from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import DEBUG, ENVIRONMENT
from app.routes import auth, users, facial

# Si ya tienes webauthn router en app.routes, agrégalo aquí:
# from app.routes import webauthn

app = FastAPI(
    title="SFS Login Backend",
    description="API de autenticación con JWT, reconocimiento facial y Passkeys (WebAuthn)",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc"
)

# ✅ CORS para desarrollo
origins = [
    "http://localhost",
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:8080",
    "http://localhost:8081",
    "http://127.0.0.1",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:8080",
    "http://127.0.0.1:8081",
]

app.add_middleware(
    CORSMiddleware,
    # ✅ En desarrollo: permitir explícitos + regex para puertos dinámicos
    allow_origins=origins,
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rutas
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(facial.router)

# ✅ IMPORTANTE: si ya tienes router webauthn en app/routes/webauthn.py, inclúyelo
# app.include_router(webauthn.router)

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "environment": ENVIRONMENT,
        "debug": DEBUG,
        "version": "1.0.0"
    }

@app.get("/")
async def root():
    return {
        "message": "Bienvenido a SFS Login Backend API",
        "docs": "/api/docs",
        "version": "1.0.0"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
