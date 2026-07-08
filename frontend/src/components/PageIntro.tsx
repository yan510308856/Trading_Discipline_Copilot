interface PageIntroProps {
  eyebrow: string;
  title: string;
  description: string;
  nextStage: string;
}

export function PageIntro({
  eyebrow,
  title,
  description,
  nextStage,
}: PageIntroProps) {
  return (
    <section className="page-card" aria-labelledby={`${eyebrow}-title`}>
      <p className="eyebrow">{eyebrow}</p>
      <h2 id={`${eyebrow}-title`}>{title}</h2>
      <p className="page-description">{description}</p>
      <div className="placeholder-panel">
        <span className="placeholder-dot" aria-hidden="true" />
        <div>
          <strong>Foundation ready</strong>
          <p>{nextStage}</p>
        </div>
      </div>
    </section>
  );
}
