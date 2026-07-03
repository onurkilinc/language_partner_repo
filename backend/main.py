from typing import Literal

from fastapi import FastAPI
from fastapi import File
from fastapi import HTTPException
from fastapi import UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from agent import generate_reply
from agent import generate_review
from agent import load_topics
from agent import pick_random_task
from agent import transcribe_audio
from memory import SessionMemory
from prompts import MODES

app = FastAPI()
memory = SessionMemory(max_history_tokens=1200)
cost_store: dict[str, dict[str, float | int]] = {}
session_store: dict[str, dict[str, str]] = {}

# USD per 1M tokens for gpt-4o-mini
INPUT_PRICE_PER_1M = 0.15
OUTPUT_PRICE_PER_1M = 0.60
MAX_INPUT_CHARS = 280
MAX_INPUT_CHARS_WRITING = 1000
MAX_AUDIO_BYTES = 25 * 1024 * 1024

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Mode = Literal["partner", "speaking_exam", "writing_exam"]


class ChatRequest(BaseModel):
    session_id: str
    message: str
    mode: Mode = "partner"
    task_id: str | None = None
    task_prompt: str | None = None


class ChatResponse(BaseModel):
    reply: str
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    estimated_cost_usd: float
    session_total_cost_usd: float
    mode: Mode
    task_title: str | None = None
    task_prompt: str | None = None


class ReviewRequest(BaseModel):
    session_id: str


class ReviewResponse(BaseModel):
    review: str
    mode: Mode


class StartSessionRequest(BaseModel):
    session_id: str
    mode: Mode = Field(default="partner")


class StartSessionResponse(BaseModel):
    mode: Mode
    task_id: str | None = None
    task_title: str | None = None
    task_prompt: str | None = None


class TranscribeResponse(BaseModel):
    transcript: str


def _max_input_chars(mode: str) -> int:
    if mode == "writing_exam":
        return MAX_INPUT_CHARS_WRITING
    return MAX_INPUT_CHARS


def _resolve_task(mode: str, task_id: str | None, task_prompt: str | None) -> dict[str, str] | None:
    if mode == "partner":
        return None

    if task_id or task_prompt:
        topic_key = "speaking" if mode == "speaking_exam" else "writing"
        if task_id:
            for topic in load_topics()[topic_key]:
                if topic["id"] == task_id:
                    return topic
        if task_prompt:
            return {"id": task_id or "custom", "title": "Tache personnalisee", "prompt": task_prompt}

    return pick_random_task(mode)


def _get_session_meta(session_id: str) -> dict[str, str]:
    return session_store.get(session_id, {"mode": "partner"})


def _set_session_meta(session_id: str, mode: str, task: dict[str, str] | None) -> None:
    meta: dict[str, str] = {"mode": mode}
    if task:
        meta["task_id"] = task["id"]
        meta["task_title"] = task["title"]
        meta["task_prompt"] = task["prompt"]
    session_store[session_id] = meta


@app.get("/topics")
def get_topics() -> dict[str, list[dict[str, str]]]:
    return load_topics()


@app.post("/session/start", response_model=StartSessionResponse)
def start_session(request: StartSessionRequest) -> StartSessionResponse:
    if request.mode not in MODES:
        raise HTTPException(status_code=400, detail=f"Invalid mode. Use one of: {', '.join(MODES)}")

    task = _resolve_task(request.mode, None, None)
    _set_session_meta(request.session_id, request.mode, task)

    if task:
        return StartSessionResponse(
            mode=request.mode,
            task_id=task["id"],
            task_title=task["title"],
            task_prompt=task["prompt"],
        )
    return StartSessionResponse(mode=request.mode)


@app.post("/transcribe", response_model=TranscribeResponse)
async def transcribe(audio: UploadFile = File(...)) -> TranscribeResponse:
    content_type = audio.content_type or ""
    if content_type and not (
        content_type.startswith("audio/")
        or content_type == "application/octet-stream"
    ):
        raise HTTPException(status_code=400, detail="Expected an audio file upload.")

    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Audio file is empty.")
    if len(audio_bytes) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=400, detail="Audio file is too large (max 25 MB).")

    filename = audio.filename or "recording.webm"
    try:
        transcript = transcribe_audio(audio_bytes, filename=filename)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Transcription failed: {exc}") from exc

    if not transcript:
        raise HTTPException(status_code=400, detail="No speech detected in the recording.")

    return TranscribeResponse(transcript=transcript)


@app.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest) -> ChatResponse:
    if request.mode not in MODES:
        raise HTTPException(status_code=400, detail=f"Invalid mode. Use one of: {', '.join(MODES)}")

    user_message = request.message.strip()
    if not user_message:
        raise HTTPException(status_code=400, detail="Message is empty.")

    max_chars = _max_input_chars(request.mode)
    if len(user_message) > max_chars:
        raise HTTPException(
            status_code=400,
            detail=f"Message too long. Max {max_chars} characters for {request.mode}.",
        )

    session_meta = _get_session_meta(request.session_id)
    if request.session_id not in session_store or session_meta.get("mode") != request.mode:
        task = _resolve_task(request.mode, request.task_id, request.task_prompt)
        _set_session_meta(request.session_id, request.mode, task)
        session_meta = _get_session_meta(request.session_id)
    elif request.mode != "partner" and request.task_prompt:
        task = _resolve_task(request.mode, request.task_id, request.task_prompt)
        _set_session_meta(request.session_id, request.mode, task)
        session_meta = _get_session_meta(request.session_id)

    task_prompt = session_meta.get("task_prompt")
    history = memory.get(request.session_id)
    memory.add_user(request.session_id, user_message)
    reply, usage = generate_reply(
        history,
        user_message,
        mode=request.mode,
        task=task_prompt,
    )
    memory.add_assistant(request.session_id, reply)

    prompt_tokens = usage["prompt_tokens"]
    completion_tokens = usage["completion_tokens"]
    total_tokens = usage["total_tokens"]

    estimated_cost_usd = (prompt_tokens / 1_000_000) * INPUT_PRICE_PER_1M + (
        completion_tokens / 1_000_000
    ) * OUTPUT_PRICE_PER_1M

    if request.session_id not in cost_store:
        cost_store[request.session_id] = {
            "session_total_cost_usd": 0.0,
            "requests": 0,
        }

    cost_store[request.session_id]["session_total_cost_usd"] += estimated_cost_usd
    cost_store[request.session_id]["requests"] += 1

    return ChatResponse(
        reply=reply,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        total_tokens=total_tokens,
        estimated_cost_usd=round(estimated_cost_usd, 8),
        session_total_cost_usd=round(
            float(cost_store[request.session_id]["session_total_cost_usd"]), 8
        ),
        mode=request.mode,
        task_title=session_meta.get("task_title"),
        task_prompt=task_prompt,
    )


@app.post("/review", response_model=ReviewResponse)
def review(request: ReviewRequest) -> ReviewResponse:
    history = memory.get(request.session_id)
    if not history:
        raise HTTPException(status_code=400, detail="No conversation to review yet.")

    session_meta = _get_session_meta(request.session_id)
    session_mode = session_meta.get("mode", "partner")
    if session_mode not in MODES:
        session_mode = "partner"

    review_text = generate_review(
        history,
        mode=session_mode,
        task=session_meta.get("task_prompt"),
    )
    return ReviewResponse(review=review_text, mode=session_mode)


@app.post("/reset/{session_id}")
def reset_session(session_id: str) -> dict[str, bool]:
    memory.clear(session_id)
    if session_id in cost_store:
        del cost_store[session_id]
    if session_id in session_store:
        del session_store[session_id]
    return {"ok": True}
