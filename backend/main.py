from fastapi import FastAPI
from fastapi import HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from agent import generate_reply
from agent import generate_review
from memory import SessionMemory

app = FastAPI()
memory = SessionMemory(max_history_tokens=1200)
cost_store: dict[str, dict[str, float | int]] = {}

# USD per 1M tokens for gpt-4o-mini
INPUT_PRICE_PER_1M = 0.15
OUTPUT_PRICE_PER_1M = 0.60
MAX_INPUT_CHARS = 280

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    session_id: str
    message: str


class ChatResponse(BaseModel):
    reply: str
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    estimated_cost_usd: float
    session_total_cost_usd: float


class ReviewRequest(BaseModel):
    session_id: str


class ReviewResponse(BaseModel):
    review: str


@app.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest) -> ChatResponse:
    user_message = request.message.strip()
    if not user_message:
        raise HTTPException(status_code=400, detail="Message is empty.")
    if len(user_message) > MAX_INPUT_CHARS:
        raise HTTPException(
            status_code=400,
            detail=f"Message too long. Max {MAX_INPUT_CHARS} characters.",
        )

    history = memory.get(request.session_id)
    memory.add_user(request.session_id, user_message)
    reply, usage = generate_reply(history, user_message)
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
    )


@app.post("/review", response_model=ReviewResponse)
def review(request: ReviewRequest) -> ReviewResponse:
    history = memory.get(request.session_id)
    if not history:
        raise HTTPException(status_code=400, detail="No conversation to review yet.")
    review_text = generate_review(history)
    return ReviewResponse(review=review_text)


@app.post("/reset/{session_id}")
def reset_session(session_id: str) -> dict[str, bool]:
    memory.clear(session_id)
    if session_id in cost_store:
        del cost_store[session_id]
    return {"ok": True}
