import os
import asyncio
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger
from dotenv import load_dotenv

from models import (
    ErrorResponse,
    ZKRegisterResponse,
    ZKVerifyRequest,
    ZKVerifyResponse,
)
from zk9500_driver import build_driver, ZK9500Driver

try:
    from zkfinger_standard import get_standard_driver, SDK_AVAILABLE
except ImportError:
    SDK_AVAILABLE = False
    get_standard_driver = None

load_dotenv()

app = FastAPI(title="ZK9500 Fingerprint Microservice", version="0.2.0")

# CORS para permitir llamadas desde el frontend
origins_env = os.getenv("CORS_ALLOW_ORIGINS")
allow_origins = [o.strip() for o in origins_env.split(",") if o.strip()] if origins_env else [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

zk_driver: ZK9500Driver = build_driver()


@app.on_event("startup")
async def startup_event() -> None:
    for attempt in range(1, 6):
        try:
            zk_driver.connect()
            logger.info(f"ZK9500 ready on startup (attempt {attempt})")
            break
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                f"Initial connection to ZK9500 failed (attempt {attempt}/5): {exc}")
            if attempt == 5:
                break
            await asyncio.sleep(1.5)


@app.get("/fingerprint/zk9500/status")
async def zk_status():
    ready = zk_driver.is_ready()
    return {"ready": ready}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=os.getenv("API_HOST", "0.0.0.0"),
        port=int(os.getenv("API_PORT", "9000")),
        reload=True,
    )


# ======== ZK9500 Endpoints ========

@app.post("/fingerprint/zk9500/register", response_model=ZKRegisterResponse, responses={400: {"model": ErrorResponse}})
async def zk_register(user_id: str) -> ZKRegisterResponse:
    try:
        logger.info(f"Iniciando registro para usuario: {user_id}")
        templates_bytes: list[bytes] = []
        qualities: list[int] = []

        capture_tries = 10
        timeout_per_capture_ms = int(25000 / capture_tries)
        for i in range(capture_tries):
            try:
                template_bytes, quality = zk_driver.capture(
                    timeout_ms=timeout_per_capture_ms)
                templates_bytes.append(template_bytes)
                qualities.append(int(quality) if quality is not None else 0)
                logger.info(
                    f"Captura {i+1}/{capture_tries}: calidad={quality}")
            except Exception as exc:
                logger.debug(f"Captura {i+1}/{capture_tries} falló: {exc}")
                continue

        if len(templates_bytes) < 3:
            raise RuntimeError(
                f"Insuficientes capturas: {len(templates_bytes)}/10 (mínimo 3 requeridas)")

        logger.info(
            f"Capturas exitosas: {len(templates_bytes)}/10, calidades: {qualities}")
        sorted_indices = sorted(
            range(len(qualities)),
            key=lambda i: qualities[i],
            reverse=True
        )
        # Ordenar por índice original
        top_3_indices = sorted(sorted_indices[:3])
        top_3_templates = [templates_bytes[i] for i in top_3_indices]
        top_3_qualities = [qualities[i] for i in top_3_indices]

        logger.debug(
            f"Top 3 templates: índices={top_3_indices}, calidades={top_3_qualities}")

        fused_template = top_3_templates[0]
        fusion_success = False

        if SDK_AVAILABLE and get_standard_driver:
            try:
                standard_driver = get_standard_driver()
                if standard_driver:
                    fused_template = standard_driver.gen_reg_template(
                        top_3_templates[0],
                        top_3_templates[1],
                        top_3_templates[2]
                    )
                    logger.info(
                        f"[REGISTER] SDK estándar fusionó exitosamente: {len(fused_template)} bytes")
                    fusion_success = True
            except Exception as exc:
                logger.warning(f"[REGISTER] Fusión SDK estándar falló: {exc}")

        if not fusion_success:
            logger.warning(
                f"[REGISTER] Fusión no disponible, retornando Top-3 templates por separado")
            fused_template_b64 = [
                zk_driver.to_base64(t) for t in top_3_templates]
        else:
            fused_template_b64 = [zk_driver.to_base64(fused_template)]

        response = ZKRegisterResponse(
            user_id=user_id,
            templates_base64=fused_template_b64,
            # Calidad máxima de los top 3
            qualities=[max(top_3_qualities)] * len(fused_template_b64)
        )
        logger.info(
            f"[REGISTER] Completado para {user_id}: {len(fused_template_b64)} template(s) registrado(s)")
        return response

    except Exception as exc:
        logger.exception("ZK register falló")
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/fingerprint/zk9500/verify", response_model=ZKVerifyResponse, responses={400: {"model": ErrorResponse}})
async def zk_verify(payload: ZKVerifyRequest) -> ZKVerifyResponse:
    try:
        logger.info(
            f"[VERIFY] Iniciando verificación con {len(payload.candidates)} candidatos, threshold={payload.score_threshold}")
        probe_template, quality = zk_driver.capture(timeout_ms=5000)
        logger.info(
            f"[VERIFY] Probe capturada: calidad={quality}, template={len(probe_template)} bytes")

        candidates_bytes = [zk_driver.from_base64(
            c.template_base64) for c in payload.candidates]
        found, best_score = zk_driver.identify(
            probe_template, candidates_bytes)

        logger.info(
            f"[VERIFY] Identify resultado: found={found}, best_score={best_score}, threshold={payload.score_threshold}")

        if not found or best_score is None or best_score < payload.score_threshold:
            logger.warning(
                f"[VERIFY] Match FALLIDO: found={found}, score={best_score} < threshold={payload.score_threshold}")
            return ZKVerifyResponse(match=False, user_id=None, score=best_score, quality=quality)
        best_idx = -1
        for idx, cand in enumerate(candidates_bytes):
            s = zk_driver.match(probe_template, cand)
            if s == best_score:
                best_idx = idx
                break

        matched_user = payload.candidates[best_idx].user_id if best_idx >= 0 else None
        logger.info(
            f"[VERIFY] Match EXITOSO: usuario={matched_user}, score={best_score}")
        return ZKVerifyResponse(match=True, user_id=matched_user, score=best_score, quality=quality)
    except Exception as exc:
        logger.exception("[VERIFY] ZK verify failed")
        raise HTTPException(status_code=400, detail=str(exc))
