import PanelHeading from "./PanelHeading";

const AttendanceSnapshot = ({ summary }) => (
  <section className="admin-panel admin-panel-summary">
    <PanelHeading eyebrow="At a glance" title="Attendance snapshot" />
    <dl className="summary-list">
      <div>
        <dt>RSVPs still pending check-in</dt>
        <dd>{summary.householdCount - summary.shownUpCount}</dd>
      </div>
      <div>
        <dt>Confirmation emails still pending</dt>
        <dd>{summary.householdCount - summary.confirmedCount}</dd>
      </div>
    </dl>
  </section>
);

export default AttendanceSnapshot;
