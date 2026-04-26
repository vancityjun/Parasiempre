import Button from "../Button";

const AdminHeader = ({ isSendingAfterEmail, onLogout, onSendAfterEmail }) => (
  <div className="admin-topbar">
    <div>
      <p className="admin-kicker">Wedding admin</p>
      <h1>Guest dashboard</h1>
      <p className="admin-subtitle">
        Review RSVPs, control gallery permissions, and send follow-up email from
        one place.
      </p>
    </div>
    <div className="admin-topbar-actions">
      <Button
        className="admin-button admin-button-secondary"
        title={isSendingAfterEmail ? "Sending..." : "Send After Email"}
        disabled={isSendingAfterEmail}
        onClick={onSendAfterEmail}
      />
      <Button
        className="admin-button admin-button-ghost"
        title="Log out"
        onClick={onLogout}
      />
    </div>
  </div>
);

export default AdminHeader;
