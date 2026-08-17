from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "fixtures" / "ocr-printed-invoice.jsonl"
OUTPUT_DIR = ROOT / "fixtures" / "ocr-png"
OUTPUT_MANIFEST = ROOT / "fixtures" / "ocr-printed-invoice-png.jsonl"
WIDTH, HEIGHT = 1600, 900


def font(size: int, bold: bool = False):
    candidates = [
        Path("C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf"),
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size)
    return ImageFont.load_default()


def render(row: dict) -> Image.Image:
    image = Image.new("RGB", (WIDTH, HEIGHT), "#ffffff")
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((30, 30, WIDTH - 30, HEIGHT - 30), radius=24, fill="#f6f7f2", outline="#1f6f54", width=4)
    draw.text((90, 85), "SO CHO AI - SYNTHETIC INVOICE", fill="#12372a", font=font(46, bold=True))
    drafts = row.get("expectedDrafts", [])
    date = drafts[0].get("occurredAt") if drafts else None
    draw.text((90, 155), f"DATE: {date or 'MISSING'} | QUALITY: {row['quality']}", fill="#405c51", font=font(30))
    y = 270
    if not drafts:
        drafts = [{"type": "review", "itemName": row["quality"], "quantity": None, "unit": None, "unitPrice": None, "amount": None}]
    for index, draft in enumerate(drafts, start=1):
        quantity = "?" if draft.get("quantity") is None else str(draft["quantity"])
        unit = "" if draft.get("unit") is None else draft["unit"]
        amount = "?" if draft.get("amount") is None else f"{draft['amount']:,}"
        text = f"{index}. {draft.get('type', 'review')} | {draft.get('itemName', '')} | {quantity} {unit} | {amount} VND"
        draw.text((110, y), text, fill="#172b22", font=font(34))
        y += 90
    draw.text((90, HEIGHT - 110), "PUBLIC SYNTHETIC FIXTURE - NO PII", fill="#647b70", font=font(24))
    if row["quality"] == "blurred":
        image = image.filter(ImageFilter.GaussianBlur(radius=4))
    elif row["quality"] == "dark":
        image = ImageEnhance.Brightness(image).enhance(0.28)
    return image


rows = [json.loads(line) for line in SOURCE.read_text(encoding="utf-8").splitlines() if line.strip()]
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
manifest = []
for row in rows:
    output = OUTPUT_DIR / f"{row['id']}.png"
    render(row).save(output, format="PNG", optimize=True)
    manifest.append({**row, "image": f"ocr-png/{output.name}"})
OUTPUT_MANIFEST.write_text(
    "".join(json.dumps(row, ensure_ascii=False) + "\n" for row in manifest),
    encoding="utf-8",
)
print(f"Generated {len(manifest)} PNG fixtures at {OUTPUT_DIR}")
