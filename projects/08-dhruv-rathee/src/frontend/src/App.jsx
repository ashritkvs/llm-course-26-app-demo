import { useState } from "react";
import InputForm from "./components/InputForm.jsx";
import Narrative from "./components/Narrative.jsx";
import Timeline from "./components/Timeline.jsx";

export default function App() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  async function handleSubmit(formData) {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Only send function_name OR line range, not both
      const hasFn = !!formData.functionName;
      const hasLines = formData.startLine && formData.endLine;

      const body = {
        repo_path: formData.repoPath.trim(),
        file_path: formData.filePath.trim(),
        function_name: hasFn ? formData.functionName.trim() : undefined,
        start_line: !hasFn && hasLines ? Number(formData.startLine) : undefined,
        end_line: !hasFn && hasLines ? Number(formData.endLine) : undefined,
        github_repo_url: formData.githubUrl.trim() || undefined,
        max_commits: 60,
      };

      const resp = await fetch("/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.detail || `HTTP ${resp.status}`);
      }

      setResult(await resp.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>
          <span>Code</span>Story
        </h1>
        <p>AI-powered git archaeology — turn code history into a 30-second story.</p>
      </header>

      <InputForm onSubmit={handleSubmit} loading={loading} />

      {loading && (
        <div className="status-bar">
          <div className="spinner" />
          Analysing commits, running blame, generating narrative…
        </div>
      )}

      {error && <div className="error-box">Error: {error}</div>}

      {result && (
        <>
          <div className="meta-bar">
            {result.file_path} · lines {result.line_range[0]}–{result.line_range[1]} ·{" "}
            {result.timeline.length} commits
          </div>
          <Narrative markdown={result.narrative_markdown} />
          <Timeline commits={result.timeline} issues={result.issues} />
        </>
      )}
    </div>
  );
}
