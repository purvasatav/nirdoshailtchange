import { documentRegistry } from "../registry/documentRegistry";
import { MaskingPurpose, Sensitivity } from "../types/piiTypes";

// Each purpose gets its own policy per sensitivity level. Add a new
// purpose by adding one entry here -- nothing else changes.

type MaskMode = "show" | "mask_partial" | "mask_full";

const POLICY: Record<MaskingPurpose, Record<Sensitivity, MaskMode>> = {
  internal_review: { public: "show", pii: "show", critical: "mask_partial" },
  export_pdf: { public: "show", pii: "show", critical: "mask_partial" },
  guidance_link: { public: "show", pii: "mask_partial", critical: "mask_full" },
  public_share: { public: "show", pii: "mask_full", critical: "mask_full" },
};

function applyMask(value: string, mode: MaskMode): string {
  if (mode === "show" || !value) return value;
  if (mode === "mask_full") return "*".repeat(Math.min(value.length, 10));
  const visible = 4;
  if (value.length <= visible) return "*".repeat(value.length);
  return "*".repeat(value.length - visible) + value.slice(-visible);
}

export interface MaskableField {
  fieldKey: string;
  value: string;
}

export function maskFields<T extends MaskableField>(
  docType: string,
  fields: T[],
  purpose: MaskingPurpose
): (T & { masked: boolean; sensitivity: Sensitivity })[] {
  const policy = POLICY[purpose];
  return fields.map((field) => {
    const sensitivity = documentRegistry.getSensitivity(docType, field.fieldKey);
    const mode = policy[sensitivity];
    return {
      ...field,
      value: applyMask(field.value, mode),
      masked: mode !== "show",
      sensitivity,
    };
  });
}
