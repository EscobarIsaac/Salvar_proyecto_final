from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import Any, Dict, Optional, List

from app.mongo import db

# WebAuthn (Passkeys)
from webauthn import (
    generate_registration_options,
    verify_registration_response,
    generate_authentication_options,
    verify_authentication_response,
)
from webauthn.helpers.structs import (
    RegistrationCredential,
    AuthenticationCredential,
    PublicKeyCredentialDescriptor,
    UserVerificationRequirement,
)
from webauthn.helpers import base64url_to_bytes, bytes_to_base64url

router = APIRouter(prefix="/api/webauthn", tags=["WebAuthn (Passkeys)"])

# Ajusta si tu frontend corre en otro puerto/origen
RP_ID = "localhost"
EXPECTED_ORIGINS = {
    "http://localhost:8081",
    "http://127.0.0.1:8081",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
}

CRED_COL = db["webauthn_credentials"]
CHAL_COL = db["webauthn_challenges"]


class RegisterOptionsBody(BaseModel):
    user_id: str
    username: Optional[str] = None  # opcional


class VerifyRegisterBody(BaseModel):
    user_id: str
    credential: Dict[str, Any]  # viene directo de navigator.credentials.create()


class AuthOptionsBody(BaseModel):
    user_id: str


class VerifyAuthBody(BaseModel):
    user_id: str
    credential: Dict[str, Any]  # viene directo de navigator.credentials.get()


@router.post("/register/options")
async def register_options(body: RegisterOptionsBody):
    # Busca el usuario (para mostrar nombre)
    user = await db["users"].find_one({"user_id": body.user_id}, {"_id": 0, "username": 1, "email": 1, "user_id": 1})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    username = body.username or user.get("username") or user.get("email") or body.user_id

    options = generate_registration_options(
        rp_id=RP_ID,
        rp_name="SFS Login",
        user_id=body.user_id.encode("utf-8"),
        user_name=username,
        user_display_name=username,
        # Puedes exigir verificación del usuario (huella/lockscreen)
        user_verification=UserVerificationRequirement.PREFERRED,
    )

    # Guarda challenge para validación posterior
    await CHAL_COL.update_one(
        {"user_id": body.user_id, "type": "register"},
        {"$set": {"challenge": bytes_to_base64url(options.challenge)}},
        upsert=True,
    )

    # Devuelve dict listo para frontend
    return options.model_dump()


@router.post("/register/verify")
async def register_verify(body: VerifyRegisterBody):
    chal_doc = await CHAL_COL.find_one({"user_id": body.user_id, "type": "register"})
    if not chal_doc:
        raise HTTPException(status_code=400, detail="No hay challenge de registro. Pide options primero.")

    challenge = base64url_to_bytes(chal_doc["challenge"])

    # Normaliza credential a tipo esperado por webauthn
    try:
        reg_cred = RegistrationCredential.model_validate(body.credential)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Credential inválido: {str(e)}")

    # Verifica respuesta
    verified = None
    last_error = None
    for origin in EXPECTED_ORIGINS:
        try:
            verified = verify_registration_response(
                credential=reg_cred,
                expected_challenge=challenge,
                expected_rp_id=RP_ID,
                expected_origin=origin,
                require_user_verification=False,  # puedes poner True si quieres obligar huella/pin
            )
            last_error = None
            break
        except Exception as e:
            last_error = e
            continue

    if verified is None:
        raise HTTPException(status_code=400, detail=f"Registro WebAuthn falló: {str(last_error)}")

    cred_id_b64 = bytes_to_base64url(verified.credential_id)

    # Guarda credencial (permitimos múltiples por usuario)
    await CRED_COL.update_one(
        {"user_id": body.user_id, "credential_id": cred_id_b64},
        {
            "$set": {
                "user_id": body.user_id,
                "credential_id": cred_id_b64,
                "public_key": bytes_to_base64url(verified.credential_public_key),
                "sign_count": verified.sign_count,
                "transports": list(reg_cred.response.transports or []),
            }
        },
        upsert=True,
    )

    # Limpia challenge
    await CHAL_COL.delete_one({"user_id": body.user_id, "type": "register"})

    return {"ok": True, "message": "✅ Passkey (huella) registrada correctamente"}


@router.post("/authenticate/options")
async def auth_options(body: AuthOptionsBody):
    # Trae credenciales del usuario
    creds = await CRED_COL.find({"user_id": body.user_id}).to_list(length=50)
    if not creds:
        raise HTTPException(status_code=404, detail="Este usuario no tiene Passkey registrada. Configura primero.")

    allow: List[PublicKeyCredentialDescriptor] = []
    for c in creds:
        allow.append(
            PublicKeyCredentialDescriptor(
                id=base64url_to_bytes(c["credential_id"]),
                type="public-key",
                transports=c.get("transports") or None,
            )
        )

    options = generate_authentication_options(
        rp_id=RP_ID,
        allow_credentials=allow,
        user_verification=UserVerificationRequirement.PREFERRED,
    )

    await CHAL_COL.update_one(
        {"user_id": body.user_id, "type": "auth"},
        {"$set": {"challenge": bytes_to_base64url(options.challenge)}},
        upsert=True,
    )

    return options.model_dump()


@router.post("/authenticate/verify")
async def auth_verify(body: VerifyAuthBody):
    chal_doc = await CHAL_COL.find_one({"user_id": body.user_id, "type": "auth"})
    if not chal_doc:
        raise HTTPException(status_code=400, detail="No hay challenge de autenticación. Pide options primero.")

    challenge = base64url_to_bytes(chal_doc["challenge"])

    try:
        auth_cred = AuthenticationCredential.model_validate(body.credential)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Credential inválido: {str(e)}")

    cred_id_b64 = auth_cred.raw_id

    # OJO: raw_id en el modelo ya viene base64url, pero a veces puede venir distinto
    # Lo normal: body.credential.rawId (base64url). Usamos el mismo string del payload:
    payload_cred_id = body.credential.get("rawId") or body.credential.get("id")
    if not payload_cred_id:
        raise HTTPException(status_code=400, detail="No se encontró rawId/id en el credential.")
    cred_doc = await CRED_COL.find_one({"user_id": body.user_id, "credential_id": payload_cred_id})
    if not cred_doc:
        raise HTTPException(status_code=401, detail="Credencial (Passkey) no registrada para este usuario.")

    public_key = base64url_to_bytes(cred_doc["public_key"])
    current_sign_count = int(cred_doc.get("sign_count") or 0)

    verified = None
    last_error = None
    for origin in EXPECTED_ORIGINS:
        try:
            verified = verify_authentication_response(
                credential=auth_cred,
                expected_challenge=challenge,
                expected_rp_id=RP_ID,
                expected_origin=origin,
                credential_public_key=public_key,
                credential_current_sign_count=current_sign_count,
                require_user_verification=False,
            )
            last_error = None
            break
        except Exception as e:
            last_error = e
            continue

    if verified is None:
        raise HTTPException(status_code=401, detail=f"Autenticación WebAuthn falló: {str(last_error)}")

    # Actualiza contador
    await CRED_COL.update_one(
        {"user_id": body.user_id, "credential_id": payload_cred_id},
        {"$set": {"sign_count": verified.new_sign_count}},
    )

    await CHAL_COL.delete_one({"user_id": body.user_id, "type": "auth"})

    return {"ok": True, "message": "✅ Passkey verificada (huella OK)"}


@router.get("/health")
async def webauthn_health():
    return {"status": "healthy", "service": "webauthn"}
