# French Language Partner

A personal French practice app for exam preparation and everyday conversation. It uses focused prompts and session-based memory so practice feels more like a real partner or examiner than a generic ChatGPT chat.

**Goals**

- Prepare for French exams (TEF / TCF Canada-style **speaking** and **writing** practice)
- Practice oral conversation with short, natural replies
- Use **speech-to-text** (Whisper) to verify what was heard before sending
- Get a **mode-specific review** at the end (casual feedback or exam rubric + corrections)
- Keep costs under control with short responses, input limits, token-based session memory, and per-session cost estimates

**Stack**

- **Backend:** FastAPI, OpenAI API (`gpt-4o-mini` + `whisper-1`), in-memory session history (no database)
- **Frontend:** React + Vite, runs on `localhost`

Session data is temporary: backend memory clears when the server restarts; the browser uses `sessionStorage` for the session id. Audio recordings are **not** stored — only transcribed in memory.

---

## Features

### Modes

| Mode | Purpose | During session | End review |
|------|---------|----------------|------------|
| **Partner** | Casual B2 conversation | Natural chat, no live correction | Encouraging session feedback |
| **Speaking exam** | Oral exam practice (TEF/TCF style) | Examiner role + random task + **timer** | Rubric /5 + corrections + topics to rework |
| **Writing exam** | Written expression practice | Coach reacts to your draft (longer input) | Rubric /5 + corrections + topics to rework |

Tasks are loaded from `backend/topics.json` (8 speaking + 8 writing prompts).

### Speaking exam timer

- Choose **5 / 10 / 15 minutes** before starting
- Warning at 1 minute left; input locks when time is up
- Use **End exam review** after the session

### Speech-to-text (Whisper)

- Available in **Partner** and **Speaking exam** (not Writing)
- Click **Mic** → speak → **Stop** → edit the transcript → **Send transcript**
- Helps verify pronunciation indirectly (what the model heard vs what you meant)

### Reviews

- **No live correction** during chat in any mode
- **Partner:** strengths, recurring errors, vocabulary, reformulations, next steps
- **Exam modes:** scored rubric, important corrections (`learner form → recommended form`), task completion, study topics

---

## OpenAI usage

One API key (`OPENAI_API_KEY`) powers everything:

| Feature | Model | Notes |
|---------|--------|--------|
| Chat (all modes) | `gpt-4o-mini` | Token usage + estimated cost shown in UI |
| Session review | `gpt-4o-mini` | Longer output for exam rubrics |
| Speech-to-text | `whisper-1` | French (`language=fr`); billed per audio minute |

Requires [billing enabled](https://platform.openai.com/settings/organization/billing) on your OpenAI account.

---

## Prerequisites

- Python 3 (on Windows you can use `py` instead of `python`)
- Node.js and npm
- An [OpenAI API key](https://platform.openai.com/api-keys)
- Microphone (for speech input; browser will ask permission on `localhost`)

---

## Environment variables

Copy the example file and add your key:

```powershell
copy .env.example .env
```

Edit `.env` and set `OPENAI_API_KEY`. The real `.env` file is gitignored and must not be committed.

---

## First-time setup

**Backend**

```powershell
cd backend
python --version
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload
```

On Windows, if `python` is not on your PATH:

```powershell
py --version
py -m pip install --upgrade pip
py -m pip install -r requirements.txt
py -m uvicorn main:app --reload
```

**Frontend** (new terminal)

```powershell
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The API runs on [http://localhost:8000](http://localhost:8000).

You only need `pip install` and `npm install` once (or again after dependency changes). You do **not** need to reinstall every time you open the project.

---

## Daily start

**Backend**

```powershell
cd backend
python -m uvicorn main:app --reload
```

**Frontend** (new terminal)

```powershell
cd frontend
npm run dev
```

Use `--reload` during development so the API restarts when you change backend code. Restart manually if you change environment variables in `.env`.

---

## How to use

1. Pick a **mode** → **Start session**
2. For speaking exam: set **duration**, read the task in the banner
3. Chat by **typing** or **Mic** (partner / speaking only)
4. Click **End session review** or **End exam review** when finished
5. **New Chat** resets the session

---

## Project layout

```
backend/
  main.py         # FastAPI routes (chat, review, transcribe, session, topics)
  agent.py        # OpenAI calls (chat, review, Whisper)
  prompts.py      # System + review prompts per mode
  topics.json     # Speaking / writing exam tasks
  memory.py       # In-memory session history
  requirements.txt
frontend/
  src/App.jsx     # Chat UI, timer, microphone, transcript panel
  ...
.env.example      # Template for secrets (commit this)
.env              # Your API key (local only, gitignored)
```

### API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/topics` | List speaking / writing tasks |
| POST | `/session/start` | Start session; assigns random exam task |
| POST | `/chat` | Send message (`mode`, optional `task_id`) |
| POST | `/transcribe` | Upload audio → French transcript |
| POST | `/review` | End-of-session review (mode-aware) |
| POST | `/reset/{session_id}` | Clear session memory |

---

## Roadmap

**Done**

- [x] Three practice modes (partner, speaking exam, writing exam)
- [x] Exam task bank (`topics.json`)
- [x] Speaking exam countdown timer
- [x] Whisper speech-to-text with editable transcript
- [x] Mode-specific end review (partner vs exam rubric + corrections)

**Planned**

- [ ] Save exam reviews offline (local export / history)
- [ ] More exam tasks and custom rubric templates (TEF/TCF sections)
- [ ] Pronunciation feedback beyond transcription (accent scoring)
- [ ] Deploy for phone use (e.g. HTTPS hosting)
- [ ] Optional tiers / hosting (personal project)



---

## Deployment (Railway + Amplify + Cognito)

### Railway (backend)


- Uses root `Dockerfile` + `railway.toml`
- Railway **Settings → Root Directory:** leave empty (repo root)
- Builder: Dockerfile (auto from `railway.toml`)

Test locally:

```powershell
docker build -t language-partner-api .
docker run -p 8000:8000 --env-file .env language-partner-api
```

Health check: `http://localhost:8000/health`

| Variable | Value |
|----------|--------|
| `OPENAI_API_KEY` | your key |
| `COGNITO_REGION` | `ca-central-1` |
| `COGNITO_USER_POOL_ID` | `<>` |
| `COGNITO_APP_CLIENT_ID` | `<>` |
| `COGNITO_USER_ATTRIBUTE` | `<>` |
| `COGNITO_APPROVED_VALUE` | `<>` |
| `ALLOWED_ORIGINS` | `<>` |

Local dev without JWT: set `AUTH_DISABLED=true` or leave Cognito vars empty.

### Amplify (frontend)

Build with env vars (see `frontend/.env.example`):

| Variable | Value |
|----------|--------|
| `VITE_API_URL` | your Railway public URL |
| `VITE_COGNITO_REGION` | `ca-central-1` |
| `VITE_COGNITO_USER_POOL_ID` | `<>` |
| `VITE_COGNITO_CLIENT_ID` | `<>` |

```powershell
cd frontend
npm install --legacy-peer-deps
npm run build
```

Upload `frontend/dist` to Amplify (or connect GitHub for CI).

### Cognito checklist

- App client: **read** attribute `custom:user` (so it appears in the ID token)
- Callback URL: `https://staging.d3cgdms6cwr0k6.amplifyapp.com`
- Post-confirmation Lambda sets `custom:user` = `pending`
- Pre-authentication Lambda blocks login until `custom:user` = `approved`

---

## Notes

- Prompts target **B2** learners.
- Exam modes do not correct during the exercise — corrections appear only in the final review.
- Whisper shows what was **transcribed**, not a pronunciation score.

---

