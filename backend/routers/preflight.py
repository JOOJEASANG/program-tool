import fitz
from fastapi import APIRouter, UploadFile, File, Form, Request, HTTPException

from models.schemas import PreflightReport
from services.preflight_svc import run_all_checks, compute_score
from services.ai_vision import analyze_with_vision

router = APIRouter()


@router.post("/check", response_model=PreflightReport)
async def preflight_check(
    request: Request,
    file: UploadFile = File(...),
    use_ai: bool = Form(False),
):
    uid = await request.app.state.verify_token(request)

    if not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="PDF 파일만 업로드 가능합니다")

    data = await file.read()
    if len(data) > 200 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="파일이 200 MB 제한을 초과합니다")

    try:
        doc = fitz.open(stream=data, filetype="pdf")
    except Exception:
        raise HTTPException(status_code=400, detail="PDF 파일을 열 수 없습니다. 파일이 손상되었을 수 있습니다.")

    try:
        checks = run_all_checks(doc)
        score = compute_score(checks)

        ai_feedback = None
        if use_ai:
            try:
                ai_feedback = await analyze_with_vision(doc)
            except Exception as e:
                ai_feedback = f"AI 분석 중 오류가 발생했습니다: {str(e)}"

        return PreflightReport(
            filename=file.filename or "document.pdf",
            page_count=len(doc),
            checks=checks,
            ai_feedback=ai_feedback,
            score=score,
        )
    finally:
        doc.close()
