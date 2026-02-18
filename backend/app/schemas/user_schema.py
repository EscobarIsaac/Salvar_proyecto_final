from pydantic import BaseModel, EmailStr, Field
from typing import Optional


class UserRegisterSchema(BaseModel):
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=8)
    full_name: Optional[str] = None
    # Imagen facial en base64 (capturada antes)
    facial_image_base64: Optional[str] = None


class UserLoginSchema(BaseModel):
    email: EmailStr
    password: str


class UserUpdateSchema(BaseModel):
    full_name: Optional[str] = None
    password: Optional[str] = Field(None, min_length=8)


class UserResponseSchema(BaseModel):
    user_id: str
    email: str
    username: str
    full_name: Optional[str]
    is_active: bool
    two_factor_enabled: bool
    facial_recognition_enabled: bool
    fingerprint_enabled: bool = False
    fingerprint_templates: list[str] = []

    class Config:
        from_attributes = True


class RegistrationFlowResponseSchema(BaseModel):
    """Respuesta después del registro inicial con instrucciones para captura facial"""
    user_id: str
    email: str
    username: str
    full_name: Optional[str]
    is_active: bool
    message: str
    # ⚠️ Antes era facial_capture, pero ahora puede ser opcional (Authenticator también)
    next_step: str = "post_register_options"

    class Config:
        from_attributes = True


class LoginFlowResponseSchema(BaseModel):
    """Respuesta después del login para elegir segundo factor (rostro o Authenticator)"""
    access_token: str
    token_type: str
    expires_in: int
    user_id: str
    message: str
    # ⚠️ Antes era facial_verification, pero ahora el usuario elige método
    next_step: str = "second_factor_choice"
    facial_recognition_enabled: bool  # Si ya tiene facial registrado
    two_factor_enabled: bool          # ✅ NUEVO: Si ya tiene Authenticator configurado
    fingerprint_enabled: bool = False
