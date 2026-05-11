interface WeeklyStrategyProps {
  weeklyHint: string | null;
  onGenerate: () => void;
  disabled: boolean;
  isLoading: boolean;
  error: string | null;
}

function renderInlineMarkdown(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      const content = part.slice(2, -2).trim();
      if (!content) {
        return null;
      }
      return <strong key={`${content}-${index}`}>{content}</strong>;
    }

    return <span key={`${part}-${index}`}>{part.replace(/\*\*/g, "")}</span>;
  });
}

function formatWeeklyStrategy(weeklyHint: string) {
  return weeklyHint
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && line.replace(/\*/g, "").trim().length > 0);
}

export function WeeklyStrategy({
  weeklyHint,
  onGenerate,
  disabled,
  isLoading,
  error,
}: WeeklyStrategyProps) {
  const lines = weeklyHint ? formatWeeklyStrategy(weeklyHint) : [];

  return (
    <section className="panel panel-soft">
      <div className="section-heading">
        <p className="eyebrow">Weekly Strategy</p>
        <h2>Turn reflection into a plan</h2>
      </div>

      <button
        className="secondary-button"
        onClick={onGenerate}
        disabled={disabled || isLoading}
        type="button"
      >
        {isLoading ? "Generating..." : "Generate Weekly Strategy"}
      </button>

      {error ? <p className="inline-message error strategy-error">{error}</p> : null}

      {lines.length ? (
        <div className="strategy-text">
          {lines.map((line) => (
            <p key={line} className="strategy-line">
              {renderInlineMarkdown(line)}
            </p>
          ))}
        </div>
      ) : null}
    </section>
  );
}
