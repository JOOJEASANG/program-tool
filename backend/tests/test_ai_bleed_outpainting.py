"""AI bleed edits are masked, cost-limited, and never replace the trim artwork."""
from __future__ import annotations

import base64
import io
import json

import fitz
import pytest
from PIL import Image

from services.ai_bleed_outpainting import (
    _multipart, outpaint_bleed, prepared_masked_images, AI_MAX_PAGES,
)
from services.ai_cover_image import AiCoverImageError
from services.design_bleed_extension import PT_PER_MM, extend_print_bleed


def base_pdf():
    source=fitz.open()
    try:
        page=source.new_page(width=210*PT_PER_MM,height=297*PT_PER_MM)
        page.draw_rect(page.rect,fill=(0.12,0.37,0.65),color=None)
        page.insert_text((55,100),"ORIGINAL VECTOR TEXT",fontsize=15)
        return source.tobytes()
    finally:
        source.close()


def test_transparent_mask_edits_only_outer_border():
    image=Image.new("RGB",(600,850),(42,92,143))
    scene,mask,size=prepared_masked_images(image,3,210,297)
    with Image.open(io.BytesIO(scene)) as base,Image.open(io.BytesIO(mask)) as alpha:
        assert base.size==size==alpha.size
        assert size[0]%16==0 and size[1]%16==0
        assert alpha.mode=="RGBA"
        assert alpha.getpixel((0,0))[3]==0
        assert alpha.getpixel((size[0]//2,size[1]//2))[3]==255
        assert base.getpixel((size[0]//2,size[1]//2))==(42,92,143)


def test_ai_border_writes_generated_outer_pixels_and_keeps_native_trim_text():
    source=base_pdf()
    requested=[]
    def fake_model(trim,bleed,width,height):
        requested.append((bleed,width,height,trim.size))
        return Image.new("RGB",(1088,1520),(248,23,50))
    result=extend_print_bleed(source,filename="brochure.pdf",bleed_mm=3,
                              edge_mode="ai",ai_processor=fake_model)
    assert len(requested)==1
    doc=fitz.open(stream=result.pdf,filetype="pdf")
    try:
        page=doc[0]
        assert "ORIGINAL VECTOR TEXT" in page.get_text()
        assert page.trimbox.width/PT_PER_MM==pytest.approx(210,abs=.03)
        assert page.mediabox.width/PT_PER_MM==pytest.approx(216,abs=.03)
        pix=page.get_pixmap(matrix=fitz.Matrix(1,1),colorspace=fitz.csRGB,alpha=False)
        red=pix.pixel(pix.width//2,4)
        inner=pix.pixel(pix.width//2,pix.height//2)
        assert red[0]>225 and red[1]<35 and red[2]<70
        assert inner[2]>130 and inner[0]<110
    finally:
        doc.close()


def test_ai_single_edge_leaves_other_sides_as_basic_reflection():
    def fake(trim,bleed,width,height):
        return Image.new("RGB",(1088,1520),(245,10,40))
    result=extend_print_bleed(base_pdf(),filename="x.pdf",edge_mode="ai",
                             ai_side="top",ai_processor=fake)
    doc=fitz.open(stream=result.pdf,filetype="pdf")
    try:
        page=doc[0]
        pix=page.get_pixmap(matrix=fitz.Matrix(1,1),colorspace=fitz.csRGB,alpha=False)
        top=pix.pixel(pix.width//2,4)
        left=pix.pixel(4,pix.height//2)
        assert top[0]>220 and top[1]<35
        assert left[2]>120 and left[0]<110
    finally:
        doc.close()


def test_ai_two_page_limit_does_not_invoke_model():
    pdf=fitz.open()
    try:
        for _ in range(AI_MAX_PAGES+1):pdf.new_page(width=200,height=300)
        source=pdf.tobytes()
    finally:pdf.close()
    called=[]
    with pytest.raises(ValueError,match="2페이지"):
        extend_print_bleed(source,filename="x.pdf",edge_mode="ai",
          ai_processor=lambda *args:called.append(1))
    assert not called


def test_image_api_requires_key_before_opening_network(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY",raising=False)
    with pytest.raises(AiCoverImageError) as exc:
        outpaint_bleed(Image.new("RGB",(100,100)),3,210,297,uid="user")
    assert exc.value.code=="OPENAI_API_KEY_MISSING"


def test_masked_outpainting_posts_multipart_to_images_edits(monkeypatch):
    image=Image.new("RGB",(640,720),(12,23,34))
    _,_,size=prepared_masked_images(image,3,210,297)
    buffer=io.BytesIO()
    Image.new("RGB",size,(250,112,64)).save(buffer,"PNG")
    response={"data":[{"b64_json":base64.b64encode(buffer.getvalue()).decode()}]}
    class FakeResponse:
        def __enter__(self):return self
        def __exit__(self,*_):return False
        def read(self,*_):return json.dumps(response).encode()
    seen=[]
    def fake_urlopen(request,timeout):
        seen.append((request,timeout))
        return FakeResponse()
    monkeypatch.setenv("OPENAI_API_KEY","unit-test-key")
    monkeypatch.setattr("urllib.request.urlopen",fake_urlopen)
    output=outpaint_bleed(image,3,210,297,uid="approved-user",quality="low")
    assert output.size==size
    assert output.getpixel((4,4))==(250,112,64)
    request,timeout=seen[0]
    assert request.full_url=="https://api.openai.com/v1/images/edits"
    assert request.get_header("Authorization")=="Bearer unit-test-key"
    assert "multipart/form-data" in request.get_header("Content-type")
    assert b'name="mask"; filename="editable-bleed.png"' in request.data
    assert b'name="image[]"; filename="original-print.png"' in request.data
    assert b'name="quality"' in request.data
    assert timeout>=60


def test_multipart_bytes_are_valid_and_avoid_filename_input():
    data,mime=_multipart([("model","gpt-image-2"),("mask",("mask.png",b"123","image/png"))])
    assert b"gpt-image-2" in data
    assert data.endswith(b"--\r\n")
    assert mime.startswith("multipart/form-data; boundary=")
