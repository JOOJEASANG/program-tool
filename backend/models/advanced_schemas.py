from __future__ import annotations

from pydantic import BaseModel, Field, model_validator
from typing import Literal

from models.schemas import HeaderFooterSettings, PageEraseRegion, PageNumberSettings


class AdvancedPageInfo(BaseModel):
    """Standalone advanced-editor page state.

    This model deliberately contains no N-up/booklet concepts. Coordinates are
    source-page based so crop/erase remain stable when a page is moved or scaled.
    """

    file_index: int = Field(ge=0, le=100_000)
    page_index: int = Field(ge=0, le=1_000_000)
    rotation: Literal[0, 90, 180, 270] = 0
    crop_left_ratio: float = Field(default=0.0, ge=0.0, le=0.90)
    crop_top_ratio: float = Field(default=0.0, ge=0.0, le=0.90)
    crop_right_ratio: float = Field(default=0.0, ge=0.0, le=0.90)
    crop_bottom_ratio: float = Field(default=0.0, ge=0.0, le=0.90)
    erase_regions: list[PageEraseRegion] = Field(default_factory=list, max_length=40)
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
