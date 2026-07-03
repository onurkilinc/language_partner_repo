import { useEffect, useMemo, useRef, useState } from "react";

import { apiFetch } from "./api";
const MODES = [
  { id: "partner", label: "Partner" },
  { id: "speaking_exam", label: "Speaking exam" },
  { id: "writing_exam", label: "Writing exam" },
];
const MAX_INPUT_CHARS_PARTNER = 280;
const MAX_INPUT_CHARS_SPEAKING = 280;
const MAX_INPUT_CHARS_WRITING = 1000;
const TIMER_PRESETS_MINUTES = [5, 10, 15];

function formatTimer(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function getMaxInputChars(mode) {
  if (mode === "writing_exam") return MAX_INPUT_CHARS_WRITING;
  return mode === "speaking_exam" ? MAX_INPUT_CHARS_SPEAKING : MAX_INPUT_CHARS_PARTNER;
}

function getAssistantLabel(mode) {
  if (mode === "speaking_exam") return "Examiner";
  if (mode === "writing_exam") return "Coach";
  return "Partner";
}

function getRecordingMimeType() {
  if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
    return "audio/webm;codecs=opus";
  }
  if (MediaRecorder.isTypeSupported("audio/webm")) {
    return "audio/webm";
  }
  if (MediaRecorder.isTypeSupported("audio/mp4")) {
    return "audio/mp4";
  }
  return "";
}

function getReviewButtonLabel(mode) {
  if (mode === "speaking_exam" || mode === "writing_exam") {
    return "End exam review";
  }
  return "End session review";
}

function getReviewHeading(mode) {
  if (mode === "speaking_exam") return "Speaking exam review";
  if (mode === "writing_exam") return "Writing exam review";
  return "Session review";
}

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
  const [mode, setMode] = useState("partner");
  const [task, setTask] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [lastUsage, setLastUsage] = useState(null);
  const [sessionTotalCost, setSessionTotalCost] = useState(0);
  const [review, setReview] = useState("");
  const [sessionStarted, setSessionStarted] = useState(false);
  const [timerMinutes, setTimerMinutes] = useState(10);
  const [secondsRemaining, setSecondsRemaining] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [transcriptError, setTranscriptError] = useState("");

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const mediaStreamRef = useRef(null);

  const isSpeakingExam = mode === "speaking_exam";
  const isWritingExam = mode === "writing_exam";
  const speechInputEnabled = !isWritingExam;
  const timerExpired = isSpeakingExam && secondsRemaining === 0;
  const timerWarning = isSpeakingExam && secondsRemaining !== null && secondsRemaining > 0 && secondsRemaining <= 60;

  const maxInputChars = useMemo(() => getMaxInputChars(mode), [mode]);
  const canSend = useMemo(
    () =>
      sessionStarted &&
      !timerExpired &&
      input.trim().length > 0 &&
      input.trim().length <= maxInputChars &&
      !loading &&
      !transcribing &&
      !isRecording,
    [input, loading, maxInputChars, sessionStarted, timerExpired, transcribing, isRecording]
  );
  const canRecord = useMemo(
    () =>
      speechInputEnabled &&
      sessionStarted &&
      !timerExpired &&
      !loading &&
      !transcribing &&
      !reviewLoading,
    [speechInputEnabled, sessionStarted, timerExpired, loading, transcribing, reviewLoading]
  );
  const canSendTranscript = useMemo(
    () =>
      sessionStarted &&
      !timerExpired &&
      transcript.trim().length > 0 &&
      transcript.trim().length <= maxInputChars &&
      !loading &&
      !transcribing &&
      !isRecording,
    [sessionStarted, timerExpired, transcript, maxInputChars, loading, transcribing, isRecording]
  );
  const canChangeMode = messages.length === 0 && !loading && !reviewLoading && !isRecording;

  useEffect(() => {
    setInput((current) => (current.length > maxInputChars ? current.slice(0, maxInputChars) : current));
  }, [maxInputChars]);

  useEffect(() => {
    setTranscript((current) => (current.length > maxInputChars ? current.slice(0, maxInputChars) : current));
  }, [maxInputChars]);

  useEffect(() => {
    if (!sessionStarted || !isSpeakingExam) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setSecondsRemaining((current) => {
        if (current === null || current <= 0) return 0;
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [sessionStarted, isSpeakingExam]);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  function stopMediaStream() {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  }

  async function transcribeBlob(blob, mimeType) {
    setTranscribing(true);
    setTranscriptError("");
    try {
      const extension = mimeType.includes("mp4") ? "mp4" : "webm";
      const formData = new FormData();
      formData.append("audio", blob, `recording.${extension}`);

      const response = await apiFetch("/transcribe", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || `Transcription failed with status ${response.status}`);
      }

      const data = await response.json();
      setTranscript((data.transcript || "").slice(0, maxInputChars));
    } catch (error) {
      setTranscript("");
      setTranscriptError(error instanceof Error ? error.message : "Transcription failed.");
    } finally {
      setTranscribing(false);
    }
  }

  async function toggleRecording() {
    if (!canRecord && !isRecording) return;

    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }

    setTranscriptError("");
    try {
      const mimeType = getRecordingMimeType();
      if (!mimeType) {
        throw new Error("Audio recording is not supported in this browser.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      audioChunksRef.current = [];

      const recorder = new MediaRecorder(stream, { mimeType });
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      recorder.onstop = async () => {
        stopMediaStream();
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        audioChunksRef.current = [];
        if (blob.size > 0) {
          await transcribeBlob(blob, mimeType);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setTranscript("");
    } catch (error) {
      stopMediaStream();
      setIsRecording(false);
      setTranscriptError(error instanceof Error ? error.message : "Microphone access failed.");
    }
  }

  async function submitMessage(userText) {
    const text = userText.trim();
    if (
      !sessionStarted ||
      timerExpired ||
      !text ||
      text.length > maxInputChars ||
      loading ||
      transcribing ||
      isRecording
    ) {
      return false;
    }

    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setLoading(true);

    try {
      const response = await apiFetch("/chat", {
        method: "POST",
        body: JSON.stringify({
          session_id: sessionId,
          message: text,
          mode,
          task_id: task?.id,
          task_prompt: task?.prompt,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const errorMessage = errorData?.detail || `Request failed with status ${response.status}`;
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      if (data.task_prompt && !task) {
        setTask({
          id: data.task_id,
          title: data.task_title,
          prompt: data.task_prompt,
        });
      }
      setLastUsage({
        promptTokens: data.prompt_tokens,
        completionTokens: data.completion_tokens,
        totalTokens: data.total_tokens,
        estimatedCostUsd: data.estimated_cost_usd,
      });
      setSessionTotalCost(data.session_total_cost_usd ?? 0);
      return true;
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: error instanceof Error ? error.message : "Erreur temporaire. Reessaie dans quelques secondes.",
        },
      ]);
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function startSession() {
    setLoading(true);
    try {
      const response = await apiFetch("/session/start", {
        method: "POST",
        body: JSON.stringify({ session_id: sessionId, mode }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || `Request failed with status ${response.status}`);
      }
      const data = await response.json();
      if (data.task_prompt) {
        setTask({
          id: data.task_id,
          title: data.task_title,
          prompt: data.task_prompt,
        });
      } else {
        setTask(null);
      }
      setSessionStarted(true);
      setReview("");
      setTranscript("");
      setTranscriptError("");
      if (mode === "speaking_exam") {
        setSecondsRemaining(timerMinutes * 60);
      } else {
        setSecondsRemaining(null);
      }
    } catch (error) {
      setReview(error instanceof Error ? error.message : "Could not start session.");
    } finally {
      setLoading(false);
    }
  }

  async function sendMessage(event) {
    event.preventDefault();
    if (!canSend) return;
    const userText = input.trim();
    setInput("");
    await submitMessage(userText);
  }

  async function sendTranscript() {
    if (!canSendTranscript) return;
    const userText = transcript.trim();
    const sent = await submitMessage(userText);
    if (sent) {
      setTranscript("");
    }
  }

  function useTranscriptInInput() {
    setInput(transcript.slice(0, maxInputChars));
  }

  async function resetChat() {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    }
    stopMediaStream();
    await apiFetch(`/reset/${sessionId}`, { method: "POST" });
    const nextSessionId = crypto.randomUUID();
    window.sessionStorage.setItem("language_partner_session_id", nextSessionId);
    setSessionId(nextSessionId);
    setMessages([]);
    setLastUsage(null);
    setSessionTotalCost(0);
    setReview("");
    setTask(null);
    setSessionStarted(false);
    setInput("");
    setSecondsRemaining(null);
    setTranscript("");
    setTranscriptError("");
  }

  async function requestReview() {
    if (messages.length === 0 || reviewLoading) return;
    setReviewLoading(true);
    try {
      const response = await apiFetch("/review", {
        method: "POST",
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

      <div className="mode-bar">
        <label htmlFor="mode-select">Mode</label>
        <select
          id="mode-select"
          value={mode}
          disabled={!canChangeMode}
          onChange={(event) => {
            setMode(event.target.value);
            setTask(null);
            setSessionStarted(false);
            setSecondsRemaining(null);
            setTranscript("");
            setTranscriptError("");
          }}
        >
          {MODES.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
        {!sessionStarted && (
          <button type="button" onClick={startSession} disabled={loading}>
            {loading ? "Starting..." : "Start session"}
          </button>
        )}
        {isSpeakingExam && !sessionStarted && (
          <>
            <label htmlFor="timer-select">Duration</label>
            <select
              id="timer-select"
              value={timerMinutes}
              onChange={(event) => setTimerMinutes(Number(event.target.value))}
            >
              {TIMER_PRESETS_MINUTES.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes} min
                </option>
              ))}
            </select>
          </>
        )}
      </div>

      {isSpeakingExam && sessionStarted && secondsRemaining !== null && (
        <div
          className={`timer-bar${timerWarning ? " timer-warning" : ""}${timerExpired ? " timer-expired" : ""}`}
        >
          <strong>Time remaining:</strong> {formatTimer(secondsRemaining)}
          {timerWarning && !timerExpired && <span> — 1 minute left</span>}
          {timerExpired && (
            <span> — Time is up. Use End Session Review when you are ready.</span>
          )}
        </div>
      )}

      {task && (
        <div className="task-banner">
          <strong>{task.title}</strong>
          <p>{task.prompt}</p>
        </div>
      )}

      <div className="chat">
        {messages.length === 0 && sessionStarted && (
          <p className="chat-hint">
            {mode === "writing_exam"
              ? "Write your response to the task above."
              : mode === "speaking_exam"
                ? "Use the microphone or type your response to the oral task."
                : "Start the conversation in French (microphone or typing)."}
          </p>
        )}
        {messages.map((message, index) => (
          <div key={`${message.role}-${index}`} className={`bubble ${message.role}`}>
            <strong>{message.role === "user" ? "You" : getAssistantLabel(mode)}:</strong>{" "}
            {message.content}
          </div>
        ))}
      </div>

      {(transcribing || transcript || transcriptError) && (
        <div className="transcript-panel">
          <strong>Transcript</strong>
          {transcribing && <p className="transcript-status">Transcribing...</p>}
          {transcriptError && <p className="transcript-error">{transcriptError}</p>}
          {transcript && !transcribing && (
            <>
              <textarea
                value={transcript}
                onChange={(event) => setTranscript(event.target.value.slice(0, maxInputChars))}
                rows={4}
                maxLength={maxInputChars}
                disabled={loading || timerExpired}
              />
              <p>
                Transcript: {transcript.trim().length}/{maxInputChars} characters
              </p>
              <div className="transcript-actions">
                <button type="button" onClick={useTranscriptInInput} disabled={!transcript.trim()}>
                  Use in input
                </button>
                <button type="button" onClick={sendTranscript} disabled={!canSendTranscript}>
                  Send transcript
                </button>
                <button type="button" onClick={() => setTranscript("")} disabled={loading}>
                  Clear
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <form onSubmit={sendMessage} className="composer">
        {speechInputEnabled && (
          <button
            type="button"
            className={`mic-button${isRecording ? " recording" : ""}`}
            onClick={toggleRecording}
            disabled={!canRecord && !isRecording}
            title={isRecording ? "Stop recording" : "Record speech"}
          >
            {isRecording ? "Stop" : "Mic"}
          </button>
        )}
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={
            mode === "writing_exam" ? "Write your draft here..." : "Type your message..."
          }
          disabled={loading || !sessionStarted || timerExpired || isRecording || transcribing}
          maxLength={maxInputChars}
        />
        <button type="submit" disabled={!canSend}>
          Send
        </button>
        <button type="button" onClick={resetChat} disabled={loading || isRecording}>
          New Chat
        </button>
        <button
          type="button"
          onClick={requestReview}
          disabled={loading || reviewLoading || messages.length === 0 || isRecording}
        >
          {reviewLoading ? "Reviewing..." : getReviewButtonLabel(mode)}
        </button>
      </form>
      <p>
        Input limit: {input.trim().length}/{maxInputChars} characters
      </p>
      {lastUsage && (
        <p>
          Tokens (last): {lastUsage.promptTokens} in / {lastUsage.completionTokens} out /{" "}
          {lastUsage.totalTokens} total | Cost (last): ${lastUsage.estimatedCostUsd.toFixed(6)} |
          Session total: ${sessionTotalCost.toFixed(6)}
        </p>
      )}
      {review && (
        <div className="review-panel">
          <h2>{getReviewHeading(mode)}</h2>
          <pre className="review-block">{review}</pre>
        </div>
      )}
    </main>
  );
}
