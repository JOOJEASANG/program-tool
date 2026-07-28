import fitz

from models.schemas import CheckSeverity
from services.preflight_svc import check_color_mode, check_transparency


def _document_with_vector(color, *, opacity: float = 1.0) -> fitz.Document:
    document = fitz.open()
    page = document.new_page(width=300, height=300)
    shape = page.new_shape()
    shape.draw_rect(fitz.Rect(30, 30, 270, 270))
    shape.finish(
        color=color,
        fill=color,
        fill_opacity=opacity,
        stroke_opacity=opacity,
    )
    shape.commit()
    return document


def test_rgb_vector_content_is_reported() -> None:
    document = _document_with_vector((1, 0, 0))
    try:
        result = check_color_mode(document)
        assert result.severity == CheckSeverity.warning
        assert result.page_refs == [1]
    finally:
        document.close()


def test_cmyk_vector_content_does_not_raise_rgb_warning() -> None:
    document = _document_with_vector((0, 1, 1, 0))
    try:
        result = check_color_mode(document)
        assert result.severity == CheckSeverity.pass_
    finally:
        document.close()


def test_transparent_vector_content_is_reported() -> None:
    document = _document_with_vector((0, 0, 0), opacity=0.5)
    try:
        result = check_transparency(document)
        assert result.severity == CheckSeverity.warning
        assert result.page_refs == [1]
    finally:
        document.close()


def test_opaque_vector_content_passes_transparency_check() -> None:
    document = _document_with_vector((0, 0, 0), opacity=1)
    try:
        result = check_transparency(document)
        assert result.severity == CheckSeverity.pass_
    finally:
        document.close()
