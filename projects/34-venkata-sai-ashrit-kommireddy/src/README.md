# ModelScope Lite

A simple FastAPI backend (plus minimal React frontend) that accepts dataset uploads and returns:

- First 5 rows (`preview`)
- Column names (`columns`)
- Dataset shape (`shape`)

Supported upload formats:

- CSV (`.csv`)
- Excel (`.xlsx`, `.xls`)
- JSON (`.json`)

## Project Structure

```text
ModelScope-Lite/
├── app/
│   ├── __init__.py
│   ├── main.py
│   └── services/
│       ├── __init__.py
│       ├── data_analyzer.py
│       └── file_loader.py
└── requirements.txt
```

## Setup

1. Create and activate a virtual environment (optional but recommended):

```bash
python3 -m venv .venv
source .venv/bin/activate
```

2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Frontend setup:

```bash
cd frontend
npm install
```

## Run the Server (uvicorn)

From the project root (`ModelScope-Lite`), run:

```bash
uvicorn app.main:app --reload
```

Server will start at:

- `http://127.0.0.1:8000`
- Interactive docs: `http://127.0.0.1:8000/docs`

## Run Frontend

From the `frontend` directory:

```bash
npm run dev
```

Frontend will start at:

- `http://127.0.0.1:5173`

## API Endpoint

### `POST /upload`

Upload a file as form-data with key `file`.

Example curl:

```bash
curl -X POST "http://127.0.0.1:8000/upload" \
  -F "file=@/path/to/your/data.csv"
```

### `POST /analyze`

Upload a file as form-data with key `file`. Returns:

- Missing values percentage per column
- Duplicate row count
- Column data types
- Basic statistics (`mean`, `std`) for numeric columns
- Correlation matrix
- Highly correlated pairs (`|correlation| > 0.8`)
- Dataset health score (out of 100) with penalty breakdown for:
  - Missing values
  - Duplicate rows
  - High correlation
  - Severe class imbalance (when a label column is found)

Example curl:

```bash
curl -X POST "http://127.0.0.1:8000/analyze" \
  -F "file=@/path/to/your/data.csv"
```
