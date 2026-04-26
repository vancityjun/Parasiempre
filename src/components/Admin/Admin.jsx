import { useMemo, useState } from "react";
import { getDocs, collection, query, orderBy } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import useSWR from "swr";
import { db, functions } from "../../firebase";
import { useAuth } from "../../contexts/AuthContext";
import AdminHeader from "./AdminHeader";
import AttendanceSnapshot from "./AttendanceSnapshot";
import GuestTable from "./GuestTable";
import MediaSettingsPanel from "./MediaSettingsPanel";
import OverviewStats from "./OverviewStats";
import "./Admin.scss";

const PUBLIC_UPLOAD = "public";
const ATTENDEES_ONLY_UPLOAD = "attendeesOnly";
const NATIVE_SAVE_BLOCKED = "blocked";
const NATIVE_SAVE_ALLOWED = "allowed";

const sendEmail = httpsCallable(functions, "sendConfirmationEmail");
const toggleShowUp = httpsCallable(functions, "toggleShowUp");
const sendAfterEmail = httpsCallable(functions, "sendAfterEmail");
const getMediaSettings = httpsCallable(functions, "getMediaSettings");
const setMediaUploadMode = httpsCallable(functions, "setMediaUploadMode");
const setNativeSaveMode = httpsCallable(functions, "setNativeSaveMode");

const fetchRsvps = async (path) => {
  const rsvpCollection = collection(db, path);
  const ref = query(rsvpCollection, orderBy("timestamp", "desc"));
  const snapshot = await getDocs(ref);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

const fetchMediaSettings = async () => {
  const result = await getMediaSettings();
  return result.data;
};

const getGuestSummary = (guests) =>
  guests.reduce(
    (summary, guest) => ({
      totalGuests: summary.totalGuests + 1 + (guest.guestCount || 0),
      householdCount: summary.householdCount + 1,
      shownUpCount: summary.shownUpCount + (guest.shownUp ? 1 : 0),
      confirmedCount:
        summary.confirmedCount + (guest.confirmationEmailSent ? 1 : 0),
    }),
    {
      totalGuests: 0,
      householdCount: 0,
      shownUpCount: 0,
      confirmedCount: 0,
    },
  );

const Admin = () => {
  const { data, error, isLoading } = useSWR("rsvps", fetchRsvps);
  const {
    data: mediaSettings,
    error: mediaSettingsError,
    isLoading: isLoadingMediaSettings,
    mutate: mutateMediaSettings,
  } = useSWR("media-settings", fetchMediaSettings);
  const { logout } = useAuth();
  const [sendingAfterEmail, setSendingAfterEmail] = useState(false);

  const guests = useMemo(() => data || [], [data]);
  const summary = useMemo(() => getGuestSummary(guests), [guests]);
  const uploadRestricted =
    mediaSettings?.uploadMode === ATTENDEES_ONLY_UPLOAD;
  const nativeSaveBlocked =
    mediaSettings?.nativeSaveMode !== NATIVE_SAVE_ALLOWED;

  const updateMediaSettings = async (settings) => {
    await mutateMediaSettings(
      { ...(mediaSettings || {}), ...settings },
      { revalidate: false },
    );
  };

  const handleAfterEmail = async () => {
    try {
      setSendingAfterEmail(true);
      await sendAfterEmail();
    } catch (sendError) {
      console.error(sendError);
    } finally {
      setSendingAfterEmail(false);
    }
  };

  const handleUploadModeToggle = async () => {
    const uploadMode = uploadRestricted ? PUBLIC_UPLOAD : ATTENDEES_ONLY_UPLOAD;
    await setMediaUploadMode({ mode: uploadMode });
    updateMediaSettings({ uploadMode });
  };

  const handleNativeSaveToggle = async () => {
    const nativeSaveMode = nativeSaveBlocked
      ? NATIVE_SAVE_ALLOWED
      : NATIVE_SAVE_BLOCKED;
    await setNativeSaveMode({ mode: nativeSaveMode });
    updateMediaSettings({ nativeSaveMode });
  };

  const handleSendEmail = async (guest) => {
    try {
      const result = await sendEmail(guest);
      console.log(result.data.message);
    } catch (sendError) {
      console.error("Error: ", sendError.message);
    }
  };

  if (mediaSettingsError) {
    return <div>Failed to load media settings: {mediaSettingsError.message}</div>;
  }

  return (
    <div className="admin">
      <div className="admin-shell">
        <AdminHeader
          isSendingAfterEmail={sendingAfterEmail}
          onLogout={logout}
          onSendAfterEmail={handleAfterEmail}
        />

        <OverviewStats summary={summary} />

        <div className="admin-secondary-grid">
          <MediaSettingsPanel
            isLoading={isLoadingMediaSettings}
            nativeSaveBlocked={nativeSaveBlocked}
            onNativeSaveToggle={handleNativeSaveToggle}
            onUploadModeToggle={handleUploadModeToggle}
            uploadRestricted={uploadRestricted}
          />
          <AttendanceSnapshot summary={summary} />
        </div>

        <GuestTable
          error={error}
          guests={guests}
          isLoading={isLoading}
          onSendEmail={handleSendEmail}
          onToggleShowUp={toggleShowUp}
        />
      </div>
    </div>
  );
};

export default Admin;
