from pydantic import BaseModel
from typing import Optional


class FingerprintRegisterResponse(BaseModel):
    message: str
    templates_base64: list[str]
    quality: Optional[int] = None
    templates_count: int
    fingerprint_enabled: bool = True


class FingerprintVerifyResponse(BaseModel):
    match: bool
    score: Optional[int] = None
    quality: Optional[int] = None
    fingerprint_enabled: bool
    message: str


class FingerprintStatusResponse(BaseModel):
    fingerprint_enabled: bool
    templates_count: int
