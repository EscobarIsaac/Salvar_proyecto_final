from fastapi import HTTPException, status
from app.mongo import db
from app.core.security import hash_password


class UserService:
    """
    Servicio de usuarios que maneja toda la lógica de negocio relacionada
    con la gestión de usuarios
    """

    @staticmethod
    async def get_user_by_id(user_id: str) -> dict:
        """
        Obtiene un usuario por su ID
        """
        user_data = await db["users"].find_one({"_id": user_id})

        if not user_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Usuario no encontrado"
            )

        user_data.pop("hashed_password", None)  # No devolver la contraseña
        user_data.pop("_id", None)              # Opcional: no devolver _id
        return user_data

    @staticmethod
    async def update_user(user_id: str, update_data: dict) -> dict:
        """
        Actualiza los datos de un usuario
        """
        from datetime import datetime, timezone

        # Verificar si existe
        existing = await db["users"].find_one({"_id": user_id}, {"_id": 1})
        if not existing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Usuario no encontrado"
            )

        # Si se proporciona una contraseña, hashearla
        if "password" in update_data and update_data["password"]:
            update_data["hashed_password"] = hash_password(update_data["password"])
            del update_data["password"]

        # Actualizar timestamp
        update_data["updated_at"] = datetime.now(timezone.utc)

        # Actualizar en Mongo
        await db["users"].update_one(
            {"_id": user_id},
            {"$set": update_data}
        )

        updated_user = await db["users"].find_one({"_id": user_id})
        if not updated_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Usuario no encontrado"
            )

        updated_user.pop("hashed_password", None)
        updated_user.pop("_id", None)  # Opcional
        return updated_user

    @staticmethod
    async def enable_two_factor(user_id: str) -> dict:
        """
        Habilita autenticación de dos factores para un usuario
        """
        return await UserService.update_user(
            user_id,
            {"two_factor_enabled": True}
        )

    @staticmethod
    async def enable_facial_recognition(user_id: str) -> dict:
        """
        Habilita reconocimiento facial para un usuario
        """
        return await UserService.update_user(
            user_id,
            {"facial_recognition_enabled": True}
        )

    @staticmethod
    async def disable_facial_recognition(user_id: str) -> dict:
        """
        Desactiva reconocimiento facial para un usuario
        """
        return await UserService.update_user(
            user_id,
            {"facial_recognition_enabled": False}
        )
