from flask import Flask, request, jsonify
import os
import json 
import uuid 
from flask_cors import CORS
from langchain_community.vectorstores.faiss import FAISS
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from dotenv import load_dotenv
import google.generativeai as genai
from pathlib import Path
from flask_login import LoginManager, UserMixin, login_user, logout_user, current_user, login_required
from werkzeug.security import generate_password_hash, check_password_hash
from sqlalchemy import create_engine, Column, String, Text, Integer, DateTime, Boolean 
from sqlalchemy.orm import sessionmaker, declarative_base
from classify_questions import classify_question
from datetime import datetime, timedelta, timezone
from email.mime.multipart import MIMEMultipart # 🟡 NEW IMPORT

os.environ['KMP_DUPLICATE_LIB_OK'] = 'True'

# 🟡 NEW SECURITY IMPORTS
import pyotp
import qrcode
import base64
from io import BytesIO
import smtplib
from email.mime.text import MIMEText
import random

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "supersecret")
login_manager = LoginManager()
login_manager.init_app(app)

@login_manager.unauthorized_handler
def unauthorized_callback():
    return jsonify({"error": "Unauthorized"}), 401

app.config.update(
    SESSION_COOKIE_SAMESITE='Lax',
    SESSION_COOKIE_SECURE=False
)

CORS(
    app,
    supports_credentials=True,
    origins=["http://127.0.0.1:3000", "http://localhost:3000"],
)

API_KEY = os.getenv("GOOGLE_API_KEY")
if not API_KEY: raise ValueError("GOOGLE_API_KEY not found in .env file")

genai.configure(api_key=API_KEY)
embed = GoogleGenerativeAIEmbeddings(google_api_key=API_KEY, model="models/gemini-embedding-001")
USER_DATA_FILE = "user_data.txt"
folder_name = "store"

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE_URL = f"sqlite:///{os.path.join(BASE_DIR, 'users.db')}"

engine = create_engine(DATABASE_URL, echo=False, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()

# 🟡 UPGRADED USER MODEL
class User(Base, UserMixin):
    __tablename__ = "users"
    id = Column(String(150), primary_key=True)
    email = Column(String(150), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    totp_secret = Column(String(32), nullable=False)
    reset_otp = Column(String(6), nullable=True)
    reset_otp_expiry = Column(DateTime, nullable=True)

    def set_password(self, password: str):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        return check_password_hash(self.password_hash, password)

class ChatSession(Base):
    __tablename__ = "chat_sessions"
    id = Column(String(50), primary_key=True)
    user_id = Column(String(150), nullable=False)
    title = Column(String(255), default="New Chat")
    is_pinned = Column(Boolean, default=False)
    is_archived = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class ChatMessage(Base):
    __tablename__ = "chat_messages"
    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String(50), nullable=False)
    role = Column(String(10), nullable=False) 
    content = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)

Base.metadata.create_all(bind=engine)

@login_manager.user_loader
def load_user(user_id: str):
    db = SessionLocal()
    try: return db.get(User, user_id)
    finally: db.close()

# --- 🟡 EMAIL HELPER FUNCTION ---
# --- 🟡 UPGRADED HTML EMAIL HELPER FUNCTION ---
def send_email_otp(to_email, otp_code):
    sender = os.getenv("EMAIL_SENDER")
    pwd = os.getenv("EMAIL_PASSWORD")
    if not sender or not pwd:
        print("⚠️ Warning: Email credentials not set in .env")
        return False
    
    # Create a multipart message (supports both plain text and HTML)
    msg = MIMEMultipart("alternative")
    msg['Subject'] = "FinSight AI - Security Verification Code"
    msg['From'] = f"FinSight Security <{sender}>"
    msg['To'] = to_email

    # Fallback plain text (for older email clients)
    text = f"Your FinSight AI security code is: {otp_code}\n\nThis code expires in 10 minutes."

    # Enterprise-grade HTML Template
    html = f"""
    <html>
      <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f9fafb; padding: 40px 20px; margin: 0;">
        <div style="max-width: 500px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; padding: 40px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); border: 1px solid #f3f4f6;">
          
          <h2 style="color: #4f46e5; text-align: center; font-size: 28px; font-weight: 800; margin-top: 0; margin-bottom: 24px; letter-spacing: -0.5px;">
            FinSight AI
          </h2>
          
          <p style="color: #374151; font-size: 16px; text-align: center; margin-bottom: 32px; line-height: 1.5;">
            You requested a security verification code. Please use the code below to securely access your account.
          </p>
          
          <div style="background-color: #f3f4f6; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 32px;">
            <span style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #111827;">
              {otp_code}
            </span>
          </div>
          
          <p style="color: #6b7280; font-size: 14px; text-align: center; margin-bottom: 24px;">
            This secure code will expire in <strong style="color: #374151;">10 minutes</strong>.
          </p>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;" />
          
          <p style="color: #9ca3af; font-size: 12px; text-align: center; line-height: 1.5; margin-bottom: 0;">
            If you did not request this code, your account is still secure. You can safely ignore this email.
          </p>
          
        </div>
      </body>
    </html>
    """

    # Attach both versions to the email
    part1 = MIMEText(text, "plain")
    part2 = MIMEText(html, "html")
    msg.attach(part1)
    msg.attach(part2)

    try:
        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
            server.login(sender, pwd)
            server.send_message(msg)
        return True
    except Exception as e:
        print(f"Error sending email: {e}")
        return False

# --- 🟡 UPGRADED AUTH ROUTES ---

@app.route('/signup', methods=['POST'])
def signup():
    data = request.get_json() or {}
    user_id = data.get('user_id')
    email = data.get('email')
    password = data.get('password')
    
    if not user_id or not email or not password: 
        return jsonify({"error": "ID, email, and password required"}), 400
        
    db = SessionLocal()
    try:
        if db.get(User, user_id) or db.query(User).filter(User.email == email).first():
            return jsonify({"error": "User ID or Email already exists"}), 400
            
        # Generate a unique Authenticator Secret for this user
        totp_secret = pyotp.random_base32()
        
        user = User(id=user_id, email=email, totp_secret=totp_secret)
        user.set_password(password)
        db.add(user)
        db.commit()

        # Generate the QR Code image to send back to React
        totp_uri = pyotp.totp.TOTP(totp_secret).provisioning_uri(name=email, issuer_name="FinSight AI")
        img = qrcode.make(totp_uri)
        buffered = BytesIO()
        img.save(buffered, format="PNG")
        qr_base64 = base64.b64encode(buffered.getvalue()).decode("utf-8")

        return jsonify({"message": "Created", "qr_code": f"data:image/png;base64,{qr_base64}"}), 201
    finally: db.close()

@app.route('/login_step1', methods=['POST'])
def login_step1():
    # Step 1: Verify Password, but DO NOT log them in yet. Ask for 2FA.
    data = request.get_json() or {}
    user_id = data.get('user_id')
    password = data.get('password')
    db = SessionLocal()
    try:
        user = db.get(User, user_id)
        if not user or not user.check_password(password): 
            return jsonify({"error": "Invalid credentials"}), 401
            
        return jsonify({"message": "Password valid. Proceed to 2FA.", "user_id": user.id, "email": user.email}), 200
    finally: db.close()

@app.route('/verify_2fa', methods=['POST'])
def verify_2fa():
    # Step 2: Verify the 6-digit Authenticator code
    data = request.get_json() or {}
    user_id = data.get('user_id')
    code = data.get('code')
    db = SessionLocal()
    try:
        user = db.get(User, user_id)
        if not user: return jsonify({"error": "User not found"}), 404
        
        totp = pyotp.TOTP(user.totp_secret)
        if totp.verify(code, valid_window=1):
            login_user(user)
            return jsonify({"message": "Logged in successfully"}), 200
        else:
            return jsonify({"error": "Invalid Authenticator Code"}), 401
    finally: db.close()

@app.route('/request_email_fallback', methods=['POST'])
def request_email_fallback():
    # The Fallback: User clicked "Send email instead" or "Forgot Password"
    data = request.get_json() or {}
    identifier = data.get('user_id') or data.get('email') # Accept either
    db = SessionLocal()
    try:
        user = db.query(User).filter((User.id == identifier) | (User.email == identifier)).first()
        if not user: return jsonify({"error": "User not found"}), 404

        otp_code = str(random.randint(100000, 999999))
        user.reset_otp = otp_code
        user.reset_otp_expiry = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(minutes=10)
        db.commit()

        if send_email_otp(user.email, otp_code):
            # Mask the email so the UI can say "Sent to d***@gmail.com" securely
            masked_email = user.email[:2] + "****" + user.email[user.email.find("@"):]
            return jsonify({"message": "Code sent", "email": masked_email, "user_id": user.id}), 200
        else:
            return jsonify({"error": "Failed to send email. Check backend logs."}), 500
    finally: db.close()

@app.route('/verify_email_login', methods=['POST'])
def verify_email_login():
    # Logging in via Email Fallback
    data = request.get_json() or {}
    user_id = data.get('user_id')
    code = data.get('code')
    db = SessionLocal()
    try:
        user = db.get(User, user_id)
        if not user: return jsonify({"error": "User not found"}), 404
        
        if user.reset_otp == code and user.reset_otp_expiry and user.reset_otp_expiry > datetime.now(timezone.utc).replace(tzinfo=None):
            # Clear the OTP so it can't be reused
            user.reset_otp = None
            user.reset_otp_expiry = None
            db.commit()
            login_user(user)
            return jsonify({"message": "Logged in via Email"}), 200
        else:
            return jsonify({"error": "Invalid or expired Email Code"}), 401
    finally: db.close()

@app.route('/reset_password_with_otp', methods=['POST'])
def reset_password_with_otp():
    # Forgot Password Flow: Verify Email OTP and set new password
    data = request.get_json() or {}
    user_id = data.get('user_id')
    code = data.get('code')
    new_password = data.get('new_password')
    db = SessionLocal()
    try:
        user = db.get(User, user_id)
        if not user: return jsonify({"error": "User not found"}), 404
        
        if user.reset_otp == code and user.reset_otp_expiry and user.reset_otp_expiry > datetime.now(timezone.utc).replace(tzinfo=None):
            user.set_password(new_password)
            user.reset_otp = None
            user.reset_otp_expiry = None
            db.commit()
            return jsonify({"message": "Password reset successfully!"}), 200
        else:
            return jsonify({"error": "Invalid or expired Reset Code"}), 401
    finally: db.close()

@app.route('/logout', methods=['POST'])
@login_required
def logout():
    logout_user()
    return jsonify({"message": "Logged out"}), 200

@app.route('/current_user', methods=['GET'])
def whoami():
    if current_user.is_authenticated: return jsonify({"user_id": current_user.id})
    return jsonify({"user_id": None})

# =====================================================================
# --- AI, RAG, & FAISS LOGIC (Unchanged and perfectly optimized) ---
# =====================================================================

def financial_education(user_id, question, image_data=None):
    try:
        contents = [question] if question else ["Please analyze this financial document."]
        if image_data:
            header, encoded = image_data.split(",", 1)
            mime_type = header.split(";")[0].split(":")[1]
            contents.append({"mime_type": mime_type, "data": encoded})
        model = genai.GenerativeModel("gemini-2.5-flash")
        response = model.generate_content(contents)
        return response.text if response and response.text else "No response."
    except Exception as e: return f"Error: {str(e)}"

def personal_budgeting(user_id, question, image_data=None):
    try:
        user_folder = os.path.join(folder_name, user_id)
        index_file_path = os.path.join(user_folder, "index.faiss")
        all_docs_data = "No past transactions recorded yet."
        if os.path.exists(index_file_path):
            vs = FAISS.load_local(str(user_folder), embeddings=embed, allow_dangerous_deserialization=True)
            docs = vs.max_marginal_relevance_search(question, k=15, fetch_k=50)
            if docs: 
                formatted_docs = []
                for doc in docs:
                    meta = doc.metadata
                    formatted_docs.append(f"[{meta.get('date', 'Unknown')}] {meta.get('type', '').upper()} - Category: {meta.get('category', '')} - Amount: ${meta.get('amount', 0)} | Details: {doc.page_content}")
                all_docs_data = "\n".join(formatted_docs)

        today_date = datetime.now().strftime("%B %d, %Y")
        prompt = f"""Today's current date is: {today_date}. The user is asking: "{question}"
        Here is the retrieved FAISS transaction history (with strict metadata): 
        {all_docs_data}
        Use this structured context to answer accurately. Pay close attention to the exact dates and amounts in the metadata."""
        
        contents = [prompt]
        if image_data:
            header, encoded = image_data.split(",", 1)
            mime_type = header.split(";")[0].split(":")[1]
            contents.append({"mime_type": mime_type, "data": encoded})

        model = genai.GenerativeModel("gemini-2.5-flash")
        response = model.generate_content(contents)
        return response.text if response and response.text else "No response."
    except Exception as e: return f"Error: {str(e)}"

@app.route('/extract_transaction', methods=['POST'])
@login_required
def extract_transaction():
    data = request.get_json()
    text = data.get("text")
    image_data = data.get("image")
    current_date = data.get("current_date")
    if not text and not image_data: return jsonify({"error": "No text/image"}), 400
    categories_list = ["Food & Dining", "Transportation", "Entertainment", "Shopping", "Utilities", "Healthcare", "Education", "Travel", "Other"]
    prompt = f"Extract to JSON. Current date: {current_date}. Return amount, transaction_type, category, description, date."
    contents = [prompt]
    if image_data:
        try:
            header, encoded = image_data.split(",", 1)
            mime_type = header.split(";")[0].split(":")[1]
            contents.append({"mime_type": mime_type, "data": encoded})
        except: return jsonify({"error": "Invalid image"}), 400
    if text: contents.append(f'User Input: "{text}"')
    try:
        model = genai.GenerativeModel("gemini-2.5-flash")
        response = model.generate_content(contents, generation_config=genai.GenerationConfig(response_mime_type="application/json"))
        return jsonify(json.loads(response.text)), 200
    except Exception as e: return jsonify({"error": str(e)}), 500

@app.route('/get_transactions', methods=['GET'])
@login_required
def get_transactions():
    user_folder = os.path.join(folder_name, current_user.id)
    file_path = os.path.join(user_folder, USER_DATA_FILE)
    if not os.path.exists(file_path): return jsonify({'transactions': []})
    with open(file_path, "r") as f:
        return jsonify({'transactions': [json.loads(line.strip()) for line in f if line.strip()]}), 200

@app.route('/update_user', methods=['POST'])
@login_required
def update_user():
    try:
        data = request.get_json()
        user_folder = os.path.join(folder_name, current_user.id)
        os.makedirs(user_folder, exist_ok=True)
        vector_store_path = os.path.join(user_folder)
        index_file_path = Path(vector_store_path) / "index.faiss"
        
        date = data.get("date")  
        transaction_text = f"{data['amount']} {data['transaction_type']} {data['category']} {data['description']} on {date}"
        
        metadata = {
            "amount": float(data['amount']),
            "category": data['category'],
            "date": date,
            "type": data['transaction_type']
        }
        
        embedding = embed.embed_query(transaction_text)
        
        if not index_file_path.exists(): 
            vector_store = FAISS.from_texts(texts=[transaction_text], embedding=embed, metadatas=[metadata])
        else:
            vector_store = FAISS.load_local(vector_store_path, embeddings=embed, allow_dangerous_deserialization=True)
            vector_store.add_texts([transaction_text], embeddings=[embedding], metadatas=[metadata])
            
        vector_store.save_local(vector_store_path)
        with open(os.path.join(user_folder, USER_DATA_FILE), "a") as f: 
            f.write(json.dumps(data) + "\n")
        return jsonify({"message": "Updated"}), 200
    except Exception as e: return jsonify({"error": str(e)}), 500

@app.route('/get_chat_sessions', methods=['GET'])
@login_required
def get_chat_sessions():
    db = SessionLocal()
    try:
        sessions = db.query(ChatSession).filter(ChatSession.user_id == current_user.id).order_by(ChatSession.created_at.desc()).all()
        return jsonify([{"id": s.id, "title": s.title, "is_pinned": s.is_pinned, "is_archived": s.is_archived} for s in sessions]), 200
    finally: db.close()

@app.route('/get_chat_history/<session_id>', methods=['GET'])
@login_required
def get_chat_history(session_id):
    db = SessionLocal()
    try:
        session = db.query(ChatSession).filter(ChatSession.id == session_id, ChatSession.user_id == current_user.id).first()
        if not session: return jsonify({"error": "Not found"}), 404
        messages = db.query(ChatMessage).filter(ChatMessage.session_id == session_id).order_by(ChatMessage.timestamp.asc()).all()
        return jsonify([{"role": m.role, "content": m.content} for m in messages]), 200
    finally: db.close()

@app.route('/update_chat/<session_id>', methods=['PUT'])
@login_required
def update_chat(session_id):
    data = request.get_json()
    db = SessionLocal()
    try:
        session = db.query(ChatSession).filter(ChatSession.id == session_id, ChatSession.user_id == current_user.id).first()
        if not session: return jsonify({"error": "Not found"}), 404
        if 'title' in data: session.title = data['title']
        if 'is_pinned' in data: session.is_pinned = data['is_pinned']
        if 'is_archived' in data: session.is_archived = data['is_archived']
        db.commit()
        return jsonify({"message": "Updated successfully"}), 200
    finally: db.close()

@app.route('/delete_chat/<session_id>', methods=['DELETE'])
@login_required
def delete_chat(session_id):
    db = SessionLocal()
    try:
        session = db.query(ChatSession).filter(ChatSession.id == session_id, ChatSession.user_id == current_user.id).first()
        if not session: return jsonify({"error": "Not found"}), 404
        db.query(ChatMessage).filter(ChatMessage.session_id == session_id).delete()
        db.delete(session)
        db.commit()
        return jsonify({"message": "Chat deleted"}), 200
    finally: db.close()

@app.route('/agentic_query', methods=['POST'])
@login_required
def agentic_query():
    data = request.get_json()
    user_id = current_user.id
    question = data.get("question", "").strip()
    image_data = data.get("image")
    session_id = data.get("session_id")

    if not question and not image_data: return jsonify({"error": "Missing input"}), 400

    db = SessionLocal()
    try:
        if not session_id:
            session_id = str(uuid.uuid4())
            title = (question[:25] + "...") if question else "Document Analysis"
            new_session = ChatSession(id=session_id, user_id=user_id, title=title)
            db.add(new_session)
            db.commit()
        else:
            session = db.query(ChatSession).filter(ChatSession.id == session_id, ChatSession.user_id == user_id).first()
            if not session: return jsonify({"error": "Invalid session"}), 400

        user_msg = ChatMessage(session_id=session_id, role="user", content=question if question else "[Image Uploaded]")
        db.add(user_msg)
        db.commit()

        category = "personal budgeting"
        if question: category = classify_question(question).strip().lower()

        if "personal budgeting" in category or "personal_budgeting" in category:
            answer = personal_budgeting(user_id, question, image_data)
        else:
            answer = financial_education(user_id, question, image_data)

        bot_msg = ChatMessage(session_id=session_id, role="bot", content=answer)
        db.add(bot_msg)
        db.commit()

        return jsonify({"response": answer, "session_id": session_id, "title": db.query(ChatSession).filter(ChatSession.id == session_id).first().title}), 200
    except Exception as e: return jsonify({"error": str(e)}), 500
    finally: db.close()

if __name__ == '__main__':
    app.run(debug=True)