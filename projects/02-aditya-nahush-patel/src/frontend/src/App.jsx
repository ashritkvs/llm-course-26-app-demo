import { useState, useRef, useEffect } from "react";

const API = "http://localhost:8000";

const fontLink = document.createElement("link");
fontLink.href = "https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=JetBrains+Mono:wght@300;400;500&display=swap";
fontLink.rel = "stylesheet";
document.head.appendChild(fontLink);

const getCSS = (dark) => `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: ${dark ? "#080808" : "#f5f5f0"}; min-height: 100vh; overflow-x: hidden; }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: ${dark ? "#0d0d0d" : "#eee"}; }
  ::-webkit-scrollbar-thumb { background: ${dark ? "#2a2a2a" : "#ccc"}; border-radius: 2px; }

  @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
  @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
  @keyframes shimmer { 0%{background-position:-200% center} 100%{background-position:200% center} }
  @keyframes scoreAnim { from{opacity:0;transform:scale(.6)} to{opacity:1;transform:scale(1)} }
  @keyframes tagSlide { from{opacity:0;transform:translateX(-8px)} to{opacity:1;transform:translateX(0)} }
  @keyframes barFill { from{width:0} }

  .root {
    font-family: 'JetBrains Mono', monospace;
    color: ${dark ? "#e0e0e0" : "#1a1a1a"};
    min-height: 100vh;
  }

  .header {
    padding: 28px 48px;
    display: flex; align-items: center; justify-content: space-between;
    border-bottom: 1px solid ${dark ? "#141414" : "#e0e0e0"};
    animation: fadeIn .5s ease both;
  }

  .header-left { display:flex; align-items:center; gap:14px; }

  .logo {
    width:38px; height:38px; border: 1px solid ${dark ? "#e0e0e0" : "#1a1a1a"};
    display:flex; align-items:center; justify-content:center;
    font-family:'Syne',sans-serif; font-size:11px; font-weight:700; letter-spacing:2px;
    transition: transform .4s ease;
  }
  .logo:hover { transform: rotate(45deg); }

  .brand { font-family:'Syne',sans-serif; font-size:18px; font-weight:700; letter-spacing:-.5px; }
  .brand-sub { font-size:10px; color:${dark ? "#444" : "#999"}; letter-spacing:2px; margin-top:2px; }

  .header-right { display:flex; align-items:center; gap:20px; }

  .status { display:flex; align-items:center; gap:8px; font-size:10px; color:${dark ? "#333" : "#aaa"}; letter-spacing:1px; }
  .dot { width:6px; height:6px; border-radius:50%; background:#22c55e; animation: pulse 2s infinite; }

  .toggle {
    background: none; border: 1px solid ${dark ? "#2a2a2a" : "#ddd"};
    color: ${dark ? "#666" : "#999"}; font-family:'JetBrains Mono',monospace;
    font-size:10px; letter-spacing:1px; padding: 6px 14px; cursor:pointer;
    transition: all .2s ease;
  }
  .toggle:hover { border-color: ${dark ? "#555" : "#aaa"}; color: ${dark ? "#ccc" : "#333"}; }

  .main { max-width:1100px; margin:0 auto; padding:56px 48px; }

  .hero { margin-bottom:52px; animation: fadeUp .6s ease .1s both; }
  .hero h1 {
    font-family:'Syne',sans-serif; font-size:clamp(32px,5vw,60px);
    font-weight:800; line-height:1.05; letter-spacing:-2px;
    color:${dark ? "#fff" : "#0a0a0a"}; margin-bottom:14px;
  }
  .hero h1 span {
    background: linear-gradient(90deg, ${dark ? "#fff 0%,#555 50%,#fff 100%" : "#000 0%,#888 50%,#000 100%"});
    background-size:200% auto;
    -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;
    animation: shimmer 4s linear infinite;
  }
  .hero p { font-size:12px; color:${dark ? "#333" : "#aaa"}; letter-spacing:1px; }

  .input-grid { display:grid; grid-template-columns:1fr 1fr; gap:2px; margin-bottom:2px; animation: fadeUp .6s ease .2s both; }

  .panel {
    background: ${dark ? "#0d0d0d" : "#fff"};
    border: 1px solid ${dark ? "#1a1a1a" : "#e8e8e8"};
    padding:28px; transition: border-color .3s ease; position:relative; overflow:hidden;
  }
  .panel::before {
    content:''; position:absolute; top:0;left:0;right:0; height:1px;
    background:linear-gradient(90deg,transparent,${dark ? "#333" : "#ddd"},transparent);
    opacity:0; transition:opacity .3s ease;
  }
  .panel:hover::before { opacity:1; }
  .panel:hover { border-color: ${dark ? "#2a2a2a" : "#d0d0d0"}; }

  .panel-label {
    font-size:9px; letter-spacing:3px; text-transform:uppercase;
    color:${dark ? "#333" : "#bbb"}; margin-bottom:18px;
    display:flex; align-items:center; gap:8px;
  }
  .panel-label::after { content:''; flex:1; height:1px; background:${dark ? "#1a1a1a" : "#f0f0f0"}; }

  .dropzone {
    min-height:160px; border:1px dashed ${dark ? "#1e1e1e" : "#ddd"};
    display:flex; flex-direction:column; align-items:center; justify-content:center;
    cursor:pointer; gap:10px; transition:all .3s ease;
  }
  .dropzone:hover { border-color:${dark ? "#333" : "#aaa"}; background:${dark ? "#111" : "#fafafa"}; }
  .dropzone.filled { border-style:solid; border-color:${dark ? "#2a2a2a" : "#ccc"}; }
  .dropzone-icon { font-size:22px; opacity:.4; }
  .dropzone-text { font-size:11px; color:${dark ? "#333" : "#bbb"}; letter-spacing:1px; }
  .dropzone-filename { font-size:12px; color:${dark ? "#888" : "#666"}; }

  .jd-textarea {
    width:100%; min-height:200px;
    background:transparent; border:1px dashed ${dark ? "#1e1e1e" : "#ddd"};
    color:${dark ? "#ccc" : "#333"}; font-family:'JetBrains Mono',monospace;
    font-size:12px; line-height:1.8; padding:14px; resize:vertical; outline:none;
    transition:border-color .3s ease;
  }
  .jd-textarea:focus { border-color:${dark ? "#333" : "#aaa"}; border-style:solid; }
  .jd-textarea::placeholder { color:${dark ? "#2a2a2a" : "#ccc"}; }

  .loading-bar { width:100%; height:2px; background:${dark ? "#111" : "#eee"}; margin-bottom:2px; overflow:hidden; }
  .loading-bar-inner {
    height:100%;
    background:linear-gradient(90deg,transparent,${dark ? "#e0e0e0" : "#333"},transparent);
    background-size:200% 100%; animation:shimmer 1.2s linear infinite; width:100%;
  }

  .error { font-size:11px; color:#ef4444; padding:10px 0; letter-spacing:1px; animation:fadeIn .3s ease; }

  .btn {
    width:100%; padding:20px;
    background:${dark ? "#e0e0e0" : "#0a0a0a"};
    color:${dark ? "#080808" : "#fff"};
    border:none; font-family:'Syne',sans-serif; font-size:13px;
    font-weight:700; letter-spacing:4px; text-transform:uppercase;
    cursor:pointer; transition:all .3s ease; position:relative; overflow:hidden;
    animation: fadeUp .6s ease .3s both;
  }
  .btn::before {
    content:''; position:absolute; top:0;left:-100%; width:100%; height:100%;
    background:linear-gradient(90deg,transparent,rgba(255,255,255,.15),transparent);
    transition:left .5s ease;
  }
  .btn:hover::before { left:100%; }
  .btn:hover { background:${dark ? "#fff" : "#222"}; }
  .btn:disabled { opacity:.3; cursor:not-allowed; }

  /* Results */
  .results { margin-top:2px; animation:fadeUp .6s ease both; }

  .score-row { display:grid; grid-template-columns:220px 1fr; gap:2px; margin-bottom:2px; }

  .score-panel {
    background:${dark ? "#0d0d0d" : "#fff"}; border:1px solid ${dark ? "#1a1a1a" : "#e8e8e8"};
    padding:36px; display:flex; flex-direction:column; justify-content:center;
    position:relative; overflow:hidden;
  }
  .score-panel::after {
    content:''; position:absolute; bottom:0;left:0;right:0; height:2px;
    background:var(--sc); opacity:.5;
  }
  .score-lbl { font-size:9px; letter-spacing:3px; text-transform:uppercase; color:${dark ? "#333" : "#bbb"}; margin-bottom:10px; }
  .score-num {
    font-family:'Syne',sans-serif; font-size:72px; font-weight:800;
    letter-spacing:-4px; line-height:1; color:var(--sc);
    animation:scoreAnim .5s cubic-bezier(.34,1.56,.64,1) both;
  }
  .score-grade { font-size:10px; letter-spacing:2px; color:${dark ? "#333" : "#bbb"}; margin-top:8px; text-transform:uppercase; }

  .score-detail {
    background:${dark ? "#0d0d0d" : "#fff"}; border:1px solid ${dark ? "#1a1a1a" : "#e8e8e8"};
    padding:36px; display:flex; flex-direction:column; justify-content:center; gap:20px;
  }
  .bar-track { height:2px; background:${dark ? "#1a1a1a" : "#eee"}; position:relative; overflow:hidden; }
  .bar-fill {
    height:100%; background:var(--sc);
    transition:width 1.2s cubic-bezier(.22,1,.36,1);
  }
  .score-insight { font-size:12px; color:${dark ? "#555" : "#999"}; line-height:1.9; }
  .score-insight strong { color:${dark ? "#888" : "#555"}; font-weight:500; }

  .two-col { display:grid; grid-template-columns:1fr 2fr; gap:2px; margin-bottom:2px; }
  .full { margin-bottom:2px; }

  .r-panel {
    background:${dark ? "#0d0d0d" : "#fff"}; border:1px solid ${dark ? "#1a1a1a" : "#e8e8e8"};
    padding:28px; transition:border-color .3s ease;
  }
  .r-panel:hover { border-color:${dark ? "#222" : "#d8d8d8"}; }

  .r-title {
    font-size:9px; letter-spacing:3px; text-transform:uppercase;
    color:${dark ? "#333" : "#bbb"}; margin-bottom:20px;
    display:flex; align-items:center; gap:8px;
  }
  .r-title::after { content:''; flex:1; height:1px; background:${dark ? "#1a1a1a" : "#f0f0f0"}; }

  /* Keywords */
  .kw-list { display:flex; flex-direction:column; gap:12px; }
  .kw-item {
    border:1px solid ${dark ? "#1a1a1a" : "#ebebeb"};
    padding:14px 16px; transition:all .2s ease;
    animation:tagSlide .4s ease both;
  }
  .kw-item:hover { border-color:${dark ? "#333" : "#ccc"}; background:${dark ? "#111" : "#fafafa"}; }
  .kw-top { display:flex; align-items:center; justify-content:space-between; margin-bottom:6px; }
  .kw-word { font-size:12px; font-weight:500; color:${dark ? "#ccc" : "#222"}; }
  .kw-where {
    font-size:9px; letter-spacing:2px; text-transform:uppercase;
    color:${dark ? "#444" : "#bbb"}; background:${dark ? "#1a1a1a" : "#f5f5f5"};
    padding:3px 8px;
  }
  .kw-suggestion { font-size:11px; color:${dark ? "#444" : "#aaa"}; line-height:1.6; }

  /* Bullet diff */
  .diff-list { display:flex; flex-direction:column; gap:16px; }
  .diff-item {
    border:1px solid ${dark ? "#1a1a1a" : "#ebebeb"};
    overflow:hidden; transition:border-color .2s ease;
    animation:fadeUp .5s ease both;
  }
  .diff-item:hover { border-color:${dark ? "#2a2a2a" : "#ccc"}; }

  .diff-section {
    font-size:9px; letter-spacing:2px; text-transform:uppercase;
    color:${dark ? "#333" : "#bbb"}; padding:8px 16px;
    background:${dark ? "#111" : "#fafafa"};
    border-bottom:1px solid ${dark ? "#1a1a1a" : "#ebebeb"};
  }

  .diff-row { display:grid; grid-template-columns:1fr 1fr; }

  .diff-before {
    padding:14px 16px; font-size:11px; line-height:1.8;
    color:${dark ? "#444" : "#bbb"};
    border-right:1px solid ${dark ? "#1a1a1a" : "#ebebeb"};
    position:relative;
  }
  .diff-before::before {
    content:'BEFORE'; position:absolute; top:8px; right:10px;
    font-size:8px; letter-spacing:2px; color:${dark ? "#222" : "#ddd"};
  }

  .diff-after {
    padding:14px 16px; font-size:11px; line-height:1.8;
    color:${dark ? "#bbb" : "#333"}; background:${dark ? "#0f1a0f" : "#f5fff5"};
    position:relative;
  }
  .diff-after::before {
    content:'AFTER'; position:absolute; top:8px; right:10px;
    font-size:8px; letter-spacing:2px; color:${dark ? "#1a3a1a" : "#cce8cc"};
  }

  .diff-tags { display:flex; flex-wrap:wrap; gap:6px; padding:10px 16px; border-top:1px solid ${dark ? "#1a1a1a" : "#ebebeb"}; background:${dark ? "#0a0a0a" : "#fafafa"}; }
  .diff-tag {
    font-size:9px; padding:3px 10px; letter-spacing:1px;
    background:${dark ? "#0f2a0f" : "#e8f5e8"}; color:${dark ? "#22c55e" : "#166534"};
    border:1px solid ${dark ? "#1a3a1a" : "#bbf7d0"};
  }

  /* Tips */
  .tips-list { display:flex; flex-direction:column; gap:10px; }
  .tip {
    display:flex; gap:16px; font-size:12px; line-height:1.7;
    color:${dark ? "#666" : "#888"}; padding:12px;
    border:1px solid transparent; transition:all .2s ease;
    animation:fadeUp .5s ease both;
  }
  .tip:hover { border-color:${dark ? "#1a1a1a" : "#ebebeb"}; color:${dark ? "#999" : "#555"}; background:${dark ? "#0f0f0f" : "#fafafa"}; }
  .tip-n { font-family:'Syne',sans-serif; font-size:20px; font-weight:800; color:${dark ? "#1e1e1e" : "#e8e8e8"}; line-height:1; min-width:26px; }

  .footer {
    padding:20px 48px; border-top:1px solid ${dark ? "#0f0f0f" : "#ebebeb"};
    display:flex; align-items:center; justify-content:space-between;
    font-size:10px; color:${dark ? "#222" : "#ccc"}; letter-spacing:1px;
  }
`;

function ScoreBar({ score, dark }) {
  const [w, setW] = useState(0);
  useEffect(() => { setTimeout(() => setW(score), 100); }, [score]);
  const color = score >= 75 ? "#22c55e" : score >= 50 ? "#f59e0b" : "#ef4444";
  const grade = score >= 75 ? "Strong Match" : score >= 50 ? "Moderate Match" : "Weak Match";
  return (
    <div className="score-row">
      <div className="score-panel" style={{ "--sc": color }}>
        <div className="score-lbl">match score</div>
        <div className="score-num">{score}%</div>
        <div className="score-grade">{grade}</div>
      </div>
      <div className="score-detail">
        <div>
          <div className="score-lbl" style={{ marginBottom: 10 }}>alignment</div>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${w}%`, "--sc": color }} />
          </div>
        </div>
        <p className="score-insight">
          Your resume aligns with <strong style={{ color }}>{score}%</strong> of requirements.{" "}
          {score >= 75 ? "Strong candidate — adding the missing keywords could push you past 85%."
            : score >= 50 ? "Solid foundation. Incorporate the missing keywords to boost ATS ranking significantly."
            : "Significant gaps detected. Use the bullet rewrites and keyword placements below to close the distance."}
        </p>
      </div>
    </div>
  );
}

export default function App() {
  const [file, setFile] = useState(null);
  const [jd, setJd] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dark, setDark] = useState(true);
  const fileRef = useRef();

  const handleAnalyze = async () => {
    if (!file || !jd.trim()) { setError("Upload a resume PDF and paste a job description."); return; }
    setError(""); setLoading(true); setResult(null);
    try {
      const form = new FormData();
      form.append("resume", file);
      form.append("job_description", jd);
      const res = await fetch(`${API}/analyze`, { method: "POST", body: form });
      if (!res.ok) throw new Error();
      setResult(await res.json());
    } catch { setError("Something went wrong. Is backend running on port 8000?"); }
    finally { setLoading(false); }
  };

  return (
    <>
      <style>{getCSS(dark)}</style>
      <div className="root">
        <header className="header">
          <div className="header-left">
            <div className="logo">RA</div>
            <div>
              <div className="brand">ResumeAlign</div>
              <div className="brand-sub">AI-Powered ATS Optimizer</div>
            </div>
          </div>
          <div className="header-right">
            <div className="status"><div className="dot" />system online</div>
            <button className="toggle" onClick={() => setDark(!dark)}>
              {dark ? "☀ light" : "◑ dark"}
            </button>
          </div>
        </header>

        <main className="main">
          <div className="hero">
            <h1>Get <span>aligned.</span><br />Get hired.</h1>
            <p>// upload resume · paste jd · receive targeted analysis</p>
          </div>

          <div className="input-grid">
            <div className="panel">
              <div className="panel-label">01 — Resume PDF</div>
              <div className={`dropzone ${file ? "filled" : ""}`} onClick={() => fileRef.current.click()}>
                {file ? (
                  <><span style={{ fontSize: 26 }}>📄</span>
                    <span className="dropzone-filename">{file.name}</span>
                    <span className="dropzone-text">click to change</span></>
                ) : (
                  <><span className="dropzone-icon">⬆</span>
                    <span className="dropzone-text">click to upload PDF</span></>
                )}
                <input ref={fileRef} type="file" accept=".pdf" style={{ display: "none" }}
                  onChange={(e) => setFile(e.target.files[0])} />
              </div>
            </div>
            <div className="panel">
              <div className="panel-label">02 — Job Description</div>
              <textarea className="jd-textarea"
                placeholder="// paste full job description here..."
                value={jd} onChange={(e) => setJd(e.target.value)} />
            </div>
          </div>

          {loading && <div className="loading-bar"><div className="loading-bar-inner" /></div>}
          {error && <p className="error">⚠ {error}</p>}

          <button className="btn" onClick={handleAnalyze} disabled={loading}>
            {loading ? "analyzing resume..." : "run analysis →"}
          </button>

          {result && (
            <div className="results">
              <ScoreBar score={result.match_score} dark={dark} />

              <div className="two-col">
                {/* Missing keywords with placement */}
                <div className="r-panel">
                  <div className="r-title">Where to Add Keywords</div>
                  <div className="kw-list">
                    {result.missing_keywords.map((k, i) => (
                      <div key={i} className="kw-item" style={{ animationDelay: `${i * 0.07}s` }}>
                        <div className="kw-top">
                          <span className="kw-word">{k.keyword}</span>
                          <span className="kw-where">{k.where_to_add}</span>
                        </div>
                        <div className="kw-suggestion">{k.suggestion}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Before / After bullet diff */}
                <div className="r-panel">
                  <div className="r-title">Bullet Changes — Before → After</div>
                  <div className="diff-list">
                    {result.bullet_changes.map((b, i) => (
                      <div key={i} className="diff-item" style={{ animationDelay: `${i * 0.1}s` }}>
                        <div className="diff-section">{b.section}</div>
                        <div className="diff-row">
                          <div className="diff-before">{b.original}</div>
                          <div className="diff-after">{b.improved}</div>
                        </div>
                        {b.keywords_added?.length > 0 && (
                          <div className="diff-tags">
                            {b.keywords_added.map((kw, j) => (
                              <span key={j} className="diff-tag">+ {kw}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="r-panel full">
                <div className="r-title">ATS Optimization Tips</div>
                <div className="tips-list">
                  {result.ats_tips.map((t, i) => (
                    <div key={i} className="tip" style={{ animationDelay: `${i * 0.1}s` }}>
                      <span className="tip-n">0{i + 1}</span>
                      <span>{t}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>

        <footer className="footer">
          <span>ResumeAlign AI · v2.0</span>
          <span>FastAPI · Groq · React</span>
        </footer>
      </div>
    </>
  );
}