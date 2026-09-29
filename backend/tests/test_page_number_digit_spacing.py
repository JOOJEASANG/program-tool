import fitz
import pytest

from models.schemas import PageNumberSettings
from services.pdf_text_renderer import apply_page_numbers


@pytest.mark.parametrize('number', [9, 10, 11, 99, 100])
@pytest.mark.parametrize('style', ['1', '1/N', '-1-', '-1/N-'])
def test_saved_page_number_uses_normal_digit_advances(number, style):
    doc = fitz.open()
    page = doc.new_page(width=300, height=400)
    settings = PageNumberSettings(enabled=True, start=number, format=style,
                                  font_size=10, position='bottom-center')
    apply_page_numbers(page, settings, 0, 1, 300, 400)
    saved = fitz.open(stream=doc.tobytes(), filetype='pdf')
    spans = [span for block in saved[0].get_text('rawdict')['blocks']
             for line in block.get('lines', []) for span in line['spans']]
    chars = [char for span in spans for char in span['chars']]
    text = ''.join(char['c'] for char in chars)
    assert str(number) in text
    assert all(span['font'] == 'Helvetica' for span in spans)
    for left, right in zip(chars, chars[1:]):
        if left['c'].isdigit() and right['c'].isdigit():
            assert right['origin'][0] - left['origin'][0] == pytest.approx(5.56, abs=0.02)
    assert (chars[0]['bbox'][0] + chars[-1]['bbox'][2]) / 2 == pytest.approx(150, abs=0.1)
    saved.close()
    doc.close()
