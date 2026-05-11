import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ShieldAlert, CheckCircle, Loader2, Globe, Server, AlertTriangle, ExternalLink, RefreshCw, Shield, Activity } from 'lucide-react';
import './App.css';

function App() {
  const [target, setTarget] = useState('');
  const [status, setStatus] = useState('idle'); // idle, scanning, complete, error
  const [jobId, setJobId] = useState(null);
  const [results, setResults] = useState(null);
  const [progressMsg, setProgressMsg] = useState('');

  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000';

  const startScan = async (e) => {
    e.preventDefault();
    if (!target) return;

    setStatus('scanning');
    setResults(null);
    setProgressMsg('Initializing scan pipeline...');
    try {
      const res = await fetch(`${API_BASE_URL}/api/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setJobId(data.job_id);
    } catch (err) {
      setStatus('error');
      setProgressMsg(err.message);
    }
  };

  useEffect(() => {
    let interval;
    if (status === 'scanning' && jobId) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`${API_BASE_URL}/api/scan/${jobId}`);
          const data = await res.json();
          if (data.status === 'completed') {
            setResults(data);
            setStatus('complete');
            clearInterval(interval);
          } else if (data.status === 'failed') {
            setStatus('error');
            setProgressMsg(data.error || 'Scan failed.');
            clearInterval(interval);
          } else {
            setProgressMsg(data.progress || 'Scanning...');
          }
        } catch (e) {
          console.error(e);
        }
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [status, jobId]);

  // Helper: compute overall risk from vuln summary dict
  const computeRisk = (summary) => {
    if (!summary || typeof summary !== 'object') return 'LOW';
    if (summary.CRITICAL > 0) return 'CRITICAL';
    if (summary.HIGH >= 3) return 'HIGH';
    if (summary.HIGH > 0 || summary.MEDIUM >= 5) return 'MEDIUM';
    return 'LOW';
  };

  const riskColor = { CRITICAL: '#ff4d4f', HIGH: '#ff7a45', MEDIUM: '#ffc53d', LOW: '#52c41a' };

  // Open the full HTML report in a new tab
  const viewReport = () => {
    if (jobId) window.open(`${API_BASE_URL}/api/report/${jobId}`, '_blank');
  };

  // Render markdown bold/italic to JSX-safe HTML string
  const renderMarkdown = (text) => {
    if (!text) return '';
    return text
      .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*\n]+?)\*/g, '<em>$1</em>')
      .replace(/_([^_\n]+?)_/g, '<em>$1</em>')
      .replace(/`([^`]+?)`/g, '<code>$1</code>');
  };

  const vulnSummary = results?.vulns?.summary || {};
  const overallRisk = computeRisk(vulnSummary);
  const totalVulns = results?.vulns?.vulnerabilities?.length || 0;
  const strategicSummary = results?.vulns?.strategic_summary || 'Full analysis complete.';

  return (
    <div className="app-container">
      <div className="background-glow"></div>
      
      <header className="header">
        <motion.div 
          initial={{ y: -20, opacity: 0 }} 
          animate={{ y: 0, opacity: 1 }} 
          className="logo" 
          onClick={() => { setStatus('idle'); setTarget(''); setResults(null); setJobId(null); }}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px', cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <ShieldAlert className="logo-icon" size={32} />
            <h1>AI Pentest Scanner</h1>
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '44px' }}>Created by Samarth Agarwal</span>
        </motion.div>
      </header>

      <main className="main-content">
        <AnimatePresence mode="wait">
          {status === 'idle' && (
            <motion.div 
              key="search"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="search-container glass-panel"
            >
              <h2>Enter Target Domain</h2>
              <p className="subtitle">Execute a full AI-powered penetration test instantly.</p>
              
              <form onSubmit={startScan} className="search-form">
                <div className="input-wrapper">
                  <Globe className="input-icon" size={20} />
                  <input 
                    type="text" 
                    placeholder="example.com" 
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    autoComplete="off"
                  />
                </div>
                <button type="submit" className="scan-btn" disabled={!target}>
                  <Search size={18} /> Initiate Scan
                </button>
              </form>
            </motion.div>
          )}

          {status === 'scanning' && (
            <motion.div 
              key="scanning"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="scanning-container glass-panel"
            >
              <Loader2 className="spinner" size={48} />
              <h3>Analyzing Target</h3>
              <p className="progress-text">{progressMsg}</p>
              
              <div className="progress-bar-container">
                <motion.div 
                  className="progress-bar-fill"
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 300, ease: "linear" }}
                />
              </div>
            </motion.div>
          )}

          {status === 'error' && (
            <motion.div 
              key="error"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="error-container glass-panel"
              style={{ textAlign: 'center', padding: '40px', maxWidth: '500px' }}
            >
              <AlertTriangle size={48} color="var(--error)" style={{ marginBottom: '16px' }} />
              <h2 style={{ color: 'var(--error)', marginBottom: '8px' }}>Scan Failed</h2>
              <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>{progressMsg}</p>
              <button 
                className="scan-btn" 
                onClick={() => { setStatus('idle'); setTarget(''); setProgressMsg(''); setJobId(null); }}
                style={{ margin: '0 auto', background: 'rgba(255, 255, 255, 0.1)' }}
              >
                Try Again
              </button>
            </motion.div>
          )}

          {status === 'complete' && results && (
            <motion.div 
              key="results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="results-dashboard"
            >
              {/* Dashboard Header */}
              <div className="dashboard-header glass-panel">
                <div className="target-info">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <h2>{results.target}</h2>
                    <span className="badge success"><CheckCircle size={14} /> Analysis Complete</span>
                  </div>
                  <p className="scan-meta">Scan ID: {jobId?.substring(0,8)} • {new Date().toLocaleDateString()}</p>
                </div>
                <div className="header-actions">
                  {results.report && (
                    <button className="download-btn" onClick={viewReport}>
                      <ExternalLink size={16} /> View Full Report
                    </button>
                  )}
                  <button className="scan-again-btn" onClick={() => { setStatus('idle'); setTarget(''); setResults(null); setJobId(null); }}>
                    <RefreshCw size={16} /> New Scan
                  </button>
                </div>
              </div>

              {/* Risk Overview Row */}
              <div className="risk-overview-row">
                {[
                  { label: 'Critical', count: vulnSummary.CRITICAL || 0, color: '#ff4d4f', cls: 'crit' },
                  { label: 'High', count: vulnSummary.HIGH || 0, color: '#ff7a45', cls: 'high' },
                  { label: 'Medium', count: vulnSummary.MEDIUM || 0, color: '#ffc53d', cls: 'med' },
                  { label: 'Low', count: vulnSummary.LOW || 0, color: '#52c41a', cls: 'low' },
                ].map(({ label, count, color, cls }) => (
                  <motion.div
                    key={label}
                    className={`glass-panel risk-stat-card ${cls}`}
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                  >
                    <div className="risk-num" style={{ color }}>{count}</div>
                    <div className="risk-label-text">{label}</div>
                  </motion.div>
                ))}
                <motion.div
                  className="glass-panel risk-stat-card overall"
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  <div className="risk-num" style={{ color: riskColor[overallRisk] }}>{overallRisk}</div>
                  <div className="risk-label-text">Overall Risk</div>
                </motion.div>
              </div>

              {/* Executive Summary */}
              <div className="glass-panel summary-card">
                <h3><Shield size={20}/> Executive Strategic Summary</h3>
                <div className="summary-content">
                  <p 
                    style={{ lineHeight: '1.8', color: 'rgba(226,228,239,0.88)' }}
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(strategicSummary) }}
                  />
                </div>
              </div>

              <div className="dashboard-grid">
                {/* Reconnaissance Card */}
                <div className="glass-panel stats-card">
                  <h3><Server size={20}/> Technical Reconnaissance</h3>
                  <div className="detailed-recon">
                    <div className="recon-group">
                      <span className="label">Open Ports / Services</span>
                      <div className="tag-cloud">
                        {results.recon?.open_ports?.length > 0 ? (
                          results.recon.open_ports.map((p, i) => (
                            <span key={i} className="port-tag">
                              {p.port} <small>{p.service}</small>
                            </span>
                          ))
                        ) : <span className="dim">None detected</span>}
                      </div>
                    </div>
                    <div className="recon-group">
                      <span className="label">Subdomains Found</span>
                      <div className="tag-cloud">
                        {results.recon?.subdomains?.length > 0 ? (
                          results.recon.subdomains.slice(0, 15).map((s, i) => (
                            <span key={i} className="sub-tag">{s}</span>
                          ))
                        ) : <span className="dim">None detected</span>}
                      </div>
                    </div>
                    <div className="recon-group">
                      <span className="label">Technology Stack</span>
                      <div className="tag-cloud">
                        {results.recon?.technologies?.length > 0 ? results.recon.technologies.map((t, i) => (
                          <span key={i} className="tech-tag">{t}</span>
                        )) : <span className="dim">Unknown</span>}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Vulnerabilities Card */}
                <div className="glass-panel vulns-card">
                  <h3><Activity size={20}/> Vulnerability Assessment ({totalVulns})</h3>
                  {totalVulns > 0 ? (
                    <ul className="vuln-list">
                      {results.vulns.vulnerabilities.map((v, i) => (
                        <li key={i} className="vuln-item">
                          <div className="vuln-main">
                            <span className={`severity-badge ${v.severity?.toLowerCase()}`}>{v.severity}</span>
                            <span className="vuln-title">{v.title}</span>
                          </div>
                          <p className="vuln-desc">{v.description}</p>
                          {v.remediation && (
                            <div className="remediation">
                              <strong>Fix:</strong> {v.remediation}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '32px 0' }}>
                      <CheckCircle size={40} color="#52c41a" style={{ marginBottom: '12px' }} />
                      <p className="no-vulns">No critical security exposures identified.</p>
                      <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '8px' }}>
                        The target appears well-hardened against common attack vectors.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Report Download Banner */}
              {results.report && (
                <motion.div 
                  className="glass-panel report-banner"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <div>
                    <h4>📄 Full Professional Report Ready</h4>
                    <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
                      Includes attack surface, CVE mapping, CVSS vectors, remediation plan, risk rating &amp; backdoor assessment.
                    </p>
                  </div>
                  <button className="download-btn" onClick={viewReport}>
                    <ExternalLink size={16} /> Open Full Report
                  </button>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

export default App;
