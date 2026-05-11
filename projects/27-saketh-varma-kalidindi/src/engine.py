import os
import pdfplumber
import google.generativeai as genai
from dotenv import load_dotenv

# 1. Load environment variables
load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    print("❌ ERROR: GEMINI_API_KEY not found in .env file.")
else:
    genai.configure(api_key=api_key)
    
    # --- DIAGNOSTIC BLOCK: Check available models ---
    print("📊 Checking available models for your API key...")
    try:
        for m in genai.list_models():
            if 'generateContent' in m.supported_generation_methods:
                print(f"✅ Found: {m.name}")
    except Exception as e:
        print(f"⚠️ Could not list models: {e}")

def extract_text_from_pdf(pdf_path):
    """Extracts all text from a PDF file using pdfplumber."""
    text = ""
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
        return text
    except Exception as e:
        return f"Error reading PDF: {str(e)}"

def analyze_tos(contract_text):
    """The 'Fee Detective Agent' logic using Gemini."""
    if not contract_text or len(contract_text) < 100:
        return "Error: Document text is too short or could not be read."

    # UPDATED MODEL NAME: Using the full path to avoid 404
    model = genai.GenerativeModel('models/gemini-2.5-flash')
    
    prompt = f"""
    You are a high-level Banking Lawyer. Analyze this text:
    1. Identify all hidden fees (maintenance, inactivity, late fees).
    2. Flag any predatory clauses (arbitration, high interest).
    3. Summarize the 'Fine Print' in 5 simple bullet points.
    
    TEXT:
    {contract_text}
    """
    
    try:
        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        return f"Error during AI Analysis: {str(e)}"

# --- TEST EXECUTION ---
if __name__ == "__main__":
    FILE_NAME = "sample_contract.pdf" 
    
    print(f"🚀 Script started. Looking for: {FILE_NAME}")
    
    if os.path.exists(FILE_NAME):
        print(f"✅ Found the file! Starting extraction...")
        raw_text = extract_text_from_pdf(FILE_NAME)
        print(f"📄 Extracted {len(raw_text)} characters.")
        
        print("🤖 Sending to Gemini... please wait...")
        final_report = analyze_tos(raw_text)
        
        print("\n" + "="*50)
        print("FINAL AUDIT REPORT")
        print("="*50 + "\n")
        print(final_report)
    else:
        print(f"❌ ERROR: File '{FILE_NAME}' not found.")