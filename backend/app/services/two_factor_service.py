import base64
import io
from datetime import datetime, timezone

import pyotp
import qrcode
from fastapi import HTTPException, status

from app.mongo import db


class TwoFactorService:
    """
    2FA con TOTP (Microsoft Authenticator / Google Authenticator).
    Genera otpauth://... y QR en PNG base64.
    """

    ISSUER = "SFS Login"  # nombre que verás en Authenticator

    @staticmethod
    async def _get_user(user_id: str) -> dict:
        user = await db["users"].find_one({"user_id": user_id})
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
        return user

    @staticmethod
    async def setup_totp(user_id: str) -> dict:
        user = await TwoFactorService._get_user(user_id)

        # Si ya tenía secret, lo reutilizamos (evita romper si refrescan página)
        secret = user.get("two_factor_secret")
        if not secret:
            secret = pyotp.random_base32()
            await db["users"].update_one(
                {"user_id": user_id},
                {"$set": {"two_factor_secret": secret, "two_factor_enabled": False,
                          "updated_at": datetime.now(timezone.utc)}},
            )

        account_name = user.get("email") or user.get("username") or user_id

        totp = pyotp.TOTP(secret)
        otpauth_url = totp.provisioning_uri(
            name=account_name, issuer_name=TwoFactorService.ISSUER)

        # Generar QR PNG en memoria
        qr = qrcode.QRCode(border=2, box_size=6)
        qr.add_data(otpauth_url)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")

        buf = io.BytesIO()
        img.save(buf, format="PNG")
        qr_png_base64 = base64.b64encode(buf.getvalue()).decode("utf-8")

        return {
            "user_id": user_id,
            "issuer": TwoFactorService.ISSUER,
            "account_name": account_name,
            "otpauth_url": otpauth_url,
            "qr_png_base64": qr_png_base64,
        }

    @staticmethod
    async def verify_totp_and_enable(user_id: str, code: str) -> dict:
        user = await TwoFactorService._get_user(user_id)
        secret = user.get("two_factor_secret")

        if not secret:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Primero debes configurar el Authenticator (no existe secret).",
            )

        totp = pyotp.TOTP(secret)

        # valid_window=1 permite tolerancia de 30s antes/después (muy útil)
        ok = totp.verify(code, valid_window=1)

        if not ok:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                                detail="Código inválido. Intenta de nuevo.")

        await db["users"].update_one(
            {"user_id": user_id},
            {
                "$set": {
                    "two_factor_enabled": True,
                    "two_factor_verified_at": datetime.now(timezone.utc),
                    "updated_at": datetime.now(timezone.utc),
                }
            },
        )

        return {"verified": True, "message": "✅ Authenticator configurado y habilitado correctamente."}

    @staticmethod
    async def verify_totp_for_login(user_id: str, code: str) -> dict:
        user = await TwoFactorService._get_user(user_id)

        if not user.get("two_factor_enabled", False):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                                detail="2FA no habilitado para este usuario.")

        secret = user.get("two_factor_secret")
        if not secret:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Secret 2FA no encontrado.")

        totp = pyotp.TOTP(secret)
        ok = totp.verify(code, valid_window=1)

        if not ok:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Código inválido.")

        return {"verified": True, "message": "✅ Código válido. Acceso permitido."}

    @staticmethod
    async def disable_totp(user_id: str) -> dict:
        """
        Deshabilita 2FA TOTP para el usuario y limpia el secret almacenado.
        """
        await TwoFactorService._get_user(user_id)

        await db["users"].update_one(
            {"user_id": user_id},
            {
                "$set": {
                    "two_factor_enabled": False,
                    "updated_at": datetime.now(timezone.utc),
                },
                "$unset": {
                    "two_factor_secret": "",
                    "two_factor_verified_at": "",
                },
            },
        )

        return {"disabled": True, "message": "2FA deshabilitado para el usuario."}
