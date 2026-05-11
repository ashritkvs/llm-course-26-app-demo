from io import BytesIO

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from app.services.ai_analyzer import generate_dataset_report
from app.services.data_cleaner import (
    dataframe_to_csv_bytes,
    fill_missing_numeric_values,
    remove_duplicate_rows,
)
from app.services.data_analyzer import analyze_dataset, build_upload_summary
from app.services.file_loader import load_dataframe

app = FastAPI(title="ModelScope Lite API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://localhost:5173",
        "https://127.0.0.1:5173",
        "https://modelscope-lite.vercel.app",
    ],
    # Allow Vercel preview/production domains.
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def health_check() -> dict:
    return {"message": "ModelScope Lite backend is running"}


@app.post("/upload")
async def upload_file(file: UploadFile = File(...)) -> dict:
    try:
        content = await file.read()
        dataframe = load_dataframe(file.filename or "", content)
    except HTTPException:
        raise

    return build_upload_summary(dataframe)


@app.post("/analyze")
async def analyze_file(file: UploadFile = File(...)) -> dict:
    try:
        content = await file.read()
        dataframe = load_dataframe(file.filename or "", content)
    except HTTPException:
        raise

    analysis = analyze_dataset(dataframe)
    try:
        analysis["ai_report"] = generate_dataset_report(analysis)
    except Exception as error:
        # Do not fail data analysis if the AI provider is unavailable.
        analysis["ai_report"] = None
        analysis["ai_report_error"] = str(error)
    return analysis


@app.post("/clean/remove-duplicates")
async def clean_remove_duplicates(file: UploadFile = File(...)) -> dict:
    try:
        content = await file.read()
        dataframe = load_dataframe(file.filename or "", content)
    except HTTPException:
        raise

    cleaned_df, removed_count = remove_duplicate_rows(dataframe)
    return {
        "action": "remove_duplicates",
        "removed_duplicates": removed_count,
        "summary": build_upload_summary(cleaned_df),
    }


@app.post("/clean/fill-missing")
async def clean_fill_missing(file: UploadFile = File(...), strategy: str = "mean") -> dict:
    try:
        content = await file.read()
        dataframe = load_dataframe(file.filename or "", content)
    except HTTPException:
        raise

    cleaned_df, filled_cells = fill_missing_numeric_values(dataframe, strategy=strategy)
    return {
        "action": "fill_missing",
        "strategy": strategy,
        "filled_cells": filled_cells,
        "summary": build_upload_summary(cleaned_df),
    }


@app.post("/clean/download")
async def download_cleaned_dataset(
    file: UploadFile = File(...),
    remove_duplicates: bool = False,
    fill_missing: bool = False,
    strategy: str = "mean",
) -> StreamingResponse:
    try:
        content = await file.read()
        dataframe = load_dataframe(file.filename or "", content)
    except HTTPException:
        raise

    cleaned_df = dataframe.copy()
    if remove_duplicates:
        cleaned_df, _ = remove_duplicate_rows(cleaned_df)
    if fill_missing:
        cleaned_df, _ = fill_missing_numeric_values(cleaned_df, strategy=strategy)

    output_bytes = dataframe_to_csv_bytes(cleaned_df)
    filename_base = (file.filename or "dataset").rsplit(".", 1)[0]
    headers = {"Content-Disposition": f'attachment; filename="{filename_base}_cleaned.csv"'}
    return StreamingResponse(BytesIO(output_bytes), media_type="text/csv", headers=headers)
