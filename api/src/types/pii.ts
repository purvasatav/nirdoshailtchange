export type PiiSensitivity = 'public' | 'internal' | 'restricted' | 'critical';
export type PiiPurpose = 'display' | 'verification' | 'audit' | 'export';

export interface PiiFieldRule {
  sensitivity: PiiSensitivity;
  allowed_purposes: PiiPurpose[];
}

export interface DocumentDefinition {
  category: string;
  supported_fields: string[];
  comparison_fields: string[];
  pii_fields: Record<string, PiiFieldRule>;
}

export interface DocumentDefinitionsFile {
  version: string;
  documents: Record<string, DocumentDefinition>;
}
