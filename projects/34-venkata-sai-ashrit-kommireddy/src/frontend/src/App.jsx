import { useMemo, useState } from "react";

import {
  analyzeDataset,
  downloadCleanedDataset,
  fillMissing,
  removeDuplicates,
  uploadDataset,
} from "./api";

const ACCEPTED_TYPES = ".csv,.xlsx,.xls,.json";

function formatIssueList(analysis) {
  if (!analysis) {
    return [];
  }

  const issues = [];
  const missing = analysis.missing_values_percentage || {};
  for (const [column, value] of Object.entries(missing)) {
    if (typeof value === "number" && value > 0) {
      issues.push(`${column}: ${value}% missing values`);
    }
  }

  const duplicates = analysis.duplicate_row_count || 0;
  if (duplicates > 0) {
    issues.push(`${duplicates} duplicate rows detected`);
  }

  const correlated = analysis.high_correlation_pairs || [];
  correlated.forEach((pair) => {
    issues.push(
      `High correlation: ${pair.column_1} vs ${pair.column_2} (${pair.correlation})`
    );
  });

  const imbalance = analysis.dataset_health?.penalties?.class_imbalance;
  if (imbalance?.is_severe) {
    issues.push(
      `Class imbalance in ${imbalance.label_column} (${imbalance.majority_ratio_percentage}% majority class)`
    );
  }

  return issues.slice(0, 12);
}

export default function App() {
  const [file, setFile] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [analysisData, setAnalysisData] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [fillStrategy, setFillStrategy] = useState("mean");
  const [cleaningSummary, setCleaningSummary] = useState("");
  const [removeDuplicatesOption, setRemoveDuplicatesOption] = useState(true);
  const [fillMissingOption, setFillMissingOption] = useState(true);
  const [error, setError] = useState("");

  const issues = useMemo(() => formatIssueList(analysisData), [analysisData]);
  const healthScore = analysisData?.dataset_health?.final_score;

  async function onUpload() {
    if (!file) {
      setError("Please select a file first.");
      return;
    }
    setError("");
    setAnalysisData(null);
    setIsUploading(true);

    try {
      const result = await uploadDataset(file);
      setPreviewData(result);
      setCleaningSummary("");
    } catch (uploadError) {
      const message =
        uploadError?.response?.data?.detail || "Failed to upload and preview dataset.";
      setError(message);
    } finally {
      setIsUploading(false);
    }
  }

  async function onAnalyze() {
    if (!file) {
      setError("Please select a file first.");
      return;
    }
    setError("");
    setIsAnalyzing(true);

    try {
      const result = await analyzeDataset(file);
      setAnalysisData(result);
    } catch (analyzeError) {
      const message =
        analyzeError?.response?.data?.detail || "Failed to analyze dataset.";
      setError(message);
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function onRemoveDuplicates() {
    if (!file) {
      setError("Please select a file first.");
      return;
    }
    setError("");
    setIsCleaning(true);
    try {
      const result = await removeDuplicates(file);
      setPreviewData(result.summary);
      setCleaningSummary(`Removed ${result.removed_duplicates} duplicate rows.`);
    } catch (cleanError) {
      const message = cleanError?.response?.data?.detail || "Failed to remove duplicates.";
      setError(message);
    } finally {
      setIsCleaning(false);
    }
  }

  async function onFillMissing() {
    if (!file) {
      setError("Please select a file first.");
      return;
    }
    setError("");
    setIsCleaning(true);
    try {
      const result = await fillMissing(file, fillStrategy);
      setPreviewData(result.summary);
      setCleaningSummary(
        `Filled ${result.filled_cells} missing numeric values using ${result.strategy}.`
      );
    } catch (cleanError) {
      const message =
        cleanError?.response?.data?.detail || "Failed to fill missing values.";
      setError(message);
    } finally {
      setIsCleaning(false);
    }
  }

  async function onDownloadCleaned() {
    if (!file) {
      setError("Please select a file first.");
      return;
    }
    setError("");
    setIsCleaning(true);
    try {
      const blob = await downloadCleanedDataset(file, {
        removeDuplicatesOption,
        fillMissingOption,
        strategy: fillStrategy,
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "cleaned_dataset.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (cleanError) {
      const message =
        cleanError?.response?.data?.detail || "Failed to download cleaned dataset.";
      setError(message);
    } finally {
      setIsCleaning(false);
    }
  }

  return (
    <main className="container">
      <h1>ModelScope Lite</h1>
      <p className="subtitle">Upload a dataset and run analysis.</p>

      <section className="card">
        <label htmlFor="dataset-file">Dataset file</label>
        <input
          id="dataset-file"
          type="file"
          accept={ACCEPTED_TYPES}
          onChange={(event) => setFile(event.target.files?.[0] || null)}
        />
        <div className="actions">
          <button type="button" onClick={onUpload} disabled={isUploading || !file}>
            {isUploading ? "Uploading..." : "Upload and Preview"}
          </button>
          <button type="button" onClick={onAnalyze} disabled={isAnalyzing || !file}>
            {isAnalyzing ? "Analyzing..." : "Analyze Dataset"}
          </button>
        </div>
        <div className="cleaning-controls">
          <button type="button" onClick={onRemoveDuplicates} disabled={isCleaning || !file}>
            {isCleaning ? "Working..." : "Remove Duplicates"}
          </button>
          <div className="fill-controls">
            <select
              value={fillStrategy}
              onChange={(event) => setFillStrategy(event.target.value)}
              disabled={isCleaning}
            >
              <option value="mean">mean</option>
              <option value="median">median</option>
            </select>
            <button type="button" onClick={onFillMissing} disabled={isCleaning || !file}>
              {isCleaning ? "Working..." : "Fill Missing Values"}
            </button>
          </div>
        </div>
        <div className="download-controls">
          <label>
            <input
              type="checkbox"
              checked={removeDuplicatesOption}
              onChange={(event) => setRemoveDuplicatesOption(event.target.checked)}
            />
            Remove duplicates
          </label>
          <label>
            <input
              type="checkbox"
              checked={fillMissingOption}
              onChange={(event) => setFillMissingOption(event.target.checked)}
            />
            Fill missing
          </label>
          <button type="button" onClick={onDownloadCleaned} disabled={isCleaning || !file}>
            {isCleaning ? "Preparing..." : "Download Cleaned Dataset"}
          </button>
        </div>
        {file ? <p className="filename">Selected: {file.name}</p> : null}
        {cleaningSummary ? <p className="filename">{cleaningSummary}</p> : null}
        {error ? <p className="error">{error}</p> : null}
      </section>

      {previewData ? (
        <section className="card">
          <h2>Dataset Preview</h2>
          <p>
            Shape: {previewData.shape?.rows} rows x {previewData.shape?.columns} columns
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {(previewData.columns || []).map((column) => (
                    <th key={column}>{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(previewData.preview || []).map((row, index) => (
                  <tr key={`row-${index}`}>
                    {(previewData.columns || []).map((column) => (
                      <td key={`${index}-${column}`}>{String(row[column] ?? "")}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {analysisData ? (
        <section className="card">
          <h2>Analysis Results</h2>
          <div className="result-grid">
            <div className="score-card">
              <p className="score-label">Health Score</p>
              <div className="score">{healthScore ?? "N/A"}</div>
            </div>

            <div className="issues-card">
              <h3>Issues</h3>
              {issues.length ? (
                <ul className="issues-list">
                  {issues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              ) : (
                <p>No major issues detected.</p>
              )}
            </div>
          </div>

          <div className="report-card">
            <h3>AI-generated Report</h3>
            <pre className="report">{analysisData.ai_report || "No AI report available."}</pre>
            {analysisData.ai_report_error ? (
              <p className="error">AI report error: {analysisData.ai_report_error}</p>
            ) : null}
          </div>
        </section>
      ) : null}
    </main>
  );
}
