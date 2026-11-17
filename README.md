<p align="center"><img src="assets/logo.png" width="120" alt="Irish logo"></p>

# Irish

**AI-Powered Resume Tailoring and Job Application Agent** — CST8327 Group #1 (Lab 010)

main -> managed by Vasu Patel

Member Branch:
Vasu Patel -> vasupatel Personal Branch

---

## Status

| Part | Status |
|---|---|
| Backend (FastAPI, all components C1–C4, C7, C8, profile) | ✅ First version |
| Frontend (Expo SDK 58 + Expo Router: web / Android / iOS) | ✅ First version — see [frontend/README.md](frontend/README.md) |
| Database (PostgreSQL + pgvector, Neo4j) | ⏳ Later — a local JSON store and an in-memory skill graph are used until then |

## Components

| ID | Component | Where | Technology (first version) |
|---|---|---|---|
| C1 | Text recognition | `backend/text_recognition` | Skill dictionary + regex, PDF/DOCX/TXT readers, job link reader (httpx + BeautifulSoup) |
| C2 | Text generation | `backend/text_generation` | **Free LLMs**: Ollama (local, default), Groq or Gemini free tier; offline template fallback |
| C3 | Image recognition | `backend/image_recognition` | Tesseract OCR (pytesseract + Pillow) |
| C4 | Graph RAG | `backend/graph_rag` | Neo4j when configured, in-memory skill graph otherwise |
| C5 | Data store | `backend/storage` | Temporary JSON store → PostgreSQL + pgvector later |
| C7 | Job tracker agent | `backend/job_tracker` | Rule-based email classifier, read-only IMAP mailbox |
| C8 | Credential manager | `backend/credential_manager` | Fernet-encrypted logins, local key file only |
| — | Profile form | `backend/profile` | Builds a resume when the user has none |

Every code folder has `independent/` (pure functions/classes, testable alone) and `dependent/` (files that connect to other parts).

## Run the backend

```powershell
cd Irish
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env          # then edit .env if needed
uvicorn backend.main:app --reload
```

Open **http://127.0.0.1:8000/docs** to try every endpoint.

### Free LLM setup (C2)

The default is **Ollama** (free, runs on the laptop, no key):

1. Install from https://ollama.com
2. `ollama pull llama3.2`
3. Keep `LLM_PROVIDER=ollama` in `.env`

Other free options — set `LLM_PROVIDER` in `.env`:
- `groq` + `GROQ_API_KEY` (free key at https://console.groq.com/keys)
- `gemini` + `GEMINI_API_KEY` (free key at https://aistudio.google.com/apikey)
- `stub` — no AI, template only (used by the tests)

If the chosen LLM is not reachable, the app falls back to the offline template so the demo never breaks (`LLM_FALLBACK_TO_STUB=true`). Changing the model is demo step 8: edit `configuration/settings.py` / `.env`.

### OCR setup (C3)

Install Tesseract for Windows from https://github.com/UB-Mannheim/tesseract/wiki and, if it is not on PATH, set
`TESSERACT_CMD=C:\Program Files\Tesseract-OCR\tesseract.exe` in `.env`.

## Run the frontend

```powershell
cd frontend
npm install
npx expo start        # w = web, a = Android, scan the QR code with Expo Go on a phone
```

For phones, start the backend with `uvicorn backend.main:app --host 0.0.0.0 --port 8000`.
Details: [frontend/README.md](frontend/README.md).

## Main API endpoints (prefix `/api`)

| Flow step | Method & path |
|---|---|
| Upload resume / paste resume | `POST /resumes/upload`, `POST /resumes/text` |
| Job posting from link / text / screenshot | `POST /postings/link`, `/postings/text`, `/postings/image` |
| Matching & missing skills + graph context | `POST /match` |
| Write tailored resume | `POST /tailor` → `PUT /tailored/{id}` to edit |
| Save as DOCX/PDF/TXT into `history/<company>/` | `POST /tailored/{id}/save`, `GET /history`, `DELETE /history?target=all` |
| Apply → add to tracker | `POST /apply` |
| Tracker list, filters, details, status | `GET /tracker/jobs`, `GET/PATCH /tracker/jobs/{id}` |
| Test email / mailbox check | `POST /tracker/emails`, `POST /tracker/check-mailbox` |
| After "Successful" | `POST /tracker/success-action` (delete_history / save_zip / stop_tracker), `GET /tracker/export` |
| Credential manager | `GET/POST /credentials`, `PATCH/DELETE /credentials/{id}` |
| Profile form | `GET/PUT /profile`, `GET /profile/resume-preview` |
| Skill graph | `GET /graph/related/{skill}`, `/graph/subgraph`, `/graph/title` |
| Health | `GET /health` |

## Configuration scripts

```powershell
python -m configuration.local_save "Company" "my_resume" pdf data\resumes\sample_resume.txt
python -m configuration.local_delete all                 # or a file name
python -m configuration.google_cloud_upload history\Company\my_resume.pdf
python -m configuration.google_cloud_delete all
python -m scripts.export_neo4j_seed                      # writes database/neo4j_seed.cypher
```

## Tests

```powershell
python -m pytest testing/unit_tests -q
```

Tests use a temporary data folder and the offline `stub` LLM, so they never touch your real data or need a model.

## Folder structure

```
Irish/
  README.md
  assets/            logo
  docs/              proposal/  report/  presentation/
  configuration/     settings, local_save, local_delete, google_cloud_upload, google_cloud_delete
  frontend/          Expo app: src/ (routes, screens, services), common-components/,
                     platforms/web | android | ios (platform-only files and overrides)
  backend/           main.py, api/, text_recognition/ (C1), text_generation/ (C2),
                     image_recognition/ (C3), graph_rag/ (C4), storage/ (C5),
                     job_tracker/ (C7), credential_manager/ (C8), profile/
  testing/           photo/  video/  text/  unit_tests/
  history/           saved resumes (local only, git-ignored)
  database/          PostgreSQL and Neo4j setup scripts
  scripts/           utilities
  data/              sample resumes and job postings
```

## Security notes

- `.env`, the credential key and `data/irish_store.json` are git-ignored (risks R5, R11).
- Passwords are encrypted and never returned by the API.
- The app never opens a site or applies without the user's permission for that site.
- The mailbox is opened read-only; only subject, sender, time and link are saved (R9).
- Job links to private/local network addresses are refused.
