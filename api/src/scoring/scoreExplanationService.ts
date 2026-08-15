import type { FieldScoreDetail } from './scoringTypes';

export function generateFieldReason(field: {
  fieldKey: string;
  label: string;
  supportingDocumentTypes: number;
  documentsContainingField: number;
  scenario: string;
  internalScenario: string;
  lowConfidenceCapped?: boolean;
  peerEvidenceAvailable?: boolean;
  extractionReliabilityMeasured?: boolean;
}): string {
  const {
    label,
    supportingDocumentTypes: n,
    documentsContainingField: total,
    internalScenario,
    lowConfidenceCapped,
    peerEvidenceAvailable,
    extractionReliabilityMeasured,
  } = field;

  if (extractionReliabilityMeasured === false) {
    return `Extraction reliability was unavailable, so ${label.toLowerCase()} was capped and marked for review.`;
  }

  if (lowConfidenceCapped) {
    return `Low extraction confidence detected for ${label.toLowerCase()}; manual review required.`;
  }

  if (peerEvidenceAvailable === false || total <= 1) {
    return `${label} is present in 1 document; cross-document peer consensus unavailable.`;
  }

  if (internalScenario === 'consistent') {
    if (n > 1) {
      return `${label} agrees across ${n} independent document types.`;
    }
    return `${label} is supported by ${total} documents.`;
  }

  if (internalScenario === 'spelling_variant') {
    return `${label} contains expected spelling or initial variations across documents.`;
  }

  if (internalScenario === 'incomplete_date_conflict') {
    return `${label} contains year-only date evidence alongside full-date evidence.`;
  }

  if (internalScenario === 'year_difference') {
    return `${label} has a one year conflict between documents.`;
  }

  if (internalScenario === 'gender_mismatch') {
    return `${label} contains a critical gender mismatch across documents.`;
  }

  return `${n} of ${total} document types support the consensus ${label.toLowerCase()}; conflicting evidence remains.`;
}

export function generateProfileReasons(
  fieldScores: FieldScoreDetail[],
  expectedFieldKeys: string[] = ['full_name', 'date_of_birth', 'parent_name', 'gender', 'address']
): string[] {
  const reasons: string[] = [];

  const presentKeys = new Set(fieldScores.map((f) => f.fieldKey));

  // Add field-level key reasons
  for (const field of fieldScores) {
    reasons.push(generateFieldReason(field));
  }

  // Add missing field reasons affecting coverage
  const missingKeys = expectedFieldKeys.filter(
    (k) => !presentKeys.has(k) && !(k === 'parent_guardian_name' && presentKeys.has('parent_name'))
  );

  for (const key of missingKeys) {
    const fieldName =
      key === 'full_name'
        ? 'Full name'
        : key === 'date_of_birth'
        ? 'Date of birth'
        : key === 'parent_name' || key === 'parent_guardian_name'
        ? 'Parent or guardian name'
        : key === 'gender'
        ? 'Gender'
        : 'Address';

    reasons.push(`${fieldName} is unavailable, reducing profile coverage.`);
  }

  return reasons;
}
