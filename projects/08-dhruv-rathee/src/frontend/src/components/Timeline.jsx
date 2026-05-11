export default function Timeline({ commits = [], issues = [] }) {
  if (!commits.length) return null;

  // Build a quick lookup: issue number → URL
  const issueMap = Object.fromEntries(issues.map((i) => [i.number, i]));

  return (
    <div className="timeline-box">
      <h2>Commit Timeline ({commits.length})</h2>
      <p style={{ fontSize: "0.78rem", color: "#8b949e", marginBottom: "0.75rem" }}>
        Highlighted rows directly touched lines in the function
      </p>
      <ul className="timeline-list">
        {commits.map((c) => (
          <li
            key={c.sha}
            className="timeline-item"
            style={c.in_blame ? { background: "rgba(56,139,253,0.08)", borderLeft: "3px solid #58a6ff", paddingLeft: "0.75rem" } : {}}
          >
            <span className="sha" title={c.sha}>
              {c.short_sha}
            </span>
            <span className="ts">{c.timestamp.slice(0, 10)}</span>
            <span className="commit-msg">
              {c.short_message}
              {(c.additions > 0 || c.deletions > 0) && (
                <span style={{ marginLeft: "0.5rem", color: "#484f58", fontSize: "0.78rem" }}>
                  <span style={{ color: "#3fb950" }}>+{c.additions}</span>
                  {" "}
                  <span style={{ color: "#f85149" }}>-{c.deletions}</span>
                </span>
              )}
            </span>
            <span className="issue-tags">
              {c.issue_numbers.map((n) => {
                const issue = issueMap[n];
                return issue ? (
                  <a
                    key={n}
                    className="issue-tag"
                    href={issue.url}
                    target="_blank"
                    rel="noreferrer"
                    title={issue.title}
                  >
                    #{n}
                  </a>
                ) : (
                  <span key={n} className="issue-tag">
                    #{n}
                  </span>
                );
              })}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
