import type { AnalysisResult } from "../types";

interface ReflectionCardProps {
  result: AnalysisResult | null;
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="bullet-list">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export function ReflectionCard({ result }: ReflectionCardProps) {
  if (!result) {
    return (
      <section className="panel panel-muted">
        <div className="section-heading">
          <p className="eyebrow">Reflection</p>
          <h2>No analysis available</h2>
        </div>
        <p className="empty-copy">Submit a journal entry to view the latest response.</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="section-heading">
        <p className="eyebrow">Your Reflection</p>
        <h2>
          {result.emotion.charAt(0).toUpperCase() + result.emotion.slice(1)} ({result.intensity}/10)
        </h2>
      </div>

      <div className="detail-grid">
        <article className="detail-card">
          <h3>Insight</h3>
          <p>{result.coreInsight}</p>
        </article>
        <article className="detail-card">
          <h3>Trigger</h3>
          <p>{result.trigger}</p>
        </article>
        <article className="detail-card">
          <h3>Thinking Patterns</h3>
          <BulletList items={result.thinkingPatterns} />
        </article>
        <article className="detail-card">
          <h3>Reframes</h3>
          <BulletList items={result.reframes} />
        </article>
        <article className="detail-card">
          <h3>Suggested Actions</h3>
          <BulletList items={result.actions} />
        </article>
        <article className="detail-card accent-card">
          <h3>Reflect Deeper</h3>
          <p>{result.reflectionQuestion}</p>
          <h3>Your Action Plan</h3>
          <p>{result.actionPlan}</p>
        </article>
      </div>
    </section>
  );
}
