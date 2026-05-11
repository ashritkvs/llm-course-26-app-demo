from fastapi import APIRouter, File, UploadFile, HTTPException
from app.config import openai_client
from app.extraction import is_image, extract_text, image_to_base64_url
from app.rag import index_text, clear_vector_store

router = APIRouter()


@router.post("/upload-datadictionary")
async def upload_data_dictionary(file: UploadFile = File(...)):
    file_bytes = await file.read()
    content_type = file.content_type or ""

    if is_image(content_type):
        data_url = image_to_base64_url(file_bytes, content_type)
        response = openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[{
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": data_url}},
                    {"type": "text", "text": "Extract all variable names and their definitions/descriptions from this data dictionary or codebook image. List them clearly."},
                ],
            }],
            max_tokens=2000,
        )
        text = response.choices[0].message.content
    else:
        text = extract_text(file_bytes, content_type)

    if not text.strip():
        raise HTTPException(status_code=400, detail="Could not extract text from the uploaded file.")

    chunk_count = index_text(text)
    return {"message": f"Data dictionary indexed successfully ({chunk_count} chunks)."}


@router.post("/reset-session")
async def reset_session():
    clear_vector_store()
    return {"message": "Session reset."}
