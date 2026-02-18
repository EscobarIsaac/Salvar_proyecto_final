import cv2
import numpy as np
import os
import uuid
from datetime import datetime
from pathlib import Path
from fastapi import HTTPException, status
import mediapipe as mp
try:
    import face_recognition
except ImportError:
    face_recognition = None
from PIL import Image
import io
from ultralytics import YOLO


class FacialRecognitionService:

    def __init__(self):
        self.FACIAL_DATA_DIR = Path(__file__).parent.parent / "facial_data"
        self.mp_face_detection = None
        self.mp_drawing = None
        if hasattr(mp, "solutions"):
            try:
                self.mp_face_detection = mp.solutions.face_detection
                self.mp_drawing = mp.solutions.drawing_utils
            except Exception:
                self.mp_face_detection = None
                self.mp_drawing = None

        try:
            self.yolo_model = YOLO('yolov8n.pt')
            print("[LOG] Modelo YOLO cargado exitosamente")
        except Exception as e:
            print(
                f"[WARN] Error cargando YOLO: {e}. Liveness detection deshabilitada")
            self.yolo_model = None

        self.FACIAL_DATA_DIR.mkdir(parents=True, exist_ok=True)
        print(
            f"[LOG] Directorio facial_data creado en: {self.FACIAL_DATA_DIR}")

    @staticmethod
    def ensure_facial_data_dir():
        """Asegura que el directorio de datos faciales existe"""
        facial_data_dir = Path(__file__).parent.parent / "facial_data"
        facial_data_dir.mkdir(parents=True, exist_ok=True)

    def save_facial_image(self, image_data: bytes, user_id: str) -> str:
        """
        Guarda una imagen facial para un usuario
        """
        try:
            user_facial_dir = self.FACIAL_DATA_DIR / user_id
            user_facial_dir.mkdir(exist_ok=True)

            # Convertir bytes a imagen numpy
            nparr = np.frombuffer(image_data, np.uint8)
            image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            if image is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Imagen inválida"
                )

            # Generar nombre único para la imagen
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"face_{timestamp}.jpg"
            filepath = user_facial_dir / filename

            # Guardar imagen
            cv2.imwrite(str(filepath), image)

            return str(filepath)

        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error guardando imagen: {str(e)}"
            )

    def detect_face_in_image(self, image_data: bytes) -> dict:
        try:
            # Convertir bytes a imagen numpy
            nparr = np.frombuffer(image_data, np.uint8)
            image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            if image is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Imagen inválida"
                )

            rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            h, w, _ = image.shape

            if self.mp_face_detection is not None:
                with self.mp_face_detection.FaceDetection(
                    model_selection=0,
                    min_detection_confidence=0.5
                ) as face_detection:
                    results = face_detection.process(rgb_image)

                    if not results.detections:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="No se detectó rostro en la imagen"
                        )

                    detection = results.detections[0]
                    bboxC = detection.location_data.relative_bounding_box
                    bbox = {
                        "x": int(bboxC.xmin * w),
                        "y": int(bboxC.ymin * h),
                        "width": int(bboxC.width * w),
                        "height": int(bboxC.height * h),
                        "confidence": float(detection.score[0])
                    }

                    return {
                        "face_detected": True,
                        "bbox": bbox,
                        "message": "Rostro detectado correctamente"
                    }

            if face_recognition is None:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Face recognition no disponible: instala face_recognition si necesitas detección facial."
                )

            face_locations = face_recognition.face_locations(rgb_image)
            if not face_locations:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No se detectó rostro en la imagen"
                )

            top, right, bottom, left = face_locations[0]
            bbox = {
                "x": int(left),
                "y": int(top),
                "width": int(right - left),
                "height": int(bottom - top),
                "confidence": 1.0
            }

            return {
                "face_detected": True,
                "bbox": bbox,
                "message": "Rostro detectado correctamente (fallback)"
            }

        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error detectando rostro: {str(e)}"
            )

    def get_user_facial_images(self, user_id: str) -> list:
        user_facial_dir = self.FACIAL_DATA_DIR / user_id

        if not user_facial_dir.exists():
            return []

        images = []
        for file in user_facial_dir.glob("face_*.jpg"):
            images.append(str(file))

        return sorted(images, reverse=True)  # Más recientes primero

    def verify_face(self, image_data: bytes, user_id: str) -> dict:
        try:
            user_images = self.get_user_facial_images(user_id)

            if not user_images:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No tiene rostro registrado. Por favor, registre su rostro primero en el perfil."
                )

            detection_result = self.detect_face_in_image(image_data)

            if not detection_result["face_detected"]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="❌ No se detectó rostro en la imagen. Asegúrese de estar mirando a la cámara."
                )

            liveness_check = self._check_liveness(image_data)
            if not liveness_check["is_alive"]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=liveness_check['reason']
                )

            verification_result = self._compare_faces(image_data, user_images)

            if verification_result["match"]:
                return {
                    "verified": True,
                    "message": "✅ Rostro verificado correctamente. Acceso permitido.",
                    "confidence": verification_result["confidence"],
                    "liveness": liveness_check
                }
            else:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="❌ El rostro no coincide con el registrado. Intente de nuevo."
                )

        except HTTPException:
            raise
        except Exception as e:
            print(f"[ERROR] verify_face: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error verificando rostro: {str(e)}"
            )

    async def verify_face_for_login(self, image_data: bytes, user_id: str) -> dict:
        try:
            from app.mongo import db
            users_col = None
            if hasattr(db, "__getitem__"):
                users_col = db["users"]
            elif hasattr(db, "get_collection"):
                users_col = db.get_collection("users")
            else:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="❌ DB no compatible: no se pudo obtener colección 'users'"
                )

            user_doc = await users_col.find_one({"user_id": user_id})

            if not user_doc:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="❌ Usuario no encontrado"
                )

            facial_enabled = user_doc.get("facial_recognition_enabled", False)

            if not facial_enabled:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="❌ Facial recognition no habilitado para este usuario"
                )

            user_images = self.get_user_facial_images(user_id)

            if not user_images:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="❌ No hay rostro registrado para este usuario. No se puede completar el login."
                )

            try:
                detection_result = self.detect_face_in_image(image_data)

                if not detection_result["face_detected"]:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="❌ No se detectó un rostro válido en la imagen."
                    )
            except HTTPException:
                raise
            except Exception as e:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail=f"❌ Error detectando rostro: {str(e)}"
                )
            liveness_check = self._check_liveness(image_data)
            if not liveness_check["is_alive"]:
                security_level = liveness_check.get(
                    "security_level", "DESCONOCIDO")
                print(
                    f"[🚫 SEGURIDAD {security_level}] Liveness check fallido: {liveness_check['reason']}")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail=liveness_check['reason']
                )

            verification_result = self._compare_faces(image_data, user_images)

            if not verification_result["match"]:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="❌ El rostro no pertenece a este usuario. Acceso denegado."
                )

            return {
                "verified": True,
                "message": "✅ Identidad verificada. Login exitoso.",
                "confidence": verification_result["confidence"],
                "user_id": user_id
            }

        except HTTPException:
            raise
        except Exception as e:
            print(f"[ERROR] verify_face_for_login: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"❌ Error en verificación facial: {str(e)}"
            )

    def _compare_faces(self, image_data: bytes, registered_images: list) -> dict:
        try:
            if not registered_images or len(registered_images) == 0:
                print(
                    "[CRITICAL] VULNERABILIDAD: Se intentó comparar con lista vacía")
                return {
                    "match": False,
                    "confidence": 0,
                    "distance": 1.0,
                    "matched_images": 0,
                    "reason": "No hay imágenes registradas para comparar"
                }

            nparr = np.frombuffer(image_data, np.uint8)
            image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            if image is None:
                print("[ERROR] Imagen capturada es inválida")
                return {
                    "match": False,
                    "confidence": 0,
                    "distance": 1.0,
                    "matched_images": 0,
                    "reason": "Imagen inválida"
                }

            image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

            if face_recognition is None:
                return {
                    "match": False,
                    "confidence": 0,
                    "distance": 1.0,
                    "matched_images": 0,
                    "reason": "Face recognition no disponible"
                }

            try:
                current_face_encodings = face_recognition.face_encodings(
                    image_rgb)
                if not current_face_encodings:
                    print("[ERROR] No se pudo extraer encoding del rostro capturado")
                    return {
                        "match": False,
                        "confidence": 0,
                        "distance": 1.0,
                        "matched_images": 0,
                        "reason": "No se pudo extraer características del rostro"
                    }

                current_face_encoding = current_face_encodings[0]
            except Exception as e:
                print(
                    f"[ERROR] Error obteniendo encoding del rostro actual: {e}")
                return {
                    "match": False,
                    "confidence": 0,
                    "distance": 1.0,
                    "matched_images": 0,
                    "reason": f"Error procesando rostro: {str(e)}"
                }

            best_match = False
            best_distance = 1.0
            matched_count = 0
            match_details = []

            DISTANCE_THRESHOLD = 0.55
            CONFIDENCE_MIN = 35

            print(
                f"[LOG] Comparando rostro capturado con {len(registered_images)} imágenes registradas")

            for idx, registered_image_path in enumerate(registered_images):
                try:
                    registered_image = face_recognition.load_image_file(
                        registered_image_path)
                    registered_face_encodings = face_recognition.face_encodings(
                        registered_image)

                    if not registered_face_encodings:
                        print(
                            f"[WARN] No se pudo extraer encoding de imagen registrada #{idx + 1}")
                        continue

                    registered_face_encoding = registered_face_encodings[0]

                    distance = face_recognition.face_distance(
                        [registered_face_encoding],
                        current_face_encoding
                    )[0]

                    confidence = max(0, (1 - distance) * 100)

                    print(
                        f"[LOG] Imagen #{idx + 1}: distance={distance:.4f}, confidence={confidence:.1f}%")

                    match_details.append({
                        "image": registered_image_path,
                        "distance": float(distance),
                        "confidence": float(confidence),
                        "is_match": distance < DISTANCE_THRESHOLD
                    })

                    if distance < DISTANCE_THRESHOLD and confidence >= CONFIDENCE_MIN:
                        best_match = True
                        matched_count += 1
                        best_distance = min(best_distance, distance)
                        print(
                            f"[✓] COINCIDENCIA ENCONTRADA en imagen #{idx + 1} con confidence {confidence:.1f}%")

                except Exception as e:
                    print(
                        f"[ERROR] Error procesando imagen registrada #{idx + 1}: {e}")
                    continue

            if best_match and matched_count > 0:
                confidence = max(0, (1 - best_distance) * 100)
                print(
                    f"[✓✓✓] VERIFICACIÓN EXITOSA: {matched_count}/{len(registered_images)} imágenes coincidieron")
                return {
                    "match": True,
                    "confidence": float(confidence),
                    "distance": float(best_distance),
                    "matched_images": matched_count,
                    "total_images": len(registered_images),
                    "reason": f"Rostro coincide con {matched_count}/{len(registered_images)} imágenes registradas"
                }
            else:
                print(f"[✗✗✗] VERIFICACIÓN FALLIDA: Ninguna imagen coincidió")
                return {
                    "match": False,
                    "confidence": 0,
                    "distance": float(best_distance),
                    "matched_images": 0,
                    "total_images": len(registered_images),
                    "reason": f"El rostro no coincide con ninguna de las {len(registered_images)} imágenes registradas",
                    "details": match_details
                }

        except Exception as e:
            print(f"[CRITICAL ERROR] _compare_faces: {str(e)}")
            return {
                "match": False,
                "confidence": 0,
                "distance": 1.0,
                "matched_images": 0,
                "reason": f"Error crítico en comparación: {str(e)}"
            }

    def _check_liveness(self, image_data: bytes) -> dict:
        try:
            if not self.yolo_model:
                return {
                    "is_alive": True,
                    "reason": "YOLO no disponible - liveness check omitido",
                    "devices_detected": []
                }

            nparr = np.frombuffer(image_data, np.uint8)
            image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            if image is None:
                return {
                    "is_alive": False,
                    "reason": "❌ Imagen inválida",
                    "devices_detected": []
                }

            results = self.yolo_model(image, verbose=False)

            if not results or len(results) == 0:
                return {
                    "is_alive": True,
                    "reason": "✅ Sin objetos sospechosos detectados",
                    "devices_detected": []
                }

            device_classes = {
                62: "laptop",
                63: "tv",
                65: "remote",
                73: "book",
                74: "cell phone",
            }

            accessory_classes = {
                0: "person",
                27: "tie",
                28: "cake",
                29: "couch",
                30: "potted plant",
            }

            allowed_accessories = {
                37: "glasses",
                38: "sunglasses",
                39: "goggles",
            }

            suspicious_classes = {
                34: "bottle",
                35: "wine glass",
                36: "cup",
                42: "spoon",
                43: "bowl",
                44: "banana",
                45: "apple",
                47: "sandwich",
                48: "orange",
                50: "pizza",
                51: "donut",
                52: "cake",
            }

            detected_devices = []
            detected_accessories = []
            detected_suspicious = []
            detected_allowed_accessories = []
            device_detections = []

            print("[LOG] ========== ANÁLISIS YOLO ==========")

            for result in results:
                if result.boxes:
                    for box in result.boxes:
                        class_id = int(box.cls[0])
                        confidence = float(box.conf[0])

                        x1, y1, x2, y2 = box.xyxy[0]
                        box_width = float(x2 - x1)
                        box_height = float(y2 - y1)
                        box_area = box_width * box_height

                        img_height, img_width = image.shape[:2]
                        img_area = img_height * img_width
                        box_percentage = (box_area / img_area) * 100

                        if class_id in allowed_accessories:
                            accessory_name = allowed_accessories[class_id]
                            detected_allowed_accessories.append(accessory_name)
                            print(
                                f"[✅ PERMITIDO] {accessory_name.upper()} detectado - Aceptado")

                        elif class_id in device_classes:
                            device_name = device_classes[class_id]
                            detected_devices.append(device_name)
                            device_detections.append({
                                "type": device_name,
                                "confidence": float(confidence),
                                "size_percentage": round(box_percentage, 2),
                                "position": {
                                    "x1": float(x1), "y1": float(y1),
                                    "x2": float(x2), "y2": float(y2)
                                }
                            })
                            print(
                                f"[⚠️ DEVICE] {device_name.upper()} detectado con {confidence:.2%} confianza (ocupa {box_percentage:.1f}% de la imagen)")

                        elif class_id in accessory_classes:
                            accessory_name = accessory_classes[class_id]
                            detected_accessories.append(accessory_name)
                            print(f"[⚠️ ACCESORIO] {accessory_name} detectado")

                        elif class_id in suspicious_classes:
                            suspicious_name = suspicious_classes[class_id]
                            detected_suspicious.append(suspicious_name)
                            print(
                                f"[⚠️ SOSPECHOSO] {suspicious_name} detectado")

            print("[LOG] ====================================")

            if detected_devices:
                devices_str = ", ".join(detected_devices)
                print(
                    f"[❌ RECHAZO] Se detectó dispositivo de video: {devices_str}")
                return {
                    "is_alive": False,
                    "reason": f"❌ VERIFICACIÓN FALLIDA: Se detectó un dispositivo de pantalla ({devices_str}). El rostro debe presentarse directamente, no a través de una pantalla, teléfono, tablet o monitor.",
                    "devices_detected": device_detections,
                    "security_level": "CRÍTICO"
                }

            if len(detected_accessories) >= 2:
                accessories_str = ", ".join(detected_accessories)
                print(
                    f"[❌ RECHAZO] Múltiples accesorios detectados: {accessories_str}")
                return {
                    "is_alive": False,
                    "reason": f"❌ VERIFICACIÓN FALLIDA: Demasiados accesorios/objetos detectados ({accessories_str}). Presente su rostro sin accesorios adicionales.",
                    "devices_detected": [],
                    "security_level": "ALTO"
                }

            if detected_allowed_accessories and not detected_accessories and not detected_suspicious:
                glasses_str = ", ".join(detected_allowed_accessories)
                print(f"[✅ PERMITIDO] Rostro con lentes/gafas: {glasses_str}")
                return {
                    "is_alive": True,
                    "reason": f"✅ Verificación de liveness exitosa. Rostro con {glasses_str} aceptado.",
                    "devices_detected": [],
                    "security_level": "BAJO",
                    "note": f"Usuario lleva {glasses_str}"
                }

            if detected_suspicious or detected_accessories:
                warnings = detected_suspicious + detected_accessories
                if detected_allowed_accessories:
                    warnings.extend(detected_allowed_accessories)
                warnings_str = ", ".join(warnings)
                print(f"[⚠️ ADVERTENCIA] Objetos detectados: {warnings_str}")
                return {
                    "is_alive": True,
                    "reason": f"⚠️ ADVERTENCIA: Se detectaron objetos ({warnings_str}). Imagen aceptada pero verificada con objetos presentes.",
                    "devices_detected": [],
                    "security_level": "MEDIO",
                    "warnings": warnings
                }

            return {
                "is_alive": True,
                "reason": "✅ Verificación de liveness exitosa. Rostro válido detectado.",
                "devices_detected": [],
                "security_level": "BAJO"
            }

        except Exception as e:
            print(f"[ERROR] Error en _check_liveness: {e}")
            return {
                "is_alive": False,
                "reason": f"❌ Error en verificación de liveness: {str(e)}",
                "devices_detected": [],
                "security_level": "ERROR"
            }

    def check_facial_uniqueness(self, image_data: bytes, exclude_user_id: str = None) -> dict:
        try:
            if not self.FACIAL_DATA_DIR.exists():
                return {
                    "is_unique": True,
                    "message": "No hay usuarios registrados aún",
                    "matched_user_id": None,
                    "confidence": 0
                }

            nparr = np.frombuffer(image_data, np.uint8)
            image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            if image is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Imagen inválida"
                )

            image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

            try:
                current_face_encodings = face_recognition.face_encodings(
                    image_rgb)
                if not current_face_encodings:
                    raise Exception(
                        "No se detectó un rostro válido en la imagen")
                current_encoding = current_face_encodings[0]
            except Exception as e:
                return {
                    "is_unique": False,
                    "message": f"Error procesando imagen: {str(e)}",
                    "matched_user_id": None,
                    "confidence": 0
                }

            for user_dir in self.FACIAL_DATA_DIR.iterdir():
                if not user_dir.is_dir():
                    continue

                user_id_dir = user_dir.name

                if exclude_user_id and user_id_dir == exclude_user_id:
                    continue

                user_images = list(user_dir.glob("face_*.jpg"))

                if not user_images:
                    continue

                registered_image_path = user_images[0]

                try:
                    registered_image = face_recognition.load_image_file(
                        str(registered_image_path))
                    registered_encodings = face_recognition.face_encodings(
                        registered_image)

                    if not registered_encodings:
                        continue

                    registered_encoding = registered_encodings[0]

                    distance = np.linalg.norm(
                        current_encoding - registered_encoding)

                    DISTANCE_THRESHOLD = 0.6
                    if distance < DISTANCE_THRESHOLD:
                        confidence = max(0, (1 - distance) * 100)
                        return {
                            "is_unique": False,
                            "message": f"El rostro ya está registrado por otro usuario",
                            "matched_user_id": user_id_dir,
                            "confidence": round(confidence, 2)
                        }

                except Exception as e:
                    print(
                        f"[WARN] Error comparando con usuario {user_id_dir}: {str(e)}")
                    continue

            return {
                "is_unique": True,
                "message": "El rostro es único en el sistema",
                "matched_user_id": None,
                "confidence": 0
            }

        except HTTPException:
            raise
        except Exception as e:
            print(f"[ERROR] check_facial_uniqueness: {str(e)}")
            return {
                "is_unique": False,
                "message": f"Error verificando unicidad del rostro: {str(e)}",
                "matched_user_id": None,
                "confidence": 0
            }
