const STAT_ITEMS = [
  ["totalGuests", "Total guests"],
  ["householdCount", "Households"],
  ["shownUpCount", "Checked in"],
  ["confirmedCount", "Confirmation sent"],
];

const OverviewStats = ({ summary }) => (
  <div className="admin-overview-grid">
    {STAT_ITEMS.map(([key, label]) => (
      <section className="admin-panel admin-panel-stat" key={key}>
        <span className="stat-label">{label}</span>
        <strong className="stat-value">{summary[key]}</strong>
      </section>
    ))}
  </div>
);

export default OverviewStats;
