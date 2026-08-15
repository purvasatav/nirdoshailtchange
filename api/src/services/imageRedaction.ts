import sharp from "sharp";
import { documentRegistry } from "../registry/documentRegistry";
import logger from "./logger";

// Redacts actual pixels for sensitive fields on a source document image.
// Masking the extracted JSON alone is not enough: a photocopy image that
// still shows a readable Aadhaar number is not safe to persist, display,
// or export just because the JSON representation is masked.

export interface FieldBox {
  fieldKey: string;
  x: number; // normalized 0-1000, source-engine-agnostic
  y: number;
  width: number;
  height: number;
}

export interface RedactionOutcome {
  buffer: Buffer;
  redactedFields: string[];
  skippedFields: string[]; // sensitive fields with no box supplied
}

export async function redactDocumentImage(
  imageBuffer: Buffer,
  docType: string,
  presentFieldKeys: string[],
  boxes: FieldBox[]
): Promise<RedactionOutcome> {
  const sensitiveFields = presentFieldKeys.filter(
    (key) => documentRegistry.getSensitivity(docType, key) !== "public"
  );

  const boxedFields = new Set(boxes.map((b) => b.fieldKey));
  const skippedFields = sensitiveFields.filter((f) => !boxedFields.has(f));

  if (skippedFields.length > 0) {
    logger.warn("[imageRedaction] sensitive fields with no box supplied, image NOT fully redacted", {
      docType,
      skippedFields,
    });
  }

  const relevantBoxes = boxes.filter((b) => sensitiveFields.includes(b.fieldKey));

  if (relevantBoxes.length === 0) {
    return { buffer: imageBuffer, redactedFields: [], skippedFields };
  }

  const meta = await sharp(imageBuffer).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;

  const rects = relevantBoxes
    .map((b) => {
      const px = (b.x / 1000) * width;
      const py = (b.y / 1000) * height;
      const pw = (b.width / 1000) * width;
      const ph = (b.height / 1000) * height;
      return `<rect x="${px}" y="${py}" width="${pw}" height="${ph}" fill="black" />`;
    })
    .join("");

  const overlay = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${rects}</svg>`);

  const buffer = await sharp(imageBuffer)
    .composite([{ input: overlay, top: 0, left: 0 }])
    .toBuffer();

  return {
    buffer,
    redactedFields: relevantBoxes.map((b) => b.fieldKey),
    skippedFields,
  };
}

// Callers (export/share endpoints) must check this before handing out
// a derivative in a lower-trust context.
export function isFullyRedacted(outcome: RedactionOutcome): boolean {
  return outcome.skippedFields.length === 0;
}
