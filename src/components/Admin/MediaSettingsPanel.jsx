import PanelHeading from "./PanelHeading";
import SettingToggle from "./SettingToggle";

const MediaSettingsPanel = ({
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
      hint="Public viewing stays on. These switches only affect who can upload and whether obvious browser save options are hidden."
    />
    <div className="media-settings">
      <SettingToggle
        disabled={isLoading}
        checked={uploadRestricted}
        label="Upload permission"
        offText="Anyone"
        onText="Attendees only"
        onChange={onUploadModeToggle}
      />
      <SettingToggle
        disabled={isLoading}
        checked={nativeSaveBlocked}
        label="Browser save"
        offText="Allowed"
        onText="Blocked"
        onChange={onNativeSaveToggle}
      />
    </div>
  </section>
);

export default MediaSettingsPanel;
