# 🚀 FinSight AI — Autonomous Multimodal Financial Tracker & RAG Advisory

> An enterprise-grade, full-stack personal finance application. 
> FinSight AI merges multimodal LLM extraction (Voice + Vision) with a FAISS-powered semantic memory and dual-layer TOTP security to create an autonomous, agentic financial advisor.

---

### 📌 Overview

**FinSight AI** elevates personal finance tracking from manual entry to autonomous data extraction. Built with a modern React/Next.js frontend and a robust Python/Flask backend, the application utilizes a multi-agent routing architecture to process natural language, parse receipt images, and provide deeply contextual financial advice based on historical semantic search.

### 🧩 Core Engineering Highlights

| Feature | Technical Implementation |
|--------|-------------|
| **📸 Multimodal Context Fusion** | Feeds simultaneous image (receipts) and text (voice/typing) to Gemini 2.5 Flash to synthesize missing context and output structured JSON. |
| **🧠 Intelligent Query Routing** | An LLM Classifier dynamically routes user queries to either a FAISS-powered RAG pipeline (for historical ledger analysis) or a general LLM pipeline. |
| **🔐 Dual-Layer Security** | Implements standard Time-Based One-Time Passwords (TOTP) via Google Authenticator, backed by a live SMTP HTML-templated email fallback system. |
| **⏱️ Implied UTC Architecture** | Bypasses SQLite timezone limitations by standardizing all backend timestamps to naive UTC, parsed locally by the React frontend. |
| **📊 Real-Time Dashboard** | Dynamic Chart.js visualizations built on a chronologically sorted, reactive ledger state. |

---

### ⚙️ Tech Stack

**Frontend (Client)**
- **Framework:** Next.js (App Router), React, TypeScript
- **Styling & UI:** Tailwind CSS, Framer Motion
- **Data Visualization:** Chart.js, react-chartjs-2

**Backend (Server & AI)**
- **API Framework:** Python, Flask, Flask-CORS
- **Database:** SQLite (Relational mapping for User Auth)
- **Vector Search:** FAISS (Facebook AI Similarity Search) for semantic transaction retrieval
- **LLM Engine:** Google Gemini 2.5 Flash (Multimodal)
- **Security:** PyOTP (Time-based Auth), smtplib (Email Verification)

---

### 📦 Example Prompts

```txt
"Log $32 spent on dinner yesterday at Olive Garden"
"How much did I spend on food this week?"
"Am I saving enough compared to last month?"
"Summarize my subscriptions"
"Based on my rent, how much should I spend on groceries?"
```
---

### 🚀 Getting Started

Clone the repo:

```bash
git clone [https://github.com/Divyansh1414/finsight-ai.git](https://github.com/Divyansh1414/finsight-ai.git)
cd finsight-ai
```

1. Backend Setup
```bash
cd backend
pip install -r requirements.txt
```

Create a .env file in the backend/ directory with the following keys:

```bash
GOOGLE_API_KEY="your_gemini_api_key"
EMAIL_SENDER="your_email@gmail.com"
EMAIL_PASSWORD="your_16_digit_google_app_password"
```

Start the Flask server:

```bash
python app.py
```

2. Frontend Setup
Open a new terminal and navigate to the frontend directory:

```bash
cd frontend
npm install
npm run dev
```

The application will be running locally at http://localhost:3000

---

### 🎯 Use Cases
🧾 Automate and understand your personal spending

📚 Retrieve financial insights from unstructured documents

🧠 Integrate with budgeting goals or salary tracking

📈 Research finance agents, LLM-driven decision flows

---

### 👤 Author
Divyansh Pradhan
📧 divyanshpradhan14@gmail.com

© 2026 Divyansh Pradhan. All Rights Reserved. This code is provided for educational and portfolio demonstration purposes only. Unauthorized copying, modification, or distribution is strictly prohibited.

