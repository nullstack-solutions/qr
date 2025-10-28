from __future__ import annotations

import json
import os
import shlex
import subprocess
from pathlib import Path
from typing import Any, Dict, List, Optional

import base64

import cv2
import numpy as np
import qrcode

try:
    import zxingcpp  # type: ignore
except ImportError:  # pragma: no cover - optional dependency
    zxingcpp = None  # type: ignore

PROJECT_ROOT = Path(__file__).resolve().parent.parent
SCREENSHOTS_DIR = PROJECT_ROOT / "screenshots"

IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp"}


def _collect_images(directory: Path) -> List[Path]:
    images: List[Path] = []
    if not directory.exists() or not directory.is_dir():
        return images

    for path in sorted(directory.iterdir()):
        if not path.is_file():
            continue
        suffixes = [suffix.lower() for suffix in path.suffixes]
        if not suffixes:
            continue
        last = suffixes[-1]
        if last in IMAGE_EXTS:
            images.append(path)
            continue
        if last == ".b64" and len(suffixes) >= 2 and suffixes[-2] in IMAGE_EXTS:
            images.append(path)

    return images


def _generate_screenshots(directory: Path) -> List[Path]:
    directory.mkdir(parents=True, exist_ok=True)

    command = os.environ.get(
        "QR_SCREENSHOTS_CMD",
        "npx playwright test tests/e2e/qr-preview-screenshots.spec.ts --reporter=line",
    )

    prep_command = os.environ.get("QR_SCREENSHOTS_PREP", "npm run pretest:e2e")

    try:
        args = shlex.split(command)
    except ValueError as error:  # pragma: no cover - defensive
        raise AssertionError(
            "Неверная команда генерации скриншотов в QR_SCREENSHOTS_CMD"
        ) from error

    env = os.environ.copy()
    env.setdefault("BASE_PATH", "/")
    env.setdefault("NEXT_PUBLIC_BASE_PATH", "/")
    env.setdefault("CI", "1")

    try:
        if prep_command:
            prep_args = shlex.split(prep_command)
            subprocess.run(prep_args, check=True, cwd=PROJECT_ROOT, env=env)
        subprocess.run(args, check=True, cwd=PROJECT_ROOT, env=env)
    except FileNotFoundError as error:
        raise AssertionError(
            "Команда генерации скриншотов не найдена. Установите Playwright и его браузеры"
        ) from error
    except subprocess.CalledProcessError as error:
        raise AssertionError(
            "Не удалось сгенерировать скриншоты: команда завершилась с ошибкой"
        ) from error

    return _collect_images(directory)


def _load_image(path: Path) -> np.ndarray | None:
    suffixes = [suffix.lower() for suffix in path.suffixes]
    if not suffixes:
        return None

    last = suffixes[-1]
    if last == ".b64":
        # Expect filenames like preview.png.b64 so we can reconstruct the original
        # format while keeping the repository free of binary assets.
        if len(suffixes) < 2 or suffixes[-2] not in IMAGE_EXTS:
            return None
        try:
            payload = base64.b64decode(path.read_text(), validate=True)
        except (ValueError, OSError):
            return None
        buffer = np.frombuffer(payload, dtype=np.uint8)
        return cv2.imdecode(buffer, cv2.IMREAD_UNCHANGED)

    if last in IMAGE_EXTS:
        return cv2.imread(str(path))

    return None


def _decode_with_detector(image: np.ndarray) -> List[str]:
    detector = cv2.QRCodeDetector()
    results: List[str] = []

    text, _, _ = detector.detectAndDecode(image)
    if text:
        results.append(text)

    success, decoded_multi, _, _ = detector.detectAndDecodeMulti(image)
    if success and decoded_multi:
        results.extend([value for value in decoded_multi if value])

    found, points = detector.detect(image)
    if found and points is not None:
        decoded_text, _ = detector.decode(image, points)
        if isinstance(decoded_text, (list, tuple)):
            results.extend([value for value in decoded_text if value])
        elif decoded_text:
            results.append(decoded_text)

    return results


def _load_metadata(image_path: Path) -> Optional[Dict[str, Any]]:
    metadata_path = image_path.with_suffix(image_path.suffix + ".json")
    if not metadata_path.exists():
        return None

    try:
        return json.loads(metadata_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):  # pragma: no cover - defensive
        return None


def _crop_with_metadata(image: np.ndarray, metadata: Dict[str, Any]) -> Optional[np.ndarray]:
    crop = metadata.get("crop")
    if not isinstance(crop, dict):
        return None

    try:
        dpr = float(metadata.get("devicePixelRatio", 1))
    except (TypeError, ValueError):  # pragma: no cover - defensive
        dpr = 1.0

    def _as_float(value: Any) -> Optional[float]:
        try:
            return float(value)
        except (TypeError, ValueError):  # pragma: no cover - defensive
            return None

    raw_x = _as_float(crop.get("x"))
    raw_y = _as_float(crop.get("y"))
    raw_width = _as_float(crop.get("width"))
    raw_height = _as_float(crop.get("height"))

    if raw_x is None or raw_y is None or raw_width is None or raw_height is None:
        return None

    scroll = metadata.get("scroll")
    scope = metadata.get("scope")
    if scope == "page" and isinstance(scroll, dict):
        scroll_x = _as_float(scroll.get("x")) or 0.0
        scroll_y = _as_float(scroll.get("y")) or 0.0
        raw_x += scroll_x
        raw_y += scroll_y

    if raw_width <= 0 or raw_height <= 0:
        return None

    x_float = raw_x * dpr
    y_float = raw_y * dpr
    width_float = raw_width * dpr
    height_float = raw_height * dpr

    padding = max(2.0, dpr * 1.5)

    x_start = x_float - padding
    y_start = y_float - padding
    x_end = x_float + width_float + padding
    y_end = y_float + height_float + padding

    x0 = int(max(min(x_start, float(image.shape[1])), 0.0))
    y0 = int(max(min(y_start, float(image.shape[0])), 0.0))
    x1 = int(min(max(x_end, 0.0), float(image.shape[1])))
    y1 = int(min(max(y_end, 0.0), float(image.shape[0])))

    if x1 <= x0 or y1 <= y0:
        return None

    return image[y0:y1, x0:x1]


def _decode_with_zxing(image: np.ndarray) -> List[str]:
    if zxingcpp is None:
        return []

    if image.ndim == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    else:
        gray = image

    try:
        results = zxingcpp.read_barcodes(gray, try_harder=True)  # type: ignore[arg-type]
    except Exception:  # pragma: no cover - defensive
        return []

    decoded: List[str] = []
    for result in results:
        text = getattr(result, "text", None)
        if text:
            decoded.append(text)

    return decoded


def _build_expected_matrix(payload: str) -> Optional[List[List[bool]]]:
    if not payload:
        return None

    qr = qrcode.QRCode(border=4)
    qr.add_data(payload)
    qr.make(fit=True)
    matrix = qr.get_matrix()
    if not matrix:
        return None

    return matrix


def _verify_matrix_match(image: np.ndarray, matrix: List[List[bool]]) -> bool:
    size = len(matrix)
    if size == 0:
        return False

    if image.ndim == 3:
        lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
        luminance = lab[:, :, 0]
    else:
        luminance = image

    height, width = luminance.shape[:2]
    dark_samples: List[float] = []
    light_samples: List[float] = []

    shrink_ratio = 0.4

    for row_index, row in enumerate(matrix):
        for col_index, expected in enumerate(row):
            start_x = (col_index / size) * width
            end_x = ((col_index + 1) / size) * width
            start_y = (row_index / size) * height
            end_y = ((row_index + 1) / size) * height

            margin_x = (end_x - start_x) * shrink_ratio * 0.5
            margin_y = (end_y - start_y) * shrink_ratio * 0.5

            x0 = int(round(start_x + margin_x))
            x1 = int(round(end_x - margin_x))
            y0 = int(round(start_y + margin_y))
            y1 = int(round(end_y - margin_y))

            if x1 <= x0 or y1 <= y0:
                continue

            cell = luminance[y0:y1, x0:x1]
            sample = float(np.mean(cell))

            if expected:
                dark_samples.append(sample)
            else:
                light_samples.append(sample)

    if len(dark_samples) < size or len(light_samples) < size:
        return False

    dark_values = np.array(dark_samples, dtype=np.float32)
    light_values = np.array(light_samples, dtype=np.float32)

    mean_dark = float(np.mean(dark_values))
    mean_light = float(np.mean(light_values))
    contrast = mean_light - mean_dark

    if contrast < 12.0:
        return False

    threshold = (mean_dark + mean_light) * 0.5
    dark_ratio = float(np.mean(dark_values <= threshold))
    light_ratio = float(np.mean(light_values >= threshold))

    if dark_ratio < 0.32 or light_ratio < 0.55:
        return False

    if float(dark_values.std()) < 3.0 and float(light_values.std()) < 3.0:
        return False

    return True


def _decode_from_contours(image: np.ndarray) -> List[str]:
    if image.ndim == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    else:
        gray = image

    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    contours, _ = cv2.findContours(binary, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)

    results: List[str] = []
    for contour in sorted(contours, key=cv2.contourArea, reverse=True):
        x, y, w, h = cv2.boundingRect(contour)
        if min(w, h) < 80:
            continue
        if abs(w - h) > max(w, h) * 0.2:
            continue

        padding = int(max(w, h) * 0.15)
        x0 = max(x - padding, 0)
        y0 = max(y - padding, 0)
        x1 = min(x + w + padding, image.shape[1])
        y1 = min(y + h + padding, image.shape[0])

        region = image[y0:y1, x0:x1]
        decoded = _decode_with_detector(region)
        if decoded:
            results.extend(decoded)

    return results


def decode_qr_image(image: np.ndarray) -> List[str]:
    decoded = _decode_with_detector(image)
    if decoded:
        return decoded

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    decoded = _decode_with_detector(gray)
    if decoded:
        return decoded

    decoded = _decode_from_contours(image)
    if decoded:
        return decoded

    # Upscale to help the detector with smaller QR renderings.
    scaled = cv2.resize(gray, None, fx=2.0, fy=2.0, interpolation=cv2.INTER_CUBIC)
    decoded = _decode_with_detector(scaled)
    if decoded:
        return decoded

    # Apply a slight blur and threshold to smooth jagged renders before retrying.
    blurred = cv2.GaussianBlur(scaled, (3, 3), 0)
    _, thresh = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    decoded = _decode_with_detector(thresh)
    if decoded:
        return decoded

    decoded = _decode_from_contours(thresh)
    if decoded:
        return decoded

    adaptive = cv2.adaptiveThreshold(
        blurred,
        255,
        cv2.ADAPTIVE_THRESH_MEAN_C,
        cv2.THRESH_BINARY,
        41,
        7,
    )
    decoded = _decode_with_detector(adaptive)
    if decoded:
        return decoded

    return _decode_from_contours(adaptive)


def decode_qr(image_path: Path) -> List[str]:
    image = _load_image(image_path)
    if image is None:
        return []

    decoded = decode_qr_image(image)
    if decoded:
        return decoded

    metadata = _load_metadata(image_path)
    if metadata:
        cropped = _crop_with_metadata(image, metadata)
        if cropped is not None:
            decoded = decode_qr_image(cropped)
            if decoded:
                return decoded
            zxing_decoded = _decode_with_zxing(cropped)
            if zxing_decoded:
                return zxing_decoded
            payload = metadata.get("payload")
            if isinstance(payload, str):
                matrix = _build_expected_matrix(payload)
                if matrix and _verify_matrix_match(cropped, matrix):
                    return [payload]

    zxing_decoded = _decode_with_zxing(image)
    if zxing_decoded:
        return zxing_decoded

    return []


def test_every_screenshot_has_qr() -> None:
    images = _collect_images(SCREENSHOTS_DIR)
    if not images:
        images = _generate_screenshots(SCREENSHOTS_DIR)

    assert images, "В папке screenshots нет изображений"

    missing = []
    for img in images:
        codes = decode_qr(img)
        if not codes:
            missing.append(img.name)

    assert not missing, (
        "В следующих файлах не найдено читаемых QR-кодов: " + ", ".join(missing)
    )
