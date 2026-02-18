import base64
import os
import time
from typing import Optional, Tuple
from loguru import logger
from as608 import AS608


class FingerprintDevice:
    def __init__(self, serial_port: str, baudrate: int = 57600, password: int = 0x00000000, address: int = 0xFFFFFFFF):
        self.serial_port = serial_port
        self.baudrate = baudrate
        self.password = password
        self.address = address
        self.device: Optional[AS608] = None

    def connect(self) -> None:
        logger.info(
            f"Connecting to AS608 on {self.serial_port} at {self.baudrate} baud...")
        self.device = AS608(self.serial_port, self.baudrate,
                            address=self.address, password=self.password)
        if not self.device.verifyPassword():
            raise RuntimeError("Failed to verify AS608 password")
        logger.info("AS608 connected and password verified")

    def ensure_connected(self) -> None:
        if self.device is None:
            self.connect()

    def _wait_for_finger(self, timeout: float = 10.0) -> bool:
        start = time.time()
        while time.time() - start < timeout:
            if self.device.getImage() == self.device.OK:
                return True
            time.sleep(0.2)
        return False

    def enroll(self, template_id: Optional[int] = None) -> Tuple[int, Optional[int], Optional[str]]:
        self.ensure_connected()

        if not self._wait_for_finger():
            raise RuntimeError("No finger detected in time (step 1)")
        if self.device.image2Tz(1) != self.device.OK:
            raise RuntimeError("Failed to convert image (buf1)")

        logger.info("Remove finger")
        time.sleep(1.5)

        if not self._wait_for_finger():
            raise RuntimeError("No finger detected in time (step 2)")
        if self.device.image2Tz(2) != self.device.OK:
            raise RuntimeError("Failed to convert image (buf2)")

        if self.device.createModel() != self.device.OK:
            raise RuntimeError("Failed to create fingerprint model")

        if template_id is None:
            template_id = self.device.getTemplateCount()
            logger.info(f"Selected next template slot: {template_id}")

        if self.device.storeModel(template_id) != self.device.OK:
            raise RuntimeError("Failed to store template on sensor")

        # Extract template bytes for optional external storage
        char_packet = self.device.getModel()
        template_b64 = base64.b64encode(char_packet).decode(
            "ascii") if char_packet else None

        confidence = None
        return template_id, confidence, template_b64

    def search(self) -> Tuple[bool, Optional[int], Optional[int]]:
        self.ensure_connected()

        if not self._wait_for_finger():
            raise RuntimeError("No finger detected")
        if self.device.getImage() != self.device.OK:
            raise RuntimeError("Failed to capture image")
        if self.device.image2Tz(1) != self.device.OK:
            raise RuntimeError("Failed to convert image (buf1)")

        result = self.device.searchTemplate()
        if result[0] == self.device.OK:
            position_number = result[1]
            score = result[2]
            return True, position_number, score
        if result[0] == self.device.NOTFOUND:
            return False, None, None
        raise RuntimeError("Search failed")

    def delete(self, template_id: int) -> None:
        self.ensure_connected()
        if self.device.deleteModel(template_id) != self.device.OK:
            raise RuntimeError(f"Failed to delete template {template_id}")


def build_device_from_env() -> FingerprintDevice:
    serial_port = os.getenv("SERIAL_PORT", "COM3")
    baudrate = int(os.getenv("BAUDRATE", "57600"))
    password = int(os.getenv("SENSOR_PASSWORD", "0"), 16) if isinstance(
        os.getenv("SENSOR_PASSWORD"), str) else int(os.getenv("SENSOR_PASSWORD", 0))
    address = int(os.getenv("SENSOR_ADDRESS", "0xFFFFFFFF"), 16)
    return FingerprintDevice(serial_port=serial_port, baudrate=baudrate, password=password, address=address)
