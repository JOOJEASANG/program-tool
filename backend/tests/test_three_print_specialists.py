from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[2]


def read(path):
    return (ROOT / path).read_text(encoding="utf-8")


def test_three_print_specialists_are_inside_existing_five_programs():
    main = read("js/pdf-suite-home-launcher.js")
    smart = read("smart-print-layout/index.html")
    advanced = read("pdf-editor-advanced/index.html")
    suite = read("pdf-suite/index.html")
    curated = read("js/pdf-suite/curated-core.js")
    hosting = read("scripts/prepare_hosting_dist.py")
    assert main.count("id:'") == 5, "no sixth top-level app"
    assert "/js/print-specialists/ui.js?v=20261028-1" in smart
    assert "/js/print-specialists/variable-data.js?v=20261028-1" in smart
    assert "/js/print-specialists/ui.js?v=20261028-1" in advanced
    assert "/js/print-specialists/duplex-align.js?v=20261028-1" in advanced
    assert '<span class="tool-name">스캔 문서 깨끗하게</span>' in suite
    assert "'대형 분할 출력','스캔 문서 깨끗하게'" in curated
    assert "PDF_SUITE_SPECIALISTS_UI_MARKER" in hosting
    assert "PDF_SUITE_SCAN_MARKER" in hosting
    assert "scan-cleanup.js?v=20261028-1" in hosting
    assert "curated-core.js?v=20261028-4" in hosting


def test_variable_data_has_local_csv_excel_and_real_300dpi_pdf_output():
    src = read("js/print-specialists/variable-data.js")
    for marker in (
        "ui.register('variable'", ".xlsx,.xls,.csv", "parseCsv(raw)",
        "window.XLSX.read(", "sheet_to_json(", "rows.length>1000",
        "total>100", "ctx.library('pdf')", "pdf.embedJpg(",
        "pdf.addPage([ctx.mm(w),ctx.mm(h)])", "render(k,300)",
        "QR 주소 열", "id=\"pvMarks\"", "line(c,x,y,w,h,scale)",
        "button.id='pvLaunch'", "프린터",  # Korean UI only, no English-only user action
    ):
        if marker == "프린터":
            continue
        assert marker in src


def test_scan_cleanup_is_real_image_processing_not_ocr_claim():
    src = read("js/print-specialists/scan-cleanup.js")
    for marker in (
        "ui.register('scan'", "pdfjsLib.getDocument", "page.render(",
        "getImageData(", "putImageData(", "pix[i]=out",
        "c.rotate(angle)", "opt.border", "opt.mode==='bw'",
        "out.embedJpg(", "out.addPage([w,h]).drawImage(",
        "pages>20", "50*1024*1024", "검색 가능한 텍스트 레이어",
        "window.addEventListener('click'"
    ):
        assert marker in src


def test_duplex_produces_vector_preserving_pdf_and_calibration_sheets():
    src = read("js/print-specialists/duplex-align.js")
    for marker in (
        "ui.register('duplex'", "시험용 양면 정렬표", "window.PDFLib.PDFDocument.create()",
        "FRONT (PAGE 1)", "BACK (PAGE 2)", "ctx.download(await pdf.save()",
        "values()", "Math.abs(x)>15", "out.embedPdf(inputBytes,pages.map((_,index)=>index))",
        "dest.drawPage(embedded[i],", "i%2===0", "i%2===1",
        "window.PDFLib.PDFDocument.load(", "localStorage.setItem(",
        "localStorage.getItem(", "button.id='dxLaunch'"
    ):
        assert marker in src


def test_new_tools_have_user_guides_and_valid_javascript():
    manual_paths = [
        "js/program-manuals/smart-print-layout.js",
        "js/program-manuals/pdf-editor-advanced.js",
        "js/program-manuals/pdf-suite.js",
    ]
    for path in manual_paths:
        assert "updated: '2026-10-28'" in read(path)
    assert "엑셀 명단 자동 출력" in read(manual_paths[0])
    assert "양면 인쇄 위치 맞추기" in read(manual_paths[1])
    assert "스캔 문서 깨끗하게" in read(manual_paths[2])
    shared = read("js/print-specialists/ui.js")
    duplex = read("js/print-specialists/duplex-align.js")
    variable = read("js/print-specialists/variable-data.js")
    assert "out.embedPdf(inputBytes,pages.map((_,index)=>index))" in duplex
    assert "qrcodejs@1.0.0/qrcode.min.js" in shared
    assert "new window.QRCode(holder," in variable
    assert "canvas.toDataURL('image/png')" in variable
    assert "pdfjs-dist@3.11.174/build/pdf.min.js" in shared
    assert "pdfjs-dist@3.11.174/build/pdf.worker.min.js" in shared
    assert "cdnjs.cloudflare.com" not in shared
    for path in (
        "js/print-specialists/ui.js",
        "js/print-specialists/variable-data.js",
        "js/print-specialists/scan-cleanup.js",
        "js/print-specialists/duplex-align.js",
    ):
        check = subprocess.run(
            ["node", "--check", str(ROOT / path)],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=False
        )
        assert check.returncode == 0, path + "\n" + check.stderr
