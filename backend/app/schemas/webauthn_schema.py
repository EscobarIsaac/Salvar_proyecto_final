from pydantic import BaseModel, Field
from typing import Any, Dict, Optional


class WebAuthnRegisterOptionsRequest(BaseModel):
    user_id: str = Field(..., description="user_id del usuario logueado")
    email: Optional[str] = None
    username: Optional[str] = None


class WebAuthnRegisterVerifyRequest(BaseModel):
    user_id: str
    credential: Dict[str, Any]


class WebAuthnAuthOptionsRequest(BaseModel):
    user_id: str


class WebAuthnAuthVerifyRequest(BaseModel):
    user_id: str
    credential: Dict[str, Any]
