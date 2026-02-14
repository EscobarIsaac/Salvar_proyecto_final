# Proyecto Final – Sistema de Login con Reconocimiento Facial
Backend en FastAPI + Frontend Web con cámara

Este proyecto implementa un sistema de autenticación con:
- Registro y login con email y contraseña
- Verificación facial obligatoria durante el login
- Detección de rostro real (liveness)
- Almacenamiento de imágenes faciales por usuario
- Backend en FastAPI
- Frontend con cámara (webcam)

--------------------------------------------------
REQUISITOS
--------------------------------------------------

SOFTWARE:
- Python 3.11.x
- Node.js 18 o superior
- Git
- Windows (recomendado para este setup)

PUERTOS USADOS:
- Backend: http://127.0.0.1:8000
- Frontend: http://localhost:8081

--------------------------------------------------
ESTRUCTURA DEL PROYECTO
--------------------------------------------------

Proyecto_Final/
│
├── backend/
│   ├── app/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── facial_data/        ← aquí se guardan los rostros
│   │   ├── main.py
│   │   └── mongo.py
│   └── venv/
│
└── frontend/

--------------------------------------------------
BACKEND – CONFIGURACIÓN Y EJECUCIÓN
--------------------------------------------------

1) ENTRAR AL BACKEND
Desde PowerShell:

cd D:\Universidad\Salvar\Proyecto_Final\backend

2) CREAR Y ACTIVAR ENTORNO VIRTUAL

python -m venv venv
.\venv\Scripts\Activate.ps1

(Si PowerShell bloquea scripts)
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned

3) INSTALAR DEPENDENCIAS

python -m pip install --upgrade pip setuptools wheel

pip install fastapi uvicorn python-jose passlib[bcrypt] pydantic
pip install opencv-python numpy pillow ultralytics face_recognition

4) EJECUTAR EL BACKEND

uvicorn app.main:app --reload

Si todo está bien verás:
- API: http://127.0.0.1:8000
- Docs: http://127.0.0.1:8000/api/docs

--------------------------------------------------
CORS (MUY IMPORTANTE)
--------------------------------------------------

El frontend corre en http://localhost:8081

En app/main.py asegúrate de tener:

origins = [
  "http://localhost:8081",
  "http://127.0.0.1:8081"
]

Luego REINICIA uvicorn.

--------------------------------------------------
FRONTEND – CONFIGURACIÓN Y EJECUCIÓN
--------------------------------------------------

1) ENTRAR AL FRONTEND

cd D:\Universidad\Salvar\Proyecto_Final\frontend

2) INSTALAR DEPENDENCIAS

npm install

3) EJECUTAR FRONTEND

npm run dev

Abre la URL que aparece, normalmente:
http://localhost:8081

--------------------------------------------------
FLUJO DE USO DEL SISTEMA
--------------------------------------------------

REGISTRO:
1. Ir a Register
2. Ingresar:
   - email
   - username
   - password
   - full_name
3. Capturar rostro con la cámara
4. Si todo es correcto → usuario creado

LOGIN:
1. Ir a Login
2. Ingresar email y password
3. El sistema solicita verificación facial
4. Se abre la cámara
5. Si el rostro coincide → login exitoso

--------------------------------------------------
ENDPOINTS PRINCIPALES
--------------------------------------------------

POST /api/auth/register

Body:
{
  "email": "user@example.com",
  "username": "user1",
  "password": "stringst",
  "full_name": "Nombre",
  "facial_image_base64": "BASE64"
}

POST /api/auth/login

Body:
{
  "email": "user@example.com",
  "password": "stringst"
}

POST /api/auth/verify-facial-for-login?user_id=UUID

Body:
{
  "image_base64": "BASE64"
}

--------------------------------------------------
PROBLEMAS COMUNES
--------------------------------------------------

ERROR CORS:
- Agregar http://localhost:8081 en origins
- Reiniciar backend

ERROR 401 EN VERIFICACIÓN FACIAL:
- El usuario no tiene rostro registrado
- facial_recognition_enabled está en false
- La imagen no coincide

ERROR:
MotorCollection object is not callable

CAUSA:
- Estás usando MongoDB (Motor) pero código estilo Firestore

SOLUCIÓN:
- Acceder a colecciones así:
  db["users"]
  await users.find_one(...)

--------------------------------------------------
VOLVER A REGISTRAR EL MISMO ROSTRO
--------------------------------------------------

Para usar tu rostro otra vez:

1) Borrar la carpeta:
backend/app/facial_data/<user_id>

2) (Opcional) borrar el usuario de la base de datos

--------------------------------------------------
NOTAS FINALES
--------------------------------------------------

- El sistema es estrictamente seguro: si el rostro no coincide, el login falla
- El reconocimiento facial es obligatorio
- El liveness detecta pantallas, celulares y fotos
- Ideal para proyectos académicos de seguridad

--------------------------------------------------
FIN
--------------------------------------------------
