import io

import fitz

from models.schemas import CheckItem, CheckSeverity
from services import preflight_reliability
from services import preflight_repair_patch


def _pdf_bytes(document: fitz.Document) -> bytes:
    buffer = io.BytesIO()
    document.save(buffer)
    document.close()
    return buffer.getvalue()


def test_sampled_pass_is_changed_to_warning():
    item = CheckItem(
        id="dpi",
        label="이미지 해상도",
        severity=CheckSeverity.pass_,
        detail="문제가 발견되지 않았습니다. (앞 8페이지 검사, 전체 100p)",
    )

    result = preflight_reliability.mark_sampled_pass_as_warning(item)

    assert result.severity == CheckSeverity.warning
    assert "전체 문서 통과를 의미하지 않습니다" in result.detail


def test_complete_pass_stays_pass():
    item = CheckItem(
        id="dpi",
        label="이미지 해상도",
        severity=CheckSeverity.pass_,
        detail="전체 8페이지에서 문제가 발견되지 않았습니다.",
    )

    result = preflight_reliability.mark_sampled_pass_as_warning(item)

    assert result.severity == CheckSeverity.pass_
    assert result.detail == item.detail


def test_sampled_failure_is_not_downgraded():
    item = CheckItem(
        id="dpi",
        label="이미지 해상도",
        severity=CheckSeverity.fail,
        detail="저해상도 이미지가 발견되었습니다. (앞 8페이지 검사, 전체 100p)",
    )

    result = preflight_reliability.mark_sampled_pass_as_warning(item)

    assert result.severity == CheckSeverity.fail
    assert result.detail == item.detail


def test_preflight_router_uses_explicit_reliability_runner():
    from routers import preflight as preflight_router

    assert preflight_router.run_reliable_checks is preflight_reliability.run_reliable_checks


def test_pdf_repair_preserves_mixed_page_sizes():
    source = fitz.open()
    source.new_page(width=595.28, height=841.89)
    source.new_page(width=841.89, height=1190.55)
    source_bytes = _pdf_bytes(source)

    response = preflight_repair_patch._fix_pdf_response_preserve_sizes(
        "mixed.pdf", source_bytes
    )

    assert response.status_code == 200
    assert "page-sizes=preserved" in response.headers["X-Fix-Note"]

    repaired = fitz.open(stream=response.get_data(), filetype="pdf")
    sizes = [(round(page.rect.width, 1), round(page.rect.height, 1)) for page in repaired]
    repaired.close()

    assert sizes == [(595.3, 841.9), (841.9, 1190.6)]
