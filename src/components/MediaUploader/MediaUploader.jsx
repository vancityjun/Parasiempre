import { useState, useEffect, useRef } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../firebase";
import Button from "../Button";
import "./MediaUploader.scss";
import { useNavigate } from "react-router";
import InputField from "../Rsvp/InputField";

const getMediaUploadMode = httpsCallable(functions, "getMediaUploadMode");
const createMediaUploadUrls = httpsCallable(functions, "createMediaUploadUrls");
const ATTENDEES_ONLY = "attendeesOnly";
const PERMISSION_MESSAGE =
  "You don't have permission to upload image. Please contact admin: vancityjun@gmail.com";

const MediaUploader = ({ onUploadSuccess }) => {
  const fileInputRef = useRef(null);
  const [filesToUpload, setFilesToUpload] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [uploaderFirstName, setUploaderFirstName] = useState("");
  const [uploaderLastName, setUploaderLastName] = useState("");
  const [uploaderEmail, setUploaderEmail] = useState("");
  const [uploadMode, setUploadMode] = useState("public");
  const [loadingUploadMode, setLoadingUploadMode] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUploadMode = async () => {
      try {
        const result = await getMediaUploadMode();
        setUploadMode(result.data.mode);
      } catch (err) {
        console.error("Failed to load media upload mode:", err);
      } finally {
        setLoadingUploadMode(false);
      }
    };

    fetchUploadMode();
  }, []);

  const handleFileChange = (event) => {
    const selectedFilesArray = Array.from(event.target.files);

    if (selectedFilesArray.length === 0) {
      if (event.target) event.target.value = null;
      return;
    }

    const uniqueNewFiles = selectedFilesArray.filter(
      (newFile) =>
        !filesToUpload.some(
          (existingFile) => existingFile.name === newFile.name,
        ),
    );

    if (uniqueNewFiles.length > 0) {
      const newFilesWithPreviews = uniqueNewFiles.map((file) =>
        Object.assign(file, {
          preview: URL.createObjectURL(file),
        }),
      );
      setFilesToUpload((currentFilesToUpload) =>
        currentFilesToUpload.concat(newFilesWithPreviews),
      );
    }
    setError(null);

    if (event.target) {
      event.target.value = null;
    }
  };

  useEffect(() => {
    return () =>
      filesToUpload.forEach((file) => {
        if (file.preview && file.preview.startsWith("blob:")) {
          URL.revokeObjectURL(file.preview);
        }
      });
  }, [filesToUpload]);

  const handleUpload = async () => {
    if (filesToUpload.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const uploadUrlResult = await createMediaUploadUrls({
        email: uploaderEmail,
        uploaderFirstName,
        uploaderLastName,
        files: filesToUpload.map((file) => ({
          name: file.name,
          type: file.type,
        })),
      });

      const uploadPromises = uploadUrlResult.data.uploads.map(
        async ({ uploadUrl, headers }, index) => {
          const response = await fetch(uploadUrl, {
            method: "PUT",
            headers,
            body: filesToUpload[index],
          });

          if (!response.ok) {
            throw new Error(`Failed to upload ${filesToUpload[index].name}`);
          }
        },
      );

      await Promise.all(uploadPromises);
      setFilesToUpload([]);
      if (onUploadSuccess) {
        onUploadSuccess();
      }
      setUploaderFirstName("");
      setUploaderLastName("");
      setUploaderEmail("");
      navigate("/");
    } catch (err) {
      if (err.code === "functions/permission-denied") {
        setError(PERMISSION_MESSAGE);
      } else {
        setError("Failed to upload photos: " + err.message);
      }
    } finally {
      setUploading(false);
    }
  };

  const removeFile = (fileName) => {
    setFilesToUpload((prevFiles) => {
      const fileToRemove = prevFiles.find((file) => file.name === fileName);
      if (
        fileToRemove &&
        fileToRemove.preview &&
        fileToRemove.preview.startsWith("blob:")
      ) {
        URL.revokeObjectURL(fileToRemove.preview);
      }
      return prevFiles.filter((file) => file.name !== fileName);
    });
  };

  return (
    <div className="photos-page-container">
      <Button
        onClick={() => navigate("/")}
        className="back-to-home-btn"
        title="&larr; Back to Gallery"
      />
      <h1>Share Your Moments</h1>
      <p className="page-description">
        Upload your favorite photos and videos from our time together!
      </p>
      <div className="media-uploader">
        <div className="file-input-container">
          <input
            type="file"
            ref={fileInputRef}
            multiple
            onChange={handleFileChange}
            accept="image/jpeg, image/png, image/gif, image/webp, video/mp4, video/quicktime, video/x-matroska, video/webm"
            className="hidden-file-input"
          />
          <Button
            onClick={() => fileInputRef.current && fileInputRef.current.click()}
            title={filesToUpload.length ? "Add more files" : "Select Files"}
          />
        </div>
        {filesToUpload.length > 0 && (
          <div className="previews">
            <div className="preview-grid">
              {filesToUpload.map((file) => (
                <div key={file.name} className="preview-item">
                  {file.preview && file.type.startsWith("image/") ? (
                    <img src={file.preview} alt={`Preview of ${file.name}`} />
                  ) : file.preview && file.type.startsWith("video/") ? (
                    <video
                      src={file.preview}
                      autoPlay
                      muted
                      loop
                      playsInline
                      alt={`Preview of ${file.name}`}
                    />
                  ) : (
                    <div className="file-icon-placeholder">
                      {file.type.startsWith("video/") ? "🎬" : "📄"}
                    </div>
                  )}
                  <span className="file-name">{file.name}</span>
                  <button
                    type="button"
                    className="remove-file-btn"
                    onClick={() => removeFile(file.name)}
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <p className="form-note">
        Help us know who shared these lovely memories!
      </p>
      <div className="uploader-info-form">
        {uploadMode === ATTENDEES_ONLY && (
          <InputField
            type="email"
            title="Your Email"
            val={uploaderEmail}
            setVal={setUploaderEmail}
            isRequired
          />
        )}
        <InputField
          type="text"
          title="Your First Name (Optional)"
          val={uploaderFirstName}
          setVal={setUploaderFirstName}
        />
        <InputField
          type="text"
          title="Your Last Name (Optional)"
          val={uploaderLastName}
          setVal={setUploaderLastName}
        />
      </div>
      <Button
        onClick={handleUpload}
        disabled={
          filesToUpload.length === 0 ||
          uploading ||
          loadingUploadMode ||
          (uploadMode === ATTENDEES_ONLY && !uploaderEmail.trim())
        }
        title={uploading ? "Uploading..." : "Upload Photos"}
      />
      {error && <p className="error-message">{error}</p>}
    </div>
  );
};

export default MediaUploader;
