from fastapi import APIRouter, HTTPException, status, Query
from app.schemas.user_schema import (
    UserRegisterSchema,
    UserLoginSchema,
    RegistrationFlowResponseSchema,
    LoginFlowResponseSchema
)
from app.schemas.facial_schema import FacialCaptureSchema
from app.services.auth_service import AuthService
from app.services.facial_recognition_service import FacialRecognitionService
import base64

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

# Instanciar servicios
facial_service = FacialRecognitionService()


@router.post("/register", response_model=RegistrationFlowResponseSchema, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserRegisterSchema):
    user = await AuthService.register_user(user_data)
    return {
        **user,
        "message": "Usuario registrado correctamente. Por favor, capture una foto facial para completar el proceso.",
        "next_step": "facial_capture"
    }


@router.post("/login", response_model=LoginFlowResponseSchema)
async def login(login_data: UserLoginSchema):
    result = await AuthService.login_user(login_data)
    user_data = result.get("user_data", {})

    return {
        "access_token": result["access_token"],
        "token_type": result["token_type"],
        "expires_in": 1800,
        "user_id": user_data.get("user_id", ""),
        "message": "Credenciales válidas. Por favor, verifique su identidad facial.",
        "next_step": "facial_verification",
        "facial_recognition_enabled": user_data.get("facial_recognition_enabled", False)
    }


@router.post("/verify-facial-for-login")
async def verify_facial_for_login(
    facial_data: FacialCaptureSchema,
    user_id: str = Query(..., description="ID del usuario que intenta hacer login")
):
    try:
        image_bytes = base64.b64decode(facial_data.image_base64)

        # ✅ CLAVE: si el método es async hay que awaited; si es sync, igual esto funciona?
        # En Python, "await" solo sirve si retorna coroutine.
        # Entonces hacemos esto seguro:
        result = facial_service.verify_face_for_login(image_bytes, user_id)
        if hasattr(result, "__await__"):  # por si es coroutine
            result = await result

        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error en verificación facial: {str(e)}"
        )


@router.get("/health")
async def health_check():
    return {"status": "healthy", "service": "authentication"}
