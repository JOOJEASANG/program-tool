from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

def read(path):
    return (ROOT / path).read_text(encoding="utf-8")

def test_layout_workflow_sections_and_input_ownership():
    html = read("pdf-editor/index.html")
    ids = ['id="sb-upload"', 'id="sb-nup"', 'id="sb-paper"', 'id="sb-trim"', 'id="sb-edit"']
    assert [html.index(key) for key in ids] == sorted(html.index(key) for key in ids)
    nup = html.split(ids[1],1)[1].split(ids[2],1)[0]
    paper = html.split(ids[2],1)[1].split(ids[3],1)[0]
    trim = html.split(ids[3],1)[1].split(ids[4],1)[0]
    assert 'id="pdfLayoutModeTabs"' in nup
    assert 'id="bookletCheck"' in nup
    assert 'id="paperSize"' in paper
    assert 'id="autoDetectSize"' in paper
    for key in ("actualSizePanel", "marginH", "marginV", "gap", "showBorder"):
        assert f'id="{key}"' in trim
        assert html.count(f'id="{key}"') == 1
    assert "$('sb-trim') || $('sb-paper')" in read("js/pdf-editor/crop-marks.js")

def test_upload_reveals_layout_and_reordering_preserves_nodes():
    js = read("js/pdf-editor/simple-sidebar-ui.js")
    assert "['upload','nup','paper','trim','edit']" in js
    assert "current.parentNode.insertBefore(current,previous.nextSibling)" in js
    assert "document.addEventListener('pdf-import-committed'" in js
    assert "openSections.add('nup')" in js
