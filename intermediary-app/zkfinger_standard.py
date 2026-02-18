"""
Manejo del SDK descargado, (ya no tenemos muchos usos sobre el SDK debido a el uso de la libreria nativa pykdft)
"""

import ctypes
import os
import sys
from typing import Tuple, Optional, List

try:
    from loguru import logger
    HAS_LOGGER = True
except ImportError:
    HAS_LOGGER = False

    class SimpleLogger:
        def info(self, msg):
            print(f"[INFO] {msg}")

        def debug(self, msg):
            print(f"[DEBUG] {msg}")

        def warning(self, msg):
            print(f"[WARNING] {msg}")

        def error(self, msg):
            print(f"[ERROR] {msg}")
    logger = SimpleLogger()

# Rutas posibles para la DLL
SDK_DLL_PATHS = [
    os.path.join(os.path.dirname(__file__), "libzkfp.dll"),
    r"C:\Users\alexi\Downloads\9774a946c3f659ddf2ae90bc8dadc3eb\ZKFingerSDK_Windows_Standard\ZKFinger Standard SDK 5.3.0.33\c\libs\x64lib\libzkfp.dll",
    "libzkfp.dll",
]

# Intentar cargar la DLL
_libzkfp = None
SDK_AVAILABLE = False
DLL_PATH_USED = None

for dll_path in SDK_DLL_PATHS:
    try:
        if os.path.exists(dll_path):
            _libzkfp = ctypes.CDLL(dll_path)
            SDK_AVAILABLE = True
            DLL_PATH_USED = dll_path
            logger.info(f"ZKFinger Standard SDK cargado desde: {dll_path}")
            break
    except Exception as e:
        logger.debug(f"Intento fallido en {dll_path}: {e}")
        continue

if not SDK_AVAILABLE:
    try:
        _libzkfp = ctypes.CDLL("libzkfp.dll")
        SDK_AVAILABLE = True
        DLL_PATH_USED = "libzkfp.dll (PATH del sistema)"
        logger.info("ZKFinger Standard SDK cargado desde PATH del sistema")
    except Exception as e:
        logger.warning(
            f"No se pudo cargar ZKFinger Standard SDK desde ninguna ruta. "
            f"Rutas intentadas: {SDK_DLL_PATHS}. Error: {e}"
        )


class ZKFingerStandard:

    def __init__(self):
        if not SDK_AVAILABLE:
            logger.error("ZKFinger Standard SDK no está disponible")
            raise RuntimeError(
                "ZKFinger Standard SDK no disponible. "
                "Asegúrate de que libzkfp.dll esté en la carpeta intermediary-app "
                "o en el PATH del sistema."
            )
        self._hdb_cache = None
        self._is_initialized = False
        self._init_lock = False

    def initialize(self) -> None:
        """Inicializa el SDK (o reutiliza contexto existente de pyzkfp)."""
        if self._is_initialized:
            logger.debug("SDK ya está inicializado")
            return

        try:
            ret = _libzkfp.ZKFPM_Init()
            if ret not in (0, 1):
                raise RuntimeError(f"ZKFPM_Init falló: código {ret}")

            logger.debug(
                f"ZKFPM_Init retornó {ret} (0=nuevo, 1=ya inicializado por pyzkfp)")
            self._is_initialized = True

            self._hdb_cache = _libzkfp.ZKFPM_CreateDBCache()
            if not self._hdb_cache:
                raise RuntimeError("ZKFPM_CreateDBCache falló")
            logger.debug("DB cache creada")
        except Exception as exc:
            logger.warning(f"No se pudo inicializar SDK: {exc}")
            self._is_initialized = False

    def terminate(self) -> None:
        try:
            if self._hdb_cache:
                _libzkfp.ZKFPM_CloseDBCache(self._hdb_cache)
                self._hdb_cache = None
            if self._is_initialized:
                ret = _libzkfp.ZKFPM_Terminate()
                if ret != 0:
                    logger.warning(f"ZKFPM_Terminate retornó: {ret}")
            logger.info("ZKFinger Standard SDK cerrado")
            self._is_initialized = False
        except Exception as exc:
            logger.error(f"Cierre falló: {exc}")

    def match_finger(self, template_a: bytes, template_b: bytes) -> int:
        if not self._is_initialized:
            logger.debug("SDK no inicializado, intentando inicializar...")
            try:
                self.initialize()
            except Exception as exc:
                logger.error(f"Inicialización automática falló: {exc}")
                return 0

        if not self._hdb_cache:
            logger.error("DB cache no disponible")
            return 0

        if len(template_a) < 10000:
            if not self._is_initialized:
                logger.debug("SDK no inicializado, intentando inicializar...")
                try:
                    self.initialize()
                except Exception as exc:
                    logger.error(f"Inicialización automática falló: {exc}")
                    return 0

            if not self._hdb_cache:
                logger.error("DB cache no disponible")
                return 0

            try:
                score = _libzkfp.ZKFPM_MatchFinger(
                    self._hdb_cache,
                    ctypes.c_char_p(template_a),
                    ctypes.c_uint(len(template_a)),
                    ctypes.c_char_p(template_b),
                    ctypes.c_uint(len(template_b))
                )
                if score > 0:
                    logger.debug(f"SDK Match score: {score}")
                    return max(0, min(100, int(score)))
            except Exception as exc:
                logger.debug(f"ZKFPM_MatchFinger falló: {exc}")

        matching_bits = 0
        total_bits = len(template_a) * 8
        for byte_a, byte_b in zip(template_a, template_b):
            xor_byte = byte_a ^ byte_b
            matching_bits += 8 - bin(xor_byte).count('1')

        if total_bits > 0:
            similarity_pct = (matching_bits * 100) // total_bits
            return max(0, min(100, similarity_pct))
        return 0

    def gen_reg_template(
        self, template1: bytes, template2: bytes, template3: bytes
    ) -> bytes:
        if not self._is_initialized:
            logger.debug(
                "SDK no inicializado, intentando inicializar para gen_reg_template...")
            try:
                self.initialize()
            except Exception as exc:
                logger.warning(
                    f"Auto-inicialización falló: {exc}, usando template1 como fallback")
                return template1

        if not self._hdb_cache:
            logger.warning(
                "DB cache no disponible, usando template1 como fallback")
            return template1

        try:
            cb1 = len(template1)
            cb2 = len(template2)
            cb3 = len(template3)

            if cb1 == 0 or cb2 == 0 or cb3 == 0:
                logger.warning("Uno o más templates vacíos, usando template1")
                return template1

            reg_template = ctypes.create_string_buffer(4096)
            cb_reg = ctypes.c_uint(4096)

            ret = _libzkfp.ZKFPM_GenRegTemplate(
                self._hdb_cache,
                ctypes.c_char_p(template1),
                ctypes.c_char_p(template2),
                ctypes.c_char_p(template3),
                reg_template,
                ctypes.byref(cb_reg)
            )

            if ret == 0 and cb_reg.value > 0:
                result = bytes(reg_template[:cb_reg.value])
                logger.info(
                    f"ZKFPM_GenRegTemplate éxito: {cb1}+{cb2}+{cb3} -> {cb_reg.value} bytes")
                return result
            else:
                logger.warning(
                    f"ZKFPM_GenRegTemplate error: ret={ret}, cb_reg={cb_reg.value}; intentando fallback")

                try:
                    score12 = self.match_finger(template1, template2)
                    score13 = self.match_finger(template1, template3)
                    score23 = self.match_finger(template2, template3)

                    logger.debug(
                        f"Fallback bit-scores: 1-2={score12}%, 1-3={score13}%, 2-3={score23}%")
                    t1_avg = (score12 + score13) // 2
                    t2_avg = (score12 + score23) // 2
                    t3_avg = (score13 + score23) // 2

                    logger.debug(
                        f"Template averages: T1={t1_avg}%, T2={t2_avg}%, T3={t3_avg}%")

                    if t1_avg >= t2_avg and t1_avg >= t3_avg:
                        logger.info(
                            f"Fallback: template1 más representativo (avg={t1_avg}%)")
                        return template1
                    elif t2_avg >= t3_avg:
                        logger.info(
                            f"Fallback: template2 más representativo (avg={t2_avg}%)")
                        return template2
                    else:
                        logger.info(
                            f"Fallback: template3 más representativo (avg={t3_avg}%)")
                        return template3
                except Exception as fb_exc:
                    logger.warning(
                        f"Fallback comparativo también falló: {fb_exc}, usando template1")
                    return template1

        except Exception as exc:
            logger.error(
                f"ZKFPM_GenRegTemplate excepción: {exc}, usando template1")
            return template1

    def identify(
        self, probe_template: bytes, candidate_templates: List[bytes]
    ) -> Tuple[bool, Optional[int]]:
        best_score = 0
        for cand in candidate_templates:
            score = self.match_finger(probe_template, cand)
            if score > best_score:
                best_score = score

        return (best_score > 0, best_score if best_score > 0 else None)


_global_standard_driver: Optional[ZKFingerStandard] = None


def get_standard_driver() -> Optional[ZKFingerStandard]:
    global _global_standard_driver

    if not SDK_AVAILABLE:
        return None

    if _global_standard_driver is None:
        try:
            _global_standard_driver = ZKFingerStandard()
            _global_standard_driver.initialize()
            logger.debug("SDK estándar inicializado")
        except Exception:
            return None

    return _global_standard_driver if _global_standard_driver._is_initialized else None
