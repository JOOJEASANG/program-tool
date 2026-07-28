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
    divider_content: Optional[str] = Field(default=None, max_length=20_000)
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
        "bottom-center", "bottom-right", "bottom-left",
        "top-center", "top-right", "top-left",
    ] = "bottom-center"
    format: Literal["1", "1/N", "-1-", "-1/N-"] = "1"
    start: int = Field(default=1, ge=-1_000_000, le=1_000_000)
    font_size: float = Field(default=10.0, ge=5.0, le=72.0)
    color: str = Field(default="#333333", max_length=32)
    exclude_first: bool = False
    apply_to: Literal["all", "odd", "even"] = "all"
    margin_mm: Optional[float] = Field(default=None, ge=0.0, le=80.0)
    auto_reserve_space: bool = True


class PrintMarkSettings(BaseModel):
    """Crop marks and reserved bleed workspace around the finished page size.

    This does not invent or stretch artwork into the bleed area. Source artwork
    must already contain the required edge content when a real bleed is needed.
    """

    enabled: bool = False
    bleed_mm: float = Field(default=3.0, ge=0.0, le=15.0)
    mark_length_mm: float = Field(default=5.0, ge=2.0, le=15.0)
    mark_offset_mm: float = Field(default=2.0, ge=0.0, le=10.0)
    edge_padding_mm: float = Field(default=2.0, ge=0.0, le=10.0)


class PaperSize(BaseModel):
    width_mm: float = Field(default=210.0, ge=10.0, le=2000.0)
    height_mm: float = Field(default=297.0, ge=10.0, le=2000.0)


class PdfProcessRequest(BaseModel):
    pages: list[PageInfo] = Field(min_length=1, max_length=2000)
    nup_default: NupValue = NupValue.one
    paper: PaperSize = Field(default_factory=PaperSize)
    add_border: bool = False
    margin_h_mm: float = Field(default=10.0, ge=0.0, le=80.0)
    margin_v_mm: float = Field(default=10.0, ge=0.0, le=80.0)
    margin_left_mm: Optional[float] = Field(default=None, ge=0.0, le=80.0)
    margin_right_mm: Optional[float] = Field(default=None, ge=0.0, le=80.0)
    margin_top_mm: Optional[float] = Field(default=None, ge=0.0, le=80.0)
    margin_bottom_mm: Optional[float] = Field(default=None, ge=0.0, le=80.0)
    gap_mm: float = Field(default=5.0, ge=0.0, le=50.0)
    page_order: Literal["row-major", "column-major"] = "row-major"
    watermark: WatermarkSettings = Field(default_factory=WatermarkSettings)
    header_footer: HeaderFooterSettings = Field(default_factory=HeaderFooterSettings)
    page_numbers: PageNumberSettings = Field(default_factory=PageNumberSettings)
    print_marks: PrintMarkSettings = Field(default_factory=PrintMarkSettings)
    facing_pages: bool = False
    booklet: bool = False

    @model_validator(mode="after")
    def validate_booklet_imposition(self):
        if self.booklet and self.nup_default not in {
            NupValue.two,
            NupValue.four,
            NupValue.six,
            NupValue.eight,
        }:
            raise ValueError("소책자 모드는 2, 4, 6, 8-up만 지원합니다")
        return self


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
    score: int
