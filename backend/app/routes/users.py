from fastapi import APIRouter, Depends, HTTPException, status
from app.schemas.user_schema import UserResponseSchema, UserUpdateSchema
from app.schemas.fingerprint_schema import (
    FingerprintRegisterResponse,
    FingerprintStatusResponse,
)
from app.services.user_service import UserService
from app.services.fingerprint_service import FingerprintService
from app.core.security import get_current_user

router = APIRouter(prefix="/api/users", tags=["Users"])


@router.get("/me", response_model=UserResponseSchema)
async def get_current_user_profile(current_user: dict = Depends(get_current_user)):
    """
    Obtiene el perfil del usuario autenticado
    """
    user = await UserService.get_user_by_id(current_user["user_id"])
    return user


@router.get("/{user_id}", response_model=UserResponseSchema)
async def get_user(user_id: str, current_user: dict = Depends(get_current_user)):
    """
    Obtiene la información de un usuario específico (requiere autenticación)
    """
    user = await UserService.get_user_by_id(user_id)
    return user


@router.put("/me", response_model=UserResponseSchema)
async def update_user_profile(
    update_data: UserUpdateSchema,
    current_user: dict = Depends(get_current_user)
):
    """
    Actualiza el perfil del usuario autenticado
    """
    update_dict = update_data.dict(exclude_unset=True)
    user = await UserService.update_user(current_user["user_id"], update_dict)
    return user


@router.post("/facial-recognition/enable")
async def enable_facial_recognition(current_user: dict = Depends(get_current_user)):
    """
    Habilita autenticación con reconocimiento facial para el usuario
    """
    user = await UserService.enable_facial_recognition(current_user["user_id"])
    return {
        "message": "Reconocimiento facial habilitado",
        "user": user
    }


@router.post("/facial-recognition/disable")
async def disable_facial_recognition(current_user: dict = Depends(get_current_user)):
    """
    Desactiva autenticación con reconocimiento facial para el usuario
    """
    user = await UserService.disable_facial_recognition(current_user["user_id"])
    return {
        "message": "Reconocimiento facial deshabilitado",
        "user": user
    }


@router.post("/fingerprint/register", response_model=FingerprintRegisterResponse)
async def register_fingerprint(current_user: dict = Depends(get_current_user)):
    """
    Captura y guarda una plantilla de huella para el usuario autenticado
    """
    result = await FingerprintService.register_template(current_user["user_id"])
    return {
        "message": "Huella registrada correctamente",
        **result,
    }


@router.post("/fingerprint/disable")
async def disable_fingerprint(
    clear_templates: bool = True,
    current_user: dict = Depends(get_current_user)
):
    """
    Deshabilita la autenticación por huella y (opcionalmente) borra las plantillas guardadas
    """
    user = await FingerprintService.disable_fingerprint(current_user["user_id"], clear_templates)
    return {
        "message": "Huella deshabilitada",
        "user": user,
    }


@router.get("/fingerprint/status", response_model=FingerprintStatusResponse)
async def fingerprint_status(current_user: dict = Depends(get_current_user)):
    """
    Devuelve el estado de la autenticación por huella del usuario autenticado
    """
    return await FingerprintService.status(current_user["user_id"])


@router.get("/health")
async def health_check():
    """
    Verifica que el servicio de usuarios esté funcionando
    """
    return {"status": "healthy", "service": "users"}
