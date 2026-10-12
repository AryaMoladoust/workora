import Icon from "../ui/Icon";

export default function ComingSoon({ eyebrow, title, description, icon, stage, features = [], embedded = false }) {
  return (
    <div className={embedded ? "" : "page-shell"}>
      {!embedded && <div className="page-heading">
        <div>
          <span className="page-eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <span className="soon-badge soon-badge-lg">{stage}</span>
      </div>}

      <section className="card coming-soon">
        <span className="coming-soon-icon"><Icon name={icon} size={30} /></span>
        {embedded && <span className="soon-badge soon-badge-lg">{stage}</span>}
        <h2>این بخش در حال طراحی است</h2>
        <p>امکانات زیر در مرحله‌ی مشخص‌شده با طراحی جدید ساخته می‌شود:</p>
        <ul className="coming-soon-list">
          {features.map((feature) => (
            <li key={feature}>
              <Icon name="check" size={16} strokeWidth={2.4} />
              {feature}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
