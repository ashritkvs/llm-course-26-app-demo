import { useState } from "react";

const PLACEHOLDER = {
  repoPath: "/Users/you/projects/my-repo",
  filePath: "src/utils.py",
  functionName: "calculate_total",
  githubUrl: "https://github.com/owner/repo",
};

export default function InputForm({ onSubmit, loading }) {
  const [form, setForm] = useState({
    repoPath: "",
    filePath: "",
    functionName: "",
    startLine: "",
    endLine: "",
    githubUrl: "",
  });

  function set(field) {
    return (e) => {
      const val = e.target.value;
      setForm((f) => {
        const next = { ...f, [field]: val };
        // Enforce "one or the other" — clear line range when typing function name, and vice versa
        if (field === "functionName" && val) {
          next.startLine = "";
          next.endLine = "";
        }
        if ((field === "startLine" || field === "endLine") && val) {
          next.functionName = "";
        }
        return next;
      });
    };
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.repoPath || !form.filePath) return;
    onSubmit(form);
  }

  return (
    <div className="card">
      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          {/* Repo path */}
          <div className="form-group full-width">
            <label htmlFor="repoPath">Repo path (local)</label>
            <input
              id="repoPath"
              type="text"
              value={form.repoPath}
              onChange={set("repoPath")}
              placeholder={PLACEHOLDER.repoPath}
              required
            />
          </div>

          {/* File path */}
          <div className="form-group full-width">
            <label htmlFor="filePath">File path (relative to repo root)</label>
            <input
              id="filePath"
              type="text"
              value={form.filePath}
              onChange={set("filePath")}
              placeholder={PLACEHOLDER.filePath}
              required
            />
          </div>

          <div className="divider">— choose one: function name OR line range —</div>

          {/* Function name */}
          <div className="form-group">
            <label htmlFor="functionName">Function / method name</label>
            <input
              id="functionName"
              type="text"
              value={form.functionName}
              onChange={set("functionName")}
              placeholder={PLACEHOLDER.functionName}
            />
          </div>

          {/* Line range */}
          <div className="form-group" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
            <div>
              <label htmlFor="startLine">Start line</label>
              <input
                id="startLine"
                type="number"
                value={form.startLine}
                onChange={set("startLine")}
                placeholder="1"
                min={1}
              />
            </div>
            <div>
              <label htmlFor="endLine">End line</label>
              <input
                id="endLine"
                type="number"
                value={form.endLine}
                onChange={set("endLine")}
                placeholder="50"
                min={1}
              />
            </div>
          </div>

          {/* GitHub URL (optional) */}
          <div className="form-group full-width">
            <label htmlFor="githubUrl">GitHub repo URL (optional – for issue lookup)</label>
            <input
              id="githubUrl"
              type="text"
              value={form.githubUrl}
              onChange={set("githubUrl")}
              placeholder={PLACEHOLDER.githubUrl}
            />
          </div>
        </div>

        <button className="btn-run" type="submit" disabled={loading}>
          {loading ? "Running…" : "▶ Run CodeStory"}
        </button>
      </form>
    </div>
  );
}
