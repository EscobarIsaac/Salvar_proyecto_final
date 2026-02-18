from fastapi import HTTPException, status
from app.mongo import db
from app.core.security import hash_password, verify_password, create_access_token
from app.schemas.user_schema import UserRegisterSchema, UserLoginSchema
from app.utils.validators import validate_email, validate_password_strength, validate_username
from app.services.facial_recognition_service import FacialRecognitionService
from datetime import datetime, timezone
import uuid
import base64
import logging

# Configurar logging
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)


class AuthService:

    @staticmethod
    async def register_user(user_data: UserRegisterSchema) -> dict:
        """
        Registra un nuevo usuario en la base de datos
        """
        logger.info(f"📝 Iniciando registro para email: {user_data.email}")

        # Validaciones
        if not validate_email(user_data.email):
            logger.warning(f"❌ Email inválido: {user_data.email}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email inválido"
            )

        if not validate_username(user_data.username):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Nombre de usuario inválido (3-50 caracteres, solo letras, números y guiones bajos)"
            )

        is_valid, message = validate_password_strength(user_data.password)
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=message
            )

        # Normaliza email (recomendado)
        email = (user_data.email or "").strip().lower()

        # Verificar si el usuario ya existe (Mongo)
        existing_user = await db["users"].find_one({"email": email}, {"_id": 1})
        if existing_user:
            logger.warning(
                f"⚠️ Intento de registro con email existente: {email}")
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="El email ya está registrado"
            )

        if user_data.facial_image_base64:
            logger.info(f"🔍 Verificando unicidad de rostro para: {email}")
            try:
                image_data = base64.b64decode(user_data.facial_image_base64)
                facial_service = FacialRecognitionService()

                # Verificar que el rostro sea único
                facial_uniqueness = facial_service.check_facial_uniqueness(
                    image_data)

                if not facial_uniqueness["is_unique"]:
                    logger.warning(
                        f"⛔ Rostro duplicado detectado para: {email}")
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"⛔ El rostro ya está registrado en el sistema. No se pueden registrar dos usuarios con el mismo rostro. "
                               f"Usuario coincidente: {facial_uniqueness['matched_user_id']} "
                               f"(Confianza: {facial_uniqueness['confidence']}%). "
                               f"Por favor, intenta con una foto diferente o un usuario diferente."
                    )
                logger.info(f"✅ Rostro único verificado para: {email}")
            except HTTPException:
                raise
            except Exception as e:
                logger.error(
                    f"❌ Error verificando facial en registro: {str(e)}")
                print(
                    f"[ERROR] Error verificando facial en registro: {str(e)}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Error procesando imagen facial: {str(e)}"
                )

        # Crear nuevo usuario
        user_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)

        logger.info(f"🆕 Creando usuario con ID: {user_id}")

        user_dict = {
            "_id": user_id,  # ✅ Mongo: guardamos el uuid como _id
            "user_id": user_id,
            "email": email,
            "username": user_data.username,
            "full_name": user_data.full_name or "",
            "hashed_password": hash_password(user_data.password),
            "is_active": True,
            "two_factor_enabled": False,
            "facial_recognition_enabled": False,
            "fingerprint_enabled": False,
            "fingerprint_templates": [],
            "created_at": now,
            "updated_at": now
        }

        try:
            await db["users"].insert_one(user_dict)
            logger.info(f"✅ Usuario creado exitosamente: {email}")
        except Exception as e:
            logger.error(f"❌ Error guardando usuario: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error guardando usuario: {str(e)}"
            )
        if user_data.facial_image_base64:
            try:
                image_data = base64.b64decode(user_data.facial_image_base64)
                facial_service = FacialRecognitionService()
                facial_service.save_facial_image(image_data, user_id)
                await db["users"].update_one(
                    {"_id": user_id},
                    {"$set": {
                        "facial_recognition_enabled": True,
                        "fingerprint_enabled": user_dict.get("fingerprint_enabled", False),
                        "updated_at": datetime.now(timezone.utc)
                    }}
                )

                user_dict["facial_recognition_enabled"] = True
                logger.info(f"📸 Imagen facial guardada para: {email}")
                print(
                    f"[FACIAL] Imagen facial guardada para usuario {user_id}")

            except Exception as e:
                logger.error(f"❌ Error guardando imagen facial: {str(e)}")
                print(
                    f"[ERROR] Error guardando imagen facial después de verificación: {str(e)}")
                # Eliminar el usuario si hay error guardando la imagen
                await db["users"].delete_one({"_id": user_id})
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Error guardando imagen facial: {str(e)}"
                )

        user_dict.pop("hashed_password", None)
        user_dict.pop("_id", None)
        return user_dict

    @staticmethod
    async def login_user(login_data: UserLoginSchema) -> dict:
        logger.info(f"🔐 Intento de login para: {login_data.email}")

        email = (login_data.email or "").strip().lower()

        # Buscar usuario por email (Mongo)
        user_data = await db["users"].find_one({"email": email})
        if not user_data:
            logger.warning(f"⚠️ Usuario no encontrado: {email}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Credenciales inválidas"
            )

        if not verify_password(login_data.password, user_data.get("hashed_password", "")):
            logger.warning(f"❌ Contraseña incorrecta para: {email}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Credenciales inválidas"
            )

        # Verificar si el usuario está activo
        if not user_data.get("is_active", False):
            logger.warning(f"⚠️ Usuario inactivo intentó login: {email}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Usuario inactivo"
            )

        # Crear token JWT
        access_token = create_access_token(
            data={"sub": user_data["user_id"], "email": user_data["email"]}
        )

        logger.info(f"✅ Login exitoso para: {email}")

        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user_data": {
                "user_id": user_data["user_id"],
                "email": user_data["email"],
                "username": user_data["username"],
                "full_name": user_data.get("full_name", ""),
                "two_factor_enabled": user_data.get("two_factor_enabled", False),
                "facial_recognition_enabled": user_data.get("facial_recognition_enabled", False),
                "fingerprint_enabled": user_data.get("fingerprint_enabled", False)
            }
        }
