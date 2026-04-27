import PanelHeading from "./PanelHeading";
import SettingToggle from "./SettingToggle";

const MediaSettingsPanel = ({
  canWriteAdmin,
  isLoading,
  nativeSaveBlocked,
  onNativeSaveToggle,
  onUploadModeToggle,
  uploadRestricted,
}) => (
  <section className="admin-panel media-settings-panel">
    <PanelHeading
      eyebrow="Media controls"
      title="Gallery settings"
      hint="Public viewing stays on. These switches control who can upload and whether original downloads are available."
    />
    <div className="media-settings">
      <SettingToggle
        disabled={isLoading || !canWriteAdmin}
        checked={uploadRestricted}
        label="Upload permission"
        offText="Anyone"
        onText="Attendees only"
        onChange={onUploadModeToggle}
      />
      <SettingToggle
        disabled={isLoading || !canWriteAdmin}
        checked={nativeSaveBlocked}
        label="Downloads"
        offText="Allowed"
        onText="Blocked"
        onChange={onNativeSaveToggle}
      />
    </div>
  </section>
);

export default MediaSettingsPanel;
