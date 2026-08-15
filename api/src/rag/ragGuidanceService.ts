import { GoogleGenerativeAI } from '@google/generative-ai';

import { config } from '../config';
import logger from '../services/logger';

import {
    buildOfficialContext,
    retrieveOfficialGuidance,
    RagGuidanceRecord,
} from './retrievalService';

/* -------------------------------------------------------------------------- */
/*                                   Types                                    */
/* -------------------------------------------------------------------------- */

export type RagGuidanceRequest = {
    documentType: string;
    fieldKey: string;
    scenario?: string;
    issueDescription?: string;
    detectedValues?: Array<{
        documentType: string;
        value: string;
    }>;
};

export type RagOfficialSource = {
    title: string;
    url: string;
    authority: string;
    effectiveDate: string;
};

export type RagCorrectionGuide = {
    title: string;
    summary: string;
    authority: string;

    steps: string[];
    requiredDocuments: string[];

    onlineAllowed: boolean | null;
    offlineRequired: boolean | null;

    updateLimit: string;
    warnings: string[];

    humanReviewRequired: boolean;

    officialSources: RagOfficialSource[];

    lastVerified: string;
    generatedBy: 'rag_gemini' | 'rag_template';
    groundingRuleIds: string[];

    disclaimer: string;
};

export type RagGuidanceResponse = {
    found: boolean;
    guide: RagCorrectionGuide | null;
    retrievedRecords: RagGuidanceRecord[];
    fallbackRequired: boolean;
    reason?: string;
};

/* -------------------------------------------------------------------------- */
/*                                  Gemini                                    */
/* -------------------------------------------------------------------------- */

const genAI = new GoogleGenerativeAI(
    config.gemini.apiKey,
);

const LEGAL_DISCLAIMER =
    'Nirdosh Vault identifies document inconsistencies and provides advisory guidance from official sources. It does not determine legal truth, approve corrections, or replace the issuing authority.';

/* -------------------------------------------------------------------------- */
/*                              Helper Functions                              */
/* -------------------------------------------------------------------------- */

function cleanText(value: unknown): string {
    return typeof value === 'string'
        ? value.trim()
        : '';
}

function cleanStringArray(
    value: unknown,
): string[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .filter(
            (item): item is string =>
                typeof item === 'string',
        )
        .map(item => item.trim())
        .filter(Boolean);
}

function parseBooleanOrNull(
    value: unknown,
): boolean | null {
    if (typeof value === 'boolean') {
        return value;
    }

    return null;
}

function extractJsonObject(
    responseText: string,
): Record<string, unknown> {
    const cleaned = responseText
        .trim()
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

    try {
        const parsed = JSON.parse(cleaned);

        if (
            parsed &&
            typeof parsed === 'object' &&
            !Array.isArray(parsed)
        ) {
            return parsed as Record<
                string,
                unknown
            >;
        }
    } catch {
        // Try extracting the first JSON object below.
    }

    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');

    if (
        start === -1 ||
        end === -1 ||
        end <= start
    ) {
        throw new Error(
            'Gemini response did not contain a valid JSON object.',
        );
    }

    const candidate =
        cleaned.slice(start, end + 1);

    const parsed = JSON.parse(candidate);

    if (
        !parsed ||
        typeof parsed !== 'object' ||
        Array.isArray(parsed)
    ) {
        throw new Error(
            'Gemini returned an invalid JSON structure.',
        );
    }

    return parsed as Record<
        string,
        unknown
    >;
}

function buildSourceList(
    records: RagGuidanceRecord[],
): RagOfficialSource[] {
    const seen = new Set<string>();
    const sources: RagOfficialSource[] = [];

    for (const record of records) {
        for (const source of record.sources) {
            const url =
                source.url ||
                record.official_portal;

            const uniqueKey = [
                source.title,
                url,
            ].join('|');

            if (seen.has(uniqueKey)) {
                continue;
            }

            seen.add(uniqueKey);

            sources.push({
                title: source.title,
                url,
                authority:
                    record.issuing_authority,
                effectiveDate:
                    source.effective_date,
            });
        }
    }

    return sources;
}

function buildDetectedEvidence(
    detectedValues:
        | RagGuidanceRequest['detectedValues']
        | undefined,
): string {
    if (
        !detectedValues ||
        detectedValues.length === 0
    ) {
        return 'No individual document values were supplied.';
    }

    return detectedValues
        .map(
            item =>
                `- ${item.documentType}: ${item.value}`,
        )
        .join('\n');
}

/* -------------------------------------------------------------------------- */
/*                              Prompt Builder                                */
/* -------------------------------------------------------------------------- */

function buildGroundedPrompt(
    request: RagGuidanceRequest,
    officialContext: string,
): string {
    return `
You are the correction-guidance component of Nirdosh Vault.

Generate a citizen-friendly correction guide using ONLY the official evidence provided below.

STRICT RULES:

1. Do not use general knowledge.
2. Do not invent procedures, documents, fees, timelines, eligibility rules or legal consequences.
3. Do not decide which uploaded document is legally correct.
4. Do not tell the user that a correction is guaranteed to be approved.
5. If the official evidence is incomplete or ambiguous, clearly say that the issuing authority must confirm the current procedure.
6. Preserve important warnings, update limits and human-review requirements.
7. Return valid JSON only.
8. Do not include markdown or text outside the JSON object.

Detected issue:

Document type: ${request.documentType}
Field: ${request.fieldKey}
Scenario: ${request.scenario ?? 'not specified'}
Issue description: ${request.issueDescription ?? 'not specified'}

Detected document values:

${buildDetectedEvidence(request.detectedValues)}

Official retrieved evidence:

${officialContext}

Return exactly this JSON structure:

{
  "title": "short correction guide title",
  "summary": "clear citizen-friendly explanation",
  "authority": "issuing authority",
  "steps": [
    "step 1",
    "step 2"
  ],
  "requiredDocuments": [
    "required document category"
  ],
  "onlineAllowed": true,
  "offlineRequired": false,
  "updateLimit": "official limit or not specified",
  "warnings": [
    "important warning"
  ],
  "humanReviewRequired": true
}
`.trim();
}

/* -------------------------------------------------------------------------- */
/*                         Template-Based Safe Fallback                       */
/* -------------------------------------------------------------------------- */

function buildTemplateGuide(
    records: RagGuidanceRecord[],
    lastVerified: string,
): RagCorrectionGuide {
    const primary = records[0];

    const steps = Array.from(
        new Set(
            records.flatMap(
                record => record.procedure,
            ),
        ),
    );

    const requiredDocuments =
        Array.from(
            new Set(
                records.flatMap(
                    record =>
                        record.required_document_categories,
                ),
            ),
        );

    const warnings = Array.from(
        new Set(
            records.flatMap(
                record => record.warnings,
            ),
        ),
    );

    return {
        title: primary.title,

        summary:
            primary.when_applicable,

        authority:
            primary.issuing_authority,

        steps,

        requiredDocuments,

        onlineAllowed:
            primary.online_allowed,

        offlineRequired:
            primary.offline_required,

        updateLimit:
            primary.update_limit,

        warnings,

        humanReviewRequired:
            records.some(
                record =>
                    record.human_review_required,
            ),

        officialSources:
            buildSourceList(records),

        lastVerified,

        generatedBy:
            'rag_template',

        groundingRuleIds:
            records.map(record => record.id),

        disclaimer:
            LEGAL_DISCLAIMER,
    };
}

/* -------------------------------------------------------------------------- */
/*                           Gemini Guide Generation                          */
/* -------------------------------------------------------------------------- */

async function generateWithGemini(
    request: RagGuidanceRequest,
    records: RagGuidanceRecord[],
    officialContext: string,
    lastVerified: string,
): Promise<RagCorrectionGuide> {
    if (!config.gemini.apiKey) {
        logger.warn(
            '[RAG] Gemini API key unavailable; using template-based guidance.',
        );

        return buildTemplateGuide(
            records,
            lastVerified,
        );
    }

    const model =
        genAI.getGenerativeModel({
            model: config.gemini.model,
            generationConfig: {
                temperature: 0.1,
                responseMimeType:
                    'application/json',
            },
        });

    const prompt =
        buildGroundedPrompt(
            request,
            officialContext,
        );

    const startedAt = Date.now();

    const timeoutMs = Math.min(
        config.extraction.geminiTimeoutMs,
        30000,
    );

    let timeoutHandle:
        | NodeJS.Timeout
        | undefined;

    const timeoutPromise =
        new Promise<never>(
            (_resolve, reject) => {
                timeoutHandle = setTimeout(
                    () =>
                        reject(
                            new Error(
                                `RAG Gemini request timed out after ${timeoutMs}ms`,
                            ),
                        ),
                    timeoutMs,
                );
            },
        );

    try {
        logger.info(
            '[RAG] Generating grounded correction guide',
            {
                documentType:
                    request.documentType,
                fieldKey:
                    request.fieldKey,
                recordCount:
                    records.length,
                model:
                    config.gemini.model,
            },
        );

        const result =
            await Promise.race([
                model.generateContent(prompt),
                timeoutPromise,
            ]);

        const responseText =
            result.response
                .text()
                .trim();

        if (!responseText) {
            throw new Error(
                'Gemini returned an empty RAG response.',
            );
        }

        const parsed =
            extractJsonObject(
                responseText,
            );

        const title =
            cleanText(parsed.title) ||
            records[0].title;

        const summary =
            cleanText(parsed.summary) ||
            records[0].when_applicable;

        const authority =
            cleanText(parsed.authority) ||
            records[0]
                .issuing_authority;

        const steps =
            cleanStringArray(
                parsed.steps,
            );

        const requiredDocuments =
            cleanStringArray(
                parsed.requiredDocuments,
            );

        const warnings =
            cleanStringArray(
                parsed.warnings,
            );

        const guide: RagCorrectionGuide = {
            title,

            summary,

            authority,

            steps:
                steps.length > 0
                    ? steps
                    : records.flatMap(
                        record =>
                            record.procedure,
                    ),

            requiredDocuments:
                requiredDocuments.length > 0
                    ? requiredDocuments
                    : records.flatMap(
                        record =>
                            record
                                .required_document_categories,
                    ),

            onlineAllowed:
                parseBooleanOrNull(
                    parsed.onlineAllowed,
                ) ??
                records[0]
                    .online_allowed,

            offlineRequired:
                parseBooleanOrNull(
                    parsed.offlineRequired,
                ) ??
                records[0]
                    .offline_required,

            updateLimit:
                cleanText(
                    parsed.updateLimit,
                ) ||
                records[0]
                    .update_limit,

            warnings:
                warnings.length > 0
                    ? warnings
                    : records.flatMap(
                        record =>
                            record.warnings,
                    ),

            humanReviewRequired:
                typeof parsed
                    .humanReviewRequired ===
                    'boolean'
                    ? parsed
                        .humanReviewRequired
                    : records.some(
                        record =>
                            record
                                .human_review_required,
                    ),

            officialSources:
                buildSourceList(records),

            lastVerified,

            generatedBy:
                'rag_gemini',

            groundingRuleIds:
                records.map(
                    record => record.id,
                ),

            disclaimer:
                LEGAL_DISCLAIMER,
        };

        logger.info(
            '[RAG] Grounded guide generated',
            {
                elapsedMs:
                    Date.now() -
                    startedAt,

                fieldKey:
                    request.fieldKey,

                groundingRuleIds:
                    guide.groundingRuleIds,
            },
        );

        return guide;
    } catch (error: unknown) {
        logger.warn(
            '[RAG] Gemini guidance generation failed; using template fallback.',
            {
                error:
                    error instanceof Error
                        ? error.message
                        : String(error),

                documentType:
                    request.documentType,

                fieldKey:
                    request.fieldKey,
            },
        );

        return buildTemplateGuide(
            records,
            lastVerified,
        );
    } finally {
        if (timeoutHandle) {
            clearTimeout(
                timeoutHandle,
            );
        }
    }
}

/* -------------------------------------------------------------------------- */
/*                              Public Function                               */
/* -------------------------------------------------------------------------- */

export async function generateRagGuidance(
    request: RagGuidanceRequest,
): Promise<RagGuidanceResponse> {
    const retrieval =
        retrieveOfficialGuidance({
            documentType:
                request.documentType,

            fieldKey:
                request.fieldKey,

            scenario:
                request.scenario,

            userQuestion:
                request.issueDescription,

            maxResults: 3,
        });

    if (
        !retrieval.found ||
        retrieval.records.length === 0
    ) {
        logger.info(
            '[RAG] No official guidance found; fallback required.',
            {
                documentType:
                    request.documentType,

                fieldKey:
                    request.fieldKey,

                reason:
                    retrieval.reason,
            },
        );

        return {
            found: false,
            guide: null,
            retrievedRecords: [],
            fallbackRequired: true,
            reason:
                retrieval.reason ??
                'No official RAG evidence was found.',
        };
    }

    const officialContext =
        buildOfficialContext(
            retrieval.records,
        );

    const guide =
        await generateWithGemini(
            request,
            retrieval.records,
            officialContext,
            retrieval.lastVerified,
        );

    return {
        found: true,
        guide,
        retrievedRecords:
            retrieval.records,
        fallbackRequired: false,
    };
}