import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const imageDir = join(root, "fixtures", "ocr-images");
const manifestPath = join(root, "fixtures", "ocr-printed-invoice.jsonl");

const cases = [
  { id: "ocr-001", date: "2026-08-12", quality: "clear", lines: [{ type: "sale", itemName: "xoai", quantity: 2, unit: "kg", unitPrice: 40000, amount: 80000 }] },
  { id: "ocr-002", date: "2026-08-11", quality: "clear", lines: [{ type: "purchase", itemName: "cam", quantity: 10, unit: "kg", unitPrice: 35000, amount: 350000 }, { type: "purchase", itemName: "oi", quantity: 5, unit: "kg", unitPrice: 22000, amount: 110000 }] },
  { id: "ocr-003", date: null, quality: "clear-missing-field", lines: [{ type: "sale", itemName: "dua hau", quantity: 1, unit: "qua", unitPrice: null, amount: 120000 }] },
  { id: "ocr-004", date: "2026-08-10", quality: "blurred", lines: [] },
  { id: "ocr-005", date: "2026-08-10", quality: "handwritten", lines: [] },
  { id: "ocr-006", date: "2026-08-09", quality: "clear", lines: [{ type: "sale", itemName: "chuoi", quantity: 3, unit: "na", unitPrice: 18000, amount: 54000 }] },
  { id: "ocr-007", date: "2026-08-09", quality: "clear", lines: [{ type: "purchase", itemName: "thanh long", quantity: 12, unit: "kg", unitPrice: 27000, amount: 324000 }] },
  { id: "ocr-008", date: "2026-08-08", quality: "clear", lines: [{ type: "expense", itemName: "tui nilon", quantity: 1, unit: "goi", unitPrice: null, amount: 66000 }] },
  { id: "ocr-009", date: "2026-08-08", quality: "clear", lines: [{ type: "sale", itemName: "dua leo", quantity: 20, unit: "kg", unitPrice: 12000, amount: 240000 }] },
  { id: "ocr-010", date: "2026-08-07", quality: "clear", lines: [{ type: "purchase", itemName: "rau muong", quantity: 8, unit: "kg", unitPrice: 14000, amount: 112000 }] },
  { id: "ocr-011", date: "2026-08-07", quality: "clear-missing-field", lines: [{ type: "sale", itemName: "ca rot", quantity: 4, unit: "kg", unitPrice: null, amount: 100000 }] },
  { id: "ocr-012", date: "2026-08-06", quality: "clear", lines: [{ type: "sale", itemName: "khoai tay", quantity: 5, unit: "kg", unitPrice: 26000, amount: 130000 }, { type: "sale", itemName: "hanh", quantity: 2, unit: "kg", unitPrice: 30000, amount: 60000 }] },
  { id: "ocr-013", date: "2026-08-06", quality: "dark", lines: [] },
  { id: "ocr-014", date: "2026-08-05", quality: "clear", lines: [{ type: "expense", itemName: "van chuyen", quantity: null, unit: null, unitPrice: null, amount: 50000 }] },
  { id: "ocr-015", date: "2026-08-05", quality: "clear", lines: [{ type: "sale", itemName: "dua", quantity: 6, unit: "qua", unitPrice: 15000, amount: 90000 }] },
];

function escapeXml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function renderSvg(item) {
  const rows = item.lines.length > 0 ? item.lines : [{ type: "review", itemName: item.quality, quantity: null, unit: null, unitPrice: null, amount: null }];
  const lineText = rows.map((line, index) => `${index + 1}. ${line.type} | ${line.itemName} | ${line.quantity ?? "?"} ${line.unit ?? ""} | ${line.amount ?? "?"} VND`).join("\n");
  const textNodes = lineText.split("\n").map((line, index) => `<text x="56" y="${150 + index * 32}" font-size="18" font-family="Arial, sans-serif">${escapeXml(line)}</text>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="280" viewBox="0 0 900 280"><rect width="900" height="280" fill="#ffffff"/><rect x="20" y="20" width="860" height="240" rx="12" fill="#f6f7f2" stroke="#1f6f54" stroke-width="2"/><text x="56" y="70" font-size="28" font-weight="700" font-family="Arial, sans-serif">SO CHO AI - SYNTHETIC INVOICE</text><text x="56" y="108" font-size="18" font-family="Arial, sans-serif">DATE: ${escapeXml(item.date ?? "MISSING")} | QUALITY: ${escapeXml(item.quality)}</text>${textNodes}</svg>`;
}

await mkdir(imageDir, { recursive: true });
const manifest = [];
for (const item of cases) {
  await writeFile(join(imageDir, `${item.id}.svg`), renderSvg(item), "utf8");
  manifest.push({
    id: item.id,
    image: `ocr-images/${item.id}.svg`,
    expectedDrafts: item.lines.map((line) => ({
      ...line,
      occurredAt: item.date,
      canonicalItemName: line.itemName,
      rawInput: `${line.itemName ?? ""} ${line.quantity ?? ""} ${line.unit ?? ""} ${line.amount ?? ""}`.trim(),
      fieldsNeedingReview: [ ...(line.unitPrice === null ? ["unitPrice"] : []), ...(item.date === null ? ["occurredAt"] : []) ],
      missingFields: [ ...(line.unitPrice === null ? ["unitPrice"] : []), ...(item.date === null ? ["occurredAt"] : []) ],
      warnings: [],
    })),
    quality: item.quality,
    notes: "Synthetic public fixture; no user image, voice, face, address, phone, or financial account data.",
  });
}
await writeFile(manifestPath, `${manifest.map((item) => JSON.stringify(item)).join("\n")}\n`, "utf8");
console.log(`Generated ${manifest.length} synthetic OCR fixtures at ${imageDir}`);
