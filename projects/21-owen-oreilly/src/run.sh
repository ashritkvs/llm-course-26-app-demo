#!/bin/bash

# 1. Check if Python 3 is installed
if ! command -v python3 &> /dev/null; then
    echo "Error: Python 3 is not installed."
    exit 1
fi

# 2. Create Virtual Environment
if [ ! -d "venv" ]; then
    echo "[1/3] Creating virtual environment..."
    python3 -m venv venv
fi

# 3. Activate and Install
echo "[2/3] Preparing dependencies..."
source venv/bin/activate
pip install --upgrade pip > /dev/null
pip install -r requirements.txt > /dev/null

# 4. Run the application
echo "[3/3] Starting server..."
python3 backend.py