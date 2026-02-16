from fastapi import APIRouter, HTTPException, status, Query
from app.schemas.user_schema import (
    UserRegisterSchema,
    UserLoginSchema,
    RegistrationFlowResponseSchema,
    LoginFlowResponseSchema,
)
from app.schemas.facial_schema import FacialCaptureSchema
from app.schemas.two_factor_schema import (
    TwoFactorSetupResponse,
    TwoFactorVerifyRequest,
    TwoFactorVerifyResponse,
    TwoFactorLoginVerifyRequest,
    TwoFactorLoginVerifyResponse,
)
from app.services.auth_service import AuthService
from app.services.facial_recognition_service import FacialRecognitionService
from app.services.two_factor_service import TwoFactorService
import base64

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

# Instanciar servicios
facial_service = FacialRecognitionService()


@router.post("/register", response_model=RegistrationFlowResponseSchema, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserRegisterSchema):
    """
    Registra un nuevo usuario en el sistema (con facial opcional si tu schema lo permite)
    """
    user = await AuthService.register_user(user_data)
    return {
        **user,
        "message": "Usuario registrado correctamente.",
        "next_step": "login",
    }


@router.post("/login", response_model=LoginFlowResponseSchema)
async def login(login_data: UserLoginSchema):
    """
    Autentica un usuario y devuelve un token JWT.
    Luego el frontend decide si verifica con rostro o Authenticator.
    """
    result = await AuthService.login_user(login_data)
    user_data = result.get("user_data", {})

    return {
        "access_token": result["access_token"],
        "token_type": result["token_type"],
        "expires_in": 1800,
        "user_id": user_data.get("user_id", ""),
        "message": "Credenciales válidas. Selecciona un método de verificación.",
        "next_step": "second_factor_choice",
        "facial_recognition_enabled": user_data.get("facial_recognition_enabled", False),
        "two_factor_enabled": user_data.get("two_factor_enabled", False),
    }


@router.post("/verify-facial-for-login")
async def verify_facial_for_login(
    facial_data: FacialCaptureSchema,
    user_id: str = Query(..., description="ID del usuario que intenta hacer login"),
):
    try:
        image_bytes = base64.b64decode(facial_data.image_base64)
        # OJO: tu servicio tiene async verify_face_for_login, aquí debe ser await
        result = await facial_service.verify_face_for_login(image_bytes, user_id)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error en verificación facial: {str(e)}")


# =========================
# 2FA (Authenticator - TOTP)
# =========================

@router.post("/2fa/setup", response_model=TwoFactorSetupResponse)
async def setup_2fa(user_id: str = Query(..., description="ID del usuario")):
    """
    Genera otpauth://... y QR para Microsoft/Google Authenticator.
    """
    return await TwoFactorService.setup_totp(user_id)


@router.post("/2fa/verify", response_model=TwoFactorVerifyResponse)
async def verify_2fa(req: TwoFactorVerifyRequest, user_id: str = Query(..., description="ID del usuario")):
    """
    Verifica el código TOTP y habilita 2FA.
    """
    return await TwoFactorService.verify_totp_and_enable(user_id, req.code)


@router.post("/2fa/verify-login", response_model=TwoFactorLoginVerifyResponse)
async def verify_2fa_login(req: TwoFactorLoginVerifyRequest, user_id: str = Query(..., description="ID del usuario")):
    """
    Verifica código TOTP durante el login (sin cambiar configuración).
    """
    return await TwoFactorService.verify_totp_for_login(user_id, req.code)


@router.get("/health")
async def health_check():
    return {"status": "healthy", "service": "authentication"}
