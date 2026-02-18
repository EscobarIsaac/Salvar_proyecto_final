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

## 👆 Flujo de Autenticación con Huella Dactilar

### Arquitectura

El sistema de huella utiliza una **arquitectura de tres capas**:

1. **Frontend (React)** → Interfaz de usuario
2. **Backend (FastAPI)** → Lógica de autenticación y gestión de datos
3. **Intermediary-App (FastAPI)** → Servicio especializado para el lector ZK9500

### Componentes

#### 📱 Dispositivo Lector ZKTeco ZK9500
- Lector biométrico conectado por **USB** al servidor
- Captura plantillas de huella de forma segura
- Realiza comparaciones y devuelve scores de coincidencia

#### ⚙️ Servicio Intermediario (`intermediary-app`)
- Servicio FastAPI que se ejecuta en el puerto **9000**
- Actúa como puente entre el backend principal y el lector ZK9500
- Endpoints principales:
  - `POST /fingerprint/zk9500/register` - Captura y registra huella
  - `POST /fingerprint/zk9500/verify` - Verifica huella contra plantillas candidatas
  - `GET /fingerprint/zk9500/status` - Verifica estado del dispositivo

### Flujo de Registro de Huella

```
Usuario (Frontend)
       ↓
[Botón "Registrar Huella"]
       ↓
1. GET /api/fingerprint/register/init
   → Backend genera registro en DB (fingerprint_enabled=false)
       ↓
2. POST /fingerprint/zk9500/register?user_id=...
   → Intermediary-App:
      • Intenta conectar con ZK9500
      • Realiza 10 capturas secuenciales (2.5s cada una)
      • Calcula calidad de cada plantilla
      • Devuelve templates_base64 + qualities
       ↓
3. Backend guarda plantillas en MongoDB
   (user.fingerprint_templates[])
       ↓
4. Backend actualiza fingerprint_enabled=true
       ↓
[✅ Huella registrada exitosamente]
```

### Flujo de Autenticación (Login) con Huella

```
Usuario (Frontend)
       ↓
1. POST /api/auth/login (email + contraseña)
   → Credenciales válidas ✅
   → Devuelve access_token + opciones de 2FA
       ↓
2. Usuario selecciona "Verificar con huella"
       ↓
3. POST /api/auth/fingerprint/verify-login?user_id=...&score_threshold=40
   → Intermediary-App:
      • Captura nueva huella del usuario (probe)
      • Backend obtiene plantillas almacenadas del usuario de MongoDB
      • Compara probe contra todas las plantillas candidatas
      • Devuelve match + user_id + score de similitud
       ↓
4. Si match=true y score >= score_threshold:
   [✅ Autenticación completada]
   → Frontend redirige a dashboard
   
   Si match=false o score < umbral:
   [❌ Huella no coincide]
   → Usuario puede reintentar o usar otro método
```

### Parámetros Clave

| Parámetro | Descripción | Valor por Defecto |
|-----------|-------------|-------------------|
| `capture_tries` | Número de capturas por registro | 10 |
| `timeout_per_capture_ms` | Tiempo máximo por captura | 2500ms |
| `score_threshold` | Umbral mínimo de similitud para match | 40 |
| `quality_threshold` | Calidad mínima aceptable | 0 |

### Respuestas de la API

#### Registro exitoso
```json
{
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "templates_base64": ["iVBOR...base64...", "iVBOR...base64..."],
  "qualities": [95, 92, 88]
}
```

#### Verificación exitosa
```json
{
  "match": true,
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "score": 78,
  "quality": 92,
  "message": "Huella verificada"
}
```

#### Error de dispositivo
```json
{
  "detail": "No ZK9500 device found. Ensure it's connected via USB."
}
```

### Instalación y Ejecución del Servicio de Huella

```bash
# Navegar a intermediary-app
cd intermediary-app

# Crear entorno virtual
python -m venv .venv
.venv\Scripts\activate

# Instalar dependencias
pip install -r requirements.txt

# Configurar variables de entorno (opcional)
cp .env.example .env

# Ejecutar servicio
uvicorn main:app --host 0.0.0.0 --port 9000 --reload
```

**Nota**: El dispositivo ZK9500 debe estar **conectado por USB** antes de iniciar el servicio.

### Manejo de Errores

| Error | Causa | Solución |
|-------|-------|----------|
| `No ZK9500 device found` | Dispositivo no conectado | Conectar USB y reiniciar servicio |
| `Fingerprint capture failed` | Dedo mal colocado/calidad baja | Reintentar con mejor posición |
| `Not enough valid captures` | Menos de 3 capturas exitosas | Repetir proceso completo |
| `Match score below threshold` | Huella no coincide lo suficiente | Verificar que sea la persona correcta |

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

Proyecto Final – Desarrollo de Software Seguro - Alexis Chimba, German Caceres, Isaac Escobar
