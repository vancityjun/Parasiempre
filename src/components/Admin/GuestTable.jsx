import { useState } from "react";
import Button from "../Button";
import PanelHeading from "./PanelHeading";

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
  expanded,
  guest,
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

  return (
    <>
      <tr>
        <td data-label="Guest">
          <div className="guest-name-cell">
            <strong>{`${firstName} ${lastName}`.trim()}</strong>
            <GuestStatus shownUp={shownUp} />
          </div>
        </td>
        <td className="guest-email-cell" data-label="Email">
          {email}
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
  error,
  guests,
  isLoading,
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
        hint="Use the right side of each row for email and check-in actions."
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
                  expanded={expandedGuestId === guest.id}
                  guest={guest}
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
