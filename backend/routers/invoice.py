"""
Invoice / Quote PDF generator.
Accepts JSON from the frontend and returns a print-ready A4 PDF.
"""
import io
import base64
import math
from datetime import date

import fitz
from flask import Blueprint, request, jsonify, Response

from utils.auth import require_auth

invoice_bp = Blueprint("invoice", __name__)

# ── Page constants (A4 points) ────────────────────────────────────────
W, H = 595, 842
MARGIN = 36
PRIMARY = (0.071, 0.224, 0.427)    # #12396d
PRIMARY_LIGHT = (0.878, 0.914, 1.0) # #e0ebff
GRAY = (0.557, 0.557, 0.557)
LINE = (0.898, 0.906, 0.922)       # #e5e7eb
WHITE = (1, 1, 1)
BLACK = (0, 0, 0)
ACCENT = (0.114, 0.608, 0.698)     # #1d9bb2


def _rgb(t):
    return t[0], t[1], t[2]


DOC_TYPE_LABELS = {
    "견적서": "견 적 서",
    "거래명세서": "거 래 명 세 서",
    "청구서": "청 구 서",
}

ITEM_COLS = [
    ("품목명",   130),
    ("규격",     70),
    ("수량",     38),
    ("단가",     75),
    ("공급가",   75),
    ("세액",     65),
    ("합계",     75),
]


def _fmt(n):
    try:
        return f"{int(n):,}"
    except Exception:
        return str(n)


def _won(n):
    try:
        return f"₩{int(n):,}"
    except Exception:
        return str(n)


def _draw_rect_filled(page, x0, y0, x1, y1, color):
    rect = fitz.Rect(x0, y0, x1, y1)
    page.draw_rect(rect, color=None, fill=color, width=0)


def _draw_rect_stroked(page, x0, y0, x1, y1, color, width=0.5):
    rect = fitz.Rect(x0, y0, x1, y1)
    page.draw_rect(rect, color=color, fill=None, width=width)


def _text(page, x, y, text, fontsize=9, color=BLACK, fontname="helv", align=0):
    """align: 0=left, 1=center, 2=right"""
    page.insert_text((x, y), str(text), fontsize=fontsize,
                     color=color, fontname=fontname)


def _text_box(page, rect, text, fontsize=9, color=BLACK, fontname="helv", align=0):
    page.insert_textbox(fitz.Rect(rect), str(text), fontsize=fontsize,
                        color=color, fontname=fontname, align=align)


def build_pdf(data: dict) -> bytes:
    doc = fitz.open()
    page = doc.new_page(width=W, height=H)

    doc_type = data.get("doc_type", "견적서")
    doc_label = DOC_TYPE_LABELS.get(doc_type, doc_type)
    doc_number = data.get("doc_number", "")
    issue_date = data.get("issue_date", str(date.today()))
    valid_until = data.get("valid_until", "")
    company = data.get("company", {})
    client = data.get("client", {})
    items = data.get("items", [])
    totals = data.get("totals", {})
    notes = data.get("notes", "")

    y = MARGIN

    # ── Logo ──────────────────────────────────────────────────────────
    logo_data = company.get("logo")
    logo_w = 0
    if logo_data:
        try:
            header = logo_data.split(",", 1)
            b64 = header[1] if len(header) == 2 else logo_data
            img_bytes = base64.b64decode(b64)
            logo_h_pt = 36
            img_stream = io.BytesIO(img_bytes)
            # Try to figure out aspect ratio via fitz
            tmp = fitz.open(stream=img_bytes, filetype="png")
            if tmp.page_count == 0:
                tmp = fitz.open(stream=img_bytes, filetype="jpg")
            if tmp.page_count > 0:
                p = tmp[0]
                ar = p.rect.width / max(p.rect.height, 1)
            else:
                ar = 1.0
            tmp.close()
            logo_w = min(logo_h_pt * ar, 120)
            page.insert_image(
                fitz.Rect(MARGIN, y, MARGIN + logo_w, y + logo_h_pt),
                stream=img_bytes,
            )
        except Exception:
            logo_w = 0

    # ── Document title ────────────────────────────────────────────────
    title_x = MARGIN + logo_w + (10 if logo_w else 0)
    page.insert_textbox(
        fitz.Rect(title_x, y, W - MARGIN, y + 30),
        doc_label,
        fontsize=22, fontname="helv-b", color=_rgb(PRIMARY), align=0,
    )
    y += 38

    # Divider
    page.draw_line((MARGIN, y), (W - MARGIN, y), color=_rgb(PRIMARY), width=1.5)
    y += 6

    # ── Doc meta row ──────────────────────────────────────────────────
    meta_parts = []
    if doc_number:
        meta_parts.append(f"문서번호: {doc_number}")
    if issue_date:
        meta_parts.append(f"발행일: {issue_date}")
    if valid_until:
        meta_parts.append(f"유효기간: {valid_until}")
    page.insert_textbox(
        fitz.Rect(MARGIN, y, W - MARGIN, y + 14),
        "   |   ".join(meta_parts),
        fontsize=8, fontname="helv", color=_rgb(GRAY), align=2,
    )
    y += 18

    # ── Company / Client info boxes ───────────────────────────────────
    BOX_W = (W - MARGIN * 2 - 8) / 2
    BOX_H = 90
    BOX_HEADER_H = 16

    def draw_info_box(bx, by, label, info: dict):
        # Header bar
        _draw_rect_filled(page, bx, by, bx + BOX_W, by + BOX_HEADER_H, _rgb(PRIMARY))
        page.insert_textbox(
            fitz.Rect(bx + 6, by + 2, bx + BOX_W - 4, by + BOX_HEADER_H),
            label, fontsize=8, fontname="helv-b", color=WHITE, align=0,
        )
        # Body border
        _draw_rect_stroked(page, bx, by + BOX_HEADER_H, bx + BOX_W, by + BOX_H, _rgb(LINE))
        # Fields
        fy = by + BOX_HEADER_H + 7
        fields = [
            ("상호", info.get("name", "")),
            ("사업자번호", info.get("biz_number", "")),
            ("대표자", info.get("ceo") or info.get("contact", "")),
            ("업태/종목", info.get("biz_type", "")),
            ("주소", info.get("address", "")),
            ("연락처", info.get("tel", "")),
        ]
        for fname, fval in fields:
            if not fval:
                continue
            page.insert_textbox(
                fitz.Rect(bx + 6, fy - 2, bx + 54, fy + 9),
                fname, fontsize=7, fontname="helv-b", color=_rgb(GRAY), align=0,
            )
            page.insert_textbox(
                fitz.Rect(bx + 54, fy - 2, bx + BOX_W - 4, fy + 9),
                fval, fontsize=7, fontname="helv", color=BLACK, align=0,
            )
            fy += 11
            if fy > by + BOX_H - 4:
                break

    draw_info_box(MARGIN, y, "공급자", company)
    draw_info_box(MARGIN + BOX_W + 8, y, "공급받는자", client)
    y += BOX_H + 10

    # ── Grand total highlight ─────────────────────────────────────────
    grand = totals.get("grand", 0)
    ht_h = 24
    _draw_rect_filled(page, MARGIN, y, W - MARGIN, y + ht_h, _rgb(PRIMARY_LIGHT))
    page.insert_textbox(
        fitz.Rect(MARGIN + 6, y + 4, W - MARGIN - 6, y + ht_h),
        f"합계금액  {_won(grand)}원  ({_number_to_korean(grand)})",
        fontsize=9, fontname="helv-b", color=_rgb(PRIMARY), align=0,
    )
    y += ht_h + 8

    # ── Items table ───────────────────────────────────────────────────
    col_widths = [c[1] for c in ITEM_COLS]
    col_names = [c[0] for c in ITEM_COLS]
    table_w = sum(col_widths)
    table_x = MARGIN + (W - MARGIN * 2 - table_w) / 2  # center
    ROW_H = 14
    HEADER_H = 16

    # Header row
    _draw_rect_filled(page, table_x, y, table_x + table_w, y + HEADER_H, _rgb(PRIMARY))
    cx = table_x
    for name, cw in zip(col_names, col_widths):
        page.insert_textbox(
            fitz.Rect(cx + 2, y + 2, cx + cw - 2, y + HEADER_H),
            name, fontsize=7.5, fontname="helv-b", color=WHITE, align=1,
        )
        cx += cw
    y += HEADER_H

    # Data rows
    visible_items = [it for it in items if it.get("name") or it.get("qty") or it.get("price")]
    for idx, item in enumerate(visible_items):
        row_color = _rgb(PRIMARY_LIGHT) if idx % 2 == 1 else WHITE
        _draw_rect_filled(page, table_x, y, table_x + table_w, y + ROW_H, row_color)

        vals = [
            item.get("name", ""),
            item.get("spec", ""),
            _fmt(item.get("qty", 0)),
            _fmt(item.get("price", 0)),
            _fmt(item.get("supply", 0)),
            _fmt(item.get("tax", 0)),
            _fmt(item.get("total", 0)),
        ]
        aligns = [0, 0, 1, 2, 2, 2, 2]
        cx = table_x
        for val, cw, align in zip(vals, col_widths, aligns):
            pad_l = 3 if align == 0 else 2
            pad_r = 2 if align != 2 else 4
            page.insert_textbox(
                fitz.Rect(cx + pad_l, y + 2, cx + cw - pad_r, y + ROW_H),
                str(val), fontsize=7, fontname="helv", color=BLACK, align=align,
            )
            cx += cw

        # Bottom border
        page.draw_line((table_x, y + ROW_H), (table_x + table_w, y + ROW_H),
                       color=_rgb(LINE), width=0.3)
        y += ROW_H

    # Table outer border
    _draw_rect_stroked(page, table_x, y - HEADER_H - len(visible_items) * ROW_H,
                       table_x + table_w, y, _rgb(LINE), width=0.7)
    y += 8

    # ── Totals block ──────────────────────────────────────────────────
    tot_x = W - MARGIN - 180
    tot_rows = [
        ("공급가액 합계", totals.get("supply", 0), False),
        ("세액 합계 (10%)", totals.get("tax", 0), False),
        ("합계금액", totals.get("grand", 0), True),
    ]
    for label, val, bold in tot_rows:
        bg = _rgb(PRIMARY) if bold else _rgb(LINE)
        fg = WHITE if bold else BLACK
        _draw_rect_filled(page, tot_x, y, tot_x + 180, y + 14, bg)
        page.insert_textbox(
            fitz.Rect(tot_x + 4, y + 2, tot_x + 100, y + 14),
            label, fontsize=8, fontname="helv-b" if bold else "helv", color=fg, align=0,
        )
        page.insert_textbox(
            fitz.Rect(tot_x + 100, y + 2, tot_x + 176, y + 14),
            _won(val), fontsize=8, fontname="helv-b" if bold else "helv", color=fg, align=2,
        )
        y += 14

    y += 10

    # ── Notes ─────────────────────────────────────────────────────────
    if notes:
        page.insert_textbox(
            fitz.Rect(MARGIN, y, MARGIN + 60, y + 12),
            "비고", fontsize=8, fontname="helv-b", color=_rgb(PRIMARY), align=0,
        )
        y += 12
        note_h = min(60, 12 * math.ceil(len(notes) / 60) + 10)
        _draw_rect_stroked(page, MARGIN, y, W - MARGIN, y + note_h, _rgb(LINE))
        page.insert_textbox(
            fitz.Rect(MARGIN + 4, y + 4, W - MARGIN - 4, y + note_h - 4),
            notes, fontsize=8, fontname="helv", color=BLACK, align=0,
        )
        y += note_h + 8

    # ── Footer ────────────────────────────────────────────────────────
    page.draw_line((MARGIN, H - 28), (W - MARGIN, H - 28), color=_rgb(LINE), width=0.5)
    page.insert_textbox(
        fitz.Rect(MARGIN, H - 24, W - MARGIN, H - 10),
        f"{company.get('name', '')}  |  본 문서는 Program Tool을 통해 생성되었습니다.",
        fontsize=7, fontname="helv", color=_rgb(GRAY), align=1,
    )

    buf = io.BytesIO()
    doc.save(buf, garbage=4, deflate=True)
    doc.close()
    return buf.getvalue()


def _number_to_korean(n: int) -> str:
    """Convert integer to Korean amount string (e.g. 1500000 → 일백오십만원정)"""
    if n == 0:
        return "영원정"
    units = ["", "만", "억", "조"]
    small = ["", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"]
    small10 = ["", "십", "이십", "삼십", "사십", "오십", "육십", "칠십", "팔십", "구십"]
    small100 = ["", "백", "이백", "삼백", "사백", "오백", "육백", "칠백", "팔백", "구백"]
    small1000 = ["", "천", "이천", "삼천", "사천", "오천", "육천", "칠천", "팔천", "구천"]

    def chunk_str(num):
        if num == 0:
            return ""
        d1 = num % 10
        d10 = (num // 10) % 10
        d100 = (num // 100) % 10
        d1000 = (num // 1000) % 10
        return small1000[d1000] + small100[d100] + small10[d10] + small[d1]

    result = ""
    for i, unit in enumerate(units):
        chunk = (n // (10000 ** i)) % 10000
        if chunk:
            result = chunk_str(chunk) + unit + result
    return result + "원정"


@invoice_bp.route("/generate", methods=["POST"])
@require_auth
def generate(uid):
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"detail": "요청 데이터가 없습니다"}), 400

    if not data.get("company", {}).get("name"):
        return jsonify({"detail": "공급자 회사명이 필요합니다"}), 400
    if not data.get("client", {}).get("name"):
        return jsonify({"detail": "공급받는자 회사명이 필요합니다"}), 400

    try:
        pdf_bytes = build_pdf(data)
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({"detail": f"PDF 생성 실패: {type(e).__name__}: {e}"}), 500

    doc_type = data.get("doc_type", "견적서")
    client_name = data.get("client", {}).get("name", "unknown")
    issue_date = (data.get("issue_date") or "").replace("-", "")
    filename = f"{doc_type}_{client_name}_{issue_date}.pdf"

    return Response(
        pdf_bytes,
        status=200,
        mimetype="application/pdf",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{filename}"},
    )
