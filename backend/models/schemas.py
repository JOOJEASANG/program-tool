from pydantic import BaseModel, Field
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
    file_index: int
    page_index: int
    rotation: int = 0
    nup_override: Optional[NupValue] = None
    nup_disabled: bool = False
    group_break: bool = False
    excluded: bool = False
    page_type: Literal["normal", "divider", "blank"] = "normal"
    divider_content: Optional[str] = None
    divider_style: Optional[Literal["simple", "lines", "band"]] = "simple"


class WatermarkSettings(BaseModel):
    enabled: bool = False
    text: str = ""
    opacity: float = 0.2
    angle: float = 45.0
    color: str = "#cccccc"


class HeaderFooterSection(BaseModel):
    """Per-range header/footer override. ranges is e.g. '1-3,5'; empty = all pages."""
    ranges: str = ""
    header_left: str = ""
    header_center: str = ""
    header_right: str = ""
    footer_left: str = ""
    footer_center: str = ""
    footer_right: str = ""


class HeaderFooterSettings(BaseModel):
    enabled: bool = False
    # Default fields apply to pages not covered by any section
    header_left: str = ""
    header_center: str = ""
    header_right: str = ""
    footer_left: str = ""
    footer_center: str = ""
    footer_right: str = ""
    font_size: float = 10.0
    color: str = "#333333"
    header_margin_mm: float = 8.0
    footer_margin_mm: float = 8.0
    margin_mm: Optional[float] = None  # overrides header/footer margin when set
    apply_to: Literal["all", "odd", "even"] = "all"
    sections: list[HeaderFooterSection] = Field(default_factory=list)


class PageNumberSettings(BaseModel):
    enabled: bool = False
    position: Literal["bottom-center", "bottom-right", "bottom-left", "top-center", "top-right", "top-left"] = "bottom-center"
    format: Literal["1", "1/N", "-1-", "-1/N-"] = "1"
    start: int = 1
    font_size: float = 10.0
    color: str = "#333333"
    exclude_first: bool = False
    apply_to: Literal["all", "odd", "even"] = "all"
    margin_mm: Optional[float] = None


class PaperSize(BaseModel):
    width_mm: float = 210.0
    height_mm: float = 297.0


class PdfProcessRequest(BaseModel):
    pages: list[PageInfo]
    nup_default: NupValue = NupValue.one
    paper: PaperSize = Field(default_factory=PaperSize)
    fit_to_paper: bool = True
    add_border: bool = False
    # Legacy paired margins remain for older clients and saved projects.
    margin_h_mm: float = 10.0
    margin_v_mm: float = 10.0
    # New independent margins. None falls back to the paired legacy value.
    margin_left_mm: Optional[float] = None
    margin_right_mm: Optional[float] = None
    margin_top_mm: Optional[float] = None
    margin_bottom_mm: Optional[float] = None
    gap_mm: float = 5.0
    watermark: WatermarkSettings = Field(default_factory=WatermarkSettings)
    header_footer: HeaderFooterSettings = Field(default_factory=HeaderFooterSettings)
    page_numbers: PageNumberSettings = Field(default_factory=PageNumberSettings)
    facing_pages: bool = False
    booklet: bool = False


class CheckSeverity(str, Enum):
    pass_ = "pass"
    warning = "warning"
    fail = "fail"


class CheckItem(BaseModel):
    id: str
    label: str
    severity: CheckSeverity
    detail: str
    page_refs: list[int] = Field(default_factory=list)


class PreflightReport(BaseModel):
    filename: str
    page_count: int
    checks: list[CheckItem]
    ai_feedback: Optional[str] = None
    score: int  # 0-100
