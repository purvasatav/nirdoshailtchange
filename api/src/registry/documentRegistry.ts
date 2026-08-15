import fs from "fs";
import path from "path";
import { DocumentRegistryFile, DocumentTypeDefinition, FieldDefinition, Sensitivity } from "../types/piiTypes";

// Single source of truth for document structure AND field sensitivity.
// Adding a new document type = adding one entry to document-registry.json.
// No code changes, no redeploy of engine logic, ever.

const REGISTRY_PATH = path.join(__dirname, "..", "data", "document-registry.json");

class DocumentRegistry {
  private data: DocumentRegistryFile;

  constructor() {
    this.data = JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf-8"));
  }

  reload(): void {
    this.data = JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf-8"));
  }

  listDocTypes(): string[] {
    return this.data.documentTypes.map((d) => d.docType);
  }

  getDefinition(docType: string): DocumentTypeDefinition | undefined {
    return this.data.documentTypes.find((d) => d.docType === docType);
  }

  getFieldDefinition(docType: string, fieldKey: string): FieldDefinition | undefined {
    return this.getDefinition(docType)?.fields.find((f) => f.key === fieldKey);
  }

  getSensitivity(docType: string, fieldKey: string): Sensitivity {
    // Unknown fields default to "pii", never "public" -- fail safe, not fail open.
    return this.getFieldDefinition(docType, fieldKey)?.sensitivity ?? "pii";
  }

  getComparisonFields(docType: string): string[] {
    return this.getDefinition(docType)?.comparisonFields ?? [];
  }
}

export const documentRegistry = new DocumentRegistry();
