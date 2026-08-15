import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { DocumentStore, AnalysisStore } from '../models/store';
import { runConsensusEngine } from '../services/consensusService';
import { calculateIdentityResolutionConfidence } from '../scoring/identityResolutionConfidenceService';
import { buildIdentityTrustGraph } from '../services/identityTrustGraphService';
import {
  generateGuidance,
} from '../services/guidanceService';
import {
  buildHybridCorrectionKit,
} from '../rag/hybridGuidanceService';
import { generateChecklist } from '../services/checklistService';
import { AuditService } from '../services/auditService';
import logger from '../services/logger';

const router = Router();

/**
 * Convert field keys and labels into a predictable format.
 *
 * Examples:
 * "License Number"     -> "license_number"
 * "PAN-Card Number"    -> "pan_card_number"
 * "Aadhaar No."        -> "aadhaar_no"
 */
function normalizeFieldKey(fieldKey: unknown): string {
  return String(fieldKey ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s./-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Government and financial identifiers that should not be returned
 * in full through analysis APIs.
 *
 * This list deliberately excludes ordinary identity attributes such as:
 * - name
 * - date of birth
 * - address
 * - gender
 * - blood group
 * - issue date
 * - expiry date
 * - vehicle class
 */
const SENSITIVE_IDENTIFIER_KEYS = new Set([
  // Aadhaar / UID
  'aadhaar',
  'aadhar',
  'aadhaar_no',
  'aadhar_no',
  'aadhaar_number',
  'aadhar_number',
  'aadhaar_card_number',
  'aadhar_card_number',
  'uid',
  'uid_no',
  'uid_number',
  'uidai',
  'uidai_no',
  'uidai_number',
  'unique_identification_number',

  // PAN
  'pan',
  'pan_no',
  'pan_number',
  'pan_card',
  'pan_card_no',
  'pan_card_number',
  'permanent_account_number',

  // Driving licence
  'license_no',
  'licence_no',
  'license_number',
  'licence_number',
  'driving_license_no',
  'driving_licence_no',
  'driving_license_number',
  'driving_licence_number',
  'dl_no',
  'dl_number',

  // Passport
  'passport',
  'passport_no',
  'passport_number',

  // Voter ID
  'voter_id',
  'voter_id_no',
  'voter_id_number',
  'epic',
  'epic_no',
  'epic_number',

  // Ration card
  'ration_card',
  'ration_card_no',
  'ration_card_number',

  // Health and employment identifiers
  'abha',
  'abha_no',
  'abha_number',
  'uan',
  'uan_no',
  'uan_number',
  'esic_no',
  'esic_number',

  // Banking identifiers
  'bank_account',
  'bank_account_no',
  'bank_account_number',
  'account_no',
  'account_number',
  'credit_card_no',
  'credit_card_number',
  'debit_card_no',
  'debit_card_number',

  // Government certificate or application identifiers
  'certificate_no',
  'certificate_number',
  'registration_no',
  'registration_number',
  'application_no',
  'application_number',
  'enrolment_no',
  'enrollment_no',
  'enrolment_number',
  'enrollment_number',
]);

/**
 * Fields that should not expose OCR-generated text.
 *
 * A signature is an image or mark. OCR may incorrectly interpret it
 * as a person's name, but that output must not be treated as verified
 * signature information.
 */
const VISUAL_ONLY_FIELDS = new Set([
  'signature',
  'holder_signature',
  'applicant_signature',
  'authorised_signature',
  'authorized_signature',
  'thumb_impression',
  'fingerprint',
  'photograph',
  'photo',
  'profile_photo',
]);

function isSensitiveIdentifierField(fieldKey: unknown): boolean {
  const key = normalizeFieldKey(fieldKey);

  if (SENSITIVE_IDENTIFIER_KEYS.has(key)) {
    return true;
  }

  /*
   * Defensive matching for extraction-model variations.
   */
  return (
    key.includes('aadhaar') ||
    key.includes('aadhar') ||
    key === 'uid' ||
    key.startsWith('uid_') ||
    key.includes('pan_number') ||
    key.includes('passport_number') ||
    key.includes('license_number') ||
    key.includes('licence_number') ||
    key.includes('driving_license') ||
    key.includes('driving_licence') ||
    key.includes('voter_id') ||
    key.includes('epic_number') ||
    key.includes('ration_card_number') ||
    key.includes('bank_account_number')
  );
}

function isVisualOnlyField(fieldKey: unknown): boolean {
  return VISUAL_ONLY_FIELDS.has(normalizeFieldKey(fieldKey));
}

function compactIdentifier(value: unknown): string {
  return String(value ?? '')
    .trim()
    .replace(/[\s-]+/g, '')
    .toUpperCase();
}

function looksLikeAadhaar(value: unknown): boolean {
  return /^\d{12}$/.test(compactIdentifier(value));
}

function looksLikePan(value: unknown): boolean {
  return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(
    compactIdentifier(value)
  );
}

function looksLikeBankAccount(value: unknown): boolean {
  return /^\d{9,18}$/.test(compactIdentifier(value));
}

function shouldMaskValue(
  fieldKey: unknown,
  value: unknown
): boolean {
  return (
    isSensitiveIdentifierField(fieldKey) ||
    looksLikeAadhaar(value) ||
    looksLikePan(value) ||
    (
      normalizeFieldKey(fieldKey).includes('account') &&
      looksLikeBankAccount(value)
    )
  );
}

/**
 * Mask identifiers while preserving enough trailing characters for
 * the user to recognise which document record was used.
 */
function maskIdentifier(
  fieldKey: unknown,
  value: unknown
): string {
  const compactValue = compactIdentifier(value);

  if (!compactValue) {
    return '';
  }

  const key = normalizeFieldKey(fieldKey);

  /*
   * PAN is commonly recognised by its final five characters.
   */
  if (
    key.includes('pan') ||
    looksLikePan(compactValue)
  ) {
    return `••••${compactValue.slice(-5)}`;
  }

  /*
   * For all other identifiers, reveal only the last four characters.
   */
  const visibleLength = Math.min(4, compactValue.length);

  return `••••${compactValue.slice(-visibleLength)}`;
}

function sanitizeVisualFieldValue(
  fieldKey: unknown,
  value: unknown
): unknown {
  if (!isVisualOnlyField(fieldKey)) {
    return value;
  }

  const normalizedValue = String(value ?? '')
    .trim()
    .toLowerCase();

  if (
    !normalizedValue ||
    normalizedValue === 'not detected' ||
    normalizedValue === 'absent' ||
    normalizedValue === 'no'
  ) {
    return 'Not detected';
  }

  return 'Detected — visual verification required';
}

function sanitizeReference(
  reference: any,
  fieldKey: unknown
): any {
  if (!reference || typeof reference !== 'object') {
    return reference;
  }

  if (isVisualOnlyField(fieldKey)) {
    return {
      ...reference,
      value: sanitizeVisualFieldValue(
        fieldKey,
        reference.value
      ),
      normalized: undefined,
      evidenceText: undefined,
    };
  }

  if (
    !shouldMaskValue(
      fieldKey,
      reference.value
    )
  ) {
    return reference;
  }

  return {
    ...reference,
    value: maskIdentifier(
      fieldKey,
      reference.value
    ),
    normalized: undefined,
    evidenceText: undefined,
  };
}

function sanitizeFieldResult(result: any): any {
  if (!result || typeof result !== 'object') {
    return result;
  }

  const fieldKey =
    result.fieldKey ??
    result.fieldName ??
    result.label;

  const visualOnly = isVisualOnlyField(fieldKey);

  const safeConsensusValue = visualOnly
    ? sanitizeVisualFieldValue(
      fieldKey,
      result.consensusValue
    )
    : shouldMaskValue(
      fieldKey,
      result.consensusValue
    )
      ? maskIdentifier(
        fieldKey,
        result.consensusValue
      )
      : result.consensusValue;

  return {
    ...result,

    consensusValue: safeConsensusValue,

    evidence: Array.isArray(result.evidence)
      ? result.evidence.map((entry: any) =>
        sanitizeReference(entry, fieldKey)
      )
      : result.evidence,

    supportingDocs: Array.isArray(
      result.supportingDocs
    )
      ? result.supportingDocs.map((entry: any) =>
        sanitizeReference(entry, fieldKey)
      )
      : result.supportingDocs,

    outliers: Array.isArray(result.outliers)
      ? result.outliers.map((entry: any) =>
        sanitizeReference(entry, fieldKey)
      )
      : result.outliers,

    groups: Array.isArray(result.groups)
      ? result.groups.map((group: any) => ({
        ...group,

        value: visualOnly
          ? sanitizeVisualFieldValue(
            fieldKey,
            group.value
          )
          : shouldMaskValue(
            fieldKey,
            group.value
          )
            ? maskIdentifier(
              fieldKey,
              group.value
            )
            : group.value,

        docs: Array.isArray(group.docs)
          ? group.docs.map((doc: any) =>
            sanitizeReference(doc, fieldKey)
          )
          : group.docs,
      }))
      : result.groups,
  };
}

function sanitizeDocumentSpecificField(
  field: any
): any {
  if (!field || typeof field !== 'object') {
    return field;
  }

  /*
   * consensusService currently returns fieldName rather than fieldKey
   * for document-specific fields, so both forms must be supported.
   */
  const fieldKey =
    field.fieldKey ??
    field.fieldName ??
    field.label;

  if (isVisualOnlyField(fieldKey)) {
    return {
      ...field,
      value: sanitizeVisualFieldValue(
        fieldKey,
        field.value
      ),
      normalized: undefined,
      evidenceText: undefined,
    };
  }

  if (
    !shouldMaskValue(
      fieldKey,
      field.value
    )
  ) {
    return field;
  }

  return {
    ...field,
    value: maskIdentifier(
      fieldKey,
      field.value
    ),
    normalized: undefined,
    evidenceText: undefined,
  };
}

function sanitizeIdentityTrustGraph(graph: any): any {
  if (!graph || typeof graph !== 'object') {
    return graph;
  }

  return {
    ...graph,
    documentNodes: Array.isArray(graph.documentNodes)
      ? graph.documentNodes.map((node: any) => ({
          ...node,
          relations: Array.isArray(node.relations)
            ? node.relations.map((rel: any) => ({
                ...rel,
                consensusValue: shouldMaskValue(rel.fieldKey, rel.consensusValue)
                  ? maskIdentifier(rel.fieldKey, rel.consensusValue)
                  : rel.consensusValue,
                documentValue: shouldMaskValue(rel.fieldKey, rel.documentValue)
                  ? maskIdentifier(rel.fieldKey, rel.documentValue)
                  : rel.documentValue,
              }))
            : node.relations,
        }))
      : graph.documentNodes,
  };
}

function safeAnalysis(analysis: any): any {
  if (!analysis) {
    return null;
  }

  return {
    ...analysis,

    fieldResults: Array.isArray(
      analysis.fieldResults
    )
      ? analysis.fieldResults.map(
        sanitizeFieldResult
      )
      : [],

    documentSpecificFields: Array.isArray(
      analysis.documentSpecificFields
    )
      ? analysis.documentSpecificFields.map(
        sanitizeDocumentSpecificField
      )
      : [],

    identityResolutionConfidence:
      analysis.identityResolutionConfidence,

    identityTrustGraph: sanitizeIdentityTrustGraph(
      analysis.identityTrustGraph
    ),
  };
}

/**
 * Recursively sanitize correction-kit output.
 *
 * This is defensive protection in case a correction template,
 * generated guidance or nested object unexpectedly contains a full
 * identifier.
 */
function sanitizeCorrectionKit(
  value: any,
  parentFieldKey: unknown
): any {
  if (Array.isArray(value)) {
    return value.map((item) =>
      sanitizeCorrectionKit(
        item,
        parentFieldKey
      )
    );
  }

  if (
    value &&
    typeof value === 'object'
  ) {
    const output: Record<string, any> = {};

    for (const [key, nestedValue] of Object.entries(value)) {
      const effectiveFieldKey =
        key === 'value' ||
          key === 'normalized' ||
          key === 'evidenceText'
          ? parentFieldKey
          : key;

      if (
        key === 'normalized' &&
        (
          isSensitiveIdentifierField(parentFieldKey) ||
          isVisualOnlyField(parentFieldKey)
        )
      ) {
        output[key] = undefined;
        continue;
      }

      if (
        key === 'evidenceText' &&
        (
          isSensitiveIdentifierField(parentFieldKey) ||
          isVisualOnlyField(parentFieldKey)
        )
      ) {
        output[key] = undefined;
        continue;
      }

      output[key] = sanitizeCorrectionKit(
        nestedValue,
        effectiveFieldKey
      );
    }

    return output;
  }

  if (
    typeof value === 'string'
  ) {
    if (isVisualOnlyField(parentFieldKey)) {
      return sanitizeVisualFieldValue(
        parentFieldKey,
        value
      );
    }

    if (
      shouldMaskValue(
        parentFieldKey,
        value
      )
    ) {
      return maskIdentifier(
        parentFieldKey,
        value
      );
    }
  }

  return value;
}

router.post(
  '/analyze',
  authenticate,
  async (
    req: AuthRequest,
    res: Response
  ): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
      });
      return;
    }

    const userDocs = DocumentStore
      .findByUser(req.user.id)
      .filter(
        (document) =>
          document.status === 'ready'
      );

    if (userDocs.length < 2) {
      res.status(400).json({
        error:
          'At least 2 processed documents are required for analysis',
      });
      return;
    }

    try {
      AuditService.log(
        req.user.id,
        'analysis.started',
        {
          documentCount: userDocs.length,
        },
        req
      );

      const engineData =
        runConsensusEngine(userDocs);

      const identityResolutionConfidence =
        calculateIdentityResolutionConfidence({
          fieldResults: engineData.fieldResults,
          allComparableFieldResults:
            engineData.allComparableFieldResults ??
            engineData.fieldResults,
          documentTypes: userDocs.map(
            (document) => document.docType
          ),
          totalUploadedDocuments: userDocs.length,
        });

      const identityTrustGraph =
        buildIdentityTrustGraph({
          documents: userDocs,
          fieldResults: engineData.fieldResults,
          identityResolutionConfidence,
        });

      const guidance =
        await generateGuidance(
          engineData.fieldResults
        );

      const checklist =
        generateChecklist(
          userDocs.map(
            (document) =>
              document.docType
          ),
          engineData.documentSpecificFields
        );

      const analysis =
        AnalysisStore.create({
          userId: req.user.id,

          documentIds: userDocs.map(
            (document) =>
              document._id
          ),

          status: 'complete',
          fieldResults:
            engineData.fieldResults,
          summary: engineData.summary,
          documentSpecificFields:
            engineData.documentSpecificFields,
          guidance,
          checklist,
          identityResolutionConfidence,
          identityTrustGraph: identityTrustGraph ?? undefined,
        });

      AuditService.log(
        req.user.id,
        'analysis.completed',
        {
          analysisId: analysis._id,
          summary: engineData.summary,
        },
        req
      );

      res
        .status(201)
        .json(
          safeAnalysis(analysis)
        );
    } catch (error) {
      logger.error(
        'Analysis failed',
        {
          error:
            error instanceof Error
              ? error.message
              : String(error),
        }
      );

      res.status(500).json({
        error: 'Analysis failed',
      });
    }
  }
);

router.post(
  '/:id/correction-kit',
  authenticate,
  async (
    req: AuthRequest,
    res: Response
  ): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
      });
      return;
    }

    const analysis =
      AnalysisStore.findById(
        req.params.id
      );

    if (
      !analysis ||
      analysis.userId !== req.user.id
    ) {
      res.status(404).json({
        error: 'Analysis not found',
      });
      return;
    }

    const {
      fieldKey,
      documentId,
    } = req.body ?? {};

    if (
      typeof fieldKey !== 'string' ||
      !fieldKey.trim()
    ) {
      res.status(400).json({
        error: 'fieldKey is required',
      });
      return;
    }

    if (
      documentId !== undefined &&
      typeof documentId !== 'string'
    ) {
      res.status(400).json({
        error:
          'documentId must be a string',
      });
      return;
    }

    const result =
      analysis.fieldResults.find(
        (fieldResult: any) =>
          fieldResult.fieldKey ===
          fieldKey
      );

    if (!result) {
      res.status(404).json({
        error:
          'Field result not found',
      });
      return;
    }

    const document = documentId
      ? DocumentStore.findById(
        documentId
      )
      : undefined;

    if (
      documentId &&
      !document
    ) {
      res.status(404).json({
        error:
          'Selected document not found',
      });
      return;
    }

    if (
      document &&
      (
        !analysis.documentIds.includes(
          document._id
        ) ||
        document.userId !==
        req.user.id
      )
    ) {
      res.status(400).json({
        error:
          'Selected document is not part of this analysis',
      });
      return;
    }

    try {
      const kit =
        await buildHybridCorrectionKit(
          analysis._id,
          result,
          document?.docType
        );

      AuditService.log(
        req.user.id,
        'correction_kit.requested',
        {
          analysisId: analysis._id,
          fieldKey,
          documentId:
            documentId ?? null,
          documentType:
            document?.docType ?? null,
          guideStatus:
            kit.guide_status,
          ragEnabled:
            Boolean(
              (
                kit as {
                  rag_metadata?: {
                    enabled?: boolean;
                  };
                }
              ).rag_metadata?.enabled
            ),
        },
        req
      );

      res.status(200).json(
        sanitizeCorrectionKit(
          kit,
          fieldKey
        )
      );
    } catch (error: unknown) {
      logger.error(
        'Correction Kit generation failed',
        {
          analysisId:
            analysis._id,
          fieldKey,
          documentId:
            documentId ?? null,
          documentType:
            document?.docType ?? null,
          error:
            error instanceof Error
              ? error.message
              : String(error),
        }
      );

      res.status(500).json({
        error:
          'Correction Kit generation failed',
      });
    }
  }
);

router.get(
  '/:id',
  authenticate,
  (
    req: AuthRequest,
    res: Response
  ): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
      });
      return;
    }

    const analysis =
      AnalysisStore.findById(
        req.params.id
      );

    if (
      !analysis ||
      analysis.userId !== req.user.id
    ) {
      res.status(404).json({
        error: 'Analysis not found',
      });
      return;
    }

    res.json(
      safeAnalysis(analysis)
    );
  }
);

router.get(
  '/',
  authenticate,
  (
    req: AuthRequest,
    res: Response
  ): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
      });
      return;
    }

    const analyses =
      AnalysisStore
        .findByUser(req.user.id)
        .sort(
          (
            first: any,
            second: any
          ) =>
            new Date(
              second.createdAt
            ).getTime() -
            new Date(
              first.createdAt
            ).getTime()
        )
        .map(safeAnalysis);

    res.json({
      analyses,
    });
  }
);

export default router;