from fastapi import APIRouter, File, UploadFile, Form
import json
from app.config import openai_client
from app.extraction import is_image, extract_text, image_to_base64_url
from app.rag import build_system_prompt

router = APIRouter()


@router.post("/chat")
async def chat(
    message: str = Form(...),
    history: str = Form(default="[]"),
    files: list[UploadFile] = File(default=[]),
):
    history_list = json.loads(history)
    is_first_message = len(history_list) == 0
    first_type = files[0].content_type if files else ""

    if files and is_image(first_type):
        # Vision: always include images in every message for full context
        image_files = [(await f.read(), f.content_type) for f in files]
        system = build_system_prompt(message)
        content: list = []
        for fb, ct in image_files:
            content.append({"type": "image_url", "image_url": {"url": image_to_base64_url(fb, ct)}})
        content.append({"type": "text", "text": message})
        current_msg = {"role": "user", "content": content}
        stored_user_content = message

    elif files and is_first_message:
        # Text file, first message: embed extracted content into user message
        file_bytes = await files[0].read()
        extracted = extract_text(file_bytes, first_type)
        system = build_system_prompt(extracted + " " + message)
        user_content = f"Here is the SAS output:\n\n{extracted}\n\n{message}"
        current_msg = {"role": "user", "content": user_content}
        stored_user_content = user_content

    else:
        # Follow-up: SAS content already in history, just send new question
        retrieval_query = " ".join(
            h.get("content", "")[:300] for h in history_list[:2]
            if isinstance(h.get("content"), str)
        ) + " " + message
        system = build_system_prompt(retrieval_query)
        current_msg = {"role": "user", "content": message}
        stored_user_content = message

    messages = [{"role": "system", "content": system}] + history_list + [current_msg]

    response = openai_client.chat.completions.create(
        model="gpt-4o",
        messages=messages,
        max_tokens=1500,
    )
    assistant_content = response.choices[0].message.content

    return {
        "response": assistant_content,
        "user_content": stored_user_content,
    }
