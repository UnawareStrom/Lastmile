export default function KpiCard({ icon, label, value, color = 'var(--primary)', subtitle }) {
  return (
    <div className="kpi-card">
      <div className="kpi-icon" style={{ background: `${color}22`, color }}>
        <i className={`fa-solid ${icon}`}></i>
      </div>
      <div className="kpi-info">
        <p className="kpi-label">{label}</p>
        <h3 className="kpi-value">{value}</h3>
        {subtitle && <p className="kpi-subtitle">{subtitle}</p>}
      </div>
    </div>
  );
}
