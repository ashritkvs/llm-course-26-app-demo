import sys
import io
if sys.stdout.encoding != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

from flask import Flask, request, jsonify
from flask_cors import CORS
import threading
import uuid
import time
import os

from agents.recon_agent import run as run_recon
from agents.vuln_scanner import run as run_vuln
from agents.report_writer import run as run_report

def sanitize_error(e):
    error_str = str(e)
    # Hide Groq organization IDs and technical rate limit details
    if "rate_limit_exceeded" in error_str or "413" in error_str or "TPM" in error_str:
        return "AI Rate Limit Exceeded (TPM). Please wait 1 minute and try again. The free-tier API is currently congested."
    if "org_" in error_str:
        import re
        error_str = re.sub(r'org_[a-zA-Z0-9]+', '[REDACTED_ORG]', error_str)
    
    # Generic clean up for other common API errors
    if "Authentication" in error_str:
        return "API Authentication Error. Please check your API keys in Settings."
    
    return error_str

app = Flask(__name__)
CORS(app)  # Enable CORS for the React frontend

@app.route('/', methods=['GET'])
def health_check():
    return """
    <html>
        <head>
            <title>AI Pentest API</title>
            <style>
                body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background: #0f1117; color: #e2e4ef; margin: 0; }
                .card { background: #1a1d27; padding: 40px; border-radius: 16px; border: 1px solid #2e3141; text-align: center; }
                h1 { color: #7c6af7; margin-bottom: 10px; }
                .status { color: #10b981; font-weight: bold; }
            </style>
        </head>
        <body>
            <div class="card">
                <h1>AI Pentest Scanner Backend</h1>
                <p>Status: <span class="status">RUNNING</span></p>
                <p style="color: #8b8fa8; font-size: 0.9em;">API Endpoint: /api/scan</p>
            </div>
        </body>
    </html>
    """

# In-memory storage for scan jobs (For production, use Redis/DB)
scan_jobs = {}

def execute_scan(job_id, target):
    scan_jobs[job_id]['status'] = 'running'
    scan_jobs[job_id]['progress'] = 'Initializing target acquisition and reconnaissance...'
    
    def progress_cb(msg):
        scan_jobs[job_id]['progress'] = msg

    try:
        # 1. Recon Phase
        progress_cb('Engaging Multi-Agent Reconnaissance Protocol...')
        recon_results = run_recon(target, progress_callback=progress_cb)
        scan_jobs[job_id]['recon'] = recon_results
        
        # 2. Vulnerability Scanning Phase
        progress_cb('Commencing advanced heuristic vulnerability assessment...')
        vuln_results = run_vuln(recon_results, progress_callback=progress_cb)
        scan_jobs[job_id]['vulns'] = vuln_results

        # 3. Final Report Generation Phase
        progress_cb('Synthesizing professional security assessment report...')
        # We mock exploit data for now as it's not always run
        exploit_data = {"results": [], "session_start": time.strftime("%Y-%m-%d %H:%M:%S")}
        report_results = run_report(recon_results, vuln_results, exploit_data)
        scan_jobs[job_id]['report'] = report_results
        
        scan_jobs[job_id]['status'] = 'completed'
        scan_jobs[job_id]['progress'] = 'Scan complete. Professional report generated.'
    except Exception as e:
        scan_jobs[job_id]['status'] = 'failed'
        scan_jobs[job_id]['error'] = sanitize_error(e)
        scan_jobs[job_id]['progress'] = 'Security analysis terminated due to a critical exception.'

@app.route('/api/scan', methods=['POST'])
def start_scan():
    data = request.json
    target = data.get('target')
    
    if not target:
        return jsonify({'error': 'Target is required'}), 400
        
    job_id = str(uuid.uuid4())
    scan_jobs[job_id] = {
        'target': target,
        'status': 'pending',
        'progress': 'Queued...',
        'recon': {},
        'vulns': {},
        'timestamp': time.time()
    }
    
    # Run scan asynchronously to avoid HTTP timeouts
    thread = threading.Thread(target=execute_scan, args=(job_id, target))
    thread.daemon = True
    thread.start()
    
    return jsonify({'job_id': job_id, 'status': 'started'})

@app.route('/api/scan/<job_id>', methods=['GET'])
def get_scan_status(job_id):
    job = scan_jobs.get(job_id)
    if not job:
        return jsonify({'error': 'Job not found'}), 404
        
    return jsonify(job)

@app.route('/api/report/<job_id>', methods=['GET'])
def get_report(job_id):
    job = scan_jobs.get(job_id)
    if not job or 'report' not in job:
        return jsonify({'error': 'Report not found'}), 404
        
    html_path = job['report'].get('html_path')
    if not html_path or not os.path.exists(html_path):
        return jsonify({'error': 'Report file missing'}), 404
        
    from flask import send_file
    return send_file(html_path)

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, threaded=True)
