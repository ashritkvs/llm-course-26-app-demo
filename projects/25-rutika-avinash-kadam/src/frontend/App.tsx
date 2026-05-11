import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import jsPDF from "jspdf";
import "./App.css";

interface Message {
  role: "user" | "assistant";
  text: string;
}

interface HistoryEntry {
  role: "user" | "assistant";
  content: string;
}

type UploadStatus = "idle" | "uploading" | "success" | "error";

const SUMMARISE_PROMPT =
  "Please provide a clear summary of this SAS statistical output. " +
  "Cover: what model was run, key findings, which effects are significant, " +
  "and what this means in practical terms.";

function App() {
  const [showAbout, setShowAbout] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    document.body.classList.toggle("dark", darkMode);
  }, [darkMode]);

  const [dictFiles, setDictFiles] = useState<File[]>([]);
  const [dictStatus, setDictStatus] = useState<UploadStatus>("idle");

  const [sasFiles, setSasFiles] = useState<File[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationHistory, setConversationHistory] = useState<HistoryEntry[]>([]);
  const [question, setQuestion] = useState("");
  const [showInput, setShowInput] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const resetSession = async () => {
    await fetch("http://localhost:8000/reset-session", { method: "POST" });
    setDictFiles([]);
    setDictStatus("idle");
    setSasFiles([]);
    setMessages([]);
    setConversationHistory([]);
    setQuestion("");
    setShowInput(false);
  };

  const dictInputRef = useRef<HTMLInputElement>(null);
  const sasInputRef = useRef<HTMLInputElement>(null);

  const ACCEPT = ".pdf,.xlsx,.xls,.docx,.doc,image/*";

  // ── Data dictionary upload ──────────────────────────────────────────────────

  const handleDictSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setDictFiles(Array.from(files));
    setDictStatus("idle");
  };

  const uploadDictionary = async (files: File[]) => {
    setDictStatus("uploading");
    const form = new FormData();
    form.append("file", files[0]);
    try {
      const res = await fetch("http://localhost:8000/upload-datadictionary", { method: "POST", body: form });
      if (!res.ok) throw new Error();
      setDictStatus("success");
    } catch {
      setDictStatus("error");
    }
  };

  // ── SAS output upload ───────────────────────────────────────────────────────

  const handleSasSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setSasFiles(Array.from(files));
    setMessages([]);
    setConversationHistory([]);
    setShowInput(false);
    setQuestion("");
  };

  const isAllImages = (files: File[]) => files.every((f) => f.type.startsWith("image/"));

  // ── Chat helpers ────────────────────────────────────────────────────────────

  const appendMessage = (role: "user" | "assistant", text: string) =>
    setMessages((prev) => [...prev, { role, text }]);

  const buildForm = (userMessage: string) => {
    const form = new FormData();
    form.append("message", userMessage);
    form.append("history", JSON.stringify(conversationHistory));
    sasFiles.forEach((f) => form.append("files", f));
    return form;
  };

  const sendMessage = async (userMessage: string, displayText: string) => {
    setLoading(true);
    appendMessage("user", displayText);
    const form = buildForm(userMessage);
    try {
      const res = await fetch("http://localhost:8000/chat", { method: "POST", body: form });
      const data = await res.json();
      appendMessage("assistant", data.response);
      setConversationHistory((prev) => [
        ...prev,
        { role: "user", content: data.user_content },
        { role: "assistant", content: data.response },
      ]);
    } catch {
      appendMessage("assistant", "Error: could not reach the server.");
    } finally {
      setLoading(false);
    }
  };

  const callSummarise = () => sendMessage(SUMMARISE_PROMPT, "Summarise this SAS output");

  const callAsk = async () => {
    if (!sasFiles.length || !question.trim()) return;
    const q = question;
    setQuestion("");
    setShowInput(false);
    await sendMessage(q, q);
  };

  // ── Copy ────────────────────────────────────────────────────────────────────

  const copyMessage = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // ── Export PDF ──────────────────────────────────────────────────────────────

  const exportPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const maxWidth = pageWidth - margin * 2;
    let y = 20;

    const checkPage = (needed: number) => {
      if (y + needed > 280) { doc.addPage(); y = 20; }
    };

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Decoding SAS — Session Report", margin, y);
    y += 8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, y);
    y += 12;

    messages.forEach((msg) => {
      checkPage(14);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(msg.role === "user" ? "You:" : "Assistant:", margin, y);
      y += 7;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const lines = doc.splitTextToSize(msg.text, maxWidth);
      lines.forEach((line: string) => {
        checkPage(6);
        doc.text(line, margin, y);
        y += 6;
      });
      y += 6;
    });

    doc.save("decoding-sas-session.pdf");
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className={`app ${darkMode ? "dark" : ""}`}>
      <header className="header">
        <div className="header-left">
          <h1>Decoding SAS</h1>
          <p>Your AI Research Assistant simplifying raw SAS output to clear, actionable insights.</p>
        </div>
        <div className="header-actions">
          <label className="toggle-switch" title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}>
            <input type="checkbox" checked={darkMode} onChange={() => setDarkMode((prev) => !prev)} />
            <span className="toggle-slider" />
          </label>
          <button className="reset-btn" onClick={resetSession}>Reset Session</button>
          <button className="about-btn" onClick={() => setShowAbout(true)}>About</button>
        </div>
      </header>

      {showAbout && (
        <div className="modal-overlay" onClick={() => setShowAbout(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowAbout(false)}>&times;</button>
            <h2>About Decoding SAS</h2>
            <p><strong>Decoding SAS</strong> is a private, AI-powered research tool designed to help researchers interpret SAS statistical outputs without requiring deep domain knowledge.</p>
            <h3>Features</h3>
            <ul>
              <li>Upload your SAS output in any format — PDF, image, Excel, or DOCX — and get a plain English summary in one click</li>
              <li>Ask follow-up questions with full conversation memory, so the AI understands context from previous answers</li>
              <li>Upload a data dictionary or codebook to give the AI complete study context — variable definitions, coding schemes, and any study-specific terminology are automatically retrieved using RAG (Retrieval-Augmented Generation)</li>
              <li>Export your full session as a PDF report for sharing or record-keeping</li>
            </ul>
            <h3>Why Decoding SAS</h3>
            <p>Research data is sensitive and confidential. Pasting statistical outputs into public AI tools like ChatGPT or Gemini risks exposing private research information. Decoding SAS processes everything through a secure, private pipeline — your data is never stored, shared publicly, or used for AI training.</p>
          </div>
        </div>
      )}

      <main className="main">

        {/* ── Data Dictionary Section ── */}
        <section className="section">
          <h2 className="section-title">Upload Data Dictionary / Code Book</h2>
          <p className="section-desc">
            Optional — upload your variable definitions so the model understands study-specific terms.
          </p>
          <div
            className={`upload-area ${dictFiles.length ? "uploaded" : ""}`}
            onClick={() => dictInputRef.current?.click()}
            onDrop={(e) => { e.preventDefault(); handleDictSelect(e.dataTransfer.files); }}
            onDragOver={(e) => e.preventDefault()}
          >
            <input ref={dictInputRef} type="file" accept={ACCEPT} onChange={(e) => handleDictSelect(e.target.files)} hidden />
            {dictFiles.length ? (
              <div className="file-info">
                <span className="file-icon">&#128196;</span>
                <span className="file-name">{dictFiles[0].name}</span>
                <span className="file-hint">Click to change file</span>
              </div>
            ) : (
              <div className="upload-prompt">
                <span className="upload-icon">+</span>
                <span>Click or drag &amp; drop your data dictionary here</span>
                <span className="upload-hint">PDF, image, Excel, or DOCX</span>
              </div>
            )}
          </div>
          {dictFiles.length > 0 && dictStatus !== "success" && (
            <button className="btn btn-primary" onClick={() => uploadDictionary(dictFiles)} disabled={dictStatus === "uploading"}>
              {dictStatus === "uploading" ? "Indexing..." : "Index Data Dictionary"}
            </button>
          )}
          {dictStatus === "success" && <p className="status-success">&#10003; Data dictionary indexed — the model will now use your variable definitions.</p>}
          {dictStatus === "error" && <p className="status-error">Failed to index. Please try again.</p>}
        </section>

        <div className="divider" />

        {/* ── SAS Output Section ── */}
        <section className="section">
          <h2 className="section-title">Upload SAS Output</h2>
          <p className="section-desc">PDF, Excel, DOCX — single file. Images — select multiple screenshots if needed.</p>
          <div
            className={`upload-area ${sasFiles.length ? "uploaded" : ""}`}
            onClick={() => sasInputRef.current?.click()}
            onDrop={(e) => { e.preventDefault(); handleSasSelect(e.dataTransfer.files); }}
            onDragOver={(e) => e.preventDefault()}
          >
            <input ref={sasInputRef} type="file" accept={ACCEPT} multiple onChange={(e) => handleSasSelect(e.target.files)} hidden />
            {sasFiles.length ? (
              <div className="file-info">
                <span className="file-icon">&#128196;</span>
                {sasFiles.length === 1 ? (
                  <span className="file-name">{sasFiles[0].name}</span>
                ) : (
                  <span className="file-name">{sasFiles.length} images selected</span>
                )}
                <span className="file-hint">Click to change</span>
              </div>
            ) : (
              <div className="upload-prompt">
                <span className="upload-icon">+</span>
                <span>Click or drag &amp; drop your SAS output here</span>
                <span className="upload-hint">PDF, image, Excel, or DOCX — multiple images supported</span>
              </div>
            )}
          </div>

          {sasFiles.length > 0 && !isAllImages(sasFiles) && sasFiles.length > 1 && (
            <p className="status-error">Multiple files are only supported for images. Please upload a single PDF, Excel, or DOCX file.</p>
          )}

          {sasFiles.length > 0 && (
            <div className="action-buttons">
              <button className="btn btn-primary" onClick={callSummarise} disabled={loading}>Summarise</button>
              <button className="btn btn-secondary" onClick={() => setShowInput((prev) => !prev)} disabled={loading}>Ask Question</button>
            </div>
          )}

          {showInput && (
            <div className="question-input">
              <input
                type="text"
                placeholder="e.g. What is the effect of meanage on chst?"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && callAsk()}
                autoFocus
              />
              <button className="btn btn-send" onClick={callAsk} disabled={!question.trim() || loading}>Send</button>
            </div>
          )}
        </section>

        {/* ── Chat ── */}
        {messages.length > 0 && (
          <>
            <div className="chat">
              {messages.map((msg, i) => (
                <div key={i} className={`message message-${msg.role}`}>
                  <div className="message-header">
                    <span className="message-label">{msg.role === "user" ? "You" : "Assistant"}</span>
                    {msg.role === "assistant" && (
                      <button className="copy-btn" onClick={() => copyMessage(msg.text, i)}>
                        {copiedIndex === i ? "Copied ✓" : "Copy"}
                      </button>
                    )}
                  </div>
                  <ReactMarkdown>{msg.text}</ReactMarkdown>
                </div>
              ))}
              {loading && (
                <div className="message message-assistant">
                  <span className="message-label">Assistant</span>
                  <p className="typing">Thinking...</p>
                </div>
              )}
            </div>

            {!loading && (
              <button className="btn btn-export" onClick={exportPDF}>
                Export Session as PDF
              </button>
            )}
          </>
        )}

      </main>
    </div>
  );
}

export default App;
