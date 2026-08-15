// Sensitivity and purpose vocabulary shared by every document type.
// Adding a new document type never touches this file.

export type Sensitivity = "public" | "pii" | "critical";

export type MaskingPurpose =
  | "internal_review"
  | "export_pdf"
  | "guidance_link"
  | "public_share";

export interface FieldDefinition {
  key: string;
  label: string;
  sensitivity: Sensitivity;
}

export interface DocumentTypeDefinition {
  docType: string;
  displayName: string;
  fields: FieldDefinition[];
  comparisonFields: string[];
}

export interface DocumentRegistryFile {
  version: string;
  documentTypes: DocumentTypeDefinition[];
}
