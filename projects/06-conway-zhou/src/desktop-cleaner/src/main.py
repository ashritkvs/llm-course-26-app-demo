#!/usr/bin/env python3
import argparse
import sys
import os

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.utils import setup_logging


def check_api_key():
    """
    Loads .env and checks that ANTHROPIC_API_KEY is present and not the
    placeholder value. Returns the key on success, exits with a clear
    error message on failure.
    """
    from dotenv import load_dotenv
    load_dotenv()

    key = os.getenv("GEMINI_API_KEY", "").strip()

    if not key or key == "your_gemini_api_key_here":
        print("=" * 60)
        print("  ERROR: Gemini API key not found.")
        print()
        print("  To fix this:")
        print("  1. Open the file: desktop-cleaner\\.env")
        print("  2. Replace  'your_gemini_api_key_here'  with your real key")
        print("  3. Save the file and run the app again")
        print()
        print("  You can get a free API key at: aistudio.google.com")
        print("=" * 60)
        input("\nPress Enter to exit...")
        sys.exit(1)

    return key


def run_gui():
    from PyQt5.QtWidgets import QApplication, QMessageBox
    from gui.app import MainWindow
    app = QApplication(sys.argv)
    window = MainWindow()
    window.show()
    sys.exit(app.exec_())


def run_api():
    import uvicorn
    from api.server import app
    uvicorn.run(app, host="0.0.0.0", port=8000)


if __name__ == "__main__":
    setup_logging()

    parser = argparse.ArgumentParser(description="Desktop Cleaner")
    parser.add_argument("--mode", choices=["gui", "api"], default="gui")
    args = parser.parse_args()

    if args.mode == "api":
        run_api()
    else:
        run_gui()
