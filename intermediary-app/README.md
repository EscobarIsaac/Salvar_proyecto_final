# Fingerprint Microservice (ZK9500)

Servicio local en FastAPI que habla con el lector **ZKTeco ZK9500** vía USB usando el binding Python `pyzkfp`.

## Estructura

```
intermediary-app/
├─ main.py                # Entrypoint FastAPI + endpoints REST (ZK9500)
├─ zk9500_driver.py       # Wrapper del SDK ZK9500 (captura/match)
├─ models.py              # Esquemas Pydantic de request/response
├─ requirements.txt       # Dependencias (FastAPI, loguru, pyzkfp)
└─ .env.example           # Config de API
```

## Instalación

```bash
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -r requirements.txt
cp .env.example .env      # Ajusta API_HOST/API_PORT si quieres cambiar bind
```

## Ejecutar

```bash
uvicorn main:app --host 0.0.0.0 --port 9000 --reload
```

Endpoints principales:

- `POST /fingerprint/zk9500/register?user_id=...` → captura y devuelve `{ user_id, template_base64, quality }` para que lo guardes en Mongo asociado al usuario.
- `POST /fingerprint/zk9500/verify` → captura un probe y compara contra plantillas recibidas en el body (`candidates`). Devuelve `{ match, user_id, score, quality }`.

## Ejemplos de uso (backend FastAPI)

```python
import httpx

INTERMEDIARY_URL = "http://localhost:9000"

async def zk_register(user_id: str) -> dict:
    async with httpx.AsyncClient() as client:
        r = await client.post(f"{INTERMEDIARY_URL}/fingerprint/zk9500/register", params={"user_id": user_id})
        r.raise_for_status()
        data = r.json()
        # Guarda data["template_base64"] asociado al user_id en Mongo
        return data

async def zk_verify(candidate_templates: list[dict]) -> dict:
    async with httpx.AsyncClient() as client:
        r = await client.post(
            f"{INTERMEDIARY_URL}/fingerprint/zk9500/verify",
            json={"candidates": candidate_templates, "score_threshold": 40},
        )
        r.raise_for_status()
        return r.json()
```

## Manejo de errores y reconexión

- Cada operación llama a `ensure_connected()`. Si no hay conexión, intenta reconectar.
- Los errores de captura se devuelven como `400` con el `detail` del problema.

## Sincronización con Mongo

1) Registrar: backend llama `/fingerprint/zk9500/register`, recibe `template_base64` y `quality`. Guarda la plantilla asociada al `user_id`.
2) Verificar: backend llama `/fingerprint/zk9500/verify` con las plantillas candidatas para el usuario. Usa `score_threshold` para decidir el match.
