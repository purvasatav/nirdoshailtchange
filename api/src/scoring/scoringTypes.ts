import type { IFieldResult } from '../models/store';

export type DisplayTier =
  | 'strong_consensus'
  | 'moderate_consensus'
  | 'needs_review'
  | 'critical_conflicts'
  | 'insufficient_data';

export type ScoringStatus = 'scored' | 'insufficient_data';

export type DisplaySeverity = 'No issue' | 'Expected Variation' | 'Needs Review' | 'Critical Conflict';

export type InternalScenario =
  | 'consistent'
  | 'spelling_variant'
  | 'incomplete_date_conflict'
  | 'year_difference'
  | 'gender_mismatch'
  | 'no_consensus'
  | 'conflicting_evidence';

export interface FieldScoreDetail {
  fieldKey: string;
  label: string;
  score: number; // 0-100 integer
  frsRaw: number; // 0.0 - 1.0
  agreement: number; // A_i (0.0 - 1.0)
  corroboration: number; // C_i (0.0 - 1.0)
  extractionReliability: number | null; // 0.0 - 1.0 or null if unmeasured
  penalty: number; // P_i
  scenario: string;
  internalScenario: InternalScenario;
  severity: 'none' | 'low' | 'medium' | 'high' | 'critical';
  displaySeverity: DisplaySeverity;
  supportingDocumentTypes: number;
  documentsContainingField: number;
  reason: string;
  lowConfidenceCapped: boolean;
  extractionReliabilityMeasured: boolean;
  peerEvidenceAvailable: boolean;
}

export interface PillarScores {
  agreement: number; // 0 - 100
  corroboration: number; // 0 - 100
  coverage: number; // 0 - 100
  extractionReliability: number | null; // 0 - 100 or null if unmeasured
}

export interface ScoringSummary {
  presentComparableFields: number;
  expectedComparableFields: number;
  criticalConflicts: number;
  needsReviewFields: number;
}

export interface IdentityResolutionConfidenceResult {
  status: ScoringStatus;
  score: number | null;
  tier: DisplayTier;
  tierLabel: string;
  cap: number | null;
  independentDocumentTypes: number;
  coverage: number; // 0.0 - 1.0
  pillars: PillarScores | null;
  summary: ScoringSummary;
  fieldScores: FieldScoreDetail[];
  reasons: string[];
  disclaimer: string;
}

export interface ScoringInput {
  fieldResults: IFieldResult[];
  allComparableFieldResults?: IFieldResult[];
  documentTypes?: string[];
  totalUploadedDocuments?: number;
}
