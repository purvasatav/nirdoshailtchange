import type { DisplaySeverity, DisplayTier, InternalScenario } from './scoringTypes';

export const COMPARABLE_FIELD_BASE_WEIGHTS: Record<string, number> = {
  full_name: 0.30,
  date_of_birth: 0.30,
  parent_name: 0.15,
  parent_guardian_name: 0.15,
  gender: 0.10,
  address: 0.15,
};

export const EXPECTED_COMPARABLE_FIELDS_COUNT = 5;

export const FRS_WEIGHT_AGREEMENT = 0.53;
export const FRS_WEIGHT_CORROBORATION = 0.35;
export const FRS_WEIGHT_EXTRACTION = 0.12;

export const CORROBORATION_LAMBDA = 0.9;

export const CAP_BASE = 45;
export const CAP_SCALE = 55;
export const CAP_LAMBDA = 0.8;

export const EXTRACTION_RELIABILITY_THRESHOLD = 0.50;
export const LOW_CONFIDENCE_FRS_CAP = 0.50;

export interface ScenarioDefinition {
  internalScenario: InternalScenario;
  penalty: number;
  displaySeverity: DisplaySeverity;
  severity: 'none' | 'low' | 'medium' | 'high' | 'critical';
}

export const SCENARIO_MAPPINGS: Record<string, ScenarioDefinition> = {
  // Spec exact internal scenarios
  consistent: {
    internalScenario: 'consistent',
    penalty: 0.00,
    displaySeverity: 'No issue',
    severity: 'none',
  },
  exact_normalized_match: {
    internalScenario: 'consistent',
    penalty: 0.00,
    displaySeverity: 'No issue',
    severity: 'none',
  },
  spelling_variant: {
    internalScenario: 'spelling_variant',
    penalty: 0.02,
    displaySeverity: 'Expected Variation',
    severity: 'low',
  },
  possible_initial_or_order_variant: {
    internalScenario: 'spelling_variant',
    penalty: 0.02,
    displaySeverity: 'Expected Variation',
    severity: 'low',
  },
  incomplete_date_conflict: {
    internalScenario: 'incomplete_date_conflict',
    penalty: 0.04,
    displaySeverity: 'Expected Variation',
    severity: 'medium',
  },
  year_only_same_year: {
    internalScenario: 'incomplete_date_conflict',
    penalty: 0.04,
    displaySeverity: 'Expected Variation',
    severity: 'medium',
  },
  year_difference: {
    internalScenario: 'year_difference',
    penalty: 0.08,
    displaySeverity: 'Needs Review',
    severity: 'medium',
  },
  gender_mismatch: {
    internalScenario: 'gender_mismatch',
    penalty: 0.18,
    displaySeverity: 'Critical Conflict',
    severity: 'critical',
  },
  gender_difference: {
    internalScenario: 'gender_mismatch',
    penalty: 0.18,
    displaySeverity: 'Critical Conflict',
    severity: 'critical',
  },
  no_consensus: {
    internalScenario: 'no_consensus',
    penalty: 0.25,
    displaySeverity: 'Critical Conflict',
    severity: 'critical',
  },
  conflicting_evidence: {
    internalScenario: 'conflicting_evidence',
    penalty: 0.25,
    displaySeverity: 'Critical Conflict',
    severity: 'critical',
  },
  different_full_date: {
    internalScenario: 'conflicting_evidence',
    penalty: 0.25,
    displaySeverity: 'Critical Conflict',
    severity: 'critical',
  },
  name_difference_standard: {
    internalScenario: 'conflicting_evidence',
    penalty: 0.25,
    displaySeverity: 'Critical Conflict',
    severity: 'critical',
  },
};

export const DEFAULT_SCENARIO_DEFINITION: ScenarioDefinition = {
  internalScenario: 'conflicting_evidence',
  penalty: 0.25,
  displaySeverity: 'Critical Conflict',
  severity: 'critical',
};

export const DISPLAY_DISCLAIMER =
  'This score measures cross-document consistency, not authenticity or legal correctness.';

export function getTierInfo(score: number | null): { tier: DisplayTier; label: string } {
  if (score === null) {
    return { tier: 'insufficient_data', label: 'Insufficient Data' };
  }

  if (score >= 90) {
    return { tier: 'strong_consensus', label: 'Strong Consensus' };
  }
  if (score >= 75) {
    return { tier: 'moderate_consensus', label: 'Moderate Consensus' };
  }
  if (score >= 60) {
    return { tier: 'needs_review', label: 'Needs Review' };
  }
  return { tier: 'critical_conflicts', label: 'Critical Conflicts Present' };
}
