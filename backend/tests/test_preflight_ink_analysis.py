from models.schemas import CheckSeverity
from services.preflight_ink_analysis import (
    check_black_ink,
    check_overprint,
    check_spot_colors,
    check_total_ink_coverage,
    run_advanced_print_checks,
)


class FakePage:
    def __init__(self, xref: int, contents=None):
        self.xref = xref
        self._contents = list(contents or [])

    def get_contents(self):
        return list(self._contents)


class FakeDoc:
    def __init__(self, pages, *, keys=None, objects=None, streams=None):
        self.pages = list(pages)
        self.keys = dict(keys or {})
        self.objects = dict(objects or {})
        self.streams = dict(streams or {})

    def __len__(self):
        return len(self.pages)

    def __getitem__(self, index):
        return self.pages[index]

    def xref_get_key(self, xref, key):
        return self.keys.get((xref, key), ("null", "null"))

    def xref_object(self, xref, compressed=False):
        del compressed
        if xref not in self.objects:
            raise KeyError(xref)
        return self.objects[xref]

    def xref_stream(self, xref):
        if xref not in self.streams:
            raise KeyError(xref)
        return self.streams[xref]


def _doc_with_resource(resource_object: str, stream: bytes = b""):
    page = FakePage(10, [40] if stream else [])
    return FakeDoc(
        [page],
        keys={(10, "Resources"): ("xref", "20 0 R")},
        objects={20: resource_object},
        streams={40: stream} if stream else {},
    )


def test_spot_color_detects_separation_and_decodes_pdf_name():
    doc = _doc_with_resource(
        "<< /ColorSpace << /CS1 [/Separation /PANTONE#20186#20C /DeviceCMYK 30 0 R] >> >>"
    )
    doc.objects[30] = "<< /FunctionType 2 >>"

    item = check_spot_colors(doc)

    assert item.severity == CheckSeverity.warning
    assert item.page_refs == [1]
    assert "PANTONE 186 C" in item.detail


def test_devicen_process_plates_are_not_reported_as_spot_colors():
    doc = _doc_with_resource(
        "<< /ColorSpace << /CS1 [/DeviceN [/Cyan /Magenta /Yellow /Black] /DeviceCMYK 30 0 R] >> >>"
    )
    doc.objects[30] = "<< /FunctionType 2 >>"

    item = check_spot_colors(doc)

    assert item.severity == CheckSeverity.pass_
    assert item.page_refs == []


def test_overprint_only_warns_when_overprint_graphics_state_is_used():
    page = FakePage(10, [40])
    doc = FakeDoc(
        [page],
        keys={(10, "Resources"): ("xref", "20 0 R")},
        objects={
            20: "<< /ExtGState << /GSop 30 0 R /GSunused 31 0 R >> >>",
            30: "<< /Type /ExtGState /OP true /op true /OPM 1 >>",
            31: "<< /Type /ExtGState /OP true >>",
        },
        streams={40: b"q /GSop gs 0 0 0 1 k Q"},
    )

    item = check_overprint(doc)

    assert item.severity == CheckSeverity.warning
    assert item.page_refs == [1]
    assert "GSop" in item.detail
    assert "GSunused" not in item.detail


def test_unused_overprint_resource_does_not_create_warning():
    page = FakePage(10, [40])
    doc = FakeDoc(
        [page],
        keys={(10, "Resources"): ("xref", "20 0 R")},
        objects={
            20: "<< /ExtGState << /GSop 30 0 R >> >>",
            30: "<< /Type /ExtGState /OP true /op true /OPM 1 >>",
        },
        streams={40: b"q 0 0 0 1 k Q"},
    )

    item = check_overprint(doc)

    assert item.severity == CheckSeverity.pass_


def test_rich_black_and_high_tac_are_reported_from_explicit_cmyk_operators():
    doc = _doc_with_resource(
        "<< >>",
        b"0 0 0 1 k\n0.5 0.4 0.4 1 k\n0.9 0.8 0.7 0.8 k\n",
    )

    black = check_black_ink(doc)
    tac = check_total_ink_coverage(doc)

    assert black.severity == CheckSeverity.warning
    assert black.page_refs == [1]
    assert "순수 100K" in black.detail
    assert tac.severity == CheckSeverity.warning
    assert tac.page_refs == [1]
    assert "320%" in tac.detail


def test_cmyk_like_text_and_comments_do_not_trigger_tac_warning():
    doc = _doc_with_resource(
        "<< >>",
        b"(0.9 0.9 0.9 1 k) Tj\n% 0.9 0.9 0.9 1 k\n0 0 0 1 k\n",
    )

    black = check_black_ink(doc)
    tac = check_total_ink_coverage(doc)

    assert black.severity == CheckSeverity.pass_
    assert "순수 100K" in black.detail
    assert tac.severity == CheckSeverity.pass_
    assert "100%" in tac.detail


def test_sampled_pass_includes_range_marker_for_reliability_layer():
    pages = [FakePage(index + 1) for index in range(101)]
    keys = {(page.xref, "Resources"): ("dict", "<< >>") for page in pages}
    doc = FakeDoc(pages, keys=keys)

    item = check_spot_colors(doc)

    assert item.severity == CheckSeverity.pass_
    assert "앞 100페이지 검사, 전체 101p" in item.detail


def test_run_advanced_print_checks_returns_four_bounded_checks():
    doc = _doc_with_resource("<< >>", b"0 0 0 1 k")

    items = run_advanced_print_checks(doc)

    assert [item.id for item in items] == [
        "spot_colors",
        "overprint",
        "black_ink",
        "total_ink_coverage",
    ]
