# 🔐 Sistema de Autenticación Segura con Reconocimiento Facial

Sistema completo de autenticación con reconocimiento facial biométrico, desarrollado con FastAPI, React + TypeScript, y MongoDB.

## 🎯 Características Principales

### Seguridad Avanzada
- **Autenticación Multi-Factor (MFA)**: Email + Contraseña + Reconocimiento Facial
- **Encriptación Argon2**: Contraseñas hasheadas con algoritmo de última generación
- **Verificación Biométrica**: Sistema anti-suplantación con detección de unicidad facial
- **JWT Tokens**: Autenticación stateless con tokens seguros

### Validaciones Robustas
- **Contraseñas Épicas**:
  - Mínimo 8 caracteres
  - Letras mayúsculas y minúsculas
  - Números y caracteres especiales
- **Email y Username únicos**: Prevención de duplicados en base de datos
- **Rostros únicos**: Un rostro = Un usuario (anti-duplicación biométrica)

## 🚀 Inicio Rápido

### Prerequisitos
- Docker Desktop
- Git

### Instalación

```bash
# Clonar repositorio
git clone https://github.com/EscobarIsaac/Salvar_proyecto_final.git
cd Salvar_proyecto_final

# Configurar variables de entorno
cp .env.example .env
cp frontend/.env.example frontend/.env

# Levantar servicios con Docker Compose
docker compose up --build
```

### Acceso
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs
- **MongoDB**: localhost:27017

## 📁 Estructura del Proyecto

```
├── backend/                 # FastAPI + Python
│   ├── app/
│   │   ├── core/           # Seguridad (JWT, Argon2)
│   │   ├── models/         # Modelos de datos
│   │   ├── routes/         # Endpoints API
│   │   ├── schemas/        # Validaciones Pydantic
│   │   ├── services/       # Lógica de negocio
│   │   └── utils/          # Utilidades y validadores
│   ├── Dockerfile
│   └── requirements.txt
│
├── frontend/               # React + TypeScript + Vite
│   ├── src/
│   │   ├── components/    # Componentes UI
│   │   ├── pages/         # Login, Register, Home
│   │   └── lib/           # Utilidades
│   ├── Dockerfile
│   └── package.json
│
└── docker-compose.yml      # Orquestación de servicios
```

## 🔄 Flujo de Autenticación

### Registro
1. Usuario completa formulario (nombre, email, username, contraseña)
2. Validación de requisitos de contraseña en tiempo real
3. Captura facial obligatoria con modal biométrico
4. Backend verifica unicidad de rostro (anti-duplicación)
5. Creación de usuario con contraseña hasheada (Argon2)
6. Redirección a login

### Login
1. Usuario ingresa email y contraseña
2. Backend valida credenciales
3. Si OK → Modal de verificación facial
4. Backend confirma que el rostro pertenece al usuario
5. Emisión de JWT token
6. Acceso a la aplicación

## 🛠️ Tecnologías

### Backend
- **FastAPI**: Framework web moderno y rápido
- **MongoDB**: Base de datos NoSQL
- **Motor**: Driver async para MongoDB
- **Argon2**: Hashing de contraseñas de última generación
- **PyJWT**: Manejo de tokens JWT
- **OpenCV + face_recognition**: Reconocimiento facial
- **YOLO**: Detección de objetos y personas

### Frontend
- **React 18**: Biblioteca UI
- **TypeScript**: Tipado estático
- **Vite**: Build tool ultra rápido
- **TailwindCSS**: Estilizado utility-first
- **Shadcn/ui**: Componentes accesibles
- **React Router**: Navegación
- **Lucide Icons**: Iconografía moderna

### DevOps
- **Docker**: Containerización
- **Docker Compose**: Orquestación multi-contenedor
- **Node 20**: Runtime JavaScript
- **Python 3.11**: Runtime backend

## 🔧 Comandos Útiles

```bash
# Levantar servicios
docker compose up

# Reconstruir desde cero
docker compose up --build --no-cache

# Ver logs
docker compose logs -f backend
docker compose logs -f frontend

# Detener servicios
docker compose down

# Limpiar volúmenes
docker compose down -v
```

## 🎨 Características UI/UX

- **Diseño Responsivo**: Mobile-first design
- **Animaciones Suaves**: Transiciones CSS optimizadas
- **Modo Oscuro**: Tema dark por defecto
- **Validación en Tiempo Real**: Feedback instantáneo
- **Mensajes Descriptivos**: Errores y éxitos claros
- **Loader States**: Indicadores de progreso visuales

## 🔒 Seguridad Implementada

- ✅ Contraseñas hasheadas con Argon2
- ✅ Validación de fortaleza de contraseña
- ✅ Protección contra ataques de fuerza bruta
- ✅ Tokens JWT con expiración
- ✅ Verificación biométrica facial única
- ✅ Validación de entrada en frontend y backend
- ✅ Protección CORS configurada
- ✅ Variables de entorno para secretos

## 📝 Endpoints API Principales

```
POST /api/auth/register                  # Registro de usuario
POST /api/auth/login                     # Login con credenciales
POST /api/auth/verify-facial-for-login   # Verificación facial
GET  /api/auth/health                    # Health check
```

## 👥 Equipo

- **Pamela Chipe**
- **Kleber Chavez**
- **Gabriel Reiniso**

## 📄 Licencia

Este proyecto es parte del curso de Desarrollo de Software Seguro.

---

**Desarrollado con ❤️ usando tecnologías modernas y prácticas de seguridad avanzadas**

