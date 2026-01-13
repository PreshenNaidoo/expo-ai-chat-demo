import os
from typing import List, Optional

import psycopg2
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from openai import OpenAI
from pydantic import BaseModel, Field

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is required for the AI service")

conn = psycopg2.connect(DATABASE_URL)
conn.autocommit = True

client = OpenAI()

app = FastAPI()


class InferPayload(BaseModel):
    user_id: Optional[str] = None
    prompt: str = Field(..., min_length=1)


@app.get("/health")
async def health():
    return {"ok": True}


@app.post("/infer")
async def infer(payload: InferPayload):
    prompt_text = payload.prompt.strip()
    if not prompt_text:
        raise HTTPException(status_code=400, detail="Prompt is required")

    try:
        completion = client.chat.completions.create(
            model=os.getenv("OPENAI_MODEL", "gpt-5"),
            messages=[
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": prompt_text}
            ]
        )
    except Exception:
        raise HTTPException(status_code=502, detail="AI service unavailable")

    answer = ""
    try:
        answer = completion.choices[0].message.content or ""
    except Exception:
        answer = ""

    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "INSERT INTO ai_logs (user_id, prompt, response) VALUES (%s, %s, %s)",
                (payload.user_id, prompt_text, answer)
            )
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to persist AI log")

    return {"answer": answer}


@app.post("/infer/stream")
async def infer_stream(payload: InferPayload):
    prompt_text = payload.prompt.strip()
    if not prompt_text:
        raise HTTPException(status_code=400, detail="Prompt is required")

    try:
        stream = client.chat.completions.create(
            model=os.getenv("OPENAI_MODEL", "gpt-5"),
            messages=[
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": prompt_text}
            ],
            stream=True
        )
    except Exception:
        raise HTTPException(status_code=502, detail="AI service unavailable")

    answer_parts: List[str] = []

    def generator():
        try:
            for event in stream:
                try:
                    delta = event.choices[0].delta.content or ""
                except Exception:
                    delta = ""
                if delta:
                    answer_parts.append(delta)
                    yield delta
        finally:
            if not answer_parts:
                return
            try:
                with conn.cursor() as cursor:
                    cursor.execute(
                        "INSERT INTO ai_logs (user_id, prompt, response) VALUES (%s, %s, %s)",
                        (payload.user_id, prompt_text, "".join(answer_parts))
                    )
            except Exception:
                return

    return StreamingResponse(generator(), media_type="text/plain")
