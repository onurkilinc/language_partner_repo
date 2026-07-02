from collections import defaultdict
from typing import DefaultDict


class SessionMemory:
    def __init__(self, max_history_tokens: int = 1200) -> None:
        self.max_history_tokens = max_history_tokens
        self.store: DefaultDict[str, list[dict[str, str]]] = defaultdict(list)

    def get(self, session_id: str) -> list[dict[str, str]]:
        return list(self.store.get(session_id, []))

    def add_user(self, session_id: str, content: str) -> None:
        self.store[session_id].append({"role": "user", "content": content})
        self._trim(session_id)

    def add_assistant(self, session_id: str, content: str) -> None:
        self.store[session_id].append({"role": "assistant", "content": content})
        self._trim(session_id)

    def clear(self, session_id: str) -> None:
        if session_id in self.store:
            del self.store[session_id]

    def _trim(self, session_id: str) -> None:
        messages = self.store[session_id]
        kept_reversed: list[dict[str, str]] = []
        total_estimated_tokens = 0

        for message in reversed(messages):
            message_tokens = self._estimate_message_tokens(message)
            if total_estimated_tokens + message_tokens > self.max_history_tokens:
                break
            kept_reversed.append(message)
            total_estimated_tokens += message_tokens

        self.store[session_id] = list(reversed(kept_reversed))

    def _estimate_message_tokens(self, message: dict[str, str]) -> int:
        # Approximate token count from content length with small overhead per message.
        content = message.get("content", "")
        return max(1, len(content) // 4) + 4
