import { useMemo } from "react";
import { getDocs, collection, query, orderBy } from "firebase/firestore";
import { db, functions } from "../../firebase";
import useSWR from "swr";
import "./Admin.scss";
import { httpsCallable } from "firebase/functions";
import Button from "../Button";
import { useAuth } from "../../contexts/AuthContext";

const sendEmail = httpsCallable(functions, "sendConfirmationEmail");
const toggleShowUp = httpsCallable(functions, "toggleShowUp");
const sendAfterEmail = httpsCallable(functions, "sendAfterEmail");
const getMediaSettings = httpsCallable(functions, "getMediaSettings");
const setMediaUploadMode = httpsCallable(functions, "setMediaUploadMode");
const setNativeSaveMode = httpsCallable(functions, "setNativeSaveMode");
const PUBLIC_UPLOAD = "public";
const ATTENDEES_ONLY_UPLOAD = "attendeesOnly";
const NATIVE_SAVE_BLOCKED = "blocked";
const NATIVE_SAVE_ALLOWED = "allowed";

const SettingToggle = ({
  checked,
  disabled,
  label,
  offText,
  onText,
  onChange,
}) => (
  <div className={`setting-toggle ${disabled ? "disabled" : ""}`}>
    <span className="setting-toggle-label">{label}</span>
    <button
      type="button"
      className={`toggle-switch ${checked ? "on" : ""}`}
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
    >
      <span className="toggle-thumb" />
    </button>
    <span className="setting-toggle-value">{checked ? onText : offText}</span>
  </div>
);

const fetcher = async (path) => {
  const rsvpCollection = collection(db, path);
  const ref = query(rsvpCollection, orderBy("timestamp", "desc"));
  const snapshot = await getDocs(ref);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

const mediaSettingsFetcher = async () => {
  const result = await getMediaSettings();
  return result.data;
};

const Admin = () => {
  const { data, error, isLoading } = useSWR("rsvps", fetcher);
  const {
    data: mediaSettings,
    error: mediaSettingsError,
    isLoading: isLoadingMediaSettings,
    mutate: mutateMediaSettings,
  } = useSWR("media-settings", mediaSettingsFetcher);
  const { logout } = useAuth();

  const totalGuests = useMemo(() => {
    if (!data) return 0;
    return data.reduce((sum, guest) => sum + 1 + guest.guestCount, 0);
  }, [data]);

  if (mediaSettingsError) {
    return (
      <div>Failed to load media settings: {mediaSettingsError.message}</div>
    );
  }

  return (
    <div className="admin">
      <Button title="Log out" onClick={logout} />
      <p className="total">Guest total: {totalGuests}</p>
      <div className="media-settings">
        <h2>Media Settings</h2>
        <SettingToggle
          disabled={isLoadingMediaSettings}
          checked={mediaSettings?.uploadMode === ATTENDEES_ONLY_UPLOAD}
          label="Upload permission"
          offText="Anyone"
          onText="Attendees only"
          onChange={async () => {
            const nextMode =
              mediaSettings?.uploadMode === ATTENDEES_ONLY_UPLOAD
                ? PUBLIC_UPLOAD
                : ATTENDEES_ONLY_UPLOAD;
            await setMediaUploadMode({ mode: nextMode });
            mutateMediaSettings({
              ...(mediaSettings || {}),
              uploadMode: nextMode,
            });
          }}
        />
        <SettingToggle
          disabled={isLoadingMediaSettings}
          checked={mediaSettings?.nativeSaveMode !== NATIVE_SAVE_ALLOWED}
          label="Native save"
          offText="Allowed"
          onText="Blocked"
          onChange={async () => {
            const nextMode =
              mediaSettings?.nativeSaveMode === NATIVE_SAVE_ALLOWED
                ? NATIVE_SAVE_BLOCKED
                : NATIVE_SAVE_ALLOWED;
            await setNativeSaveMode({ mode: nextMode });
            mutateMediaSettings({
              ...(mediaSettings || {}),
              nativeSaveMode: nextMode,
            });
          }}
        />
      </div>
      {error && <p>Failed to load RSVPs: {error.message}</p>}
      {isLoading ? (
        <div>Loading RSVPs...</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>First name</th>
              <th>Last name</th>
              <th>Email</th>
              <th>Guest count</th>
              <th>Answers</th>
              <th>Confirmation Email Sent</th>
              <th>Shown up</th>
            </tr>
          </thead>
          <tbody>
            {(data || []).map((guestData) => {
              const {
                id,
                firstName,
                lastName,
                email,
                guestCount,
                questionnaireAnswers,
                confirmationEmailSent,
                shownUp,
              } = guestData;
              return (
                <tr key={id}>
                  <td>{firstName}</td>
                  <td>{lastName}</td>
                  <td>{email}</td>
                  <td>{guestCount}</td>
                  <td>
                    <ul>
                      {Object.entries(questionnaireAnswers).map(
                        ([key, answer]) => (
                          <li key={key}>
                            {key}: <b>{answer}</b>
                          </li>
                        ),
                      )}
                    </ul>
                  </td>
                  <td>
                    {confirmationEmailSent ? (
                      "done"
                    ) : (
                      <Button
                        title="send confirmation email"
                        onClick={async () => {
                          try {
                            const result = await sendEmail(guestData);
                            console.log(result.data.message);
                          } catch (error) {
                            console.error("Error: ", error.message);
                          }
                        }}
                      />
                    )}
                  </td>
                  <td>
                    <Button
                      title={
                        shownUp ? "Toggle not shown up" : "Toggle shown up"
                      }
                      onClick={() => toggleShowUp({ id, shownUp: !shownUp })}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <Button
        title="Send After Email"
        onClick={async () => {
          try {
            await sendAfterEmail();
          } catch (error) {
            console.error(error);
          }
        }}
      />
    </div>
  );
};

export default Admin;
