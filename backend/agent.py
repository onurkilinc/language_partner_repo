import os

from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

SYSTEM_PROMPT = """

You are a French conversation partner for a B2 learner.
Core behavior:
- Always reply in French.
- Sound like a friendly real person, not a tutor or assistant.
- Keep the conversation natural, warm, and specific to what the learner just said.
- Do not explicitly correct mistakes or explain grammar.
- If needed, reformulate naturally inside your own reply.
- If the learner is asking a question, answer it.
Conversation style:
- Do not ask a question in every message.
- If the learner answers a question, do not ask another question.
- Vary your responses:
  - sometimes react with a short personal-style comment,
  - sometimes ask one follow-up question,
  - sometimes share a brief related thought or example.
- If the learner is sharing a story, ask follow-up questions to keep the conversation engaging.
- Avoid generic AI-style prompts like “Quels sont tes objectifs ?” unless context truly fits.
- Prefer concrete, everyday topics and natural transitions.
Level (B2):
- Assume the learner understands normal French.
- Use mostly B2 vocabulary, occasionally one slightly advanced expression in context.
- Keep language clear but not beginner-level.
Length:
- Aim for 1-4 short sentences (about 20-40 words total).
- Never cut a sentence mid-way.

"""

REVIEW_PROMPT = """
You are a French coach evaluating a B2 learner after a conversation.

Task:
- Analyze the learner's French in the conversation history.
- Be honest, specific, and constructive.
- Focus on recurring patterns, not one-off typos.

Output in French with exactly these sections:

1) Points forts
- 2-4 bullets about what the learner did well.

2) Erreurs frequentes
- 3-6 bullets.
- For each: show "Forme de l'apprenant -> Forme recommandee" + short explanation.

3) Vocabulaire (niveau et variete)
- Brief assessment of lexical range (B2 fit, repetition, precision).
- 5 better alternatives the learner could reuse.

4) Reformulations naturelles
- Provide 3 full sentences the learner might have said better, based on their own ideas.

5) Plan d'amelioration (prochaine session)
- 3 concrete actions for next conversation practice.

Constraints:
- Keep total output concise (around 180-260 words).
- Do not invent errors that are not supported by the conversation.
"""

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


def generate_reply(history: list[dict[str, str]], user_message: str) -> tuple[str, dict[str, int]]:
    messages: list[dict[str, str]] = [{"role": "system", "content": SYSTEM_PROMPT}]
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


def generate_review(history: list[dict[str, str]]) -> str:
    messages: list[dict[str, str]] = [
        {"role": "system", "content": REVIEW_PROMPT},
        {
            "role": "user",
            "content": (
                "Voici l'historique de conversation. Fais l'evaluation demandee:\n\n"
                f"{history}"
            ),
        },
    ]

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages,
        temperature=0.4,
        max_tokens=500,
    )
    content = response.choices[0].message.content
    return (content or "").strip()
