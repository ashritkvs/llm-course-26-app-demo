---
slug: 14-jaya-chandra-dadi

title: FutureYou AI – Long-Term Consequence Simulator

students:
  - Jaya Chandra Dadi

tags:
  - llm
  - multi-agent
  - decision-making
  - ollama
  - streamlit

category: productivity

tagline: AI-powered simulator for exploring future consequences of decisions.

featuredEligible: true

semester: "Spring 2026"

shortTitle: "FutureYou AI"

studentId: "116423050"

videoUrl: "https://drive.google.com/file/d/1s3mV6MpE9UsQyvhfMPAgv9jIeRH3T63h/view?usp=drive_link"
# Add your Google Drive demo video link here

thumbnail: /thumbnails/14-jaya-chandra-dadi.png
# Add your Google Drive thumbnail link here

githubUrl: ""
# Optional: add your personal GitHub repo link if needed
---
## Problem

People often make important life and career decisions without understanding the long-term consequences of their choices. It is difficult to evaluate short-term benefits, long-term outcomes, risks, and personal priorities all at once.


## Solution

FutureYou AI is an LLM-powered decision simulation system that compares two choices and predicts possible future outcomes. The application uses multiple AI agents to analyze short-term impact, long-term consequences, and hidden risks while also considering user priorities such as salary, learning, stability, and work-life balance.


## User Flow

- User enters two decision options
- User optionally provides additional context
- User adjusts priority sliders such as salary, learning, and stability
- User selects either single-model mode or multi-model ensemble mode
- AI agents simulate future outcomes and risks for both options
- User receives decision scores, best-case scenarios, worst-case scenarios, and final recommendations


## LLM Components

- **Short-Term Outcome Agent** — predicts immediate effects and short-term consequences of each decision
- **Long-Term Projection Agent** — analyzes possible long-term career and life outcomes
- **Risk Analysis Agent** — identifies hidden risks, uncertainties, and trade-offs
- **Multi-Model Ensemble System** — combines outputs from Llama3, Mistral, and Gemma models for broader reasoning
- **Decision Scoring Engine** — generates weighted recommendation scores based on user priorities


## Tools

- **Frontend:** Streamlit
- **Backend:** Python
- **LLM:** Ollama, Llama3, Mistral, Gemma
- **Libraries:** Requests
- **Development Tools:** VS Code, GitHub