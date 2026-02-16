# 🔐 SFS Login – Sistema de Autenticación Biométrica y 2FA

Sistema de autenticación seguro desarrollado como **Proyecto Final**, que integra **credenciales tradicionales**, **biometría facial con cámara** y **autenticación de dos factores (2FA) mediante aplicaciones Authenticator** como **Microsoft Authenticator** o **Google Authenticator**.

---

## 📌 Características principales
✔ Registro de usuarios  
✔ Login con email y contraseña  
✔ Biometría facial con cámara  
✔ 2FA con Authenticator (huella/PIN del celular)  
✔ Elección de método de autenticación  
✔ Backend FastAPI + Frontend React  

---

## 🚀 Ejecución rápida

### Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Backend: http://localhost:8000  
Docs: http://localhost:8000/api/docs  

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Frontend: http://localhost:8081  

---

## 🔐 Authenticator (Microsoft / Google)

El sistema genera un **QR OTP universal** compatible con:
- Microsoft Authenticator
- Google Authenticator

El celular maneja la huella o biometría, **no el computador**.

---

## 🧪 Tecnologías
- FastAPI
- Python
- OpenCV
- face_recognition
- MongoDB
- React + TypeScript
- TailwindCSS

---

## 🎓 Proyecto académico
Proyecto Final – Desarrollo de Software Seguro
