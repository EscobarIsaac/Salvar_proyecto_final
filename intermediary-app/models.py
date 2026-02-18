from pydantic import BaseModel, Field


class ErrorResponse(BaseModel):
    detail: str


class ZKRegisterResponse(BaseModel):
    user_id: str
    templates_base64: list[str]
    qualities: list[int]


class CandidateTemplate(BaseModel):
    user_id: str
    template_base64: str


class ZKVerifyRequest(BaseModel):
    candidates: list[CandidateTemplate]
    score_threshold: int = Field(
        40, description="Umbral mínimo de score para considerar match")


class ZKVerifyResponse(BaseModel):
    match: bool
    user_id: str | None = None
    score: int | None = None
    quality: int | None = None
