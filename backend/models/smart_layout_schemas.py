from __future__ import annotations

from typing import Literal
from pydantic import BaseModel, Field, model_validator


class SmartPaperSize(BaseModel):
    width_mm: float = Field(default=297.0, ge=50.0, le=2000.0)
    height_mm: float = Field(default=420.0, ge=50.0, le=2000.0)


class SmartLayoutJob(BaseModel):
    file_index: int = Field(ge=0, le=49)
    back_file_index: int | None = Field(default=None, ge=0, le=49)
    quantity: int = Field(default=1, ge=1, le=2000)


class SmartLayoutRequest(BaseModel):
    jobs: list[SmartLayoutJob] = Field(min_length=1, max_length=30)
    paper: SmartPaperSize = Field(default_factory=SmartPaperSize)
    margin_mm: float = Field(default=5.0, ge=0.0, le=80.0)
    gap_mm: float = Field(default=3.0, ge=0.0, le=50.0)
    allow_rotate: bool = False
    auto_fill: bool = False
    side_mode: Literal['auto', 'single', 'duplex'] = 'auto'
    flip_edge: Literal['long', 'short'] = 'long'
    crop_marks: bool = False

    @model_validator(mode='after')
    def validate_totals(self):
        front_indexes = [job.file_index for job in self.jobs]
        if len(set(front_indexes)) != len(front_indexes):
            raise ValueError('같은 파일의 작업 설정이 중복되었습니다')

        back_indexes = [job.back_file_index for job in self.jobs if job.back_file_index is not None]
        if len(set(back_indexes)) != len(back_indexes):
            raise ValueError('같은 파일을 여러 작업의 뒷면으로 사용할 수 없습니다')
        if set(front_indexes) & set(back_indexes):
            raise ValueError('하나의 파일을 앞면 작업과 다른 작업의 뒷면으로 동시에 사용할 수 없습니다')
        if any(job.back_file_index == job.file_index for job in self.jobs):
            raise ValueError('같은 파일을 자신의 뒷면으로 사용할 수 없습니다')

        total = sum(job.quantity for job in self.jobs)
        if total > 2000:
            raise ValueError('한 번에 배치할 총 수량은 2,000개 이하로 설정해 주세요')
        if self.paper.width_mm - 2 * self.margin_mm <= 1 or self.paper.height_mm - 2 * self.margin_mm <= 1:
            raise ValueError('용지 여백이 너무 큽니다')
        return self
