import io
import json
import os
import random
from pathlib import Path

from openai import OpenAI
from dotenv import load_dotenv

from prompts import MODES, get_review_prompt, get_system_prompt

load_dotenv()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
_TOPICS_PATH = Path(__file__).parent / "topics.json"


def load_topics() -> dict[str, list[dict[str, str]]]:
    with _TOPICS_PATH.open(encoding="utf-8") as file:
        return json.load(file)


def pick_random_task(mode: str) -> dict[str, str] | None:
    if mode == "speaking_exam":
        topics = load_topics()["speaking"]
    elif mode == "writing_exam":
        topics = load_topics()["writing"]
    else:
        return None
    return random.choice(topics)


def generate_reply(
    history: list[dict[str, str]],
    user_message: str,
    mode: str = "partner",
    task: str | None = None,
) -> tuple[str, dict[str, int]]:
    system_prompt = get_system_prompt(mode, task)
    messages: list[dict[str, str]] = [{"role": "system", "content": system_prompt}]
    messages.extend(history)
    messages.append({"role": "user", "content": user_message})

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages,
        temperature=0.7,
        max_tokens=240,
    )

    content = response.choices[0].message.content
    usage = response.usage
    usage_data = {
        "prompt_tokens": usage.prompt_tokens if usage else 0,
        "completion_tokens": usage.completion_tokens if usage else 0,
        "total_tokens": usage.total_tokens if usage else 0,
    }
    return (content or "").strip(), usage_data


def transcribe_audio(audio_bytes: bytes, filename: str = "audio.webm") -> str:
    audio_file = io.BytesIO(audio_bytes)
    audio_file.name = filename
    transcript = client.audio.transcriptions.create(
        model="whisper-1",
        file=audio_file,
        language="fr",
    )
    return (transcript.text or "").strip()


def generate_review(
    history: list[dict[str, str]],
    mode: str = "partner",
    task: str | None = None,
) -> str:
    system_prompt = get_review_prompt(mode)
    user_content = "Voici l'historique de conversation. Fais l'evaluation demandee:\n\n"
    if task and mode in ("speaking_exam", "writing_exam"):
        user_content += f"Consigne de l'examen:\n{task}\n\n"
    user_content += f"{history}"

    messages: list[dict[str, str]] = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_content},
    ]

    max_tokens = 700 if mode in ("speaking_exam", "writing_exam") else 500

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages,
        temperature=0.4,
        max_tokens=max_tokens,
    )
    content = response.choices[0].message.content
    return (content or "").strip()
