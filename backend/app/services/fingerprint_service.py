import httpx
from datetime import datetime, timezone
from fastapi import HTTPException, status
from app.config import INTERMEDIARY_URL
from app.mongo import db
from loguru import logger


class FingerprintService:
    DEFAULT_SCORE_THRESHOLD = 60
    TIMEOUT = 35  # 35 segundos para registro, 25 para el tiempo de la persona y 10 para el buffer de la web

    @staticmethod
    def _build_url(path: str) -> str:
        return f"{INTERMEDIARY_URL.rstrip('/')}{path}"

    @staticmethod
    async def _get_user(user_id: str) -> dict:
        user = await db["users"].find_one({"_id": user_id})
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Usuario no encontrado",
            )
        return user

    @staticmethod
    async def register_template(user_id: str) -> dict:
        await FingerprintService._get_user(user_id)

        url = FingerprintService._build_url("/fingerprint/zk9500/register")
        logger.info(f"[BACKEND] Registrando huella para {user_id} en {url}")
        try:
            async with httpx.AsyncClient(timeout=FingerprintService.TIMEOUT) as client:
                resp = await client.post(url, params={"user_id": user_id})
        except httpx.HTTPError as exc:
            logger.error(f"[BACKEND] Error conectando intermediary-app: {exc}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Servicio de huella no disponible: {exc}",
            ) from exc

        if resp.status_code != 200:
            logger.warning(
                f"[BACKEND] intermediary-app retornó {resp.status_code}: {resp.text}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Error del servicio de huella: {resp.text}",
            )

        payload = resp.json()
        templates = payload.get("templates_base64") or []
        if isinstance(templates, str):
            templates = [templates]
        if not templates:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="El servicio de huella no retornó plantilla",
            )
        qualities = payload.get("qualities")
        quality = None
        if isinstance(qualities, list) and qualities:
            quality = sum(int(q) for q in qualities if isinstance(
                q, (int, float))) // len(qualities)

        now = datetime.now(timezone.utc)
        # Limitar a las primeras 6 plantillas por usuario (todas del mismo dedo)
        max_templates = 6
        templates = templates[:max_templates]

        logger.info(
            f"[BACKEND] Guardando {len(templates)} template(s) en MongoDB para {user_id}")
        await db["users"].update_one(
            {"_id": user_id},
            {
                "$set": {
                    "fingerprint_templates": templates,
                    "fingerprint_enabled": True,
                    "updated_at": now,
                }
            },
        )

        updated = await db["users"].find_one({"_id": user_id})
        templates_count = len(updated.get(
            "fingerprint_templates", [])) if updated else 0
        logger.info(
            f"[BACKEND] Registro completado: {templates_count} template(s) guardado(s)")

        return {
            "templates_base64": templates,
            "quality": quality,
            "fingerprint_enabled": True,
            "templates_count": templates_count,
        }

    @staticmethod
    async def verify_for_login(user_id: str, score_threshold: int | None = None) -> dict:
        user = await FingerprintService._get_user(user_id)
        templates = user.get("fingerprint_templates", [])
        if not templates:
            logger.warning(
                f"[BACKEND] Usuario {user_id} no tiene huellas registradas")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El usuario no tiene huellas registradas",
            )

        url = FingerprintService._build_url("/fingerprint/zk9500/verify")
        payload = {
            "candidates": [
                {"user_id": user_id, "template_base64": t} for t in templates
            ],
            "score_threshold": score_threshold or FingerprintService.DEFAULT_SCORE_THRESHOLD,
        }
        logger.info(
            f"[BACKEND] Verificando huella para {user_id} con {len(templates)} template(s), threshold={payload['score_threshold']}")

        try:
            async with httpx.AsyncClient(timeout=FingerprintService.TIMEOUT) as client:
                resp = await client.post(url, json=payload)
        except httpx.HTTPError as exc:
            logger.error(
                f"[BACKEND] Error conectando intermediary-app para verify: {exc}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Servicio de huella no disponible: {exc}",
            ) from exc

        if resp.status_code != 200:
            logger.warning(
                f"[BACKEND] intermediary-app verify retornó {resp.status_code}: {resp.text}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Error del servicio de huella: {resp.text}",
            )

        data = resp.json()
        match = bool(data.get("match"))
        matched_user_id = data.get("user_id")
        score = data.get("score")
        quality = data.get("quality")

        if match and matched_user_id and matched_user_id != user_id:
            logger.warning(
                f"[BACKEND] Match retornó otro usuario: {matched_user_id} != {user_id}")
            match = False

        logger.info(
            f"[BACKEND] Verify resultado: match={match}, score={score}, quality={quality}")
        return {
            "match": match,
            "score": score,
            "quality": quality,
            "fingerprint_enabled": user.get("fingerprint_enabled", False),
        }

    @staticmethod
    async def disable_fingerprint(user_id: str, clear_templates: bool = True) -> dict:
        await FingerprintService._get_user(user_id)

        update_fields = {
            "fingerprint_enabled": False,
            "updated_at": datetime.now(timezone.utc),
        }
        if clear_templates:
            update_fields["fingerprint_templates"] = []

        await db["users"].update_one({"_id": user_id}, {"$set": update_fields})

        updated = await db["users"].find_one({"_id": user_id})
        if not updated:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Usuario no encontrado",
            )

        updated.pop("_id", None)
        updated.pop("hashed_password", None)
        return updated

    @staticmethod
    async def status(user_id: str) -> dict:
        user = await FingerprintService._get_user(user_id)
        return {
            "fingerprint_enabled": user.get("fingerprint_enabled", False),
            "templates_count": len(user.get("fingerprint_templates", [])),
        }
