import json
from fastapi import APIRouter, UploadFile, File, Form, Request, HTTPException
from fastapi.responses import Response

from models.schemas import PdfProcessRequest
from services.pdf_ops import process_pdf

router = APIRouter()


@router.post("/process")
async def process_pdf_endpoint(
    request: Request,
    files: list[UploadFile] = File(...),
    settings: str = Form(...),
):
    uid = await request.app.state.verify_token(request)

    try:
        req = PdfProcessRequest.model_validate(json.loads(settings))
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Invalid settings: {e}")

    file_bytes_list = []
    for f in files:
        if not f.content_type or "pdf" not in f.content_type.lower():
            if not (f.filename or "").lower().endswith(".pdf"):
                raise HTTPException(status_code=400, detail=f"File '{f.filename}' is not a PDF")
        data = await f.read()
        if len(data) > 100 * 1024 * 1024:  # 100 MB per file
            raise HTTPException(status_code=413, detail=f"File '{f.filename}' exceeds 100 MB limit")
        file_bytes_list.append(data)

    if not file_bytes_list:
        raise HTTPException(status_code=400, detail="No files provided")

    try:
        output_bytes = process_pdf(file_bytes_list, req)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF processing failed: {e}")

    return Response(
        content=output_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=output.pdf"},
    )
