import type { DashboardPoint, DashboardSummary } from "../types";

interface DashboardProps {
  summary: DashboardSummary | null;
}

interface PieSlice {
  label: string;
  value: number;
  color: string;
}

function formatDayLabel(date: string) {
  return new Date(date).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

function describeTrend(points: DashboardPoint[]) {
  if (points.length < 2) {
    return "Too little data to describe a trend yet.";
  }

  const delta = points[points.length - 1].signedScore - points[0].signedScore;
  if (delta >= 3) {
    return "Your recent entries are trending upward, with the latest check-ins feeling more positive than the start of the week.";
  }
  if (delta <= -3) {
    return "Your recent entries are trending downward, which suggests this week has felt heavier as it went on.";
  }
  return "Your mood pattern looks fairly steady across the week, without a sharp upward or downward swing.";
}

function describeArc(cx: number, cy: number, radius: number, startAngle: number, endAngle: number) {
  const startX = cx + radius * Math.cos(startAngle);
  const startY = cy + radius * Math.sin(startAngle);
  const endX = cx + radius * Math.cos(endAngle);
  const endY = cy + radius * Math.sin(endAngle);
  const largeArcFlag = endAngle - startAngle > Math.PI ? 1 : 0;

  return [
    `M ${cx} ${cy}`,
    `L ${startX} ${startY}`,
    `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY}`,
    "Z",
  ].join(" ");
}

function MoodDistributionPie({ slices }: { slices: PieSlice[] }) {
  const cx = 90;
  const cy = 90;
  const radius = 68;
  const total = slices.reduce((sum, slice) => sum + slice.value, 0) || 1;
  let currentAngle = -Math.PI / 2;

  return (
    <div className="pie-wrap">
      <svg
        className="pie-chart"
        viewBox="0 0 180 180"
        role="img"
        aria-label="Pie chart showing the share of positive, neutral, and difficult journal days"
      >
        {slices.map((slice) => {
          const angle = (slice.value / total) * Math.PI * 2;
          const path = describeArc(cx, cy, radius, currentAngle, currentAngle + angle);
          currentAngle += angle;

          return <path key={slice.label} d={path} fill={slice.color} />;
        })}
        <circle cx={cx} cy={cy} r="34" fill="rgba(255,255,255,0.92)" />
        <text className="pie-center-label" x={cx} y={cy - 4} textAnchor="middle">
          {total}
        </text>
        <text className="pie-center-subtitle" x={cx} y={cy + 14} textAnchor="middle">
          entries
        </text>
      </svg>

      <div className="pie-legend">
        {slices.map((slice) => (
          <div key={slice.label} className="pie-legend-item">
            <span className="pie-swatch" style={{ backgroundColor: slice.color }} />
            <span>
              {slice.label}: {slice.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MoodChart({ points }: { points: DashboardPoint[] }) {
  const width = 620;
  const height = 280;
  const left = 70;
  const right = 22;
  const top = 24;
  const bottom = 60;
  const chartHeight = height - top - bottom;
  const chartWidth = width - left - right;
  const yTicks = [-10, -5, 0, 5, 10];

  const plotPoints = points.map((point, index) => {
    const x = left + (index * chartWidth) / Math.max(points.length - 1, 1);
    const y = top + ((10 - point.signedScore) * chartHeight) / 20;
    return { ...point, x, y };
  });

  const polyline = plotPoints.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <svg
      className="chart"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Mood trend chart with mood score on the vertical axis and journal dates on the horizontal axis"
    >
      {yTicks.map((tick) => {
        const y = top + ((10 - tick) * chartHeight) / 20;
        return (
          <g key={tick}>
            <line className="chart-grid" x1={left} x2={width - right} y1={y} y2={y} />
            <text className="chart-tick" x={left - 12} y={y + 4} textAnchor="end">
              {tick}
            </text>
          </g>
        );
      })}

      <line className="chart-axis" x1={left} x2={left} y1={top} y2={height - bottom} />
      <line
        className="chart-axis"
        x1={left}
        x2={width - right}
        y1={height - bottom}
        y2={height - bottom}
      />

      {plotPoints.map((point) => (
        <line
          key={`${point.date}-guide`}
          className="chart-guide"
          x1={point.x}
          x2={point.x}
          y1={top}
          y2={height - bottom}
        />
      ))}

      <polyline className="chart-line" points={polyline} />

      {plotPoints.map((point) => (
        <g key={`${point.date}-${point.x}`}>
          <circle className="chart-point" cx={point.x} cy={point.y} r="4.5" />
          <title>{`${formatDayLabel(point.date)}: ${point.emotion}, mood score ${point.signedScore}`}</title>
        </g>
      ))}

      {plotPoints.map((point) => (
        <text
          key={`${point.date}-label`}
          className="chart-date-label"
          x={point.x}
          y={height - bottom + 18}
          textAnchor="middle"
        >
          {formatDayLabel(point.date)}
        </text>
      ))}

      <text className="chart-axis-title" x={(left + width - right) / 2} y={height - 12} textAnchor="middle">
        X-axis: Journal entry date
      </text>
      <text
        className="chart-axis-title"
        transform={`translate(18 ${(top + height - bottom) / 2}) rotate(-90)`}
        textAnchor="middle"
      >
        Y-axis: Mood score (-10 to +10)
      </text>
    </svg>
  );
}

export function Dashboard({ summary }: DashboardProps) {
  if (!summary) {
    return (
      <section className="panel panel-muted">
        <div className="section-heading">
          <p className="eyebrow">Mood Dashboard</p>
          <h2>No entries yet</h2>
        </div>
        <p className="empty-copy">
          Add journal entries to unlock a weekly trend view and clearer pattern summaries.
        </p>
      </section>
    );
  }

  const points = summary.points;
  const positiveDays = points.filter((point) => point.category === "positive").length;
  const challengingDays = points.filter((point) => point.category === "negative").length;
  const neutralDays = points.filter((point) => point.category === "neutral").length;
  const latestPoint = points[points.length - 1];
  const trendSummary = describeTrend(points);
  const pieSlices: PieSlice[] = [
    { label: "Positive", value: positiveDays, color: "#d67c4a" },
    { label: "Neutral", value: neutralDays, color: "#8fa8bf" },
    { label: "Difficult", value: challengingDays, color: "#17324d" },
  ].filter((slice) => slice.value > 0);

  return (
    <section className="panel">
      <div className="section-heading">
        <p className="eyebrow">Mood Dashboard</p>
        <h2>Weekly mood trend</h2>
        <p className="empty-copy">{trendSummary}</p>
      </div>

      <MoodChart points={points} />

      <div className="dashboard-split">
        <MoodDistributionPie slices={pieSlices} />

        <div className="metric-grid">
        <article className="metric-card">
          <span>Average intensity this week</span>
          <strong>{summary.averageMood}/10</strong>
        </article>
        <article className="metric-card">
          <span>Positive vs difficult days</span>
          <strong>
            {positiveDays} / {challengingDays}
          </strong>
        </article>
        <article className="metric-card">
          <span>Most repeated trigger</span>
          <strong>{summary.topTrigger}</strong>
        </article>
        </div>
      </div>

      <div className="insight-row">
        <article className="detail-card">
          <h3>Latest check-in</h3>
          <p>
            Your most recent entry leaned <strong>{latestPoint.category}</strong> and was tagged as{" "}
            <strong>{latestPoint.emotion}</strong>.
          </p>
        </article>
        <article className="detail-card">
          <h3>Pattern to watch</h3>
          <p>
            {summary.topTrigger === "Not enough data yet"
              ? "Once you add a few more entries, recurring triggers will stand out more clearly."
              : `The trigger showing up most often this week is "${summary.topTrigger}", so that is the clearest place to focus next.`}
          </p>
        </article>
        <article className="detail-card">
          <h3>Weekly rhythm</h3>
          <p>
            Your strongest day so far has been <strong>{summary.bestDay}</strong>, while{" "}
            <strong>{summary.toughestDay}</strong> looks like the hardest stretch.
          </p>
        </article>
      </div>
    </section>
  );
}
