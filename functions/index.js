/* eslint-disable no-undef */
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onObjectFinalized } = require("firebase-functions/v2/storage");
const Mailgun = require("mailgun.js").default;
const FormData = require("form-data");
const { getStorage } = require("firebase-admin/storage");
const crypto = require("crypto");
const sharp = require("sharp");
// const { MAILGUN_API_KEY } = process.env;
const COLLECTION = "rsvps";
const MEDIA_SETTINGS_COLLECTION = "settings";
const MEDIA_SETTINGS_DOC = "media";
const MEDIA_UPLOAD_MODES = {
  PUBLIC: "public",
  ATTENDEES_ONLY: "attendeesOnly",
};
const NATIVE_SAVE_MODES = {
  BLOCKED: "blocked",
  ALLOWED: "allowed",
};
const DEFAULT_MEDIA_SETTINGS = {
  uploadMode: MEDIA_UPLOAD_MODES.PUBLIC,
  nativeSaveMode: NATIVE_SAVE_MODES.BLOCKED,
};
const MEDIA_PERMISSION_MESSAGE =
  "You don't have permission to upload image. Please contact admin: vancityjun@gmail.com";
const PHOTOS_PREFIX = "photos/";
const GENERATED_PHOTOS_PREFIX = "photos_resized/";
const IMAGE_VARIANT_WIDTHS = [480, 960, 1440];
const SIGNED_UPLOAD_TTL_MS = 10 * 60 * 1000;
const MAX_UPLOAD_URLS_PER_REQUEST = 30;
const DEFAULT_ADMIN_EMAILS = ["vancityjun@gmail.com"];
const RESPONSIVE_WIDTHS_METADATA_KEY = "responsiveWidths";

initializeApp();
const db = getFirestore();
const rsvpCollection = db.collection(COLLECTION);
const mediaSettingsDoc = db
  .collection(MEDIA_SETTINGS_COLLECTION)
  .doc(MEDIA_SETTINGS_DOC);
let localMediaSettings = { ...DEFAULT_MEDIA_SETTINGS };

const normalizeEmail = (email = "") => email.trim().toLowerCase();

const MEDIA_ADMIN_EMAILS = (
  process.env.MEDIA_ADMIN_EMAILS ||
  process.env.ADMIN_EMAILS ||
  DEFAULT_ADMIN_EMAILS.join(",")
)
  .split(",")
  .map((email) => normalizeEmail(email))
  .filter(Boolean);

const isFunctionsEmulator = () =>
  process.env.FUNCTIONS_EMULATOR === "true" ||
  Boolean(process.env.FIREBASE_EMULATOR_HUB);

const canUseLocalSettingsFallback = (error) =>
  isFunctionsEmulator() &&
  (error?.details?.includes("invalid_grant") ||
    error?.message?.includes("invalid_grant") ||
    error?.code === 2);

const getMediaSettings = async () => {
  let data = {};

  try {
    const snapshot = await mediaSettingsDoc.get();
    data = snapshot.exists ? snapshot.data() : {};
  } catch (error) {
    if (!canUseLocalSettingsFallback(error)) throw error;
    console.warn(
      "Using in-memory media settings because Firestore is unavailable in the Functions emulator.",
      error.message,
    );
    data = localMediaSettings;
  }

  const uploadMode = Object.values(MEDIA_UPLOAD_MODES).includes(data.uploadMode)
    ? data.uploadMode
    : DEFAULT_MEDIA_SETTINGS.uploadMode;
  const nativeSaveMode = Object.values(NATIVE_SAVE_MODES).includes(
    data.nativeSaveMode,
  )
    ? data.nativeSaveMode
    : DEFAULT_MEDIA_SETTINGS.nativeSaveMode;

  return { uploadMode, nativeSaveMode };
};

const saveMediaSettings = async (settings) => {
  try {
    await mediaSettingsDoc.set(settings, { merge: true });
  } catch (error) {
    if (!canUseLocalSettingsFallback(error)) throw error;
    localMediaSettings = { ...localMediaSettings, ...settings };
    console.warn(
      "Using in-memory media settings because Firestore is unavailable in the Functions emulator.",
      error.message,
    );
  }
};

const assertMediaAdmin = (request) => {
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "The function must be called while authenticated.",
    );
  }

  const normalizedAuthEmail = normalizeEmail(request.auth.token.email);
  const hasAdminClaim = request.auth.token.admin === true;
  const isAllowedAdminEmail = MEDIA_ADMIN_EMAILS.includes(normalizedAuthEmail);

  if (!hasAdminClaim && !isAllowedAdminEmail) {
    throw new HttpsError(
      "permission-denied",
      "The function must be called by an admin user.",
    );
  }
};

const validateAttendeeUploadPermission = async (email) => {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    throw new HttpsError("permission-denied", MEDIA_PERMISSION_MESSAGE);
  }

  const snapshot = await rsvpCollection.get();
  const attendee = snapshot.docs
    .map((doc) => doc.data())
    .find((data) => normalizeEmail(data.email) === normalizedEmail);

  if (!attendee || attendee.shownUp !== true) {
    throw new HttpsError("permission-denied", MEDIA_PERMISSION_MESSAGE);
  }

  return normalizedEmail;
};

const getSafeFileName = (fileName = "media") => {
  const sanitized = fileName
    .replace(/[/\\]/g, "-")
    .replace(/[^a-zA-Z0-9._ -]/g, "")
    .trim();
  return sanitized || "media";
};

const isVideoFileName = (fileName = "") => {
  const videoExtensions = [".mp4", ".mov", ".webm", ".quicktime", ".mkv"];
  return videoExtensions.some((ext) => fileName.toLowerCase().endsWith(ext));
};

const isOriginalPhotoPath = (fileName = "") =>
  fileName.startsWith(PHOTOS_PREFIX) &&
  fileName !== PHOTOS_PREFIX &&
  !fileName.endsWith("/");

const isSupportedImage = (contentType = "", fileName = "") => {
  if (contentType === "image/gif") return false;
  if (contentType.startsWith("image/")) return true;

  return [".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff", ".heic"].some(
    (ext) => fileName.toLowerCase().endsWith(ext),
  );
};

const getDerivativeFolder = (fullName) =>
  `${GENERATED_PHOTOS_PREFIX}${encodeURIComponent(fullName)}/`;

const getDerivativePath = (fullName, width) =>
  `${getDerivativeFolder(fullName)}${width}.webp`;

const getPublicReadUrl = (file) =>
  `https://firebasestorage.googleapis.com/v0/b/${file.bucket.name}/o/${encodeURIComponent(file.name)}?alt=media`;

const parseResponsiveWidths = (value = "") =>
  [...new Set(String(value).split(",").map((item) => Number(item.trim())))]
    .filter((width) => Number.isInteger(width) && width > 0)
    .sort((left, right) => left - right);

const getResponsiveWidthsFromMetadata = (metadata = {}) =>
  parseResponsiveWidths(metadata?.[RESPONSIVE_WIDTHS_METADATA_KEY]);

const getDerivativeWidthFromPath = (fileName = "") => {
  const match = fileName.match(/\/(\d+)\.webp$/i);
  return match ? Number(match[1]) : null;
};

const saveResponsiveWidthsMetadata = async (
  originalFile,
  existingMetadata,
  responsiveWidths,
) => {
  const nextWidths = parseResponsiveWidths(responsiveWidths.join(","));
  const currentWidths = getResponsiveWidthsFromMetadata(existingMetadata?.metadata);

  if (
    nextWidths.length === currentWidths.length &&
    nextWidths.every((width, index) => width === currentWidths[index])
  ) {
    return;
  }

  await originalFile.setMetadata({
    metadata: {
      ...(existingMetadata?.metadata || {}),
      [RESPONSIVE_WIDTHS_METADATA_KEY]: nextWidths.join(","),
    },
  });
};

const getTargetWidths = (originalWidth) => {
  if (!Number.isFinite(originalWidth) || originalWidth <= 0) {
    return [...IMAGE_VARIANT_WIDTHS];
  }

  const matchingWidths = IMAGE_VARIANT_WIDTHS.filter(
    (width) => width <= originalWidth,
  );

  return matchingWidths.length > 0 ? matchingWidths : [Math.round(originalWidth)];
};

const generateImageVariants = async (
  bucket,
  originalFile,
  contentType,
  existingMetadata = null,
) => {
  const fullName = originalFile.name;
  if (
    !isOriginalPhotoPath(fullName) ||
    isVideoFileName(fullName) ||
    !isSupportedImage(contentType, fullName)
  ) {
    return { skipped: true, generated: [] };
  }

  const metadataSnapshot =
    existingMetadata || (await originalFile.getMetadata())[0];
  const existingWidths = getResponsiveWidthsFromMetadata(
    metadataSnapshot?.metadata,
  );
  if (existingWidths.length > 0) {
    return { skipped: true, generated: [] };
  }

  const [sourceBuffer] = await originalFile.download();
  const metadata = await sharp(sourceBuffer).metadata();
  const targetWidths = getTargetWidths(metadata.width);
  const basePipeline = sharp(sourceBuffer).rotate();

  await Promise.all(
    targetWidths.map(async (width) => {
      const derivativeFile = bucket.file(getDerivativePath(fullName, width));
      const outputBuffer = await basePipeline
        .clone()
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: 78 })
        .toBuffer();

      await derivativeFile.save(outputBuffer, {
        metadata: {
          contentType: "image/webp",
          cacheControl: "public, max-age=31536000, immutable",
          metadata: {
            originalFullName: fullName,
            generatedWidth: String(width),
          },
        },
        resumable: false,
      });
    }),
  );

  await saveResponsiveWidthsMetadata(
    originalFile,
    metadataSnapshot,
    targetWidths,
  );

  return { skipped: false, generated: targetWidths };
};

const getResponsiveWidths = async (bucket, file) => {
  if (file.metadata?.metadata) {
    const widths = getResponsiveWidthsFromMetadata(file.metadata.metadata);
    if (widths.length > 0) return widths;
  }

  try {
    const [metadata] = await file.getMetadata();
    const widths = getResponsiveWidthsFromMetadata(metadata.metadata);
    if (widths.length > 0) return widths;
  } catch (error) {
    console.warn("Unable to read responsive width metadata", {
      fullName: file.name,
      message: error.message,
    });
  }

  const [derivativeFiles] = await bucket.getFiles({
    prefix: getDerivativeFolder(file.name),
    autoPaginate: true,
  });

  return derivativeFiles
    .map((derivativeFile) => getDerivativeWidthFromPath(derivativeFile.name))
    .filter((width) => Number.isInteger(width))
    .sort((left, right) => left - right);
};

const getResponsiveImageUrls = async (bucket, file) => {
  const responsiveWidths = await getResponsiveWidths(bucket, file);
  if (responsiveWidths.length === 0) {
    return { thumbnailUrl: null, srcSet: "" };
  }

  const variants = responsiveWidths.map((width) => {
    const derivativeFile = bucket.file(getDerivativePath(file.name, width));
    return {
      width,
      url: getPublicReadUrl(derivativeFile),
    };
  });

  return {
    thumbnailUrl: variants[0].url,
    srcSet: variants
      .map(({ url, width }) => `${url} ${width}w`)
      .join(", "),
  };
};

exports.addRSVP = onCall(async (request) => {
  const { id, ...data } = request.data;

  try {
    if (id) {
      await rsvpCollection.doc(id).update({ ...data, lastUpdated: new Date() });
      return { message: "RSVP updated successfully", id };
    }

    // Check for duplicate email
    const querySnapshot = await rsvpCollection.where("email", "==", data.email).get();
    if (!querySnapshot.empty) {
      throw new HttpsError("already-exists", "Email already exists");
    }

    // Add new RSVP
    const docRef = await rsvpCollection.add({ ...data, timestamp: new Date() });
    return { message: "RSVP added successfully", id: docRef.id };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "Error processing RSVP", error.message);
  }
});

async function sendEmail(
  guestData,
  docId,
  subject,
  body,
  emailType = "rsvpConfirmation",
  update,
) {
  const mailgun = new Mailgun(FormData);
  if (!MAILGUN_API_KEY) {
    throw new HttpsError("internal", "API key is not defined");
  }
  const mg = mailgun.client({
    username: "api",
    key: MAILGUN_API_KEY,
  });

  const { email, firstName, lastName = "", questionnaireAnswers } = guestData;

  let htmlContent = "";

  const styles = `
    <style>
      body { font-family: sans-serif; color: #333; }
      .container { padding: 20px; border: 1px solid #eee; max-width: 600px; margin: 20px auto; }
      h1 { color: #d49a9a; font-size: 1.8rem; }
      h3 { font-size: 1.2rem; color: #555; }
      p { font-size: 15px; line-height: 1.6; }
      a { color: #d49a9a; text-decoration: none; }
      a:hover { text-decoration: underline; }
      .info-block { margin-top: 15px; padding-top: 15px; border-top: 1px solid #f0f0f0; }
    </style>
  `;

  if (emailType === "rsvpConfirmation" || emailType === "reminder") {
    htmlContent = `
      <html>
        <head>${styles}</head>
        <body>
          <div class="container">
            <h1>${emailType === "reminder" ? "Friendly Reminder!" : `Thank You for Your RSVP, ${firstName}!`}</h1>
            <p>Hi ${firstName} ${lastName || ""},</p>
            <p>${body}</p>
            <div class="info-block">
              <h3>Event Details:</h3>
              <p><strong>When:</strong> May 11th, Sunday at 2:00 PM</p>
              <p><strong>Where:</strong> 9850 64th St W, University Place, WA 98467, United States</p>
            </div>
            ${
              emailType === "rsvpConfirmation" && questionnaireAnswers
                ? `
            <div class="info-block">
              <p><b>Your RSVP Information:</b></p>
              <p>First name: ${firstName}</p>
              <p>Last name: ${lastName || "N/A"}</p>
              ${Object.entries(questionnaireAnswers || {})
                .map(([key, answer]) => {
                  const qInfo = require("./questionnaireFlow.json")[key];
                  return qInfo
                    ? `<p><strong>${qInfo.question}:</strong> ${answer}</p>`
                    : "";
                })
                .filter((line) => line)
                .join("\n    ")}
              <p>Need to make changes? Please contact Jun & Leslie directly.</p>
            </div>
            `
                : ""
            }
            <p>More information at <a href="https://www.para-siempre.love">para-siempre.love</a></p>
            <p>Warmly,</p>
            <p>Jun ❤️ Leslie</p>
          </div>
        </body>
      </html>`;
  } else if (emailType === "afterWedding") {
    htmlContent = `
      <html>
        <head>${styles}</head>
        <body>
          <div class="container">
            <h1>Thank You for Celebrating With Us, ${firstName}!</h1>
            <p>Hi ${firstName} ${lastName || ""},</p>
            <p>${body}</p>
            <p>We'd love to see all the wonderful moments you captured! Please share your photos and videos from the wedding on our website: <a href="https://www.para-siempre.love/upload">para-siempre.love/upload</a>.</p>
            <p>You can also send them directly to Jun & Leslie's families.</p>
            <p>Warmly,</p>
            <p>Jun ❤️ Leslie</p>
          </div>
        </body>
      </html>`;
  }

  try {
    const data = await mg.messages.create("para-siempre.love", {
      from: "Jun ❤️ Leslie <no-reply@para-siempre.love>",
      to: [`${firstName} ${lastName} <${email}>`],
      subject,
      html: htmlContent,
    });
    update && (await rsvpCollection.doc(docId).update(update));
    return { success: true, data };
  } catch (error) {
    throw new HttpsError("internal", "Failed to send email: " + error.message);
  }
}

async function sendReminderEmailToAll() {
  try {
    const snapshot = await rsvpCollection.get();

    if (snapshot.empty) {
      console.log("No RSVPs found to send reminders to.");
      return { message: "No RSVPs found." };
    }

    const emailPromises = snapshot.docs.map(async (doc) => {
      const guestData = doc.data(); // Get the actual data
      const body = `
      Just a friendly reminder about our wedding! We're so excited to celebrate with you soon. Our special day is just one week away!
    `;
      return sendEmail(
        guestData,
        doc.id,
        "Wedding Reminder: Jun ❤️ Leslie",
        body,
        "reminder",
        {
          reminderSent: true,
        },
      );
    });

    await Promise.all(emailPromises); // Wait for ALL email promises to settle
    console.log(`Attempted to send ${emailPromises.length} reminder emails.`);
    return {
      message: `Attempted to send ${emailPromises.length} reminder emails.`,
    };
  } catch (error) {
    console.error("Error sending reminder emails:", error);
    // Re-throw as HttpsError if you want the client to see a specific error
    if (error instanceof HttpsError) throw error;
    throw new HttpsError(
      "internal",
      "Failed to send reminder emails.",
      error.message,
    );
  }
}

async function sendAfterMailToAll() {
  try {
    const snapshot = await rsvpCollection.get();

    if (snapshot.empty) {
      console.log("No RSVPs found to send email to.");
      return { message: "No RSVPs found." };
    }

    const emailPromises = snapshot.docs.map(async (doc) => {
      const guestData = doc.data();
      if (!guestData.shownUp) {
        // Send only if they showed up
        console.log(
          `Skipping "after wedding" email for ${guestData.email} because they were marked as not shown up.`,
        );
        return;
      }
      const body = `
      Thank you so much for celebrating with us at our wedding! We hope you had a wonderful time sharing in our joy.
    `;

      return sendEmail(
        guestData,
        doc.id,
        "Thank you for joining Jun ❤️ Leslie's wedding!",
        body,
        "afterWedding",
        {
          afterEmailSent: true,
        },
      );
    });

    await Promise.all(emailPromises);
    const msg = `Attempted to send ${emailPromises.length} after emails.`;
    console.log(msg);
    return {
      message: msg,
    };
  } catch (error) {
    console.error("Error sending after emails:", error);
    // Re-throw as HttpsError if you want the client to see a specific error
    if (error instanceof HttpsError) throw error;
    throw new HttpsError(
      "internal",
      "Failed to send after emails.",
      error.message,
    );
  }
}

exports.sendReminderEmail = onCall(async () => await sendReminderEmailToAll());
exports.sendAfterEmail = onCall(async () => await sendAfterMailToAll());

exports.sendConfirmationEmail = onCall(
  async (request) =>
    await sendEmail(
      request.data,
      request.data.id,
      "Thank you for RSVP",
      "We've received your RSVP for our wedding. We're so excited to celebrate with you!",
      "rsvpConfirmation",
      { confirmationEmailSent: true },
    ),
);

exports.toggleShowUp = onCall(
  async ({ data: { shownUp, id } }) =>
    await rsvpCollection.doc(id).update({ shownUp }),
);

exports.getMediaUploadMode = onCall(async () => {
  const { uploadMode } = await getMediaSettings();
  return { mode: uploadMode };
});

exports.getMediaSettings = onCall(async () => await getMediaSettings());

exports.setMediaUploadMode = onCall(async (request) => {
  assertMediaAdmin(request);

  const { mode } = request.data || {};
  if (!Object.values(MEDIA_UPLOAD_MODES).includes(mode)) {
    throw new HttpsError("invalid-argument", "Invalid media upload mode.");
  }

  await saveMediaSettings({ uploadMode: mode });
  return { mode };
});

exports.setNativeSaveMode = onCall(async (request) => {
  assertMediaAdmin(request);

  const { mode } = request.data || {};
  if (!Object.values(NATIVE_SAVE_MODES).includes(mode)) {
    throw new HttpsError("invalid-argument", "Invalid native save mode.");
  }

  await saveMediaSettings({ nativeSaveMode: mode });
  return { mode };
});

exports.createMediaUploadUrls = onCall(async (request) => {
  const data = request.data || {};
  const files = Array.isArray(data.files) ? data.files : [];
  if (files.length === 0 || files.length > MAX_UPLOAD_URLS_PER_REQUEST) {
    throw new HttpsError("invalid-argument", "Invalid upload file list.");
  }

  const settings = await getMediaSettings();
  const normalizedEmail =
    settings.uploadMode === MEDIA_UPLOAD_MODES.ATTENDEES_ONLY
      ? await validateAttendeeUploadPermission(data.email)
      : normalizeEmail(data.email);

  const bucket = getStorage().bucket();
  const uploads = await Promise.all(
    files.map(async ({ name, type }) => {
      const safeName = getSafeFileName(name);
      const contentType =
        typeof type === "string" && type.trim()
          ? type.trim()
          : "application/octet-stream";
      const fullName = `${PHOTOS_PREFIX}${Date.now()}-${crypto.randomUUID()}-${
        safeName
      }`;
      const file = bucket.file(fullName);
      const headers = { "Content-Type": contentType };
      const extensionHeaders = normalizedEmail
        ? { "x-goog-meta-uploader-email": normalizedEmail }
        : undefined;

      const [uploadUrl] = await file.getSignedUrl({
        action: "write",
        expires: Date.now() + SIGNED_UPLOAD_TTL_MS,
        contentType,
        extensionHeaders,
      });

      return {
        name,
        fullName,
        uploadUrl,
        headers: extensionHeaders
          ? { ...headers, ...extensionHeaders }
          : headers,
      };
    }),
  );

  return { mode: settings.uploadMode, uploads };
});

// Trigger for new RSVP creation
exports.sendConfirmationEmailOnCreate = onDocumentCreated(
  `${COLLECTION}/{id}`,
  async (event) => {
    const guestData = event.data.data();
    const docId = event.data.id;
    if (guestData.confirmationEmailSent) {
      console.log(`confirmation email already sent ${guestData.email}`);
      return;
    }
    return sendEmail(
      guestData,
      docId,
      "Thank you for RSVP",
      "We've received your RSVP for our wedding. We're so excited to celebrate with you!",
      "rsvpConfirmation",
      { confirmationEmailSent: true },
    );
  },
);

// Trigger for RSVP updates
// module.exports.sendConfirmationEmailOnUpdate = onDocumentUpdated(
//   "rsvps/{id}",
//   async (event) => {
//     const guestData = event.data.after.data();
//     const docId = event.data.after.id;
//     return sendEmail(guestData, docId);
//   },
// );

exports.listMediaPaginated = onCall(async (request) => {
  const bucket = getStorage().bucket();
  const pageSize =
    request.data.pageSize &&
    Number.isInteger(request.data.pageSize) &&
    request.data.pageSize > 0
      ? request.data.pageSize
      : 9;
  const pageToken = request.data.pageToken || undefined;
  try {
    const [files, nextQuery] = await bucket.getFiles({
      prefix: PHOTOS_PREFIX,
      maxResults: pageSize,
      pageToken: pageToken,
      autoPaginate: false,
    });

    const itemsWithUrls = await Promise.all(
      files
        .filter((file) => isOriginalPhotoPath(file.name))
        .map(async (file) => {
          const url = getPublicReadUrl(file);
          const displayName = file.name.substring(PHOTOS_PREFIX.length);
          const responsiveUrls =
            isVideoFileName(file.name)
              ? { thumbnailUrl: null, srcSet: "" }
              : await getResponsiveImageUrls(bucket, file);
          return {
            name: displayName,
            url,
            fullName: file.name,
            thumbnailUrl: responsiveUrls.thumbnailUrl,
            srcSet: responsiveUrls.srcSet,
          };
        }),
    );

    return {
      mediaItems: itemsWithUrls,
      nextPageToken:
        nextQuery && nextQuery.pageToken ? nextQuery.pageToken : null,
    };
  } catch (error) {
    console.error("Error listing files in Firebase Function:", error);
    throw new HttpsError(
      "internal",
      "Failed to list media files. Please try again later.",
      error.message,
    );
  }
});

exports.deleteMediaItem = onCall(async (request) => {
  // Check if the user is authenticated (Firebase automatically does this for onCall)
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "The function must be called while authenticated.",
    );
  }

  const { fullName } = request.data; // e.g., "photos/my-image.jpg"
  if (!fullName || typeof fullName !== "string") {
    throw new HttpsError(
      "invalid-argument",
      "The function must be called with a 'fullName' (string) argument representing the full path to the file.",
    );
  }

  console.log(
    `Attempting to delete media item: ${fullName} by user: ${request.auth.uid}`,
  );

  try {
    const bucket = getStorage().bucket();
    const file = bucket.file(fullName);
    const [derivativeFiles] = await bucket.getFiles({
      prefix: getDerivativeFolder(fullName),
    });

    await Promise.all([
      file.delete(),
      ...derivativeFiles.map((derivativeFile) => derivativeFile.delete()),
    ]);
    console.log(`Successfully deleted ${fullName}`);
    return { success: true, message: `Successfully deleted ${fullName}` };
  } catch (error) {
    console.error(`Failed to delete ${fullName}:`, error);
    throw new HttpsError(
      "internal",
      "Failed to delete media item.",
      error.message,
    );
  }
});

exports.generateMediaImageVariants = onObjectFinalized(
  {
    region: "us-west1",
    memory: "1GiB",
    timeoutSeconds: 300,
  },
  async (event) => {
    const object = event.data;
    const fullName = object.name;
    if (!fullName) return null;

    const bucket = getStorage().bucket(object.bucket);
    const file = bucket.file(fullName);
    const result = await generateImageVariants(
      bucket,
      file,
      object.contentType || "",
      object,
    );

    console.log("Image variant generation complete", {
      fullName,
      skipped: result.skipped,
      generated: result.generated,
    });
    return result;
  },
);

exports.backfillMediaImageVariants = onCall(
  {
    memory: "1GiB",
    timeoutSeconds: 540,
  },
  async (request) => {
    assertMediaAdmin(request);

    const bucket = getStorage().bucket();
    const [files] = await bucket.getFiles({
      prefix: PHOTOS_PREFIX,
      autoPaginate: true,
    });
    const photoFiles = files.filter((file) => isOriginalPhotoPath(file.name));
    const results = [];

    for (const file of photoFiles) {
      const [metadata] = await file.getMetadata();
      const result = await generateImageVariants(
        bucket,
        file,
        metadata.contentType || "",
        metadata,
      );
      results.push({ fullName: file.name, ...result });
    }

    return {
      processed: results.length,
      generated: results.reduce(
        (total, result) => total + result.generated.length,
        0,
      ),
      skipped: results.filter((result) => result.skipped).length,
    };
  },
);
