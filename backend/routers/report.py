import io
import json
import math
from datetime import datetime
from urllib.parse import quote

import fitz
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.font_manager as fm
import pandas as pd
from flask import Blueprint, request, jsonify, Response

from utils.auth import require_auth

report_bp = Blueprint("report", __name__)

# ── colour themes ─────────────────────────────────────────────────────────────
THEMES = {
    "blue":  {"header": (0.071, 0.224, 0.427), "accent": (0.114, 0.608, 0.694), "row_even": (0.941, 0.949, 0.961)},
    "dark":  {"header": (0.122, 0.122, 0.165), "accent": (0.380, 0.380, 0.502), "row_even": (0.906, 0.906, 0.922)},
    "green": {"header": (0.063, 0.384, 0.200), "accent": (0.157, 0.694, 0.400), "row_even": (0.929, 0.961, 0.941)},
}

A4_W, A4_H = 595, 842          # portrait
A4_L_W, A4_L_H = 842, 595      # landscape
MARGIN = 36
ROWS_PER_PAGE = 40


# ── helpers ───────────────────────────────────────────────────────────────────

def _read_file(file_storage):
    """Return pandas DataFrame from uploaded CSV/Excel file."""
    name = (file_storage.filename or "").lower()
    data = file_storage.read()
    if len(data) > 10 * 1024 * 1024:
        raise ValueError("파일이 10 MB 제한을 초과합니다")
    buf = io.BytesIO(data)
    if name.endswith(".csv"):
        for enc in ("utf-8-sig", "utf-8", "cp949", "euc-kr"):
            try:
                buf.seek(0)
                return pd.read_csv(buf, encoding=enc)
            except UnicodeDecodeError:
                continue
        raise ValueError("CSV 인코딩을 인식할 수 없습니다")
    elif name.endswith((".xlsx", ".xls")):
        return pd.read_excel(buf)
    else:
        raise ValueError("CSV 또는 Excel(.xlsx/.xls) 파일만 지원합니다")


def _numeric_cols(df):
    return [c for c in df.columns if pd.api.types.is_numeric_dtype(df[c])]


def _summary_stats(df):
    """Return list of {col, mean, max, min, sum} for numeric columns."""
    rows = []
    for c in _numeric_cols(df):
        s = df[c].dropna()
        if len(s) == 0:
            continue
        rows.append({
            "col": str(c),
            "mean": round(float(s.mean()), 4),
            "max":  round(float(s.max()),  4),
            "min":  round(float(s.min()),  4),
            "sum":  round(float(s.sum()),  4),
        })
    return rows


def _bar_chart_image(df, col, theme_key, orientation):
    """Render a simple bar chart and return PNG bytes."""
    theme = THEMES.get(theme_key, THEMES["blue"])
    h_color = theme["header"]
    a_color = theme["accent"]

    series = df[col].dropna()
    # Down-sample to at most 50 bars for readability
    if len(series) > 50:
        series = series.head(50)

    fig_w = 7.0 if orientation == "portrait" else 10.0
    fig, ax = plt.subplots(figsize=(fig_w, 3.5))
    bar_color = (a_color[0], a_color[1], a_color[2], 0.85)
    ax.bar(range(len(series)), series.values, color=bar_color, edgecolor="white", linewidth=0.4)
    ax.set_facecolor("#f8f9fb")
    fig.patch.set_facecolor("#ffffff")
    ax.spines[["top", "right"]].set_visible(False)
    ax.spines[["left", "bottom"]].set_color("#cccccc")
    ax.tick_params(colors="#555555", labelsize=7)
    ax.set_xlabel(str(col), fontsize=8, color="#333333")
    ax.set_ylabel("값", fontsize=8, color="#333333")
    title_color = (h_color[0], h_color[1], h_color[2])
    ax.set_title(f"{col} 바 차트", fontsize=9, fontweight="bold", color=title_color, pad=8)
    plt.tight_layout()

    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=150, bbox_inches="tight")
    plt.close(fig)
    buf.seek(0)
    return buf.read()


# ── PDF drawing helpers ───────────────────────────────────────────────────────

def _draw_header(page, title, company, gen_date, theme, page_w, page_h):
    """Draw top header band and return y position after header."""
    hdr_h = 60
    hdr_rect = fitz.Rect(0, 0, page_w, hdr_h)
    page.draw_rect(hdr_rect, color=None, fill=theme["header"])

    white = (1, 1, 1)
    # Company name (smaller, upper-left)
    if company:
        page.insert_text(
            fitz.Point(MARGIN, 18),
            company,
            fontsize=9,
            color=white,
        )
    # Title (bold, centre)
    tw = fitz.get_text_length(title, fontsize=14)
    page.insert_text(
        fitz.Point((page_w - tw) / 2, 38),
        title,
        fontsize=14,
        color=white,
        fontname="helv",
    )
    # Generated date (right side, small)
    date_str = f"생성일: {gen_date}"
    dw = fitz.get_text_length(date_str, fontsize=8)
    page.insert_text(
        fitz.Point(page_w - MARGIN - dw, 52),
        date_str,
        fontsize=8,
        color=(0.85, 0.90, 0.95),
    )
    return hdr_h + 16  # y start for content


def _draw_footer(page, page_num, total_pages, page_w, page_h):
    y = page_h - 20
    footer_text = f"페이지 {page_num} / {total_pages}"
    fw = fitz.get_text_length(footer_text, fontsize=8)
    page.insert_text(
        fitz.Point((page_w - fw) / 2, y),
        footer_text,
        fontsize=8,
        color=(0.55, 0.55, 0.55),
    )
    page.draw_line(
        fitz.Point(MARGIN, page_h - 26),
        fitz.Point(page_w - MARGIN, page_h - 26),
        color=(0.80, 0.85, 0.90),
        width=0.5,
    )


def _col_widths(columns, avail_w):
    """Distribute column widths evenly, minimum 30pt."""
    n = len(columns)
    if n == 0:
        return []
    base = max(30, avail_w / n)
    # Truncate if too many columns
    if base * n > avail_w:
        base = avail_w / n
    return [base] * n


def _draw_table(doc, pages_list, df_rows, columns, theme, title, company, gen_date,
                page_w, page_h, start_y, is_header_table=False, label=None):
    """
    Draw table rows across one or more pages.
    pages_list: mutable list; new pages are appended as needed.
    Returns (last_page, last_y).
    """
    avail_w = page_w - 2 * MARGIN
    col_w = _col_widths(columns, avail_w)
    row_h = 14
    hdr_h_row = 16

    accent = theme["accent"]
    row_even = theme["row_even"]
    header_bg = theme["header"]
    text_dark = (0.10, 0.10, 0.15)
    text_white = (1.0, 1.0, 1.0)

    page = pages_list[-1]
    y = start_y

    # Optional section label
    if label:
        page.insert_text(fitz.Point(MARGIN, y), label, fontsize=10, color=header_bg, fontname="helv")
        y += 16

    def _draw_col_headers(pg, y0):
        x = MARGIN
        pg.draw_rect(
            fitz.Rect(MARGIN, y0, MARGIN + sum(col_w), y0 + hdr_h_row),
            color=None,
            fill=accent,
        )
        for ci, col in enumerate(columns):
            ctext = str(col)[:18]
            pg.insert_text(
                fitz.Point(x + 3, y0 + hdr_h_row - 4),
                ctext,
                fontsize=7,
                color=text_white,
                fontname="helv",
            )
            x += col_w[ci]
        # vertical lines
        x = MARGIN
        for w in col_w:
            pg.draw_line(fitz.Point(x, y0), fitz.Point(x, y0 + hdr_h_row),
                         color=(1, 1, 1, 0.3), width=0.4)
            x += w
        pg.draw_line(fitz.Point(x, y0), fitz.Point(x, y0 + hdr_h_row),
                     color=(1, 1, 1, 0.3), width=0.4)
        return y0 + hdr_h_row

    y = _draw_col_headers(page, y)

    for ri, row in enumerate(df_rows):
        # New page check
        if y + row_h > page_h - 40:
            _draw_footer(page, len(pages_list), 0, page_w, page_h)
            page = doc.new_page(width=page_w, height=page_h)
            pages_list.append(page)
            new_y = _draw_header(page, title, company, gen_date, theme, page_w, page_h)
            y = _draw_col_headers(page, new_y)

        bg = row_even if ri % 2 == 0 else (1, 1, 1)
        x = MARGIN
        page.draw_rect(
            fitz.Rect(MARGIN, y, MARGIN + sum(col_w), y + row_h),
            color=None,
            fill=bg,
        )
        for ci, val in enumerate(row):
            cell_text = str(val) if val is not None and not (isinstance(val, float) and math.isnan(val)) else ""
            cell_text = cell_text[:22]
            page.insert_text(
                fitz.Point(x + 3, y + row_h - 3),
                cell_text,
                fontsize=6.5,
                color=text_dark,
            )
            x += col_w[ci]

        # horizontal separator
        page.draw_line(
            fitz.Point(MARGIN, y + row_h),
            fitz.Point(MARGIN + sum(col_w), y + row_h),
            color=(0.85, 0.87, 0.90),
            width=0.3,
        )
        y += row_h

    # Outer border
    table_top = start_y if not label else start_y + 16
    page.draw_rect(
        fitz.Rect(MARGIN, table_top, MARGIN + sum(col_w), y),
        color=(0.75, 0.80, 0.87),
        fill=None,
        width=0.6,
    )

    return page, y + 12


# ── main route ────────────────────────────────────────────────────────────────

@report_bp.route("/generate", methods=["POST"])
@require_auth
def generate(uid):
    # --- parse settings ---
    settings_raw = request.form.get("settings", "{}")
    try:
        settings = json.loads(settings_raw)
    except Exception:
        return jsonify({"detail": "settings JSON 파싱 실패"}), 400

    report_title   = str(settings.get("title",        "데이터 리포트"))[:80]
    company_name   = str(settings.get("company",      ""))[:60]
    include_chart  = bool(settings.get("include_chart", False))
    chart_col      = settings.get("chart_col", None)
    theme_key      = settings.get("theme",      "blue")
    orientation    = settings.get("orientation", "portrait")  # portrait / landscape
    include_stats  = bool(settings.get("include_stats", False))

    if theme_key not in THEMES:
        theme_key = "blue"
    theme = THEMES[theme_key]

    page_w = A4_W if orientation == "portrait" else A4_L_W
    page_h = A4_H if orientation == "portrait" else A4_L_H

    # --- parse uploaded file ---
    file = request.files.get("file")
    if not file:
        return jsonify({"detail": "파일이 없습니다"}), 400
    try:
        df = _read_file(file)
    except ValueError as e:
        return jsonify({"detail": str(e)}), 400
    except Exception as e:
        return jsonify({"detail": f"파일 파싱 실패: {e}"}), 400

    if df.empty:
        return jsonify({"detail": "데이터가 비어 있습니다"}), 400

    columns = [str(c) for c in df.columns.tolist()]
    gen_date = datetime.now().strftime("%Y-%m-%d %H:%M")

    # --- build PDF ---
    doc = fitz.open()
    pages_list = [doc.new_page(width=page_w, height=page_h)]
    first_page = pages_list[0]

    y = _draw_header(first_page, report_title, company_name, gen_date, theme, page_w, page_h)

    # Data rows (all rows)
    df_rows = [list(row) for row in df.itertuples(index=False, name=None)]

    last_page, y = _draw_table(
        doc, pages_list, df_rows, columns, theme,
        report_title, company_name, gen_date,
        page_w, page_h, y,
        label="■ 데이터 테이블",
    )

    # Summary stats
    if include_stats:
        stats = _summary_stats(df)
        if stats:
            stat_columns = ["컬럼", "평균", "최대", "최소", "합계"]
            stat_rows = [
                [s["col"], s["mean"], s["max"], s["min"], s["sum"]]
                for s in stats
            ]
            if y + 60 > page_h - 40:
                _draw_footer(last_page, len(pages_list), 0, page_w, page_h)
                last_page = doc.new_page(width=page_w, height=page_h)
                pages_list.append(last_page)
                y = _draw_header(last_page, report_title, company_name, gen_date, theme, page_w, page_h)

            last_page, y = _draw_table(
                doc, pages_list, stat_rows, stat_columns, theme,
                report_title, company_name, gen_date,
                page_w, page_h, y + 8,
                label="■ 요약 통계",
            )

    # Bar chart
    if include_chart and chart_col and chart_col in df.columns:
        try:
            chart_png = _bar_chart_image(df, chart_col, theme_key, orientation)
            # Place on a new section (or new page if needed)
            chart_display_w = page_w - 2 * MARGIN
            chart_display_h = chart_display_w * 0.42

            if y + chart_display_h + 30 > page_h - 40:
                _draw_footer(last_page, len(pages_list), 0, page_w, page_h)
                last_page = doc.new_page(width=page_w, height=page_h)
                pages_list.append(last_page)
                y = _draw_header(last_page, report_title, company_name, gen_date, theme, page_w, page_h)

            last_page.insert_text(
                fitz.Point(MARGIN, y + 10),
                "■ 차트",
                fontsize=10,
                color=theme["header"],
                fontname="helv",
            )
            y += 18

            img_rect = fitz.Rect(MARGIN, y, MARGIN + chart_display_w, y + chart_display_h)
            last_page.insert_image(img_rect, stream=chart_png)
            y += chart_display_h + 10
        except Exception:
            pass  # chart is optional, don't fail the whole report

    # Patch page numbers now that we know the total
    total_pages = len(pages_list)
    for i, pg in enumerate(pages_list):
        _draw_footer(pg, i + 1, total_pages, page_w, page_h)

    # Serialise
    out_buf = io.BytesIO()
    doc.save(out_buf, garbage=4, deflate=True)
    doc.close()

    safe_title = report_title.replace(" ", "_")[:40]
    filename = f"{safe_title}_report.pdf"
    encoded_filename = quote(filename, safe="-._~")

    return Response(
        out_buf.getvalue(),
        status=200,
        mimetype="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}",
        },
    )
