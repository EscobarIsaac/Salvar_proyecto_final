import os
import base64
from datetime import datetime, timezone
from fastapi import HTTPException, status
from app.mongo import db

from webauthn import (
    generate_registration_options,
    verify_registration_response,
    generate_authentication_options,
    verify_authentication_response,
)
from webauthn.helpers.structs import (
    PublicKeyCredentialRpEntity,
    PublicKeyCredentialUserEntity,
    AuthenticatorSelectionCriteria,
    UserVerificationRequirement,
    AttestationConveyancePreference,
    RegistrationCredential,
    AuthenticationCredential,
)


def _b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("utf-8")


def _b64url_decode(data: str) -> bytes:
    # Añadir padding si falta
    pad = "=" * ((4 - len(data) % 4) % 4)
    return base64.urlsafe_b64decode((data + pad).encode("utf-8"))


class WebAuthnService:
    """
    Guarda credenciales WebAuthn (Passkeys) en MongoDB dentro del documento de users:
    users.webauthn = {
      "credential_id": "...",
      "public_key": "...",
      "sign_count": 0,
      "transports": [],
      "created_at": ...
    }
    y almacena challenge temporal en users.webauthn_challenge
    """

    def __init__(self):
        # RP (Relying Party) = tu app
        # Para localhost, rp_id debe ser "localhost"
        self.rp_id = os.getenv("WEBAUTHN_RP_ID", "localhost")
        self.rp_name = os.getenv("WEBAUTHN_RP_NAME", "SFS Login")
        self.origin = os.getenv("WEBAUTHN_ORIGIN", "http://localhost:8081")

    async def generate_registration_options(self, user_id: str, email: str, username: str):
        try:
            user = await db["users"].find_one({"user_id": user_id})
            if not user:
                raise HTTPException(status_code=404, detail="Usuario no encontrado")

            # user_handle debe ser bytes (estable y único)
            user_handle = user_id.encode("utf-8")

            options = generate_registration_options(
                rp=PublicKeyCredentialRpEntity(id=self.rp_id, name=self.rp_name),
                user=PublicKeyCredentialUserEntity(
                    id=user_handle,
                    name=email or username or user_id,
                    display_name=username or email or user_id,
                ),
                authenticator_selection=AuthenticatorSelectionCriteria(
                    user_verification=UserVerificationRequirement.REQUIRED
                ),
                attestation=AttestationConveyancePreference.NONE,
            )

            # guardar challenge temporal
            await db["users"].update_one(
                {"user_id": user_id},
                {"$set": {"webauthn_challenge": _b64url_encode(options.challenge), "updated_at": datetime.now(timezone.utc)}},
            )

            # devolver options “serializable”
            # webauthn lib trae objetos; los convertimos a dict simple:
            return {
                "publicKey": {
                    "rp": {"id": self.rp_id, "name": self.rp_name},
                    "user": {
                        "id": _b64url_encode(user_handle),
                        "name": email or username or user_id,
                        "displayName": username or email or user_id,
                    },
                    "challenge": _b64url_encode(options.challenge),
                    "pubKeyCredParams": [{"type": "public-key", "alg": -7}, {"type": "public-key", "alg": -257}],
                    "timeout": 60000,
                    "attestation": "none",
                    "authenticatorSelection": {"userVerification": "required"},
                }
            }

        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error generando opciones de registro: {str(e)}")

    async def verify_registration_response(self, user_id: str, credential: dict):
        try:
            user = await db["users"].find_one({"user_id": user_id})
            if not user:
                raise HTTPException(status_code=404, detail="Usuario no encontrado")

            challenge_b64 = user.get("webauthn_challenge")
            if not challenge_b64:
                raise HTTPException(status_code=400, detail="No hay challenge de registro. Pida /register/options primero.")

            expected_challenge = _b64url_decode(challenge_b64)

            # Verificar registro
            verification = verify_registration_response(
                credential=RegistrationCredential.parse_obj(credential),
                expected_challenge=expected_challenge,
                expected_rp_id=self.rp_id,
                expected_origin=self.origin,
                require_user_verification=True,
            )

            # Guardar credencial
            await db["users"].update_one(
                {"user_id": user_id},
                {
                    "$set": {
                        "webauthn": {
                            "credential_id": _b64url_encode(verification.credential_id),
                            "public_key": _b64url_encode(verification.credential_public_key),
                            "sign_count": int(verification.sign_count),
                            "created_at": datetime.now(timezone.utc),
                        },
                        "webauthn_enabled": True,
                        "updated_at": datetime.now(timezone.utc),
                    },
                    "$unset": {"webauthn_challenge": ""},
                },
            )

            return {"registered": True, "message": "✅ Passkey registrada correctamente", "user_id": user_id}

        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"No se pudo registrar Passkey: {str(e)}")

    async def generate_authentication_options(self, user_id: str):
        try:
            user = await db["users"].find_one({"user_id": user_id})
            if not user:
                raise HTTPException(status_code=404, detail="Usuario no encontrado")

            webauthn_data = user.get("webauthn")
            if not webauthn_data or not webauthn_data.get("credential_id"):
                raise HTTPException(status_code=400, detail="No hay Passkey registrada para este usuario.")

            credential_id = _b64url_decode(webauthn_data["credential_id"])

            options = generate_authentication_options(
                rp_id=self.rp_id,
                allow_credentials=[credential_id],
                user_verification=UserVerificationRequirement.REQUIRED,
            )

            await db["users"].update_one(
                {"user_id": user_id},
                {"$set": {"webauthn_challenge": _b64url_encode(options.challenge), "updated_at": datetime.now(timezone.utc)}},
            )

            return {
                "publicKey": {
                    "challenge": _b64url_encode(options.challenge),
                    "rpId": self.rp_id,
                    "timeout": 60000,
                    "userVerification": "required",
                    "allowCredentials": [
                        {"type": "public-key", "id": webauthn_data["credential_id"]}
                    ],
                }
            }

        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error generando opciones de autenticación: {str(e)}")

    async def verify_authentication_response(self, user_id: str, credential: dict):
        try:
            user = await db["users"].find_one({"user_id": user_id})
            if not user:
                raise HTTPException(status_code=404, detail="Usuario no encontrado")

            webauthn_data = user.get("webauthn")
            if not webauthn_data:
                raise HTTPException(status_code=400, detail="No hay Passkey registrada para este usuario.")

            challenge_b64 = user.get("webauthn_challenge")
            if not challenge_b64:
                raise HTTPException(status_code=400, detail="No hay challenge. Pida /authenticate/options primero.")

            expected_challenge = _b64url_decode(challenge_b64)

            credential_id = _b64url_decode(webauthn_data["credential_id"])
            public_key = _b64url_decode(webauthn_data["public_key"])
            sign_count = int(webauthn_data.get("sign_count", 0))

            verification = verify_authentication_response(
                credential=AuthenticationCredential.parse_obj(credential),
                expected_challenge=expected_challenge,
                expected_rp_id=self.rp_id,
                expected_origin=self.origin,
                credential_public_key=public_key,
                credential_current_sign_count=sign_count,
                require_user_verification=True,
            )

            # actualizar contador y limpiar challenge
            await db["users"].update_one(
                {"user_id": user_id},
                {
                    "$set": {
                        "webauthn.sign_count": int(verification.new_sign_count),
                        "updated_at": datetime.now(timezone.utc),
                    },
                    "$unset": {"webauthn_challenge": ""},
                },
            )

            return {"verified": True, "message": "✅ Passkey verificada. Acceso permitido.", "user_id": user_id}

        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=401, detail=f"❌ Error verificando Passkey: {str(e)}")
