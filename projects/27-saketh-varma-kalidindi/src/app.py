import streamlit as st
import os
from fpdf import FPDF
from engine import extract_text_from_pdf, analyze_tos

# 1. Professional Page Setup
st.set_page_config(page_title="ToS Guardian", page_icon="🛡️", layout="wide")

# --- PDF GENERATION ENGINE ---
def create_pdf_report(report_text):
    """Converts the AI Audit text into a professional PDF document with Unicode safety."""
    pdf = FPDF()
    pdf.add_page()
    
    # Title Header
    pdf.set_font("Arial", 'B', 16)
    pdf.cell(200, 10, txt="ToS GUARDIAN: AI LEGAL AUDIT", ln=True, align='C')
    pdf.set_font("Arial", 'I', 10)
    pdf.cell(200, 10, txt="Automated Financial Transparency Report", ln=True, align='C')
    pdf.ln(10)
    
    # --- THE UNICODE FIX ---
    # FPDF's default fonts don't like emojis or special 'smart quotes'.
    # This line strips them out ONLY for the PDF version so it doesn't crash.
    clean_text = report_text.encode('ascii', 'ignore').decode('ascii')
    
    # Body Text
    pdf.set_font("Arial", size=11)
    pdf.multi_cell(0, 10, txt=clean_text)
    
    # Return as bytes
    return pdf.output(dest='S').encode('latin-1')

# --- CUSTOM CSS FOR THE RISK GAUGE ---
st.markdown("""
    <style>
    .risk-box {
        padding: 20px;
        border-radius: 10px;
        text-align: center;
        font-weight: bold;
        font-size: 24px;
        color: white;
        margin-bottom: 25px;
        border: 2px solid rgba(255,255,255,0.1);
    }
    .red { background-color: #ff4b4b; box-shadow: 0 4px 15px rgba(255,75,75,0.3); }
    .yellow { background-color: #ffa500; color: black; box-shadow: 0 4px 15px rgba(255,165,0,0.3); }
    .green { background-color: #28a745; box-shadow: 0 4px 15px rgba(40,167,69,0.3); }
    </style>
    """, unsafe_allow_html=True)

st.title("🛡️ ToS Guardian Agent")
st.markdown("Automating the detection of predatory 'junk fees' and hidden legal risks.")
st.markdown("---")

# 2. Sidebar Status
with st.sidebar:
    st.header("Agent Intelligence")
    st.success("✅ Fee Detective: Active")
    st.info("🤖 Model: Gemini 2.5 Flash")
    st.write("**University:** Stony Brook")
    st.write("**Student:** Saketh Varma Kalidindi")

# 3. File Upload Logic
uploaded_file = st.file_uploader("Upload your Banking Agreement (PDF)", type="pdf")

if uploaded_file:
    temp_path = "temp_contract.pdf"
    with open(temp_path, "wb") as f:
        f.write(uploaded_file.getbuffer())
    
    col1, col2 = st.columns([1, 2])
    
    with col1:
        st.subheader("📂 Document Status")
        st.write(f"File: `{uploaded_file.name}`")
        
        if st.button("🚀 Start AI Risk Audit"):
            with st.spinner("Agent is auditing 30+ pages of fine print..."):
                text = extract_text_from_pdf(temp_path)
                report = analyze_tos(text)
                st.session_state['report'] = report

    # 4. Results Display
    if 'report' in st.session_state:
        report = st.session_state['report']
        
        # --- DYNAMIC RISK GAUGE LOGIC ---
        risk_level = "LOW RISK"
        risk_class = "green"
        
        # Checking for high-risk markers found in your specific sample contract
        if any(word in report.lower() for word in ["high", "predatory", "penalty", "20."]):
            risk_level = "HIGH RISK"
            risk_class = "red"
        elif any(word in report.lower() for word in ["warning", "medium", "caution"]):
            risk_level = "MEDIUM RISK"
            risk_class = "yellow"

        with col2:
            st.markdown(f'<div class="risk-box {risk_class}">DETECTED RISK LEVEL: {risk_level}</div>', unsafe_allow_html=True)
            
            st.header("📋 Legal Audit Report")
            st.markdown(report)
            
            st.divider()
            
            # --- ACTION & EXPORT ---
            st.subheader("💡 Action & Export")
            c1, c2 = st.columns(2)
            with c1:
                try:
                    pdf_bytes = create_pdf_report(report)
                    st.download_button(
                        label="📥 Download Audit Report (.pdf)",
                        data=pdf_bytes,
                        file_name="ToS_Guardian_Audit_Report.pdf",
                        mime="application/pdf"
                    )
                except Exception as e:
                    st.error(f"PDF Error: {e}")
            with c2:
                if st.button("✍️ Generate Negotiation Script"):
                    st.warning("Negotiation Agent logic being integrated in Phase 2!")

    # Cleanup
    if os.path.exists(temp_path):
        os.remove(temp_path)