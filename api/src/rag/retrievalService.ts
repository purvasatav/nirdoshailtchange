import uidaiGuidanceData from '../data/rag/uidai-guidance.json';

/* -------------------------------------------------------------------------- */
/*                                   Types                                    */
/* -------------------------------------------------------------------------- */

export type RagSource = {
    title: string;
    file_name: string;
    url: string;
    effective_date: string;
};

export type RagGuidanceRecord = {
    id: string;
    title: string;
    field_key: string;
    scenario: string;
    when_applicable: string;

    procedure: string[];

    required_document_categories: string[];
    example_documents: string[];

    online_allowed: boolean | null;
    offline_required: boolean | null;

    update_limit: string;
    human_review_required: boolean;

    warnings: string[];

    issuing_authority: string;
    official_portal: string;

    sources: RagSource[];
    supporting_excerpt: string[];

    verification_status:
    | 'verified'
    | 'derived'
    | 'authority_dependent'
    | 'pending_manual_review'
    | 'unverified';

    active: boolean;
    tags: string[];
};

type UidaiGuidanceDatabase = {
    database_version: string;
    authority: string;
    document_type: string;
    jurisdiction: string;
    last_verified_by_project: string;
    records: RagGuidanceRecord[];
};

export type RagRetrievalQuery = {
    documentType: string;
    fieldKey: string;
    scenario?: string;
    userQuestion?: string;
    maxResults?: number;
};

export type RagRetrievalResult = {
    found: boolean;
    databaseVersion: string;
    authority: string;
    documentType: string;
    lastVerified: string;
    records: RagGuidanceRecord[];
    reason?: string;
};

/* -------------------------------------------------------------------------- */
/*                              Knowledge Database                            */
/* -------------------------------------------------------------------------- */

const knowledgeBase =
    uidaiGuidanceData as UidaiGuidanceDatabase;

/* -------------------------------------------------------------------------- */
/*                              Normalization                                 */
/* -------------------------------------------------------------------------- */

function normalizeToken(value: string | undefined | null): string {
    return (value ?? '')
        .normalize('NFC')
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, '_')
        .replace(/[^a-z0-9_]/g, '')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '');
}

function normalizeDocumentType(value: string): string {
    const normalized = normalizeToken(value);

    const aliases: Record<string, string> = {
        aadhar: 'aadhaar',
        aadhaar_card: 'aadhaar',
        aadhar_card: 'aadhaar',
    };

    return aliases[normalized] ?? normalized;
}

function normalizeFieldKey(value: string): string {
    const normalized = normalizeToken(value);

    const aliases: Record<string, string> = {
        name: 'full_name',
        applicant_name: 'full_name',
        candidate_name: 'full_name',
        student_name: 'full_name',
        child_name: 'full_name',

        dob: 'date_of_birth',
        birth_date: 'date_of_birth',
        dateofbirth: 'date_of_birth',
        year_of_birth: 'date_of_birth',

        sex: 'gender',

        permanent_address: 'address',
        residential_address: 'address',
        current_address: 'address',
    };

    return aliases[normalized] ?? normalized;
}

function tokenize(value: string | undefined): string[] {
    return normalizeToken(value)
        .split('_')
        .filter(token => token.length > 1);
}

/* -------------------------------------------------------------------------- */
/*                              Relevance Scoring                             */
/* -------------------------------------------------------------------------- */

function calculateScore(
    record: RagGuidanceRecord,
    query: RagRetrievalQuery,
): number {
    let score = 0;

    const queryField = normalizeFieldKey(query.fieldKey);
    const recordField = normalizeFieldKey(record.field_key);

    if (recordField === queryField) {
        score += 100;
    }

    const queryScenario = normalizeToken(query.scenario);
    const recordScenario = normalizeToken(record.scenario);

    if (
        queryScenario &&
        recordScenario === queryScenario
    ) {
        score += 50;
    }

    if (
        queryScenario &&
        recordScenario.includes(queryScenario)
    ) {
        score += 25;
    }

    const queryTokens = new Set([
        ...tokenize(query.scenario),
        ...tokenize(query.userQuestion),
    ]);

    const searchableText = normalizeToken(
        [
            record.title,
            record.scenario,
            record.when_applicable,
            record.update_limit,
            ...record.tags,
        ].join(' '),
    );

    for (const token of queryTokens) {
        if (searchableText.includes(token)) {
            score += 5;
        }
    }

    if (record.verification_status === 'verified') {
        score += 10;
    }

    if (
        record.verification_status ===
        'pending_manual_review'
    ) {
        score += 2;
    }

    if (record.human_review_required) {
        score += 1;
    }

    return score;
}

/* -------------------------------------------------------------------------- */
/*                               Public API                                   */
/* -------------------------------------------------------------------------- */

export function retrieveOfficialGuidance(
    query: RagRetrievalQuery,
): RagRetrievalResult {
    const normalizedDocumentType =
        normalizeDocumentType(query.documentType);

    if (
        normalizedDocumentType !==
        normalizeDocumentType(
            knowledgeBase.document_type,
        )
    ) {
        return {
            found: false,
            databaseVersion:
                knowledgeBase.database_version,
            authority:
                knowledgeBase.authority,
            documentType:
                normalizedDocumentType,
            lastVerified:
                knowledgeBase.last_verified_by_project,
            records: [],
            reason:
                `No UIDAI RAG knowledge is available for document type "${query.documentType}".`,
        };
    }

    const normalizedField =
        normalizeFieldKey(query.fieldKey);

    const maxResults = Math.max(
        1,
        Math.min(query.maxResults ?? 3, 5),
    );

    const candidates = knowledgeBase.records
        .filter(record => record.active)
        .filter(
            record =>
                normalizeFieldKey(record.field_key) ===
                normalizedField,
        )
        .map(record => ({
            record,
            score: calculateScore(record, query),
        }))
        .filter(item => item.score > 0)
        .sort(
            (first, second) =>
                second.score - first.score,
        )
        .slice(0, maxResults)
        .map(item => item.record);

    if (candidates.length === 0) {
        return {
            found: false,
            databaseVersion:
                knowledgeBase.database_version,
            authority:
                knowledgeBase.authority,
            documentType:
                normalizedDocumentType,
            lastVerified:
                knowledgeBase.last_verified_by_project,
            records: [],
            reason:
                `No active UIDAI guidance record matched field "${query.fieldKey}".`,
        };
    }

    return {
        found: true,
        databaseVersion:
            knowledgeBase.database_version,
        authority:
            knowledgeBase.authority,
        documentType:
            normalizedDocumentType,
        lastVerified:
            knowledgeBase.last_verified_by_project,
        records: candidates,
    };
}

/* -------------------------------------------------------------------------- */
/*                         Context Builder for Gemini                         */
/* -------------------------------------------------------------------------- */

export function buildOfficialContext(
    records: RagGuidanceRecord[],
): string {
    if (records.length === 0) {
        return '';
    }

    return records
        .map((record, index) => {
            const sources = record.sources
                .map(source => {
                    const url =
                        source.url ||
                        record.official_portal;

                    return [
                        `Source title: ${source.title}`,
                        `Source file: ${source.file_name}`,
                        `Official URL: ${url}`,
                        `Effective date: ${source.effective_date}`,
                    ].join('\n');
                })
                .join('\n\n');

            return [
                `OFFICIAL GUIDANCE RECORD ${index + 1}`,
                `Rule ID: ${record.id}`,
                `Authority: ${record.issuing_authority}`,
                `Document type: Aadhaar`,
                `Field: ${record.field_key}`,
                `Scenario: ${record.scenario}`,
                `Title: ${record.title}`,
                `When applicable: ${record.when_applicable}`,
                '',
                'Official procedure:',
                ...record.procedure.map(
                    (step, stepIndex) =>
                        `${stepIndex + 1}. ${step}`,
                ),
                '',
                'Required document categories:',
                ...record.required_document_categories.map(
                    item => `- ${item}`,
                ),
                '',
                'Example documents:',
                ...record.example_documents.map(
                    item => `- ${item}`,
                ),
                '',
                `Online allowed: ${record.online_allowed === null
                    ? 'Not conclusively established'
                    : record.online_allowed
                        ? 'Yes'
                        : 'No'
                }`,
                `Offline required: ${record.offline_required === null
                    ? 'Depends on the case'
                    : record.offline_required
                        ? 'Yes'
                        : 'No'
                }`,
                `Update limit: ${record.update_limit}`,
                `Human review required: ${record.human_review_required
                    ? 'Yes'
                    : 'No'
                }`,
                '',
                'Warnings:',
                ...record.warnings.map(
                    warning => `- ${warning}`,
                ),
                '',
                'Sources:',
                sources,
                '',
                `Official portal: ${record.official_portal}`,
                `Verification status: ${record.verification_status}`,
            ].join('\n');
        })
        .join('\n\n---\n\n');
}

export function getUidaiKnowledgeBaseInfo() {
    return {
        databaseVersion:
            knowledgeBase.database_version,

        authority:
            knowledgeBase.authority,

        documentType:
            knowledgeBase.document_type,

        jurisdiction:
            knowledgeBase.jurisdiction,

        lastVerified:
            knowledgeBase.last_verified_by_project,

        totalRecords:
            knowledgeBase.records.length,

        activeRecords:
            knowledgeBase.records.filter(
                record => record.active,
            ).length,
    };
}