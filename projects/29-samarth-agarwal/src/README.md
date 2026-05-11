# AI Pentest Scanner Standalone Application

This folder contains the clean, standalone version of the AI Pentest Scanner. It is separated from legacy bot components for easier management.

## 🚀 How to Run

### 1. Start the Backend API
Open a terminal in this folder and run:
```bash
conda activate agenticAi
python api_server.py
```
The API will start at `http://localhost:5000`.

### 2. Start the Frontend
Open another terminal in the `frontend` folder and run:
```bash
cd frontend
npm run dev
```
The UI will start at `http://localhost:5173`.

### 3. Run via CLI
You can also run scans directly from the terminal in this folder:
```bash
python main.py --target example.com
```

## 📁 Directory Structure
- `api_server.py`: Flask backend for the web UI.
- `main.py`: CLI entry point.
- `agents/`: AI agents for Recon, Vuln Scanning, and Reporting.
- `core/`: Core configurations and security utilities.
- `frontend/`: Vite + React + Tailwind frontend source.
- `reports/`: All generated scan results (Markdown, HTML, JSON, PDF).
- `.env`: Contains your API keys for Groq and Gemini.
