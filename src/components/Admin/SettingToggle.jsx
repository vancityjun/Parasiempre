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

export default SettingToggle;
