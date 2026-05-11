import os
from huggingface_hub import HfApi

# Configuration
REPO_ID = "Sa-m/ai-pentest-api"  # Your Space ID
LOCAL_DIR = "./"  # The folder containing your standalone app

def upload_to_space():
    token = os.getenv("HF_TOKEN")
    if not token:
        print("❌ Error: HF_TOKEN environment variable not set.")
        print("Please run: $env:HF_TOKEN='your_write_token_here'")
        return

    api = HfApi()
    
    print(f"🚀 Starting upload to Hugging Face Space: {REPO_ID}...")
    
    try:
        # Upload the entire folder
        # We ignore .git, .env, and local reports to keep it clean
        api.upload_folder(
            folder_path=LOCAL_DIR,
            repo_id=REPO_ID,
            repo_type="space",
            token=token,
            ignore_patterns=[".git*", ".env*", "reports/*", "__pycache__/*", "*.pyc", "bot.log", "audit.log", "node_modules/*"]
        )
        print("✅ Success! Your files have been uploaded.")
        print(f"🔗 View your space at: https://huggingface.co/spaces/{REPO_ID}")
    except Exception as e:
        print(f"❌ Upload failed: {e}")

if __name__ == "__main__":
    upload_to_space()
