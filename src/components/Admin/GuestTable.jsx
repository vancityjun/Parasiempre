import { useState } from "react";
import Button from "../Button";
import PanelHeading from "./PanelHeading";

const maskName = (value = "") => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return `${trimmed.charAt(0)}***`;
};

const maskEmail = (email = "") => {
  const [localPart = "", domain = ""] = email.split("@");
  if (!localPart || !domain) return email;

  if (localPart.length <= 3) {
    return `${localPart.charAt(0)}***@${domain}`;
  }

  const suffixLength = Math.min(2, Math.max(localPart.length - 1, 1));
  return `${localPart.charAt(0)}*****${localPart.slice(-suffixLength)}@${domain}`;
};

const GuestStatus = ({ shownUp }) => (
  <span className={`status-pill ${shownUp ? "is-positive" : ""}`}>
    {shownUp ? "Arrived" : "Not checked in"}
  </span>
);

const AnswersDetail = ({ answers }) => (
  <tr className="answers-detail-row">
    <td colSpan="6">
      <div className="answers-detail-card">
        <p className="answers-detail-title">RSVP answers</p>
        <ul className="answers-list">
          {answers.map(([key, answer]) => (
            <li key={key}>
              <span>{key}</span>
              <b>{answer}</b>
            </li>
          ))}
        </ul>
      </div>
    </td>
  </tr>
);

const GuestRow = ({
  canWriteAdmin,
  expanded,
  guest,
  isReadOnlyAdmin,
  onAnswerToggle,
  onSendEmail,
  onToggleShowUp,
}) => {
  const {
    id,
    firstName,
    lastName,
    email,
    guestCount,
    questionnaireAnswers,
    confirmationEmailSent,
    shownUp,
  } = guest;
  const answers = Object.entries(questionnaireAnswers || {});
  const displayFirstName = isReadOnlyAdmin ? maskName(firstName) : firstName;
  const displayLastName = isReadOnlyAdmin ? maskName(lastName) : lastName;
  const displayEmail = isReadOnlyAdmin ? maskEmail(email) : email;

  return (
    <>
      <tr>
        <td data-label="Guest">
          <div className="guest-name-cell">
            <strong>{`${displayFirstName} ${displayLastName}`.trim()}</strong>
            <GuestStatus shownUp={shownUp} />
          </div>
        </td>
        <td className="guest-email-cell" data-label="Email">
          {displayEmail}
        </td>
        <td data-label="Party size">
          <span className="count-badge">{1 + (guestCount || 0)}</span>
        </td>
        <td data-label="Answers">
          {answers.length ? (
            <Button
              className="admin-button admin-button-secondary admin-button-small"
              title={expanded ? "Hide answers" : "View answers"}
              onClick={() => onAnswerToggle(id)}
            />
          ) : (
            <span className="empty-state-text">No answers</span>
          )}
        </td>
        <td data-label="Confirmation">
          {confirmationEmailSent ? (
            <span className="status-pill is-positive">Sent</span>
          ) : (
            <Button
              className="admin-button admin-button-secondary admin-button-small"
              disabled={!canWriteAdmin}
              title="Send"
              onClick={() => onSendEmail(guest)}
            />
          )}
        </td>
        <td data-label="Arrival">
          <Button
            className={`admin-button admin-button-small ${
              shownUp ? "admin-button-secondary" : "admin-button-primary"
            }`}
            disabled={!canWriteAdmin}
            title={shownUp ? "Mark absent" : "Mark arrived"}
            onClick={() => onToggleShowUp({ id, shownUp: !shownUp })}
          />
        </td>
      </tr>
      {expanded && answers.length > 0 && <AnswersDetail answers={answers} />}
    </>
  );
};

const GuestTable = ({
  canWriteAdmin,
  error,
  guests,
  isLoading,
  isReadOnlyAdmin,
  onSendEmail,
  onToggleShowUp,
}) => {
  const [expandedGuestId, setExpandedGuestId] = useState(null);

  const toggleAnswers = (id) => {
    setExpandedGuestId((currentId) => (currentId === id ? null : id));
  };

  return (
    <section className="admin-panel guest-list-panel">
      <PanelHeading
        eyebrow="Guest list"
        title="RSVP records"
        hint={
          canWriteAdmin
            ? "Use the right side of each row for email and check-in actions."
            : "Review RSVPs in read-only mode. Email and check-in actions are disabled."
        }
      />

      {error && (
        <p className="admin-inline-error">Failed to load RSVPs: {error.message}</p>
      )}
      {isLoading ? (
        <div className="admin-loading">Loading RSVPs...</div>
      ) : (
        <div className="guest-table-wrap">
          <table className="guest-table">
            <thead>
              <tr>
                <th>Guest</th>
                <th>Email</th>
                <th>Party size</th>
                <th>Answers</th>
                <th>Email</th>
                <th>Arrival</th>
              </tr>
            </thead>
            <tbody>
              {guests.map((guest) => (
                <GuestRow
                  canWriteAdmin={canWriteAdmin}
                  expanded={expandedGuestId === guest.id}
                  guest={guest}
                  isReadOnlyAdmin={isReadOnlyAdmin}
                  key={guest.id}
                  onAnswerToggle={toggleAnswers}
                  onSendEmail={onSendEmail}
                  onToggleShowUp={onToggleShowUp}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default GuestTable;
