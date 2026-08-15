import ruleData from '../data/correction-rules.json';
import { IFieldResult, IGuidanceItem } from '../models/store';
import type {
  CorrectionRule,
  DocumentType,
  GuideStatus,
  OfficialSource,
  RuleStatus,
} from '../types/nirdosh-vault';

type TriggerSource = CorrectionRule['trigger_source'];

type RawCorrectionRule = {
  rule_id?: unknown;
  document_type?: unknown;
  field_key?: unknown;
  scenario?: unknown;
  priority?: unknown;
  trigger_source?: unknown;
  requires_user_input?: unknown;
  recommended_action?: unknown;
  explanation?: unknown;
  exact_steps?: unknown;
  supporting_document_categories?: unknown;
  authority?: unknown;
  channel?: unknown;
  jurisdiction?: unknown;
  rule_status?: unknown;
  human_review_required?: unknown;
  official_source?: unknown;
  official_sources?: unknown;
  exact_support?: unknown;
  source_checked_date?: unknown;
  expires_for_review_on?: unknown;
  disclaimer?: unknown;
};

type CorrectionRulesFile = {
  rules?: RawCorrectionRule[];
};

const LEGAL_BOUNDARY =
  'Nirdosh Vault identifies consistency patterns only. Final legal correctness, document correction and approval remain with the issuing authority.';

const RETENTION_INFORMATION = {
  raw_files_deleted_after_processing: true,
};

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback;
}

function asOptionalString(value: unknown): string | null {
  const result = asString(value);
  return result || null;
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is string => typeof item === 'string')
    .map(item => item.trim())
    .filter(Boolean);
}

function normalizeLookupValue(value: unknown): string {
  return asString(value)
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function normalizeDocumentType(value: unknown): DocumentType | null {
  const normalized = normalizeLookupValue(value);

  const aliases: Record<string, DocumentType> = {
    aadhaar: 'aadhaar',
    aadhar: 'aadhaar',
    aadhaar_card: 'aadhaar',
    aadhar_card: 'aadhaar',
    pan: 'pan',
    pancard: 'pan',
    pan_card: 'pan',
    birth_certificate: 'birth_certificate',
    birthcertificate: 'birth_certificate',
    birth_cert: 'birth_certificate',
    school_leaving_certificate: 'school_leaving_certificate',
    school_leaving: 'school_leaving_certificate',
    leaving_certificate: 'school_leaving_certificate',
    lc: 'school_leaving_certificate',
    marksheet: 'marksheet',
    mark_sheet: 'marksheet',
  };

  return aliases[normalized] ?? null;
}

function normalizeFieldKey(value: unknown): string {
  const normalized = normalizeLookupValue(value);

  const aliases: Record<string, string> = {
    dob: 'date_of_birth',
    birth_date: 'date_of_birth',
    dateofbirth: 'date_of_birth',
    year_of_birth: 'date_of_birth',
    name: 'full_name',
    applicant_name: 'full_name',
    candidate_name: 'full_name',
    student_name: 'full_name',
    child_name: 'full_name',
    residential_address: 'address',
    permanent_address: 'address',
    current_address: 'address',
    sex: 'gender',
    fathername: 'father_name',
    mothername: 'mother_name',
    guardianname: 'guardian_name',
    aadhaar_no: 'aadhaar_number',
    aadhar_no: 'aadhaar_number',
    pan_no: 'pan_number',
    reg_no: 'registration_number',
    roll_no: 'seat_number',
  };

  return aliases[normalized] ?? normalized;
}

function normalizeScenario(value: unknown): string {
  return normalizeLookupValue(value);
}

function normalizeTriggerSource(value: unknown): TriggerSource {
  const normalized = normalizeLookupValue(value);
  const allowed: TriggerSource[] = [
    'automatic',
    'user_reported',
    'authority_rejection',
    'manual_selection',
  ];

  return allowed.includes(normalized as TriggerSource)
    ? (normalized as TriggerSource)
    : 'automatic';
}

function normalizeRuleStatus(value: unknown): RuleStatus {
  const normalized = normalizeLookupValue(value);

  const aliases: Record<string, RuleStatus> = {
    verified: 'verified',
    derived: 'derived',
    authority_dependent: 'authority-dependent',
    authoritydependent: 'authority-dependent',
    unverified: 'unverified',
  };

  return aliases[normalized] ?? 'unverified';
}

function buildOfficialSources(raw: RawCorrectionRule): OfficialSource[] {
  if (Array.isArray(raw.official_sources)) {
    return raw.official_sources
      .filter(source => source !== null && typeof source === 'object')
      .map(source => {
        const item = source as Record<string, unknown>;
        return {
          authority: asString(item.authority) || asString(raw.authority),
          title: asString(item.title),
          url: asString(item.url),
          publication_date: asOptionalString(item.publication_date),
          exact_support: asString(item.exact_support),
        };
      })
      .filter(source => Boolean(source.title || source.url || source.authority));
  }

  const sourceValue = asString(raw.official_source);
  if (!sourceValue) return [];

  const urlMatch = sourceValue.match(/https?:\/\/[^)\s]+/i);
  const extractedUrl = urlMatch?.[0] ?? '';
  const title = sourceValue
    .replace(/\s*\(https?:\/\/[^)]+\)\s*$/i, '')
    .trim();

  return [
    {
      authority: asString(raw.authority),
      title: title || 'Official authority source',
      url: extractedUrl,
      publication_date: null,
      exact_support: asString(raw.exact_support),
    },
  ];
}

function toCorrectionRule(raw: RawCorrectionRule): CorrectionRule | null {
  const documentType = normalizeDocumentType(raw.document_type);
  const ruleId = asString(raw.rule_id);
  const fieldKey = normalizeFieldKey(raw.field_key);
  const scenario = normalizeScenario(raw.scenario);

  if (!documentType || !ruleId || !fieldKey || !scenario) {
    return null;
  }

  return {
    rule_id: ruleId,
    document_type: documentType,
    field_key: fieldKey,
    scenario,
    priority: asNumber(raw.priority),
    trigger_source: normalizeTriggerSource(raw.trigger_source),
    requires_user_input: asBoolean(raw.requires_user_input),
    title: asString(raw.recommended_action) || 'Correction guidance',
    citizen_message:
      asString(raw.explanation) ||
      'Review the detected inconsistency and confirm the correct value with the relevant issuing authority.',
    recommended_steps: asStringArray(raw.exact_steps),
    supporting_document_categories: asStringArray(
      raw.supporting_document_categories,
    ),
    authority: asString(raw.authority) || 'Relevant issuing authority',
    channel: asStringArray(raw.channel),
    jurisdiction: asString(raw.jurisdiction) || 'Authority-dependent',
    rule_status: normalizeRuleStatus(raw.rule_status),
    human_review_required: asBoolean(raw.human_review_required, true),
    official_sources: buildOfficialSources(raw),
    source_checked_date: asString(raw.source_checked_date),
    expires_for_review_on: asOptionalString(raw.expires_for_review_on),
    disclaimer: asString(raw.disclaimer) || LEGAL_BOUNDARY,
  };
}

const parsedRuleData = ruleData as CorrectionRulesFile;

const rules: CorrectionRule[] = (parsedRuleData.rules ?? [])
  .map(toCorrectionRule)
  .filter((rule): rule is CorrectionRule => rule !== null);

function isExpired(expiresOn: string | null | undefined): boolean {
  if (!expiresOn) return false;

  const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;
  const expiryDate = dateOnlyPattern.test(expiresOn)
    ? new Date(`${expiresOn}T23:59:59.999Z`)
    : new Date(expiresOn);

  if (Number.isNaN(expiryDate.getTime())) return true;
  return expiryDate.getTime() < Date.now();
}

function isActiveRule(rule: CorrectionRule): boolean {
  return rule.rule_status !== 'unverified' && !isExpired(rule.expires_for_review_on);
}

function createBaseResponse(analysisId: string, result: IFieldResult) {
  return {
    analysis_id: analysisId,
    field_result: result,
    legal_boundary: LEGAL_BOUNDARY,
    data_retention: RETENTION_INFORMATION,
  };
}

function findBestRule(
  result: IFieldResult,
  documentType: string,
): CorrectionRule | null {
  const normalizedDocumentType = normalizeDocumentType(documentType);
  if (!normalizedDocumentType) return null;

  const normalizedFieldKey = normalizeFieldKey(result.fieldKey);
  const normalizedScenario = normalizeScenario(result.scenario);

  const exactMatch = rules
    .filter(isActiveRule)
    .filter(
      rule =>
        rule.document_type === normalizedDocumentType &&
        rule.field_key === normalizedFieldKey &&
        rule.scenario === normalizedScenario,
    )
    .sort((a, b) => b.priority - a.priority)[0];

  if (exactMatch) return exactMatch;

  const genericScenarios = new Set([
    'mismatch',
    'field_mismatch',
    'correction_required',
    'generic',
  ]);

  return (
    rules
      .filter(isActiveRule)
      .filter(
        rule =>
          rule.document_type === normalizedDocumentType &&
          rule.field_key === normalizedFieldKey &&
          genericScenarios.has(rule.scenario),
      )
      .sort((a, b) => b.priority - a.priority)[0] ?? null
  );
}

export function buildCorrectionKit(
  analysisId: string,
  result: IFieldResult,
  documentType?: string,
) {
  const base = createBaseResponse(analysisId, result);

  if (result.status === 'consistent' || result.status === 'not_comparable') {
    return {
      ...base,
      guide_status: 'unsupported_rule' as GuideStatus,
      selected_rule_id: null,
      correction_guide: null,
      official_evidence: [],
      next_action:
        result.status === 'consistent'
          ? 'No correction guidance is required because the comparable uploaded values are consistent.'
          : 'Correction guidance cannot be generated because this field was not comparable across at least two documents.',
    };
  }

  if (result.status === 'conflicting_evidence') {
    return {
      ...base,
      guide_status: 'no_consensus' as GuideStatus,
      selected_rule_id: null,
      correction_guide: null,
      official_evidence: [],
      next_action:
        'The uploaded documents do not establish a reliable consensus. Verify the original records and select the document that should be reviewed.',
    };
  }

  if (!documentType) {
    return {
      ...base,
      guide_status: 'requires_user_input' as GuideStatus,
      selected_rule_id: null,
      correction_guide: null,
      official_evidence: [],
      next_action:
        'Select the document you want to review. Majority agreement is supporting evidence, not legal truth.',
    };
  }

  const rule = findBestRule(result, documentType);

  if (!rule) {
    return {
      ...base,
      guide_status: 'unsupported_rule' as GuideStatus,
      selected_rule_id: null,
      correction_guide: null,
      official_evidence: [],
      next_action:
        'No active verified guidance rule is available for this document, field and scenario. Contact the issuing authority or use its official portal.',
    };
  }

  if (rule.requires_user_input) {
    return {
      ...base,
      guide_status: 'requires_user_input' as GuideStatus,
      selected_rule_id: rule.rule_id,
      correction_guide: null,
      official_evidence: rule.official_sources,
      next_action:
        'This guidance requires additional facts that cannot be safely inferred from the uploaded documents.',
    };
  }

  const guideStatus: GuideStatus =
    rule.rule_status === 'authority-dependent'
      ? 'authority_dependent'
      : 'guide_available';

  return {
    ...base,
    guide_status: guideStatus,
    selected_rule_id: rule.rule_id,
    correction_guide: {
      title: rule.title,
      citizen_message: rule.citizen_message,
      authority: rule.authority,
      jurisdiction: rule.jurisdiction,
      channel: rule.channel,
      steps: rule.recommended_steps,
      supporting_document_categories: rule.supporting_document_categories,
      human_review_required: rule.human_review_required,
      source_checked_date: rule.source_checked_date,
      expires_for_review_on: rule.expires_for_review_on,
      disclaimer: rule.disclaimer,
    },
    official_evidence: rule.official_sources,
    next_action: rule.human_review_required
      ? 'Review the official evidence and confirm the correction procedure with the issuing authority before submitting any request.'
      : 'Follow the verified guidance and confirm current requirements on the official authority portal before submission.',
  };
}

export async function generateGuidance(
  fieldResults: IFieldResult[],
): Promise<IGuidanceItem[]> {
  return fieldResults
    .filter(result => !['consistent', 'not_comparable'].includes(result.status))
    .map(result => {
      const noConsensus = result.status === 'conflicting_evidence';

      return {
        fieldKey: result.fieldKey,
        fieldLabel: result.label,
        issueStatus: result.status,
        explanation: result.explanation,
        rules: [],
        steps: noConsensus
          ? [
            'Review the values extracted from every comparable document.',
            'Verify the original records with the relevant issuing authorities.',
            'Select the document that should be reviewed before requesting correction guidance.',
          ]
          : [
            'Review the detected values and consensus evidence.',
            'Select the document that you want to review.',
            'Open the verified correction guidance for that document and field.',
          ],
        disclaimer:
          'Nirdosh Vault does not determine legal truth or automatically decide which official document must be corrected.',
      };
    });
}