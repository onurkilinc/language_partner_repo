# French Language Partner

A personal French practice app for exam preparation and everyday conversation. It uses a focused system prompt and session-based memory so practice feels more like talking to a partner than using a generic ChatGPT chat.

**Goals**

- Prepare for French exams (e.g. TEF / TCF Canada-style speaking and writing practice)
- Practice **oral** conversation with short, natural replies
- Get a **session review** at the end (vocabulary, phrasing, areas to improve)
- Keep costs under control with short responses, input limits, token-based session memory, and per-session cost estimates

**Stack**

- **Backend:** FastAPI, OpenAI API (`gpt-4o-mini`), in-memory session history (no database)
- **Frontend:** React + Vite, runs on `localhost`

Session data is temporary: backend memory clears when the server restarts; the browser uses `sessionStorage` for the session id.

---

## Prerequisites

- Python 3 (on Windows you can use `py` instead of `python`)
- Node.js and npm
- An [OpenAI API key](https://platform.openai.com/api-keys)

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

## Project layout

```
backend/
  main.py       # FastAPI routes (chat, review, reset)
  agent.py      # OpenAI calls and prompts
  memory.py     # In-memory session history
  requirements.txt
frontend/
  src/App.jsx   # Chat UI
  ...
.env.example    # Template for secrets (commit this)
.env            # Your API key (local only, gitignored)
```

---

## Notes

- Prompts are tuned for **B2** learners: natural French, no explicit correction during chat, optional end-of-session review.
- Planned directions include Whisper for voice input, writing practice modes, and offline review storage — see local `next.txt` for ideas (not tracked in git).


