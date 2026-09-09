from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, model_validator
from typing import Literal

from models.schemas import HeaderFooterSettings, PageEraseRegion, PageNumberSettings


class AdvancedPageOverlay(BaseModel):
    """One lightweight user-added text or image layer on an output page."""

    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(default="", max_length=80)
    type: Literal["text", "image"]
    x: float = Field(ge=0.0, le=0.98)
    y: float = Field(ge=0.0, le=0.98)
    width: float = Field(gt=0.0, le=1.0)
    height: float = Field(gt=0.0, le=1.0)
    text: str = Field(default="", max_length=500)
    font_size: float = Field(default=18.0, alias="fontSize", ge=5.0, le=96.0)
    color: str = Field(default="#111111", max_length=16)
    bold: bool = False
    align: Literal["left", "center", "right"] = "left"
    data_url: str = Field(default="", alias="dataUrl", max_length=360_000)
    name: str = Field(default="", max_length=120)

    @model_validator(mode="after")
    def validate_overlay(self):
        if self.x + self.width > 1.001 or self.y + self.height > 1.001:
            raise ValueError("삽입 항목이 페이지 영역을 벗어났습니다")
        if self.type == "text":
            # Empty text is a valid in-progress editor state. The renderer simply
            # skips it until the user enters content, so downloads never fail just
            # because a freshly inserted text box is temporarily blank.
            self.data_url = ""
        else:
            prefix = self.data_url[:32].lower()
            if not (prefix.startswith("data:image/png;base64,") or prefix.startswith("data:image/jpeg;base64,")):
                raise ValueError("삽입 이미지는 PNG 또는 JPEG 데이터여야 합니다")
            self.text = ""
        return self


class AdvancedPageInfo(BaseModel):
    """Standalone advanced-editor page state.

    This model deliberately contains no N-up/booklet concepts. Coordinates are
    source-page based so crop/erase remain stable when a page is moved or scaled.
    """

    file_index: int = Field(ge=0, le=100_000)
    page_index: int = Field(ge=0, le=1_000_000)
    rotation: Literal[0, 90, 180, 270] = 0
    fine_rotation_deg: float = Field(default=0.0, ge=-15.0, le=15.0)
    output_width_pt: float | None = Field(default=None, ge=10.0, le=10_000.0)
    output_height_pt: float | None = Field(default=None, ge=10.0, le=10_000.0)
    crop_left_ratio: float = Field(default=0.0, ge=0.0, le=0.90)
    crop_top_ratio: float = Field(default=0.0, ge=0.0, le=0.90)
    crop_right_ratio: float = Field(default=0.0, ge=0.0, le=0.90)
    crop_bottom_ratio: float = Field(default=0.0, ge=0.0, le=0.90)
    erase_regions: list[PageEraseRegion] = Field(default_factory=list, max_length=40)
    overlays: list[AdvancedPageOverlay] = Field(default_factory=list, max_length=20)
    edit_scale: float = Field(default=1.0, ge=0.5, le=3.0)
    offset_x_mm: float = Field(default=0.0, ge=-200.0, le=200.0)
    offset_y_mm: float = Field(default=0.0, ge=-200.0, le=200.0)
    excluded: bool = False

    @model_validator(mode="after")
    def validate_crop_region(self):
        if self.crop_left_ratio + self.crop_right_ratio >= 0.95:
            raise ValueError("좌우 잘라내기 합계는 페이지 폭의 95% 미만이어야 합니다")
        if self.crop_top_ratio + self.crop_bottom_ratio >= 0.95:
            raise ValueError("상하 잘라내기 합계는 페이지 높이의 95% 미만이어야 합니다")
        if (self.output_width_pt is None) != (self.output_height_pt is None):
            raise ValueError("출력 페이지 크기는 너비와 높이를 함께 지정해야 합니다")
        return self


class AdvancedMarginSettings(BaseModel):
    left_mm: float = Field(default=0.0, ge=0.0, le=80.0)
    right_mm: float = Field(default=0.0, ge=0.0, le=80.0)
    top_mm: float = Field(default=0.0, ge=0.0, le=80.0)
    bottom_mm: float = Field(default=0.0, ge=0.0, le=80.0)
    facing_pages: bool = False


class PdfAdvancedProcessRequest(BaseModel):
    """Output contract owned only by the standalone advanced editor."""

    pages: list[AdvancedPageInfo] = Field(min_length=1, max_length=2000)
    margins: AdvancedMarginSettings = Field(default_factory=AdvancedMarginSettings)
    header_footer: HeaderFooterSettings = Field(default_factory=HeaderFooterSettings)
    page_numbers: PageNumberSettings = Field(default_factory=PageNumberSettings)

    @model_validator(mode="after")
    def propagate_overlay_margins(self):
        # Header/footer and page-number renderers are shared stateless primitives.
        # Keep their horizontal anchors aligned with the advanced editor margins.
        if self.header_footer.margin_left_mm is None:
            self.header_footer.margin_left_mm = self.margins.left_mm
        if self.header_footer.margin_right_mm is None:
            self.header_footer.margin_right_mm = self.margins.right_mm
        return self
