from models.schemas import CheckSeverity
from services.preflight_print_metadata import check_output_intent, check_page_boxes


class FakePage:
    def __init__(self, xref: int):
        self.xref = xref


class FakeDoc:
    def __init__(self, pages, keys=None, objects=None, catalog_xref=1):
        self._pages = list(pages)
        self._keys = dict(keys or {})
        self._objects = dict(objects or {})
        self._catalog_xref = catalog_xref

    def __len__(self):
        return len(self._pages)

    def __getitem__(self, index):
        return self._pages[index]

    def xref_get_key(self, xref, key):
        return self._keys.get((xref, key), ("null", "null"))

    def xref_object(self, xref, compressed=False):
        del compressed
        return self._objects.get(xref, "")

    def pdf_catalog(self):
        return self._catalog_xref


def test_page_boxes_warn_when_trim_and_bleed_are_missing():
    doc = FakeDoc([FakePage(10)])

    item = check_page_boxes(doc)

    assert item.severity == CheckSeverity.warning
    assert item.page_refs == [1]
    assert "TrimBox 미지정" in item.detail
    assert "BleedBox 미지정" in item.detail


def test_page_boxes_pass_with_about_three_mm_bleed():
    doc = FakeDoc(
        [FakePage(10)],
        keys={
            (10, "TrimBox"): ("array", "[0 0 100 100]"),
            (10, "BleedBox"): ("array", "[-9 -9 109 109]"),
        },
    )

    item = check_page_boxes(doc)

    assert item.severity == CheckSeverity.pass_
    assert item.page_refs == []
    assert "3mm 이상" in item.detail


def test_output_intent_warns_when_missing():
    doc = FakeDoc([FakePage(10)])

    item = check_output_intent(doc)

    assert item.severity == CheckSeverity.warning
    assert "OutputIntent가 없습니다" in item.detail


def test_output_intent_passes_with_pdfx_profile_reference():
    doc = FakeDoc(
        [FakePage(10)],
        keys={
            (1, "OutputIntents"): ("array", "[5 0 R]"),
        },
        objects={
            5: (
                "<< /Type /OutputIntent /S /GTS_PDFX "
                "/OutputConditionIdentifier (FOGRA39) "
                "/DestOutputProfile 6 0 R >>"
            ),
            6: "<< /N 4 /Length 128 >>",
        },
    )

    item = check_output_intent(doc)

    assert item.severity == CheckSeverity.pass_
    assert "FOGRA39" in item.detail
    assert "PDF/X" in item.detail
