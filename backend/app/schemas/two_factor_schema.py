from pydantic import BaseModel, Field


class TwoFactorSetupResponse(BaseModel):
    user_id: str
    issuer: str
    account_name: str
    otpauth_url: str
    qr_png_base64: str  # PNG en base64 para mostrar en frontend


class TwoFactorVerifyRequest(BaseModel):
    code: str = Field(..., min_length=6, max_length=6)


class TwoFactorVerifyResponse(BaseModel):
    verified: bool
    message: str


class TwoFactorLoginVerifyRequest(BaseModel):
    code: str = Field(..., min_length=6, max_length=6)


class TwoFactorLoginVerifyResponse(BaseModel):
    verified: bool
    message: str
