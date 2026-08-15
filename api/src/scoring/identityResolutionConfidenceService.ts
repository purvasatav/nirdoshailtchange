import type { IFieldResult } from '../models/store';
import type {
  FieldScoreDetail,
  IdentityResolutionConfidenceResult,
  PillarScores,
  ScoringInput,
  ScoringSummary,
} from './scoringTypes';
import {
  CAP_BASE,
  CAP_LAMBDA,
  CAP_SCALE,
  COMPARABLE_FIELD_BASE_WEIGHTS,
  CORROBORATION_LAMBDA,
  DEFAULT_SCENARIO_DEFINITION,
  DISPLAY_DISCLAIMER,
  EXPECTED_COMPARABLE_FIELDS_COUNT,
  EXTRACTION_RELIABILITY_THRESHOLD,
  FRS_WEIGHT_AGREEMENT,
  FRS_WEIGHT_CORROBORATION,
  FRS_WEIGHT_EXTRACTION,
  LOW_CONFIDENCE_FRS_CAP,
  SCENARIO_MAPPINGS,
  getTierInfo,
} from './scoreConfig';
import { generateFieldReason, generateProfileReasons } from './scoreExplanationService';

function isComparableField(fieldKey: string): boolean {
  const normalizedKey = fieldKey.trim().toLowerCase();
  return Boolean(COMPARABLE_FIELD_BASE_WEIGHTS[normalizedKey]);
}

function getCanonicalFieldKey(fieldKey: string): string {
  const normalizedKey = fieldKey.trim().toLowerCase();
  if (normalizedKey === 'parent_guardian_name') return 'parent_name';
  return normalizedKey;
}

export function calculateIdentityResolutionConfidence(
  input: ScoringInput | IFieldResult[] | any
): IdentityResolutionConfidenceResult {
  // Normalize input
  let rawFieldResults: IFieldResult[] = [];
  let explicitDocTypes: string[] | undefined;

  if (Array.isArray(input)) {
    rawFieldResults = input;
  } else if (input && typeof input === 'object') {
    rawFieldResults = input.allComparableFieldResults || input.fieldResults || [];
    explicitDocTypes = input.documentTypes;
  }

  // 1. Filter comparable fields present in evidence
  const comparableFieldMap = new Map<string, IFieldResult>();
  for (const field of rawFieldResults) {
    if (!field || !field.fieldKey) continue;
    if (field.status === 'not_comparable') continue;
    if (isComparableField(field.fieldKey)) {
      const canonicalKey = getCanonicalFieldKey(field.fieldKey);
      // Prefer multi-doc or explicit result over single-doc placeholder
      if (!comparableFieldMap.has(canonicalKey) || (field.documentsContainingField && field.documentsContainingField > 1)) {
        comparableFieldMap.set(canonicalKey, field);
      }
    }
  }

  const presentComparableFields = Array.from(comparableFieldMap.values());

  // Derive profile-level distinct document types D
  // NOTE: D counts ALL distinct document types contributing usable evidence across the profile,
  // INCLUDING conflicting document types. This is deliberate and must not be collapsed to agreeing document types.
  let D = 0;
  if (explicitDocTypes && explicitDocTypes.length > 0) {
    D = new Set(explicitDocTypes).size;
  } else {
    const profileDocTypes = new Set<string>();
    for (const field of presentComparableFields) {
      if (field.contributingDocumentTypes && field.contributingDocumentTypes.length > 0) {
        field.contributingDocumentTypes.forEach((dt) => profileDocTypes.add(dt));
      } else {
        if (field.supportingDocs) field.supportingDocs.forEach((d) => d.docType && profileDocTypes.add(d.docType));
        if (field.outliers) field.outliers.forEach((d) => d.docType && profileDocTypes.add(d.docType));
        if (field.groups) {
          field.groups.forEach((g) => g.docs && g.docs.forEach((d) => d.docType && profileDocTypes.add(d.docType)));
        }
      }
    }
    D = profileDocTypes.size;
  }

  // Zero-fields guard
  if (presentComparableFields.length === 0) {
    return {
      status: 'insufficient_data',
      score: null,
      tier: 'insufficient_data',
      tierLabel: 'Insufficient Data',
      cap: null,
      independentDocumentTypes: D,
      coverage: 0.0,
      pillars: null,
      summary: {
        presentComparableFields: 0,
        expectedComparableFields: EXPECTED_COMPARABLE_FIELDS_COUNT,
        criticalConflicts: 0,
        needsReviewFields: 0,
      },
      fieldScores: [],
      reasons: ['The system could not form a resolvable peer-evidence profile.'],
      disclaimer: DISPLAY_DISCLAIMER,
    };
  }

  // 2. Compute FRS_i for each present field
  const fieldDetails: FieldScoreDetail[] = [];
  let totalBaseWeight = 0;
  let criticalConflicts = 0;
  let needsReviewFields = 0;

  for (const field of presentComparableFields) {
    const canonicalKey = getCanonicalFieldKey(field.fieldKey);
    const baseWeight = COMPARABLE_FIELD_BASE_WEIGHTS[canonicalKey] || 0.15;
    totalBaseWeight += baseWeight;

    // A_i: Agreement Strength
    let agreementNumerator = 1;
    let documentsContainingField = field.documentsContainingField || 1;

    if (field.supportingDocs && field.supportingDocs.length > 0) {
      agreementNumerator = field.supportingDocs.length;
      if (!field.documentsContainingField) {
        documentsContainingField = field.supportingDocs.length + (field.outliers ? field.outliers.length : 0);
      }
    } else if (field.groups && field.groups.length > 0) {
      agreementNumerator = field.groups[0].docs ? field.groups[0].docs.length : 1;
      if (!field.documentsContainingField) {
        documentsContainingField = field.groups.reduce((acc, g) => acc + (g.docs ? g.docs.length : 0), 0);
      }
    } else if (field.evidence && Array.isArray(field.evidence)) {
      documentsContainingField = field.evidence.length || 1;
      agreementNumerator = documentsContainingField;
    }

    const A_i = Math.min(1.0, Math.max(0.0, agreementNumerator / (documentsContainingField || 1)));

    // C_i: Independent Corroboration
    // NOTE: C_i counts ONLY distinct document types supporting the consensus value for field i.
    // Conflicting document types do NOT increase C_i. For conflicting_evidence / no_consensus, C_i = 0.
    let n_i = 0;
    const isConflicting = field.status === 'conflicting_evidence' || field.scenario === 'no_consensus';

    if (!isConflicting) {
      if (Array.isArray(field.supportingDocumentTypes) && field.supportingDocumentTypes.length > 0) {
        n_i = new Set(field.supportingDocumentTypes).size;
      } else if (field.supportingDocs && field.supportingDocs.length > 0) {
        n_i = new Set(field.supportingDocs.map((d) => d.docType).filter(Boolean)).size || 1;
      } else if (field.groups && field.groups.length > 0 && field.groups[0].docs) {
        n_i = new Set(field.groups[0].docs.map((d) => d.docType).filter(Boolean)).size || 1;
      }
    }

    const C_i = n_i > 0 ? 1 - Math.exp(-CORROBORATION_LAMBDA * n_i) : 0.0;

    // E_i: Extraction Reliability
    // NOTE: effectiveExtractionReliability is an internal neutral fallback (0.50) for safe arithmetic guard calculation, NOT measured evidence.
    let effectiveExtractionReliability = 0.50;
    let extractionReliability: number | null = null;
    let extractionReliabilityMeasured = false;

    if (typeof field.averageExtractionConfidence === 'number' && Number.isFinite(field.averageExtractionConfidence)) {
      const clamped = Math.max(0.0, Math.min(1.0, field.averageExtractionConfidence));
      effectiveExtractionReliability = clamped;
      extractionReliability = clamped;
      extractionReliabilityMeasured = true;
    } else {
      effectiveExtractionReliability = 0.50;
      extractionReliability = null;
      extractionReliabilityMeasured = false;
    }

    // P_i: Scenario Penalty
    const scenarioKey = field.scenario || field.status;
    const scenarioDef = SCENARIO_MAPPINGS[scenarioKey] || DEFAULT_SCENARIO_DEFINITION;
    const P_i = scenarioDef.penalty;

    // FRS_i raw calculation
    let frsRaw = FRS_WEIGHT_AGREEMENT * A_i + FRS_WEIGHT_CORROBORATION * C_i + FRS_WEIGHT_EXTRACTION * effectiveExtractionReliability - P_i;
    frsRaw = Math.max(0.0, frsRaw);

    // Low confidence guard clause
    let lowConfidenceCapped = false;
    let displaySeverity = scenarioDef.displaySeverity;
    let severity = scenarioDef.severity;

    if (effectiveExtractionReliability < EXTRACTION_RELIABILITY_THRESHOLD || !extractionReliabilityMeasured) {
      lowConfidenceCapped = true;
      frsRaw = Math.min(frsRaw, LOW_CONFIDENCE_FRS_CAP);
      displaySeverity = 'Needs Review';
      if (severity === 'none' || severity === 'low') {
        severity = 'medium';
      }
    }

    const peerEvidenceAvailable = field.peerEvidenceAvailable !== false && documentsContainingField > 1;
    if (!peerEvidenceAvailable && (displaySeverity === 'No issue')) {
      displaySeverity = 'Needs Review';
      severity = 'medium';
    }

    if (severity === 'critical') {
      criticalConflicts++;
    }
    if (severity === 'medium' || severity === 'high' || displaySeverity === 'Needs Review') {
      needsReviewFields++;
    }

    const fieldScore = Math.round(frsRaw * 100);

    const tempDetail = {
      fieldKey: canonicalKey,
      label: field.label || canonicalKey,
      score: fieldScore,
      frsRaw,
      agreement: A_i,
      corroboration: C_i,
      extractionReliability,
      penalty: P_i,
      scenario: scenarioKey,
      internalScenario: scenarioDef.internalScenario,
      severity,
      displaySeverity,
      supportingDocumentTypes: n_i,
      documentsContainingField,
      reason: '',
      lowConfidenceCapped,
      extractionReliabilityMeasured,
      peerEvidenceAvailable,
    };

    tempDetail.reason = generateFieldReason(tempDetail);
    fieldDetails.push(tempDetail);
  }

  // 3. Weighted Aggregation over present usable fields
  let ircRaw = 0.0;
  let pillarAgreementSum = 0.0;
  let pillarCorroborationSum = 0.0;
  let pillarExtractionSum = 0.0;
  let measuredWeightSum = 0.0;

  for (const detail of fieldDetails) {
    const baseWeight = COMPARABLE_FIELD_BASE_WEIGHTS[detail.fieldKey] || 0.15;
    const normalizedWeight = baseWeight / totalBaseWeight;

    ircRaw += normalizedWeight * detail.frsRaw;
    pillarAgreementSum += normalizedWeight * detail.agreement;
    pillarCorroborationSum += normalizedWeight * detail.corroboration;
    if (detail.extractionReliability !== null) {
      pillarExtractionSum += normalizedWeight * detail.extractionReliability;
      measuredWeightSum += normalizedWeight;
    }
  }

  // 4. Profile-Level Coverage
  // NOTE: Coverage is calculated ONCE at profile level. It is NEVER included inside the per-field FRS_i formula.
  const coverage = presentComparableFields.length / EXPECTED_COMPARABLE_FIELDS_COUNT;
  const ircCoverage = ircRaw * coverage;

  // 5. Evidence Cap
  let cap = 100;
  if (D >= 1) {
    cap = CAP_BASE + CAP_SCALE * (1 - Math.exp(-CAP_LAMBDA * (D - 1)));
  } else {
    cap = CAP_BASE;
  }

  // 6. Final Score Calculation
  const finalUnclamped = Math.min(100 * ircCoverage, cap);
  const finalClamped = Math.max(0, Math.min(100, finalUnclamped));
  const finalScore = Math.round(finalClamped);

  const tierInfo = getTierInfo(finalScore);

  const pillars: PillarScores = {
    agreement: Math.round(pillarAgreementSum * 100),
    corroboration: Math.round(pillarCorroborationSum * 100),
    coverage: Math.round(coverage * 100),
    extractionReliability:
      measuredWeightSum > 0 ? Math.round((pillarExtractionSum / measuredWeightSum) * 100) : null,
  };

  const summary: ScoringSummary = {
    presentComparableFields: presentComparableFields.length,
    expectedComparableFields: EXPECTED_COMPARABLE_FIELDS_COUNT,
    criticalConflicts,
    needsReviewFields,
  };

  const reasons = generateProfileReasons(fieldDetails);

  return {
    status: 'scored',
    score: finalScore,
    tier: tierInfo.tier,
    tierLabel: tierInfo.label,
    cap: Math.round(cap),
    independentDocumentTypes: D,
    coverage,
    pillars,
    summary,
    fieldScores: fieldDetails,
    reasons,
    disclaimer: DISPLAY_DISCLAIMER,
  };
}
