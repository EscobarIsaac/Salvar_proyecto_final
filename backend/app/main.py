from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import DEBUG, ENVIRONMENT
from app.routes import auth, users, facial

app = FastAPI(
    title="SFS Login Backend",
    description="API de autenticación con JWT y reconocimiento facial + Authenticator (TOTP)",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

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
    allow_origins=origins if DEBUG else ["https://tudominio.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(facial.router)

@app.get("/health")
async def health_check():
    return {"status": "healthy", "environment": ENVIRONMENT, "version": "1.0.0"}

@app.get("/")
async def root():
    return {"message": "Bienvenido a SFS Login Backend API", "docs": "/api/docs", "version": "1.0.0"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=DEBUG)
