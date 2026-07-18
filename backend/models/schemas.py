from enum import Enum
from typing import Literal, Optional

from pydantic import BaseModel, Field


class NupValue(int, Enum):
    one = 1
    two = 2
    four = 4
    six = 6
    eight = 8
    nine = 9


class PageInfo(BaseModel):
    file_index: int = Field(ge=0, le=49)
    page_index: int = Field(ge=0, le=99999)
    rotation: Literal[0, 90, 180, 270] = 0
    nup_override: Optional[NupValue] = None
    nup_disabled: bool = False
    group_break: bool = False
    excluded: bool = False
    page_type: Literal["normal", "divider", "blank"] = "normal"
    divider_content: Optional[str] = Field(default=None, max_length=4000)
    divider_style: Optional[Literal["simple", "lines", "band"]] = "simple"


class WatermarkSettings(BaseModel):
    enabled: bool = False
    text: str = Field(default="", max_length=200)
    opacity: float = Field(default=0.2, ge=0.0, le=1.0)
    angle: float = Field(default=45.0, ge=-360.0, le=360.0)
    color: str = Field(default="#cccccc", pattern=r"^#[0-9a-fA-F]{6}$")


class HeaderFooterSection(BaseModel):
    """Per-range header/footer override. ranges is e.g. '1-3,5'; empty = all pages."""
    ranges: str = Field(default="", max_length=500)
    header_left: str = Field(default="", max_length=300)
    header_center: str = Field(default="", max_length=300)
    header_right: str = Field(default="", max_length=300)
    footer_left: str = Field(default="", max_length=300)
    footer_center: str = Field(default="", max_length=300)
    footer_right: str = Field(default="", max_length=300)


class HeaderFooterSettings(BaseModel):
    enabled: bool = False
    header_left: str = Field(default="", max_length=300)
    header_center: str = Field(default="", max_length=300)
    header_right: str = Field(default="", max_length=300)
    footer_left: str = Field(default="", max_length=300)
    footer_center: str = Field(default="", max_length=300)
    footer_right: str = Field(default="", max_length=300)
    font_size: float = Field(default=10.0, ge=4.0, le=72.0)
    color: str = Field(default="#333333", pattern=r"^#[0-9a-fA-F]{6}$")
    header_margin_mm: float = Field(default=8.0, ge=0.0, le=50.0)
    footer_margin_mm: float = Field(default=8.0, ge=0.0, le=50.0)
    margin_mm: Optional[float] = Field(default=None, ge=0.0, le=50.0)
    apply_to: Literal["all", "odd", "even"] = "all"
    sections: list[HeaderFooterSection] = Field(default_factory=list, max_length=50)


class PageNumberSettings(BaseModel):
    enabled: bool = False
    position: Literal["bottom-center", "bottom-right", "bottom-left", "top-center", "top-right", "top-left"] = "bottom-center"
    format: Literal["1", "1/N", "-1-", "-1/N-"] = "1"
    start: int = Field(default=1, ge=-999999, le=999999)
    font_size: float = Field(default=10.0, ge=4.0, le=72.0)
    color: str = Field(default="#333333", pattern=r"^#[0-9a-fA-F]{6}$")
    exclude_first: bool = False
    apply_to: Literal["all", "odd", "even"] = "all"
    margin_mm: Optional[float] = Field(default=None, ge=0.0, le=50.0)


class PaperSize(BaseModel):
    width_mm: float = Field(default=210.0, ge=50.0, le=1500.0)
    height_mm: float = Field(default=297.0, ge=50.0, le=1500.0)


class PdfProcessRequest(BaseModel):
    pages: list[PageInfo] = Field(min_length=1, max_length=2000)
    nup_default: NupValue = NupValue.one
    paper: PaperSize = Field(default_factory=PaperSize)
    fit_to_paper: bool = True
    add_border: bool = False
    margin_h_mm: float = Field(default=10.0, ge=0.0, le=80.0)
    margin_v_mm: float = Field(default=10.0, ge=0.0, le=80.0)
    gap_mm: float = Field(default=5.0, ge=0.0, le=50.0)
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
    id: str = Field(max_length=100)
    label: str = Field(max_length=200)
    severity: CheckSeverity
    detail: str = Field(max_length=4000)
    page_refs: list[int] = Field(default_factory=list, max_length=2000)


class PreflightReport(BaseModel):
    filename: str = Field(max_length=255)
    page_count: int = Field(ge=0, le=100000)
    checks: list[CheckItem] = Field(max_length=100)
    ai_feedback: Optional[str] = Field(default=None, max_length=10000)
    score: int = Field(ge=0, le=100)
