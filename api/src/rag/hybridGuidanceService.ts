import type { IFieldResult } from '../models/store';

import {
    buildCorrectionKit,
} from '../services/guidanceService';

import logger from '../services/logger';

import {
    generateRagGuidance,
} from './ragGuidanceService';

/**
 * Legal boundary shown with every Correction Kit.
 */
const LEGAL_BOUNDARY =
    'Nirdosh Vault identifies document inconsistencies and provides advisory guidance from official sources. It does not determine legal truth, approve corrections, or replace the issuing authority.';

type DetectedValue = {
    documentType: string;
    value: string;
};

/**
 * Safely extracts evidence values from an analysis field result.
 *
 * The exact evidence structure may vary across versions of the
 * consensus engine, so this function performs defensive checks.
 */
function extractDetectedValues(
    result: IFieldResult,
): DetectedValue[] {
    const rawResult =
        result as unknown as Record<
            string,
            unknown
        >;

    const possibleEvidence =
        rawResult.evidence ??
        rawResult.values ??
        rawResult.documents;

    if (!Array.isArray(possibleEvidence)) {
        return [];
    }

    return possibleEvidence
        .map(item => {
            if (
                !item ||
                typeof item !== 'object'
            ) {
                return null;
            }

            const record =
                item as Record<
                    string,
                    unknown
                >;

            const documentType =
                typeof record.documentType ===
                    'string'
                    ? record.documentType
                    : typeof record.docType ===
                        'string'
                        ? record.docType
                        : typeof record.sourceDocument ===
                            'string'
                            ? record.sourceDocument
                            : 'unknown_document';

            const value =
                typeof record.value === 'string'
                    ? record.value
                    : typeof record.normalized ===
                        'string'
                        ? record.normalized
                        : typeof record.evidenceText ===
                            'string'
                            ? record.evidenceText
                            : '';

            if (!value.trim()) {
                return null;
            }

            return {
                documentType,
                value,
            };
        })
        .filter(
            (
                item,
            ): item is DetectedValue =>
                item !== null,
        );
}

/**
 * Converts the RAG response into the same broad response shape used
 * by the existing Correction Kit frontend.
 */
function convertRagGuideToCorrectionKit(
    analysisId: string,
    result: IFieldResult,
    ragResponse: Awaited<
        ReturnType<
            typeof generateRagGuidance
        >
    >,
) {
    if (
        !ragResponse.found ||
        !ragResponse.guide
    ) {
        return null;
    }

    const guide =
        ragResponse.guide;

    const guideStatus =
        guide.humanReviewRequired
            ? 'authority_dependent'
            : 'guide_available';

    return {
        analysis_id:
            analysisId,

        field_result:
            result,

        guide_status:
            guideStatus,

        selected_rule_id:
            guide.groundingRuleIds[0] ??
            null,

        correction_guide: {
            title:
                guide.title,

            citizen_message:
                guide.summary,

            authority:
                guide.authority,

            jurisdiction:
                'India',

            channel:
                [
                    guide.offlineRequired
                        ? 'Aadhaar Enrolment or Update Centre'
                        : 'Official UIDAI service',
                ],

            steps:
                guide.steps,

            supporting_document_categories:
                guide.requiredDocuments,

            online_allowed:
                guide.onlineAllowed,

            offline_required:
                guide.offlineRequired,

            update_limit:
                guide.updateLimit,

            human_review_required:
                guide.humanReviewRequired,

            source_checked_date:
                guide.lastVerified,

            disclaimer:
                guide.disclaimer,
        },

        official_evidence:
            guide.officialSources.map(
                source => ({
                    authority:
                        source.authority,

                    title:
                        source.title,

                    url:
                        source.url,

                    exact_support:
                        source.effectiveDate
                            ? `Official source effective date: ${source.effectiveDate}`
                            : '',
                }),
            ),

        next_action:
            guide.humanReviewRequired
                ? 'Review the official evidence and confirm the current correction process with UIDAI before submitting the request.'
                : 'Follow the source-backed steps and confirm the latest requirements on the official UIDAI portal.',

        legal_boundary:
            LEGAL_BOUNDARY,

        data_retention: {
            raw_files_deleted_after_processing:
                true,
        },

        rag_metadata: {
            enabled:
                true,

            generated_by:
                guide.generatedBy,

            grounding_rule_ids:
                guide.groundingRuleIds,

            retrieved_record_count:
                ragResponse
                    .retrievedRecords
                    .length,

            last_verified:
                guide.lastVerified,
        },
    };
}

/**
 * Main hybrid Correction Kit function.
 *
 * Flow:
 *
 * Aadhaar + supported field
 * → attempt official-source RAG
 * → return grounded RAG guide when available
 *
 * Unsupported document / RAG failure
 * → fall back to existing verified rule-based guidance
 */
export async function buildHybridCorrectionKit(
    analysisId: string,
    result: IFieldResult,
    documentType?: string,
) {
    /*
     * The user must first select which document they want to review.
     */
    if (!documentType) {
        return buildCorrectionKit(
            analysisId,
            result,
            documentType,
        );
    }

    const normalizedDocumentType =
        documentType
            .trim()
            .toLowerCase()
            .replace(/[\s-]+/g, '_');

    /*
     * Currently the RAG knowledge base supports Aadhaar only.
     * Every other document continues using the existing rule engine.
     */
    const isAadhaar =
        normalizedDocumentType ===
        'aadhaar' ||
        normalizedDocumentType ===
        'aadhar' ||
        normalizedDocumentType ===
        'aadhaar_card' ||
        normalizedDocumentType ===
        'aadhar_card';

    if (!isAadhaar) {
        return buildCorrectionKit(
            analysisId,
            result,
            documentType,
        );
    }

    /*
     * Do not generate correction guidance for fields that are already
     * consistent or cannot be compared.
     */
    if (
        result.status === 'consistent' ||
        result.status === 'not_comparable'
    ) {
        return buildCorrectionKit(
            analysisId,
            result,
            documentType,
        );
    }

    try {
        const ragResponse =
            await generateRagGuidance({
                documentType:
                    normalizedDocumentType,

                fieldKey:
                    result.fieldKey,

                scenario:
                    result.scenario,

                issueDescription:
                    result.explanation,

                detectedValues:
                    extractDetectedValues(
                        result,
                    ),
            });

        const ragKit =
            convertRagGuideToCorrectionKit(
                analysisId,
                result,
                ragResponse,
            );

        if (ragKit) {
            logger.info(
                '[RAG] Using grounded UIDAI Correction Kit',
                {
                    analysisId,
                    fieldKey:
                        result.fieldKey,
                    documentType:
                        normalizedDocumentType,
                    ruleIds:
                        ragKit.rag_metadata
                            .grounding_rule_ids,
                },
            );

            return ragKit;
        }

        logger.info(
            '[RAG] No matching UIDAI guidance; using rule-based fallback',
            {
                analysisId,
                fieldKey:
                    result.fieldKey,
                reason:
                    ragResponse.reason,
            },
        );
    } catch (error: unknown) {
        logger.warn(
            '[RAG] Hybrid guidance failed; using existing fallback',
            {
                analysisId,
                fieldKey:
                    result.fieldKey,
                documentType:
                    normalizedDocumentType,
                error:
                    error instanceof Error
                        ? error.message
                        : String(error),
            },
        );
    }

    return buildCorrectionKit(
        analysisId,
        result,
        documentType,
    );
}