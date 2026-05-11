from io import BytesIO

import pandas as pd
from fastapi import HTTPException

ALLOWED_EXTENSIONS = {".csv", ".xlsx", ".xls", ".json"}


def get_file_extension(filename: str) -> str:
    if "." not in filename:
        return ""
    return "." + filename.rsplit(".", 1)[-1].lower()


def load_dataframe(file_name: str, content: bytes) -> pd.DataFrame:
    if not file_name:
        raise HTTPException(status_code=400, detail="Uploaded file must have a name.")

    extension = get_file_extension(file_name)
    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Please upload CSV, Excel, or JSON.",
        )

    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    try:
        if extension == ".csv":
            return pd.read_csv(BytesIO(content))
        if extension in {".xlsx", ".xls"}:
            return pd.read_excel(BytesIO(content))
        return pd.read_json(BytesIO(content))
    except ValueError as error:
        raise HTTPException(status_code=400, detail=f"Invalid file content: {error}") from error
    except Exception as error:
        raise HTTPException(status_code=400, detail=f"Could not process file: {error}") from error
