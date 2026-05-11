from io import BytesIO

import pandas as pd
from fastapi import HTTPException


def remove_duplicate_rows(dataframe: pd.DataFrame) -> tuple[pd.DataFrame, int]:
    before_count = len(dataframe)
    cleaned = dataframe.drop_duplicates().copy()
    removed_count = int(before_count - len(cleaned))
    return cleaned, removed_count


def fill_missing_numeric_values(dataframe: pd.DataFrame, strategy: str) -> tuple[pd.DataFrame, int]:
    if strategy not in {"mean", "median"}:
        raise HTTPException(status_code=400, detail="Strategy must be 'mean' or 'median'.")

    cleaned = dataframe.copy()
    numeric_columns = cleaned.select_dtypes(include=["number"]).columns
    filled_cells = 0

    for column in numeric_columns:
        missing_before = int(cleaned[column].isna().sum())
        if missing_before == 0:
            continue
        fill_value = cleaned[column].mean() if strategy == "mean" else cleaned[column].median()
        cleaned[column] = cleaned[column].fillna(fill_value)
        filled_cells += missing_before

    return cleaned, filled_cells


def dataframe_to_csv_bytes(dataframe: pd.DataFrame) -> bytes:
    csv_content = dataframe.to_csv(index=False)
    return BytesIO(csv_content.encode("utf-8")).getvalue()
