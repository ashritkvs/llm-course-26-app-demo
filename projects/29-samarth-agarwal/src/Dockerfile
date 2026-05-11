# syntax=docker/dockerfile:1
FROM python:3.11-slim

# Install system deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    nmap \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy app source
COPY agents/ ./agents/
COPY core/ ./core/
COPY api_server.py .
COPY main.py .

# Create reports directories with permissions
RUN mkdir -p reports/recon reports/vulns reports/exploits reports/final && chmod -R 777 reports

# HF Spaces/Render/Cloud Run usually provide a PORT env var.
# HF specifically requires 7860.
EXPOSE 7860

# Use waitress for production
CMD ["python", "-c", "import os; from waitress import serve; from api_server import app; port = int(os.environ.get('PORT', 7860)); print(f'Starting server on port {port}'); serve(app, host='0.0.0.0', port=port)"]
