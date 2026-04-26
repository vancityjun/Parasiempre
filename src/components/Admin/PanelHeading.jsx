const PanelHeading = ({ eyebrow, hint, title }) => (
  <div className="panel-heading">
    <div>
      <p className="panel-eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
    </div>
    {hint && <span className="panel-hint">{hint}</span>}
  </div>
);

export default PanelHeading;
