# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A web-based business automation suite for PDF processing, document generation, and AI-assisted writing. Stack: Python/Flask backend on Firebase Cloud Functions + vanilla JS/HTML frontend on Firebase Hosting + Firestore + Cloud Storage.

Live at: https://program-tool.web.app  
Firebase project: `program-tool`

---

## Development Commands

### Backend (Python/Flask)

```bash
# Set up local environment
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Run the Flask app locally (not via Firebase emulator)
FLASK_APP=main.py flask run

# Run backend tests (if any exist)
pytest
```

### Deployment

```bash
# Full project deploy (hosting + functions + rules)
firebase deploy --project program-tool

# Deploy only backend functions
firebase deploy --only functions --project program-tool

# Deploy only hosting (frontend)
firebase deploy --only hosting --project program-tool

# Deploy only Firestore/Storage rules
firebase deploy --only firestore:rules,storage --project program-tool
```

### Version Bump

Update `version.json` whenever making visible user-facing changes. The service worker uses this to detect and broadcast updates to clients:

```json
{
  "version": "YYYY-MM-DD-short-description",
  "label": "변경 내용 한국어 설명",
  "updatedAt": "YYYY-MM-DDTHH:MM:SS+09:00"
}
```

---

## Architecture

### Request Flow

```
Browser → Firebase Hosting
  ├── /api/** → Firebase Cloud Function "api" → Flask app → Blueprint router
  └── static files (HTML/JS/CSS) → Hosting CDN
```

All `/api/**` traffic is rewritten to the single `api` Cloud Function defined in `backend/main.py`. Flask blueprints route from there.

### Backend Structure

`backend/main.py` initializes Firebase Admin, creates the Flask app, and registers six blueprints:

| Blueprint | URL Prefix | Module |
|-----------|-----------|--------|
| `pdf_bp` | `/api/pdf` | `routers/pdf.py` |
| `pdf_tools_bp` | `/api/pdf-tools` | `routers/pdf_tools.py` |
| `preflight_bp` | `/api/preflight` | `routers/preflight.py` |
| `report_bp` | `/api/report` | `routers/report.py` |
| `invoice_bp` | `/api/invoice` | `routers/invoice.py` |
| `writing_bp` | `/api/writing` | `routers/writing.py` |

Business logic lives in `backend/services/`. Pydantic models for request/response validation are in `backend/models/schemas.py`.

### Large File Upload Pattern (Critical)

The Cloud Function HTTP body limit is ~32 MB. To handle large PDFs, `apiProcessPdf` in `js/api.js` uses a Storage-first pattern:

1. Frontend uploads PDF files to `pdf_temp/{uid}/{sessionId}/{i}.pdf` in Firebase Storage
2. Frontend sends a JSON body to `/api/pdf/process-storage` with `{ storage_paths, settings }`
3. Backend reads files from Storage, processes them, and returns the output PDF as a binary response
4. Frontend cleans up temp Storage files after receiving the response

Simple tools (`/api/pdf-tools/*`, `/api/preflight/*`) that accept smaller files use direct `multipart/form-data` uploads.

### Authentication

Every API endpoint is protected by the `@require_auth` decorator (`backend/utils/auth.py`). It:
- Reads the `Authorization: Bearer <token>` header
- Verifies the Firebase ID token via `firebase_admin.auth.verify_id_token`
- Passes the verified `uid` as the first argument to the route handler

Frontend obtains tokens via `auth.currentUser.getIdToken()` (Firebase JS SDK). All API calls go through `js/api.js` helpers that inject the token automatically.

### Firestore Access Control

- Admin status is determined by an email whitelist stored in `settings/admin` document
- Per-user program access is stored in `user_permissions/{uid}` — users cannot elevate their own permissions (enforced in `firestore.rules`)
- `settings/config` (API keys) is admin-read-only

### Frontend Structure

No build step — plain HTML files with inline `<script>` tags and CDN imports. Firebase SDK (Auth, Firestore, Storage) is loaded via CDN in each tool's HTML.

- `js/api.js` — shared API client functions; included in tool HTML files that need backend calls
- `js/firebase-config.js` — Firebase app initialization; must be loaded before any Firebase SDK usage
- `tools/*.html` — self-contained tool UIs (pdf-editor, design-studio, pdf-Checker, invoice, report, writing)
- `index.html` — landing page with 3×2 tool grid

### Service Worker & Caching

`sw.js` uses a **network-first** strategy for all assets (HTML, JS, CSS, JSON). API calls are never cached. On activation, all old caches are cleared.

`sw-register.js` registers the service worker with a cache-busting timestamp and calls `app-version.js` to detect version changes. When a new `version.json` is detected, the page prompts users to reload.

Cache headers (set in `firebase.json`):
- HTML, `version.json`: `no-store` (always fresh)
- JS, CSS: `no-cache` (revalidate before use)

---

## Key Conventions

### Adding a New API Route

1. Create a blueprint in `backend/routers/your_module.py`
2. Register it in `backend/main.py` with `flask_app.register_blueprint(bp, url_prefix="/api/your-prefix")`
3. Add Pydantic models to `backend/models/schemas.py` if needed
4. Add a corresponding JS helper in `js/api.js`
5. Add the `@require_auth` decorator to every endpoint

### PDF Processing

All PDF work uses `PyMuPDF` (imported as `fitz`). Key constraint: **never rasterize source pages** — always use `show_pdf_page()` to place PDF content into new pages to preserve vector/text quality.

Measurement units: PyMuPDF uses points (pt). Use `MM_TO_PT = 72 / 25.4` for conversions. The constant is defined in `backend/services/pdf_ops.py`.

The `PdfProcessRequest` schema in `models/schemas.py` is the single source of truth for what the PDF editor frontend sends to the backend.

### Firestore Rules Changes

After editing `firestore.rules` or `storage.rules`, deploy with:
```bash
firebase deploy --only firestore:rules,storage --project program-tool
```
The emulator is not required for rule testing — deploy to preview and test via the Firebase console.

### UI Language

The UI is in Korean. Error messages, status strings, and labels in both frontend and backend should be written in Korean (한국어).

---

## CI/CD

- **Push to `main`** → auto-deploys full project via `.github/workflows/firebase-deploy.yml`
- **Pull requests** → deploys to a 7-day preview channel; the workflow posts the preview URL as a PR comment (`.github/workflows/firebase-preview.yml`)
- Required secret: `FIREBASE_TOKEN` (set in GitHub repository secrets)
