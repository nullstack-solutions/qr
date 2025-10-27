# tests/testValidQrScrenshots.py
from pathlib import Path
from PIL import Image
from pyzbar.pyzbar import decode

IMAGE_EXTS = {'.png', '.jpg', '.jpeg', '.bmp', '.gif', '.tiff'}

def decode_qr(path: Path):
    img = Image.open(path).convert('RGB')
    decoded = decode(img)
    return [d.data.decode('utf-8', errors='replace') for d in decoded]

def test_every_screenshot_has_qr():
    screenshots = Path('screenshots')
    assert screenshots.exists() and screenshots.is_dir(), "Папка screenshots не найдена"
    images = [p for p in screenshots.iterdir() if p.suffix.lower() in IMAGE_EXTS and p.is_file()]
    assert images, "В папке screenshots нет изображений"
    missing = []
    for img in images:
        codes = decode_qr(img)
        if not codes:
            missing.append(img.name)
    assert not missing, f"В следующих файлах не найдено читаемых QR-кодов: {', '.join(missing)}"
