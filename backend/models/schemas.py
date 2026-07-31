from pydantic import BaseModel, Field, model_validator
from typing import Optional, Literal
from enum import Enum


class NupValue(int, Enum):
    one = 1
    two = 2
    four = 4
    six = 6
    eight = 8
    nine = 9


class PageInfo(BaseModel):
    file_index: int = Field(ge=0, le=100_000)
    page_index: int = Field(ge=0, le=1_000_000)
    rotation: Literal[0, 90, 180, 270] = 0
    nup_override: Optional[NupValue] = None
    nup_disabled: bool = False
    group_break: bool = False
    excluded: bool = False
    page_type: Literal["normal", "divider", "blank"] = "normal"
    # 30 extra layers × 500 characters plus layer metadata fits below 50 KB.
    # The explicit divider renderer still enforces per-layer and count limits.
    divider_content: Optional[str] = Field(default=None, max_length=50_000)
    divider_style: Optional[Literal["simple", "lines", "band"]] = "simple"


class WatermarkSettings(BaseModel):
    enabled: bool = False
    text: str = Field(default="", max_length=500)
    opacity: float = Field(default=0.2, ge=0.0, le=1.0)
    angle: float = Field(default=45.0, ge=-360.0, le=360.0)
    color: str = Field(default="#cccccc", max_length=32)


class HeaderFooterSection(BaseModel):
    """Per-range header/footer override. ranges is e.g. '1-3,5'; empty = all pages."""
    ranges: str = Field(default="", max_length=4096)
    header_left: str = Field(default="", max_length=500)
    header_center: str = Field(default="", max_length=500)
    header_right: str = Field(default="", max_length=500)
    footer_left: str = Field(default="", max_length=500)
    footer_center: str = Field(default="", max_length=500)
    footer_right: str = Field(default="", max_length=500)


class HeaderFooterSettings(BaseModel):
    enabled: bool = False
    header_left: str = Field(default="", max_length=500)
    header_center: str = Field(default="", max_length=500)
    header_right: str = Field(default="", max_length=500)
    footer_left: str = Field(default="", max_length=500)
    footer_center: str = Field(default="", max_length=500)
    footer_right: str = Field(default="", max_length=500)
    font_size: float = Field(default=10.0, ge=5.0, le=72.0)
    color: str = Field(default="#333333", max_length=32)
    header_margin_mm: float = Field(default=8.0, ge=0.0, le=80.0)
    footer_margin_mm: float = Field(default=8.0, ge=0.0, le=80.0)
    margin_mm: Optional[float] = Field(default=None, ge=0.0, le=80.0)
    apply_to: Literal["all", "odd", "even"] = "all"
    sections: list[HeaderFooterSection] = Field(default_factory=list, max_length=100)


class PageNumberSettings(BaseModel):
    enabled: bool = False
    position: Literal[
        "top-left",
        "top-center",
        "top-right",
        "bottom-left",
        "bottom-center",
        "bottom-right",
    ] = "bottom-center"
    format: Literal["number", "dash", "page-of"] = "number"
    start: int = Field(default=1, ge=0, le=1_000_000)
    font_size: float = Field(default=10.0, ge=5.0, le=72.0)
    color: str = Field(default="#333333", max_length=32)
    exclude_first: bool = False
    margin_mm: float = Field(default=5.0, ge=0.0, le=80.0)
    apply_to: Literal["all", "odd", "even"] = "all"


class PdfSettings(BaseModel):
    nup: NupValue = NupValue.two
    order_lr: bool = True
    landscape: bool = False
    show_border: bool = True
    paper_size: Literal["A3", "A4", "A5", "B4", "B5", "custom"] = "A4"
    custom_width_mm: Optional[float] = Field(default=None, ge=20.0, le=2000.0)
    custom_height_mm: Optional[float] = Field(default=None, ge=20.0, le=2000.0)
    margin_horizontal_mm: float = Field(default=10.0, ge=0.0, le=200.0)
    margin_vertical_mm: float = Field(default=10.0, ge=0.0, le=200.0)
    margin_left_mm: Optional[float] = Field(default=None, ge=0.0, le=200.0)
    margin_right_mm: Optional[float] = Field(default=None, ge=0.0, le=200.0)
    margin_top_mm: Optional[float] = Field(default=None, ge=0.0, le=200.0)
    margin_bottom_mm: Optional[float] = Field(default=None, ge=0.0, le=200.0)
    gap_mm: float = Field(default=5.0, ge=0.0, le=200.0)
    facing_pages: bool = False
    booklet: bool = False
    booklet_flip: Literal["long-edge", "short-edge"] = "long-edge"
    print_marks: Optional[dict] = None

    @model_validator(mode="after")
    def validate_custom_paper(self):
        if self.paper_size == "custom":
            if self.custom_width_mm is None or self.custom_height_mm is None:
                raise ValueError("custom paper size requires custom_width_mm and custom_height_mm")
        return self


class PdfProcessRequest(BaseModel):
    files: list[str] = Field(min_length=1, max_length=100)
    pages: list[PageInfo] = Field(min_length=1, max_length=20_000)
    settings: PdfSettings
    watermark: Optional[WatermarkSettings] = None
    header_footer: Optional[HeaderFooterSettings] = None
    page_number: Optional[PageNumberSettings] = None
