import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Info,
  XCircle,
} from 'lucide-react';

export interface FieldScoreDetail {
  fieldKey: string;
  label: string;
  score: number;
  agreement: number;
  corroboration: number;
  extractionReliability: number | null;
  penalty: number;
  scenario: string;
  severity: 'none' | 'low' | 'medium' | 'high' | 'critical';
  displaySeverity:
  | 'No issue'
  | 'Expected Variation'
  | 'Needs Review'
  | 'Critical Conflict';
  supportingDocumentTypes: number;
  documentsContainingField: number;
  reason: string;
  lowConfidenceCapped: boolean;
  extractionReliabilityMeasured?: boolean;
  peerEvidenceAvailable?: boolean;
}

interface Props {
  fieldScores?: FieldScoreDetail[];
}

function getSeverityBadge(
  severity: FieldScoreDetail['severity'],
  label: FieldScoreDetail['displaySeverity'],
) {
  switch (severity) {
    case 'none':
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20">
          <CheckCircle className="h-3 w-3" />
          {label}
        </span>
      );

    case 'low':
    case 'medium':
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20">
          <AlertTriangle className="h-3 w-3" />
          {label}
        </span>
      );

    case 'high':
    case 'critical':
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20">
          <XCircle className="h-3 w-3" />
          {label}
        </span>
      );

    default:
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          <Info className="h-3 w-3" />
          {label}
        </span>
      );
  }
}

function getEvidenceDepth(field: FieldScoreDetail): string {
  if (field.peerEvidenceAvailable === false) {
    return 'Single-document evidence only';
  }

  return `${field.supportingDocumentTypes} of ${field.documentsContainingField} document types`;
}

export const FieldResolutionBreakdown: React.FC<Props> = ({
  fieldScores,
}) => {
  const [isOpen, setIsOpen] = useState(true);

  if (!fieldScores || fieldScores.length === 0) {
    return null;
  }

  return (
    <section className="mb-8 overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-900 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:shadow-xl">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between border-b border-slate-200 bg-white px-6 py-4 text-left transition-colors hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800/70"
      >
        <div className="flex flex-wrap items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-blue-500" />

          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Field Resolution Breakdown
          </h3>

          <span className="rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
            {fieldScores.length}{' '}
            {fieldScores.length === 1 ? 'Field' : 'Fields'} Evaluated
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span className="hidden sm:inline">
            {isOpen ? 'Collapse Details' : 'Expand Details'}
          </span>

          {isOpen ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </div>
      </button>

      {isOpen && (
        <div className="space-y-4 p-6">
          {fieldScores.map((field) => {
            const hasPeerEvidence =
              field.peerEvidenceAvailable !== false;

            return (
              <article
                key={field.fieldKey}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4 transition-colors hover:border-slate-300 dark:border-slate-800/80 dark:bg-slate-950/60 dark:hover:border-slate-700"
              >
                <div className="mb-3 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-base font-semibold text-slate-900 dark:text-white">
                      {field.label}
                    </span>

                    {getSeverityBadge(
                      field.severity,
                      field.displaySeverity,
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {hasPeerEvidence ? (
                      <>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          Resolution Score:
                        </span>

                        <span className="rounded-lg border border-blue-500/30 bg-blue-50 px-2.5 py-0.5 text-lg font-bold text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-400">
                          {field.score}/100
                        </span>
                      </>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Insufficient Peer Evidence
                      </span>
                    )}
                  </div>
                </div>

                <div className="mb-3 grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-white p-3 text-xs dark:border-slate-800/60 dark:bg-slate-900/60 md:grid-cols-4">
                  <div>
                    <span className="mb-0.5 block text-slate-500 dark:text-slate-400">
                      Agreement
                    </span>

                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {Math.round(field.agreement * 100)}%
                    </span>
                  </div>

                  <div>
                    <span className="mb-0.5 block text-slate-500 dark:text-slate-400">
                      Independent Corroboration
                    </span>

                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {hasPeerEvidence
                        ? `${Math.round(field.corroboration * 100)}%`
                        : 'Unavailable'}
                    </span>
                  </div>

                  <div>
                    <span className="mb-0.5 block text-slate-500 dark:text-slate-400">
                      Extraction Reliability
                    </span>

                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {field.extractionReliability !== null
                        ? `${Math.round(
                          field.extractionReliability * 100,
                        )}%`
                        : 'Unavailable'}
                    </span>
                  </div>

                  <div>
                    <span className="mb-0.5 block text-slate-500 dark:text-slate-400">
                      Evidence Depth
                    </span>

                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {getEvidenceDepth(field)}
                    </span>
                  </div>
                </div>

                {!hasPeerEvidence && (
                  <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/5 dark:text-amber-200">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />

                    <p>
                      This field was found in only one uploaded
                      document. Its extraction may be reliable, but
                      cross-document agreement cannot be established.
                    </p>
                  </div>
                )}

                <p
                  className={`border-l-2 pl-2 text-xs leading-relaxed ${field.severity === 'critical' ||
                      field.severity === 'high'
                      ? 'border-rose-500/60 text-rose-800 dark:text-rose-100'
                      : field.severity === 'medium' ||
                        field.severity === 'low' ||
                        !hasPeerEvidence
                        ? 'border-amber-500/60 text-amber-800 dark:text-amber-100'
                        : 'border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300'
                    }`}
                >
                  {field.reason}
                </p>

                {field.lowConfidenceCapped && (
                  <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                    This field score was capped because extraction
                    reliability was low or unavailable.
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default FieldResolutionBreakdown;