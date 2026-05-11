import streamlit as st
import requests
import concurrent.futures

OLLAMA_URL = "http://localhost:11434/api/generate"


# -----------------------------
# 🔹 BASE CALL
# -----------------------------
def call_ollama(model: str, prompt: str) -> str:
    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False
    }

    try:
        response = requests.post(OLLAMA_URL, json=payload, timeout=120)
        response.raise_for_status()
        data = response.json()
        return data.get("response", "").strip()
    except:
        return "⚠️ Error: Ollama not running or model missing."


# -----------------------------
# 🔥 MULTI-MODEL CORE
# -----------------------------
def multi_model_call(prompt):
    models = ["llama3", "mistral", "gemma"]

    responses = []

    with concurrent.futures.ThreadPoolExecutor() as executor:
        futures = [executor.submit(call_ollama, m, prompt) for m in models]

        for f in futures:
            responses.append(f.result())

    return responses


def aggregator_agent(responses):
    combined = "\n\n".join(
        [f"Model {i+1}:\n{r}" for i, r in enumerate(responses)]
    )

    prompt = f"""
You are an Aggregation Agent.

Combine the following model outputs:

{combined}

Instructions:
- Remove repetition
- Keep best insights
- Be concise and structured
"""
    return call_ollama("llama3", prompt)


# -----------------------------
# 🔹 GENERIC RUN FUNCTION
# -----------------------------
def run_agent(prompt, model, multi_mode):
    if multi_mode:
        responses = multi_model_call(prompt)
        return aggregator_agent(responses)
    else:
        return call_ollama(model, prompt)


# -----------------------------
# 🔹 AGENTS
# -----------------------------
def short_term_agent(decision, context, priorities, model, multi):
    prompt = f"""
Analyze short-term (1-2 years)

{decision}
{context}
{priorities}

Max 5 bullets
"""
    return run_agent(prompt, model, multi)


def long_term_agent(decision, context, priorities, model, multi):
    prompt = f"""
Analyze long-term (5-10 years)

{decision}
{context}
{priorities}

Max 5 bullets
"""
    return run_agent(prompt, model, multi)


def risk_agent(decision, context, priorities, model, multi):
    prompt = f"""
Identify risks & trade-offs

{decision}
{context}
{priorities}

Max 5 bullets
"""
    return run_agent(prompt, model, multi)


def scenario_agent(decision, context, priorities, model, multi):
    prompt = f"""
Generate:

Best Case
Worst Case
Most Likely Case

{decision}
{context}
{priorities}
"""
    return run_agent(prompt, model, multi)


def scoring_agent(decision, short_term, long_term, risks, model, multi):
    prompt = f"""
Assign score (1-10)

{decision}

{short_term}
{long_term}
{risks}

Option A + Option B scores
"""
    return run_agent(prompt, model, multi)


def insight_agent(decision, short_term, long_term, risks, model, multi):
    prompt = f"""
Give 2-3 key insights

{decision}

{short_term}
{long_term}
{risks}
"""
    return run_agent(prompt, model, multi)


def final_synthesizer(decision, short_term, long_term, risks, model, multi):
    prompt = f"""
Create structured output

{decision}

{short_term}
{long_term}
{risks}
"""
    return run_agent(prompt, model, multi)


# -----------------------------
# 🔹 UI
# -----------------------------
st.set_page_config(page_title="FutureYou AI", layout="wide")

st.title("FutureYou AI")
st.subheader("Long-Term Consequence Simulator")

with st.sidebar:
    st.header("Settings")

    model_name = st.selectbox("Model", ["llama3", "mistral", "gemma"])

    multi_mode = st.toggle("🔥 Multi-Model Mode")

    st.subheader("Priorities")
    salary = st.slider("Salary", 0, 10, 5)
    learning = st.slider("Learning", 0, 10, 5)
    stability = st.slider("Stability", 0, 10, 5)
    worklife = st.slider("Work-Life", 0, 10, 5)

priorities = f"""
Salary: {salary}/10
Learning: {learning}/10
Stability: {stability}/10
Work-Life: {worklife}/10
"""

# Input
st.markdown("## Enter Decision")

option_a = st.text_input("Option A")
option_b = st.text_input("Option B")

context = st.text_area("Context")

decision = f"""
Option A: {option_a}
Option B: {option_b}
"""

# Run
if st.button("Simulate"):

    if not option_a or not option_b:
        st.warning("Enter both options")
    else:

        with st.spinner("Running agents..."):

            with concurrent.futures.ThreadPoolExecutor() as executor:
                f1 = executor.submit(short_term_agent, decision, context, priorities, model_name, multi_mode)
                f2 = executor.submit(long_term_agent, decision, context, priorities, model_name, multi_mode)
                f3 = executor.submit(risk_agent, decision, context, priorities, model_name, multi_mode)

                short_term = f1.result()
                long_term = f2.result()
                risks = f3.result()

        scenario = scenario_agent(decision, context, priorities, model_name, multi_mode)
        score = scoring_agent(decision, short_term, long_term, risks, model_name, multi_mode)
        insight = insight_agent(decision, short_term, long_term, risks, model_name, multi_mode)
        final = final_synthesizer(decision, short_term, long_term, risks, model_name, multi_mode)

        st.success("Done")

        st.markdown("## 📊 Decision Score")
        st.markdown(score)

        col1, col2 = st.columns(2)

        with col1:
            st.markdown("### 🔵 Short-Term")
            st.markdown(short_term)

            st.markdown("### 🟢 Long-Term")
            st.markdown(long_term)

        with col2:
            st.markdown("### 🔴 Risks")
            st.markdown(risks)

            st.markdown("### 💡 Insights")
            st.markdown(insight)

        st.markdown("### 🔮 Scenarios")
        st.markdown(scenario)

        st.markdown("### 🧠 Final Reflection")
        st.markdown(final)