import { useMemo, useState } from "react";

const API_BASE = "http://localhost:8000";
const MAX_INPUT_CHARS = 280;

function getOrCreateSessionId() {
  const key = "language_partner_session_id";
  const existing = window.sessionStorage.getItem(key);
  if (existing) return existing;
  const created = crypto.randomUUID();
  window.sessionStorage.setItem(key, created);
  return created;
}

export default function App() {
  const [sessionId, setSessionId] = useState(() => getOrCreateSessionId());
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [lastUsage, setLastUsage] = useState(null);
  const [sessionTotalCost, setSessionTotalCost] = useState(0);
  const [review, setReview] = useState("");
  const canSend = useMemo(
    () => input.trim().length > 0 && input.trim().length <= MAX_INPUT_CHARS && !loading,
    [input, loading]
  );

  async function sendMessage(event) {
    event.preventDefault();
    if (!canSend) return;

    const userText = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userText }]);
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, message: userText }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const errorMessage = errorData?.detail || `Request failed with status ${response.status}`;
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      setLastUsage({
        promptTokens: data.prompt_tokens,
        completionTokens: data.completion_tokens,
        totalTokens: data.total_tokens,
        estimatedCostUsd: data.estimated_cost_usd,
      });
      setSessionTotalCost(data.session_total_cost_usd ?? 0);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: error instanceof Error ? error.message : "Erreur temporaire. Reessaie dans quelques secondes.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function resetChat() {
    await fetch(`${API_BASE}/reset/${sessionId}`, { method: "POST" });
    const nextSessionId = crypto.randomUUID();
    window.sessionStorage.setItem("language_partner_session_id", nextSessionId);
    setSessionId(nextSessionId);
    setMessages([]);
    setLastUsage(null);
    setSessionTotalCost(0);
    setReview("");
  }

  async function requestReview() {
    if (messages.length === 0 || reviewLoading) return;
    setReviewLoading(true);
    try {
      const response = await fetch(`${API_BASE}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const errorMessage = errorData?.detail || `Request failed with status ${response.status}`;
        throw new Error(errorMessage);
      }
      const data = await response.json();
      setReview(data.review || "");
    } catch (error) {
      setReview(error instanceof Error ? error.message : "Review unavailable right now.");
    } finally {
      setReviewLoading(false);
    }
  }

  return (
    <main className="app">
      <h1>French Language Partner</h1>
      <div className="chat">
        {messages.map((message, index) => (
          <div key={`${message.role}-${index}`} className={`bubble ${message.role}`}>
            <strong>{message.role === "user" ? "You" : "Partner"}:</strong> {message.content}
          </div>
        ))}
      </div>

      <form onSubmit={sendMessage} className="composer">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Type your message..."
          disabled={loading}
          maxLength={MAX_INPUT_CHARS}
        />
        <button type="submit" disabled={!canSend}>
          Send
        </button>
        <button type="button" onClick={resetChat} disabled={loading}>
          New Chat
        </button>
        <button type="button" onClick={requestReview} disabled={loading || reviewLoading || messages.length === 0}>
          {reviewLoading ? "Reviewing..." : "End Session Review"}
        </button>
      </form>
      <p>
        Input limit: {input.trim().length}/{MAX_INPUT_CHARS} characters
      </p>
      {lastUsage && (
        <p>
          Tokens (last): {lastUsage.promptTokens} in / {lastUsage.completionTokens} out /{" "}
          {lastUsage.totalTokens} total | Cost (last): ${lastUsage.estimatedCostUsd.toFixed(6)} |
          Session total: ${sessionTotalCost.toFixed(6)}
        </p>
      )}
      {review && <pre>{review}</pre>}
    </main>
  );
}
