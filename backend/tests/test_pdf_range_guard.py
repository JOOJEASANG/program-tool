from pathlib import Path

import pytest

from services.pdf_ops import (
    MAX_RANGE_SPEC_LENGTH,
    MAX_RANGE_TOKENS,
    _parse_page_ranges,
)


ROOT = Path(__file__).resolve().parents[2]


def test_empty_range_means_all_pages():
    assert _parse_page_ranges("", 5) == {1, 2, 3, 4, 5}


def test_normal_reversed_and_out_of_range_values_are_clamped_first():
    assert _parse_page_ranges("1-3, 8-6, 999999999-2", 8) == set(range(1, 9))


def test_billion_endpoint_never_expands_beyond_real_page_count():
    assert _parse_page_ranges("1-1000000000", 12) == set(range(1, 13))


def test_invalid_and_absurd_digit_tokens_are_ignored():
    assert _parse_page_ranges("abc,0,3,999999999999999999999", 5) == {3}


def test_excessively_long_range_input_is_rejected():
    with pytest.raises(ValueError, match="너무 깁니다"):
        _parse_page_ranges("1," * (MAX_RANGE_SPEC_LENGTH + 1), 10)


def test_excessive_range_token_count_is_rejected():
    spec = ",".join("1" for _ in range(MAX_RANGE_TOKENS + 1))
    with pytest.raises(ValueError, match="너무 많습니다"):
        _parse_page_ranges(spec, 10)


def test_range_guard_is_part_of_pdf_ops_without_startup_patch():
    main = (ROOT / "backend" / "main.py").read_text(encoding="utf-8")
    pdf_ops = (ROOT / "backend" / "services" / "pdf_ops.py").read_text(encoding="utf-8")
    assert "pdf_range_guard_patch" not in main
    assert "MAX_RANGE_SPEC_LENGTH = 4096" in pdf_ops
    assert "def _parse_page_ranges" in pdf_ops
