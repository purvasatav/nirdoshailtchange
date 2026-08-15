import assert from 'assert';
import { buildIdentityTrustGraph } from './identityTrustGraphService';
import type { IDocument, IFieldResult } from '../models/store';

console.log('--- Running Identity Trust Graph Service Unit Tests ---');

function mockDoc(id: string, docType: string, title?: string): IDocument {
  return {
    _id: id,
    userId: 'u1',
    docType,
    title: title || docType,
    status: 'ready',
    originalFilename: `${id}.pdf`,
    storedFilename: `${id}.pdf`,
    contentType: 'application/pdf',
    size: 1000,
    needsReview: false,
    createdAt: new Date(),
  };
}

// 1. All documents agree
{
  const docs = [mockDoc('d1', 'aadhaar', 'Aadhaar'), mockDoc('d2', 'pan', 'PAN Card')];
  const fieldResults: IFieldResult[] = [
    {
      fieldKey: 'full_name',
      label: 'Full Name',
      status: 'consistent',
      confidence: 'high',
      confidenceLabel: 'High',
      consensusValue: 'Siddharth Patel',
      supportingDocs: [
        { docId: 'd1', docTitle: 'Aadhaar', value: 'Siddharth Patel' },
        { docId: 'd2', docTitle: 'PAN Card', value: 'Siddharth Patel' },
      ],
      explanation: 'Both documents match',
      needsManualVerification: false,
      documentsContainingField: 2,
      peerEvidenceAvailable: true,
    },
  ];

  const graph = buildIdentityTrustGraph({ documents: docs, fieldResults });
  assert.ok(graph !== null);
  assert.strictEqual(graph.centralNode.displayStatus, 'strong_agreement');
  assert.strictEqual(graph.documentNodes.length, 2);
  assert.strictEqual(graph.documentNodes[0].displayStatus, 'strong_agreement');
  assert.strictEqual(graph.documentNodes[1].displayStatus, 'strong_agreement');
  assert.strictEqual(graph.documentNodes[0].relations[0].status, 'agreement');
  assert.strictEqual(graph.documentNodes[1].relations[0].status, 'agreement');
}

// 2. One outlier
{
  const docs = [
    mockDoc('d1', 'aadhaar', 'Aadhaar'),
    mockDoc('d2', 'pan', 'PAN'),
    mockDoc('d3', 'voter_id', 'Voter ID'),
  ];
  const fieldResults: IFieldResult[] = [
    {
      fieldKey: 'full_name',
      label: 'Full Name',
      status: 'outlier_detected',
      confidence: 'high',
      confidenceLabel: 'High',
      consensusValue: 'Siddharth Patel',
      supportingDocs: [
        { docId: 'd1', docTitle: 'Aadhaar', value: 'Siddharth Patel' },
        { docId: 'd2', docTitle: 'PAN', value: 'Siddharth Patel' },
      ],
      outliers: [{ docId: 'd3', docTitle: 'Voter ID', value: 'Rajesh Kumar' }],
      explanation: 'Outlier detected on Voter ID',
      needsManualVerification: true,
      documentsContainingField: 3,
      peerEvidenceAvailable: true,
    },
  ];

  const graph = buildIdentityTrustGraph({ documents: docs, fieldResults });
  assert.ok(graph !== null);
  assert.strictEqual(graph.centralNode.displayStatus, 'conflict_detected');
  assert.strictEqual(graph.documentNodes[0].displayStatus, 'strong_agreement');
  assert.strictEqual(graph.documentNodes[1].displayStatus, 'strong_agreement');
  assert.strictEqual(graph.documentNodes[2].displayStatus, 'conflict_detected');
  assert.strictEqual(graph.documentNodes[2].relations[0].status, 'conflict');
}

// 3. No-consensus conflict
{
  const docs = [mockDoc('d1', 'aadhaar', 'Aadhaar'), mockDoc('d2', 'pan', 'PAN')];
  const fieldResults: IFieldResult[] = [
    {
      fieldKey: 'date_of_birth',
      label: 'Date of Birth',
      status: 'conflicting_evidence',
      confidence: 'no_consensus',
      confidenceLabel: 'No Consensus',
      groups: [
        { value: '1990-01-01', docs: [{ docId: 'd1', docTitle: 'Aadhaar' }] },
        { value: '1992-05-10', docs: [{ docId: 'd2', docTitle: 'PAN' }] },
      ],
      explanation: 'DOB conflict',
      needsManualVerification: true,
      documentsContainingField: 2,
      peerEvidenceAvailable: true,
    },
  ];

  const graph = buildIdentityTrustGraph({ documents: docs, fieldResults });
  assert.ok(graph !== null);
  assert.strictEqual(graph.centralNode.displayStatus, 'conflict_detected');
  assert.strictEqual(graph.documentNodes[0].displayStatus, 'conflict_detected');
  assert.strictEqual(graph.documentNodes[1].displayStatus, 'conflict_detected');
  assert.strictEqual(graph.documentNodes[0].relations[0].status, 'conflict');
}

// 4. Possible variant / incomplete DOB
{
  const docs = [mockDoc('d1', 'aadhaar', 'Aadhaar'), mockDoc('d2', 'birth_cert', 'Birth Cert')];
  const fieldResults: IFieldResult[] = [
    {
      fieldKey: 'date_of_birth',
      label: 'Date of Birth',
      status: 'possible_variant',
      confidence: 'medium',
      confidenceLabel: 'Medium',
      scenario: 'year_only_same_year',
      completeEntries: [{ docId: 'd2', docTitle: 'Birth Cert', value: '2005-05-12' }],
      incompleteEntries: [{ docId: 'd1', docTitle: 'Aadhaar', value: '2005' }],
      explanation: 'Year-only match',
      needsManualVerification: true,
      documentsContainingField: 2,
      peerEvidenceAvailable: true,
    },
  ];

  const graph = buildIdentityTrustGraph({ documents: docs, fieldResults });
  assert.ok(graph !== null);
  assert.strictEqual(graph.centralNode.displayStatus, 'review_recommended');
  assert.strictEqual(graph.documentNodes[0].relations[0].status, 'expected_variation');
}

// 5. Single-document evidence
{
  const docs = [mockDoc('d1', 'aadhaar', 'Aadhaar'), mockDoc('d2', 'pan', 'PAN')];
  const fieldResults: IFieldResult[] = [
    {
      fieldKey: 'father_name',
      label: 'Father Name',
      status: 'consistent',
      confidence: 'high',
      confidenceLabel: 'High',
      supportingDocs: [{ docId: 'd1', docTitle: 'Aadhaar', value: 'Ramesh Patel' }],
      explanation: 'Single document field',
      needsManualVerification: false,
      documentsContainingField: 1,
      peerEvidenceAvailable: false,
    },
  ];

  const graph = buildIdentityTrustGraph({ documents: docs, fieldResults });
  assert.ok(graph !== null);
  assert.strictEqual(graph.documentNodes[0].relations[0].status, 'insufficient_evidence');
}

// 6. Document with no comparable fields
{
  const docs = [mockDoc('d1', 'aadhaar', 'Aadhaar'), mockDoc('d2', 'utility_bill', 'Utility Bill')];
  const fieldResults: IFieldResult[] = [
    {
      fieldKey: 'full_name',
      label: 'Full Name',
      status: 'consistent',
      confidence: 'high',
      confidenceLabel: 'High',
      supportingDocs: [{ docId: 'd1', docTitle: 'Aadhaar', value: 'Siddharth Patel' }],
      explanation: 'Only on Aadhaar',
      needsManualVerification: false,
      documentsContainingField: 1,
      peerEvidenceAvailable: false,
    },
  ];

  const graph = buildIdentityTrustGraph({ documents: docs, fieldResults });
  assert.ok(graph !== null);
  assert.strictEqual(graph.documentNodes[1].relations.length, 0);
  assert.strictEqual(graph.documentNodes[1].displayStatus, 'insufficient_evidence');
}

// 7. Old analysis without graph data (handling null/undefined gracefully)
{
  const graph = buildIdentityTrustGraph({ documents: [], fieldResults: [] });
  assert.strictEqual(graph, null);
}

// 8. Deterministic repeatability
{
  const docs = [mockDoc('d1', 'aadhaar', 'Aadhaar'), mockDoc('d2', 'pan', 'PAN Card')];
  const fieldResults: IFieldResult[] = [
    {
      fieldKey: 'full_name',
      label: 'Full Name',
      status: 'consistent',
      confidence: 'high',
      confidenceLabel: 'High',
      consensusValue: 'Siddharth Patel',
      supportingDocs: [
        { docId: 'd1', docTitle: 'Aadhaar', value: 'Siddharth Patel' },
        { docId: 'd2', docTitle: 'PAN Card', value: 'Siddharth Patel' },
      ],
      explanation: 'Both documents match',
      needsManualVerification: false,
      documentsContainingField: 2,
      peerEvidenceAvailable: true,
    },
  ];

  const g1 = buildIdentityTrustGraph({ documents: docs, fieldResults });
  const g2 = buildIdentityTrustGraph({ documents: docs, fieldResults });

  assert.deepStrictEqual(g1, g2);

  // Forbidden words check
  const jsonStr = JSON.stringify(g1).toLowerCase();
  for (const word of ['trusted', 'fake', 'invalid', 'authentic', 'verified']) {
    assert.strictEqual(jsonStr.includes(word), false, `Graph output must never contain forbidden word "${word}"`);
  }
}

console.log('✅ All 8 Identity Trust Graph Service unit test suites passed!');
