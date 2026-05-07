from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import firebase_admin
from firebase_admin import credentials, auth as firebase_auth
import os

from routers import pdf, preflight

app = FastAPI(title="Program Tool API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "https://program-tool.web.app").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_fb_app = None

def get_firebase_app():
    global _fb_app
    if _fb_app is None:
        cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        if cred_path and os.path.exists(cred_path):
            cred = credentials.Certificate(cred_path)
        else:
            cred = credentials.ApplicationDefault()
        _fb_app = firebase_admin.initialize_app(cred)
    return _fb_app


async def verify_token(request: Request) -> str:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing auth token")
    token = auth_header[7:]
    try:
        get_firebase_app()
        decoded = firebase_auth.verify_id_token(token)
        return decoded["uid"]
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid auth token")


app.state.verify_token = verify_token

app.include_router(pdf.router, prefix="/api/pdf", tags=["pdf"])
app.include_router(preflight.router, prefix="/api/preflight", tags=["preflight"])


@app.get("/health")
async def health():
    return {"status": "ok"}
