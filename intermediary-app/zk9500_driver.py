"""
Driver wrapper para el lector ZKTeco ZK9500.

Nota: Manejo del SDK estándar y el nativo como libreria de python.
"""
import base64
import threading
import time
from typing import List, Optional, Tuple
from loguru import logger

try:
    from zkfinger_standard import get_standard_driver, SDK_AVAILABLE as STANDARD_SDK_AVAILABLE, DLL_PATH_USED
    if STANDARD_SDK_AVAILABLE:
        logger.info(f"SDK estándar disponible desde: {DLL_PATH_USED}")
    else:
        logger.warning("SDK estándar no disponible en ninguna ubicación")
except Exception as exc:  # noqa: BLE001
    logger.warning(f"Error importando zkfinger_standard: {exc}")
    STANDARD_SDK_AVAILABLE = False
    get_standard_driver = None
    DLL_PATH_USED = None

try:
    import pyzkfp as zkfp  # tipo: ignore
    try:
        from pyzkfp._construct.errors_handler import DeviceNotInitializedError  # type: ignore
    except Exception:  # noqa: BLE001
        DeviceNotInitializedError = None
except Exception as exc:  # noqa: BLE001
    zkfp = None
    DeviceNotInitializedError = None
    logger.warning(
        "SDK ZK9500 (pyzkfp) no disponible. Instala con `pip install pyzkfp`.")


class ZK9500Driver:
    def __init__(self):
        self._device = None
        self._lock = threading.Lock()

    @staticmethod
    def _resolve_device_class():
        if zkfp is None:
            return None
        for candidate in ("ZKFP", "ZKFP2", "FingerprintSensor", "FingerPrint", "Finger"):
            if hasattr(zkfp, candidate):
                return getattr(zkfp, candidate)
        logger.error(
            f"No se encontró clase de dispositivo en pyzkfp. Miembros: {dir(zkfp)}")
        return None

    def _open_device(self) -> None:
        if not self._device:
            raise RuntimeError("Instancia de dispositivo no creada")
        if hasattr(self._device, "OpenDevice"):
            ret_open = None
            try:
                try:
                    ret_open = self._device.OpenDevice(0)
                except TypeError:
                    ret_open = self._device.OpenDevice()
            except Exception as exc:  # noqa: BLE001
                logger.error(f"OpenDevice lanzó excepción: {exc}")
                raise
            try:
                if ret_open not in (0, None):
                    logger.warning(
                        f"OpenDevice retorno inesperado: {ret_open}, continuando")
            except Exception:
                # Algunos bindings devuelven punteros/IntPtr que no permiten comparación directa
                logger.warning(
                    f"OpenDevice retorno tipo no comparable: {type(ret_open)}; continuando")
            logger.info(f"ZK9500 OpenDevice llamado. Retorno: {ret_open}")
        else:
            logger.warning(
                "pyzkfp no expone OpenDevice; asumiendo abierto tras Init().")

    def connect(self) -> None:
        if zkfp is None:
            raise RuntimeError("SDK ZK9500 no instalado (pyzkfp)")
        with self._lock:
            device_cls = self._resolve_device_class()
            if device_cls is None:
                raise RuntimeError(
                    "pyzkfp instalado pero no expone clase ZKFP/ZKFP2")
            self._device = device_cls()
            ret = None
            try:
                ret = self._device.Init()
            except Exception as exc:  # noqa: BLE001
                logger.error(f"Init() lanzó excepción: {exc}")
                raise

            if ret not in (0, None):
                raise RuntimeError(
                    f"No se pudo inicializar ZK9500. Código: {ret}")
            logger.info(f"ZK9500 inicializado (pyzkfp). Init retornó: {ret}")
            self._open_device()

    def close(self) -> None:
        with self._lock:
            if self._device:
                try:
                    if hasattr(self._device, "CloseDevice"):
                        try:
                            self._device.CloseDevice(0)
                        except TypeError:
                            self._device.CloseDevice()
                except Exception:
                    pass
                try:
                    self._device.Terminate()
                except Exception:
                    pass
                self._device = None
                logger.info("ZK9500 cerrado")

    def ensure_connected(self) -> None:
        if self._device is None:
            self.connect()

    def is_ready(self) -> bool:
        try:
            self.ensure_connected()
            return True
        except Exception as exc:
            logger.warning(f"ZK9500 no listo: {exc}")
            return False

    def _acquire_once(self, timeout_ms: int):
        try:
            return self._device.AcquireFingerprint(timeout_ms)
        except TypeError:
            # Algunos bindings no aceptan timeout
            return self._device.AcquireFingerprint()

    def capture(self, timeout_ms: int = 5000, retries: int = 20, delay: float = 0.5) -> Tuple[bytes, int]:
        self.ensure_connected()
        with self._lock:
            last_error = None
            for attempt in range(1, retries + 1):
                try:
                    result = self._acquire_once(timeout_ms)
                except Exception as exc:
                    if DeviceNotInitializedError and isinstance(exc, DeviceNotInitializedError):
                        logger.debug(
                            "DeviceNotInitializedError: reintentando tras reconectar...")
                        self.close()
                        time.sleep(0.2)
                        self.connect()
                        time.sleep(0.2)
                        continue
                    else:
                        raise

                if result is None:
                    last_error = "None"
                    if attempt % 5 == 0:
                        logger.debug(
                            f"Esperando dedo... ({attempt}/{retries})")
                    time.sleep(delay)
                    continue

                fp_image = fp_template = None
                ret = 0
                if isinstance(result, tuple):
                    if len(result) == 4:
                        ret, fp_image, fp_template, _ = result
                    elif len(result) == 3:
                        fp_image, fp_template, _ = result
                    elif len(result) == 2:
                        fp_image, fp_template = result
                    else:
                        raise RuntimeError(
                            f"Firma inesperada de AcquireFingerprint: len={len(result)}")
                else:
                    raise RuntimeError(
                        f"Firma inesperada de AcquireFingerprint (no es tupla): {type(result)}")

                if ret not in (0, None):
                    raise RuntimeError(
                        f"No se pudo capturar huella. Código: {ret}")
                if fp_image is None or fp_template is None:
                    last_error = "No datos"
                    if attempt % 5 == 0:
                        logger.debug(
                            f"Datos incompletos... ({attempt}/{retries})")
                    time.sleep(delay)
                    continue

                template_bytes = bytes(fp_template)

                logger.info(
                    f"[CAPTURE] Template completo: {len(template_bytes)} bytes (contiene imagen + datos biométricos)")
                quality = 0
                try:
                    if hasattr(self._device, "GetQuality"):
                        q = self._device.GetQuality(fp_image)
                        quality = int(q) if q else 0
                    elif hasattr(self._device, "GetImageQuality"):
                        q = self._device.GetImageQuality(fp_image)
                        quality = int(q) if q else 0
                except Exception:
                    pass

                if quality == 0:
                    quality = 75

                return template_bytes, quality

            raise RuntimeError(
                f"AcquireFingerprint falló tras {retries} intentos (último error: {last_error})")

    def match(self, template_a: bytes, template_b: bytes) -> int:
        self.ensure_connected()
        with self._lock:
            # Validación básica
            if len(template_a) != len(template_b):
                logger.warning(
                    f"[MATCH] Tamaños diferentes: {len(template_a)} vs {len(template_b)}")
                return 0

            if len(template_a) == 0:
                logger.warning("[MATCH] Templates vacíos")
                return 0

            BIOMETRIC_OFFSET = 50000

            if len(template_a) >= BIOMETRIC_OFFSET and len(template_b) >= BIOMETRIC_OFFSET:
                # Extraer datos biométricos completos
                biom_a = template_a[BIOMETRIC_OFFSET:]
                biom_b = template_b[BIOMETRIC_OFFSET:]

                # Comparar bit a bit para máxima precisión
                matching_bits = 0
                total_bits = len(biom_a) * 8
                for byte_a, byte_b in zip(biom_a, biom_b):
                    xor_byte = byte_a ^ byte_b
                    matching_bits += 8 - bin(xor_byte).count('1')

                similarity_pct = (
                    matching_bits * 100) // total_bits if total_bits > 0 else 0

                logger.info(
                    f"[MATCH] Biometric features (bytes {BIOMETRIC_OFFSET}-{len(template_a)}): "
                    f"{matching_bits}/{total_bits} bits = {similarity_pct}%")

                if similarity_pct > 60:
                    logger.info(
                        f"[MATCH] Score {similarity_pct}% > 60% threshold ✓ VÁLIDO")
                    return max(0, min(100, similarity_pct))
                else:
                    logger.warning(
                        f"[MATCH] Score {similarity_pct}% <= 60% threshold ✗ RECHAZADO")
                    return 0
            if self._device:
                for method_name in ("Identify", "IdentifyTemplate", "MatchFingerprint", "MatchTemplate", "Match", "Verify"):
                    try:
                        if hasattr(self._device, method_name):
                            method = getattr(self._device, method_name)
                            result = method(template_a, template_b)
                            score = None

                            if isinstance(result, (int, float)):
                                score = int(result)
                            elif isinstance(result, bool):
                                score = 100 if result else 0
                            elif isinstance(result, tuple) and result:
                                for val in result:
                                    if isinstance(val, (int, float)):
                                        score = int(val)
                                        break

                            if score is not None and score >= 0:
                                logger.info(
                                    f"[MATCH] Dispositivo.{method_name}() = {score}")
                                return max(0, min(100, score))
                    except Exception as exc:
                        logger.debug(f"[MATCH] {method_name} falló: {exc}")

            matching_bits = 0
            total_bits = len(template_a) * 8

            for byte_a, byte_b in zip(template_a, template_b):
                # Contar bits matching usando XOR
                xor_byte = byte_a ^ byte_b
                matching_bits += 8 - bin(xor_byte).count('1')

            if total_bits > 0:
                similarity_pct = (matching_bits * 100) // total_bits
                logger.warning(
                    f"[MATCH] Fallback bit-comparison: {matching_bits}/{total_bits} bits = {similarity_pct}%")
                return max(0, min(100, similarity_pct))

            return 0

    def identify(self, probe_template: bytes, candidates: List[bytes]) -> Tuple[bool, Optional[int]]:
        best = -1
        scores = []
        for idx, cand in enumerate(candidates):
            score = self.match(probe_template, cand)
            scores.append(score)
            if score > best:
                best = score
            logger.debug(
                f"[IDENTIFY] Candidato {idx+1}/{len(candidates)}: score={score}")
        logger.info(f"[IDENTIFY] Scores totales: {scores}, máximo={best}")
        return (best >= 0, best if best >= 0 else None)

    @staticmethod
    def to_base64(template: bytes) -> str:
        return base64.b64encode(template).decode("ascii")

    @staticmethod
    def from_base64(b64: str) -> bytes:
        return base64.b64decode(b64.encode("ascii"))


def build_driver() -> ZK9500Driver:
    return ZK9500Driver()
