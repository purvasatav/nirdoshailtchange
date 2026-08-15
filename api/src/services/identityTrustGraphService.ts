import type { IDocument, IFieldResult } from '../models/store';
import type { IdentityResolutionConfidenceResult } from '../scoring/scoringTypes';

export type RelationStatus =
  | 'agreement'
  | 'expected_variation'
  | 'conflict'
  | 'insufficient_evidence';

export type DocumentDisplayStatus =
  | 'strong_agreement'
  | 'review_recommended'
  | 'conflict_detected'
  | 'insufficient_evidence';

export interface DocumentFieldRelation {
  fieldKey: string;
  label: string;
  status: RelationStatus;
  consensusValue?: string;
  documentValue?: string;
  explanation?: string;
}

export interface GraphRelationSummary {
  agreement: number;
  expected_variation: number;
  conflict: number;
  insufficient_evidence: number;
}

export interface GraphDocumentNode {
  id: string;
  title: string;
  docType: string;
  displayStatus: DocumentDisplayStatus;
  relations: DocumentFieldRelation[];
  summary: GraphRelationSummary;
}

export interface CentralGraphNode {
  id: string;
  label: string;
  displayStatus: DocumentDisplayStatus;
}

export interface GraphSummary {
  totalDocuments: number;
  strongAgreementCount: number;
  reviewRecommendedCount: number;
  conflictDetectedCount: number;
  insufficientEvidenceCount: number;
}

export interface IdentityTrustGraphData {
  centralNode: CentralGraphNode;
  documentNodes: GraphDocumentNode[];
  summary: GraphSummary;
}

export interface IdentityTrustGraphInput {
  documents: IDocument[];
  fieldResults: IFieldResult[];
  identityResolutionConfidence?: IdentityResolutionConfidenceResult;
}

function deriveRelationStatus(
  doc: IDocument,
  fr: IFieldResult
): { status: RelationStatus; docValue?: string } | null {
  const supportingEntry = fr.supportingDocs?.find((d) => d.docId === doc._id);
  const outlierEntry = fr.outliers?.find((d) => d.docId === doc._id);
  const completeEntry = fr.completeEntries?.find((d) => d.docId === doc._id);
  const incompleteEntry = fr.incompleteEntries?.find((d) => d.docId === doc._id);

  let groupEntryValue: string | undefined;
  let inGroup = false;
  if (Array.isArray(fr.groups)) {
    for (const g of fr.groups) {
      if (g.docs?.some((d) => d.docId === doc._id)) {
        inGroup = true;
        groupEntryValue = g.value;
        break;
      }
    }
  }

  const docValue =
    supportingEntry?.value ??
    outlierEntry?.value ??
    completeEntry?.value ??
    incompleteEntry?.value ??
    groupEntryValue;

  const inField = Boolean(
    supportingEntry || outlierEntry || completeEntry || incompleteEntry || inGroup
  );

  if (!inField) {
    return null; // Document does not contain this comparable field
  }

  // STOP CONDITION: If critical evidence property is missing when status calls for it, do not infer
  if (
    (fr.status === 'conflicting_evidence' && (!fr.groups || fr.groups.length === 0)) ||
    (fr.status === 'outlier_detected' && (!fr.outliers || fr.outliers.length === 0))
  ) {
    return { status: 'insufficient_evidence', docValue };
  }

  // Single-document evidence or missing peer consensus
  const totalDocsCount = fr.documentsContainingField ?? (
    (fr.supportingDocs?.length || 0) +
    (fr.outliers?.length || 0) +
    (fr.completeEntries?.length || 0) +
    (fr.incompleteEntries?.length || 0)
  );

  if (
    totalDocsCount <= 1 ||
    fr.peerEvidenceAvailable === false ||
    fr.status === 'missing' ||
    fr.status === 'not_comparable' ||
    fr.status === 'extraction_uncertain'
  ) {
    return { status: 'insufficient_evidence', docValue };
  }

  // Conflict
  const statusStr = fr.status as string;
  if (
    outlierEntry ||
    (incompleteEntry && statusStr === 'incomplete_date_conflict') ||
    statusStr === 'conflicting_evidence' ||
    statusStr === 'mismatch'
  ) {
    return { status: 'conflict', docValue };
  }

  // Expected variation
  if (
    statusStr === 'possible_variant' ||
    (fr.scenario && (
      fr.scenario.includes('variant') ||
      fr.scenario.includes('year_only') ||
      fr.scenario.includes('initial') ||
      fr.scenario.includes('middle_name')
    ))
  ) {
    return { status: 'expected_variation', docValue };
  }

  // Agreement
  if (
    supportingEntry ||
    completeEntry ||
    statusStr === 'consistent' ||
    (fr.consensusValue && docValue === fr.consensusValue)
  ) {
    return { status: 'agreement', docValue };
  }

  return { status: 'insufficient_evidence', docValue };
}

export function buildIdentityTrustGraph(
  input: IdentityTrustGraphInput
): IdentityTrustGraphData | null {
  const { documents, fieldResults } = input;

  if (!Array.isArray(documents) || documents.length === 0) {
    return null;
  }

  const documentNodes: GraphDocumentNode[] = [];

  let strongAgreementCount = 0;
  let reviewRecommendedCount = 0;
  let conflictDetectedCount = 0;
  let insufficientEvidenceCount = 0;

  for (const doc of documents) {
    const relations: DocumentFieldRelation[] = [];
    const relationSummary: GraphRelationSummary = {
      agreement: 0,
      expected_variation: 0,
      conflict: 0,
      insufficient_evidence: 0,
    };

    if (Array.isArray(fieldResults)) {
      for (const fr of fieldResults) {
        const derived = deriveRelationStatus(doc, fr);
        if (derived) {
          relations.push({
            fieldKey: fr.fieldKey,
            label: fr.label,
            status: derived.status,
            consensusValue: fr.consensusValue,
            documentValue: derived.docValue,
            explanation: fr.explanation,
          });
          relationSummary[derived.status]++;
        }
      }
    }

    let displayStatus: DocumentDisplayStatus = 'insufficient_evidence';
    if (relationSummary.conflict > 0) {
      displayStatus = 'conflict_detected';
      conflictDetectedCount++;
    } else if (relationSummary.expected_variation > 0) {
      displayStatus = 'review_recommended';
      reviewRecommendedCount++;
    } else if (relationSummary.agreement > 0) {
      displayStatus = 'strong_agreement';
      strongAgreementCount++;
    } else {
      insufficientEvidenceCount++;
    }

    documentNodes.push({
      id: doc._id,
      title: doc.title || doc.docType,
      docType: doc.docType,
      displayStatus,
      relations,
      summary: relationSummary,
    });
  }

  let centralDisplayStatus: DocumentDisplayStatus = 'insufficient_evidence';
  if (conflictDetectedCount > 0) {
    centralDisplayStatus = 'conflict_detected';
  } else if (reviewRecommendedCount > 0) {
    centralDisplayStatus = 'review_recommended';
  } else if (strongAgreementCount > 0) {
    centralDisplayStatus = 'strong_agreement';
  }

  return {
    centralNode: {
      id: 'consensus_profile',
      label: 'Consensus Identity Profile',
      displayStatus: centralDisplayStatus,
    },
    documentNodes,
    summary: {
      totalDocuments: documents.length,
      strongAgreementCount,
      reviewRecommendedCount,
      conflictDetectedCount,
      insufficientEvidenceCount,
    },
  };
}
