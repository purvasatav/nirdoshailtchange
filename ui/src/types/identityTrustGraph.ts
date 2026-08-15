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
