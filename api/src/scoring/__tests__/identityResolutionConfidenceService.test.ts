import assert from 'assert';
import { calculateIdentityResolutionConfidence } from '../identityResolutionConfidenceService';
import type { IFieldResult } from '../../models/store';

console.log('--- Running Identity Resolution Confidence Unit Tests ---');

// Helper to create mock field result
function mockField(
  fieldKey: string,
  label: string,
  status: 'consistent' | 'possible_variant' | 'mismatch' | 'outlier_detected' | 'conflicting_evidence',
  scenario: string,
  supportingDocs: { docId: string; docTitle: string; value: string; docType: string }[],
  outliers?: { docId: string; docTitle: string; value: string; docType: string }[],
  extractionConfidence: number | null = 0.90
): IFieldResult {
  const supportingTypes = Array.from(new Set(supportingDocs.map((d) => d.docType)));
  const outlierTypes = outliers ? Array.from(new Set(outliers.map((d) => d.docType))) : [];
  const contributingTypes = Array.from(new Set([...supportingTypes, ...outlierTypes]));

  const fieldRes: IFieldResult = {
    fieldKey,
    label,
    status,
    confidence: status === 'conflicting_evidence' ? 'no_consensus' : 'high',
    confidenceLabel: 'Test',
    scenario,
    consensusValue: supportingDocs[0]?.value || '',
    supportingDocs,
    explanation: 'Test explanation',
    needsManualVerification: status !== 'consistent',
    documentsContainingField: new Set([...supportingDocs, ...(outliers || [])].map((d) => d.docId)).size,
    supportingDocumentTypes: supportingTypes,
    contributingDocumentTypes: contributingTypes,
    averageExtractionConfidence: extractionConfidence,
    peerEvidenceAvailable: supportingDocs.length + (outliers?.length || 0) > 1,
  };

  if (outliers) {
    fieldRes.outliers = outliers;
  }

  return fieldRes;
}

// 1. Zero comparable fields -> Insufficient Data, no division by zero
{
  const res = calculateIdentityResolutionConfidence([]);
  assert.strictEqual(res.status, 'insufficient_data');
  assert.strictEqual(res.score, null);
  assert.strictEqual(res.tier, 'insufficient_data');
  assert.strictEqual(res.tierLabel, 'Insufficient Data');
  assert.strictEqual(res.coverage, 0.0);
  assert.strictEqual(res.pillars, null);
  assert.ok(res.disclaimer.includes('cross-document consistency'));
}

// 2. One document with perfect extraction -> score cannot exceed one-document cap (45%)
{
  const fields = [
    mockField('full_name', 'Full Name', 'consistent', 'exact_normalized_match', [{ docId: '1', docTitle: 'Doc 1', value: 'Siddharth Patel', docType: 'aadhaar' }]),
    mockField('date_of_birth', 'Date of Birth', 'consistent', 'exact_normalized_match', [{ docId: '1', docTitle: 'Doc 1', value: '1990-01-01', docType: 'aadhaar' }]),
    mockField('gender', 'Gender', 'consistent', 'exact_normalized_match', [{ docId: '1', docTitle: 'Doc 1', value: 'Male', docType: 'aadhaar' }]),
    mockField('address', 'Address', 'consistent', 'exact_normalized_match', [{ docId: '1', docTitle: 'Doc 1', value: '123 Main St', docType: 'aadhaar' }]),
    mockField('parent_name', 'Parent Name', 'consistent', 'exact_normalized_match', [{ docId: '1', docTitle: 'Doc 1', value: 'Ramesh Patel', docType: 'aadhaar' }]),
  ];

  const res = calculateIdentityResolutionConfidence({ allComparableFieldResults: fields, documentTypes: ['aadhaar'] });
  assert.strictEqual(res.status, 'scored');
  assert.strictEqual(res.independentDocumentTypes, 1);
  assert.strictEqual(res.cap, 45);
  assert.ok(res.score !== null && res.score <= 45, `Score ${res.score} should be <= 45`);
  assert.strictEqual(res.fieldScores[0].peerEvidenceAvailable, false);
  assert.ok(res.fieldScores[0].reason.includes('peer consensus unavailable'));
}

// 3. Two document types agree on all present fields -> score remains below two-document cap (75%)
{
  const fields = [
    mockField('full_name', 'Full Name', 'consistent', 'exact_normalized_match', [
      { docId: '1', docTitle: 'Aadhaar', value: 'Siddharth Patel', docType: 'aadhaar' },
      { docId: '2', docTitle: 'PAN', value: 'Siddharth Patel', docType: 'pan' },
  ]),
    mockField('date_of_birth', 'Date of Birth', 'consistent', 'exact_normalized_match', [
      { docId: '1', docTitle: 'Aadhaar', value: '1990-01-01', docType: 'aadhaar' },
      { docId: '2', docTitle: 'PAN', value: '1990-01-01', docType: 'pan' },
  ]),
  ];

  const res = calculateIdentityResolutionConfidence({ allComparableFieldResults: fields, documentTypes: ['aadhaar', 'pan'] });
  assert.strictEqual(res.independentDocumentTypes, 2);
  assert.strictEqual(res.cap, 75);
  assert.ok(res.score !== null && res.score <= 75, `Score ${res.score} should be <= 75`);
}

// 4. Three low-confidence extractions agree -> affected field is capped at 50% and labelled Needs Review
{
  const lowConfField = mockField('full_name', 'Full Name', 'consistent', 'exact_normalized_match', [
    { docId: '1', docTitle: 'Aadhaar', value: 'Siddharth Patel', docType: 'aadhaar' },
    { docId: '2', docTitle: 'PAN', value: 'Siddharth Patel', docType: 'pan' },
    { docId: '3', docTitle: 'Voter ID', value: 'Siddharth Patel', docType: 'voter_id' },
  ], undefined, 0.40); // 0.40 < 0.50

  const res = calculateIdentityResolutionConfidence([lowConfField]);
  const fScore = res.fieldScores[0];
  assert.strictEqual(fScore.lowConfidenceCapped, true);
  assert.strictEqual(fScore.displaySeverity, 'Needs Review');
  assert.ok(fScore.score <= 50, `Field score ${fScore.score} should be <= 50`);
}

// 5. Two-vs-two field split -> A_i reflects 2/4 and C_i is 0 for conflicting_evidence
{
  const splitField: IFieldResult = {
    fieldKey: 'date_of_birth',
    label: 'Date of Birth',
    status: 'conflicting_evidence',
    confidence: 'no_consensus',
    confidenceLabel: 'No Consensus',
    scenario: 'different_full_date',
    groups: [
      { value: '1990-01-01', docs: [{ docId: '1', docTitle: 'Aadhaar', docType: 'aadhaar' }, { docId: '2', docTitle: 'Voter ID', docType: 'voter_id' }] },
      { value: '1991-05-05', docs: [{ docId: '3', docTitle: 'PAN', docType: 'pan' }, { docId: '4', docTitle: 'Driving Licence', docType: 'driving_licence' }] },
    ],
    explanation: 'Split evidence',
    needsManualVerification: true,
    documentsContainingField: 4,
    supportingDocumentTypes: [], // Conflicting evidence has no consensus group
    contributingDocumentTypes: ['aadhaar', 'voter_id', 'pan', 'driving_licence'],
    averageExtractionConfidence: 0.95,
  };

  const res = calculateIdentityResolutionConfidence([splitField]);
  const fDetail = res.fieldScores[0];
  assert.strictEqual(fDetail.agreement, 0.5); // 2/4 = 0.5
  assert.strictEqual(fDetail.supportingDocumentTypes, 0); // 0 agreeing document types for no consensus
  assert.strictEqual(fDetail.corroboration, 0.0); // C_i = 0
}

// 6. Fully conflicting document type still counts in D for profile cap if it contributed usable identity evidence
{
  const fields = [
    mockField('full_name', 'Full Name', 'outlier_detected', 'name_difference_standard', [
      { docId: '1', docTitle: 'Aadhaar', value: 'Siddharth Patel', docType: 'aadhaar' },
      { docId: '2', docTitle: 'PAN', value: 'Siddharth Patel', docType: 'pan' },
    ], [
      { docId: '3', docTitle: 'Passport', value: 'Rajesh Kumar', docType: 'passport' }, // Conflicting document type
    ]),
  ];

  const res = calculateIdentityResolutionConfidence(fields);
  // D should count aadhaar, pan, AND passport = 3
  assert.strictEqual(res.independentDocumentTypes, 3);
  assert.strictEqual(res.cap, 89); // 45 + 55*(1 - e^-1.6) ≈ 88.9 -> 89
}

// 7. Missing parent name reduces Coverage (4/5) but is not counted as a mismatch
{
  const fields = [
    mockField('full_name', 'Full Name', 'consistent', 'exact_normalized_match', [{ docId: '1', docTitle: 'Aadhaar', value: 'Siddharth Patel', docType: 'aadhaar' }]),
    mockField('date_of_birth', 'Date of Birth', 'consistent', 'exact_normalized_match', [{ docId: '1', docTitle: 'Aadhaar', value: '1990-01-01', docType: 'aadhaar' }]),
    mockField('gender', 'Gender', 'consistent', 'exact_normalized_match', [{ docId: '1', docTitle: 'Aadhaar', value: 'Male', docType: 'aadhaar' }]),
    mockField('address', 'Address', 'consistent', 'exact_normalized_match', [{ docId: '1', docTitle: 'Aadhaar', value: '123 Main St', docType: 'aadhaar' }]),
    // parent_name missing
  ];

  const res = calculateIdentityResolutionConfidence(fields);
  assert.strictEqual(res.coverage, 0.8); // 4/5 = 0.8
  assert.strictEqual(res.summary.criticalConflicts, 0); // Not counted as mismatch
}

// 8. Duplicate uploads of the same document type do not inflate independent corroboration (C_i)
{
  const duplicateTypesField = mockField('full_name', 'Full Name', 'consistent', 'exact_normalized_match', [
    { docId: '1', docTitle: 'Aadhaar 1', value: 'Siddharth Patel', docType: 'aadhaar' },
    { docId: '2', docTitle: 'Aadhaar Copy', value: 'Siddharth Patel', docType: 'aadhaar' }, // duplicate type
  ]);

  const res = calculateIdentityResolutionConfidence([duplicateTypesField]);
  const fDetail = res.fieldScores[0];
  assert.strictEqual(fDetail.supportingDocumentTypes, 1); // 1 distinct type
  // C_1 = 1 - Math.exp(-0.9 * 1) ≈ 0.5934
  assert.ok(Math.abs(fDetail.corroboration - 0.5934) < 0.01);
}

// 9. Negative clamp & bounds check (0 - 100)
{
  const heavyPenaltyField = mockField('gender', 'Gender', 'conflicting_evidence', 'gender_difference', [
    { docId: '1', docTitle: 'Doc 1', value: 'Male', docType: 'aadhaar' },
  ], [
    { docId: '2', docTitle: 'Doc 2', value: 'Female', docType: 'pan' },
    { docId: '3', docTitle: 'Doc 3', value: 'Other', docType: 'voter_id' },
  ], 0.10); // Very low extraction

  const res = calculateIdentityResolutionConfidence([heavyPenaltyField]);
  assert.ok(res.score !== null && res.score >= 0 && res.score <= 100);
  assert.ok(res.fieldScores[0].score >= 0);
}

// 10. Forbidden words check (never use "Verified")
{
  const fields = [
    mockField('full_name', 'Full Name', 'consistent', 'exact_normalized_match', [{ docId: '1', docTitle: 'Aadhaar', value: 'Siddharth Patel', docType: 'aadhaar' }]),
  ];
  const res = calculateIdentityResolutionConfidence(fields);
  const jsonStr = JSON.stringify(res);
  assert.strictEqual(jsonStr.includes('Verified'), false, 'Output must never contain "Verified"');
  assert.strictEqual(jsonStr.includes('Authentic'), false, 'Output must never contain "Authentic"');
  assert.strictEqual(jsonStr.includes('Fraud-Free'), false, 'Output must never contain "Fraud-Free"');
}

// 11. Unmeasured extraction confidence (null) returns extractionReliability: null, lowConfidenceCapped: true, Needs Review
{
  const unmeasuredField = mockField('full_name', 'Full Name', 'consistent', 'exact_normalized_match', [
    { docId: '1', docTitle: 'Aadhaar', value: 'Siddharth Patel', docType: 'aadhaar' },
    { docId: '2', docTitle: 'PAN', value: 'Siddharth Patel', docType: 'pan' },
  ], undefined, null); // null confidence

  const res = calculateIdentityResolutionConfidence([unmeasuredField]);
  const fDetail = res.fieldScores[0];
  assert.strictEqual(fDetail.extractionReliability, null);
  assert.strictEqual(fDetail.extractionReliabilityMeasured, false);
  assert.strictEqual(fDetail.lowConfidenceCapped, true);
  assert.strictEqual(fDetail.displaySeverity, 'Needs Review');
  assert.ok(fDetail.score <= 50, `Unmeasured field score ${fDetail.score} should be <= 50`);
  assert.ok(fDetail.reason.includes('Extraction reliability was unavailable'), `Reason "${fDetail.reason}" should state unavailable`);
  assert.strictEqual(fDetail.reason.includes('50%'), false, 'Reason must not claim 50% confidence when unmeasured');
  assert.strictEqual(res.pillars?.extractionReliability, null);
}

// 12. Deterministic repeatability & immutability
{
  const fields = [
    mockField('full_name', 'Full Name', 'consistent', 'exact_normalized_match', [{ docId: '1', docTitle: 'Aadhaar', value: 'Siddharth Patel', docType: 'aadhaar' }]),
  ];
  const inputCopy = JSON.parse(JSON.stringify(fields));

  const res1 = calculateIdentityResolutionConfidence(fields);
  const res2 = calculateIdentityResolutionConfidence(fields);

  assert.deepStrictEqual(res1, res2, 'Identical inputs must produce deeply equal outputs');
  assert.deepStrictEqual(fields, inputCopy, 'Input objects must not be mutated');
}

console.log('✅ All 12 Identity Resolution Confidence unit test suites passed!');
