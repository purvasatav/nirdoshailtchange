import React from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Info,
  ShieldCheck,
  XCircle,
} from 'lucide-react';

export interface PillarScores {
  agreement: number;
  corroboration: number;
  coverage: number;
  extractionReliability: number | null;
}

export interface ScoringSummary {
  presentComparableFields: number;
  expectedComparableFields: number;
  criticalConflicts: number;
  needsReviewFields: number;
}

export interface IdentityResolutionConfidenceData {
  status: 'scored' | 'insufficient_data';
  score: number | null;
  tier:
  | 'strong_consensus'
  | 'moderate_consensus'
  | 'needs_review'
  | 'critical_conflicts'
  | 'insufficient_data';
  tierLabel: string;
  cap: number | null;
  independentDocumentTypes: number;
  coverage: number;
  pillars: PillarScores | null;
  summary: ScoringSummary;
  reasons: string[];
  disclaimer: string;
}

interface Props {
  data?: IdentityResolutionConfidenceData | null;
}

type ObservationTone = 'positive' | 'warning' | 'critical' | 'neutral';

function clampPercentage(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(100, Math.max(0, value));
}

function getTierClasses(
  tier: IdentityResolutionConfidenceData['tier'],
): string {
  switch (tier) {
    case 'strong_consensus':
      return 'border-emerald-500/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300';

    case 'moderate_consensus':
      return 'border-blue-500/30 bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300';

    case 'needs_review':
      return 'border-amber-500/30 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300';

    case 'critical_conflicts':
      return 'border-rose-500/30 bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300';

    default:
      return 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300';
  }
}

function getScoreTextClass(score: number): string {
  if (score >= 90) {
    return 'text-emerald-600 dark:text-emerald-400';
  }

  if (score >= 75) {
    return 'text-blue-600 dark:text-blue-400';
  }

  if (score >= 60) {
    return 'text-amber-600 dark:text-amber-400';
  }

  return 'text-rose-600 dark:text-rose-400';
}

function getScorePanelClasses(score: number): string {
  if (score >= 90) {
    return 'border-emerald-500/30 bg-emerald-50/80 dark:border-emerald-500/20 dark:bg-emerald-500/5';
  }

  if (score >= 75) {
    return 'border-blue-500/30 bg-blue-50/80 dark:border-blue-500/20 dark:bg-blue-500/5';
  }

  if (score >= 60) {
    return 'border-amber-500/30 bg-amber-50/80 dark:border-amber-500/20 dark:bg-amber-500/5';
  }

  return 'border-rose-500/30 bg-rose-50/80 dark:border-rose-500/20 dark:bg-rose-500/5';
}

function getObservationTone(reason: string): ObservationTone {
  const normalized = reason.toLowerCase();

  if (
    normalized.includes('conflict') ||
    normalized.includes('no consensus') ||
    normalized.includes('critical')
  ) {
    return 'critical';
  }

  if (
    normalized.includes('unavailable') ||
    normalized.includes('single document') ||
    normalized.includes('single-document') ||
    normalized.includes('needs review') ||
    normalized.includes('reducing profile coverage') ||
    normalized.includes('incomplete')
  ) {
    return 'warning';
  }

  if (
    normalized.includes('agrees across') ||
    normalized.includes('consistent') ||
    normalized.includes('strong consensus')
  ) {
    return 'positive';
  }

  return 'neutral';
}

function ObservationIcon({ tone }: { tone: ObservationTone }) {
  switch (tone) {
    case 'positive':
      return (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500 dark:text-emerald-400" />
      );

    case 'warning':
      return (
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500 dark:text-amber-400" />
      );

    case 'critical':
      return (
        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500 dark:text-rose-400" />
      );

    default:
      return <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-500 dark:text-blue-400" />;
  }
}

interface PillarCardProps {
  label: string;
  value: number | null;
  barClassName: string;
  unavailableText?: string;
}

function PillarCard({
  label,
  value,
  barClassName,
  unavailableText = 'Unavailable',
}: PillarCardProps) {
  const displayValue =
    value === null ? unavailableText : `${Math.round(value)}%`;

  const width = value === null ? 0 : clampPercentage(value);

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800/80 dark:bg-slate-950/60">
      <div className="mb-1 text-xs text-slate-500 dark:text-slate-400">{label}</div>

      <div
        className={`font-bold text-slate-900 dark:text-white ${value === null ? 'text-lg' : 'text-2xl'
          }`}
      >
        {displayValue}
      </div>

      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        <div
          className={`h-full rounded-full transition-all ${barClassName}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

export const IdentityResolutionConfidenceCard: React.FC<Props> = ({
  data,
}) => {
  if (!data) {
    return null;
  }

  if (data.status === 'insufficient_data' || data.score === null) {
    return (
      <section className="mb-8 rounded-xl border border-slate-200 bg-white p-6 text-slate-900 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:shadow-xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-amber-600 dark:text-amber-400">
            <AlertCircle className="h-6 w-6" />
          </div>

          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
              Identity Resolution Confidence
            </h3>

            <p className="text-sm text-amber-600 dark:text-amber-300 font-medium">
              Insufficient peer evidence
            </p>
          </div>
        </div>

        <p className="mb-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          The system could not calculate a cross-document resolution score
          because there were not enough comparable identity fields or usable
          peer-evidence signals across the uploaded documents.
        </p>

        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/60">
            <p className="text-xs text-slate-500 dark:text-slate-400">Comparable fields found</p>

            <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
              {data.summary.presentComparableFields} of{' '}
              {data.summary.expectedComparableFields}
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/60">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Independent document types
            </p>

            <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
              {data.independentDocumentTypes}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-800/80 dark:bg-slate-950/60 dark:text-slate-400">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />

          <span>
            <strong>Advisory limitation:</strong> {data.disclaimer}
          </span>
        </div>
      </section>
    );
  }

  const score = clampPercentage(data.score);
  const tierClasses = getTierClasses(data.tier);
  const scoreTextClass = getScoreTextClass(score);
  const scorePanelClasses = getScorePanelClasses(score);

  return (
    <section className="mb-8 rounded-xl border border-slate-200 bg-white p-6 text-slate-900 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:shadow-xl">
      <div className="mb-6 flex flex-col justify-between gap-6 border-b border-slate-200 pb-6 dark:border-slate-800 md:flex-row md:items-center">
        <div className="flex items-start gap-4">
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-3 text-blue-600 dark:text-blue-400">
            <ShieldCheck className="h-8 w-8" />
          </div>

          <div>
            <h2 className="text-xl font-bold tracking-wide text-slate-900 dark:text-white">
              Identity Resolution Confidence
            </h2>

            <p className="text-sm text-slate-500 dark:text-slate-400">
              Cross-document peer-evidence consistency
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${tierClasses}`}
              >
                {data.tierLabel}
              </span>

              {data.summary.criticalConflicts > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
                  <XCircle className="h-3.5 w-3.5" />
                  {data.summary.criticalConflicts}{' '}
                  {data.summary.criticalConflicts === 1
                    ? 'critical conflict'
                    : 'critical conflicts'}
                </span>
              )}

              {data.summary.needsReviewFields > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Manual review recommended
                </span>
              )}

              {data.cap !== null && data.cap < 100 && (
                <span className="flex items-center gap-1 rounded-md border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                  <Info className="h-3.5 w-3.5" />
                  Evidence cap: {Math.round(data.cap)}% (
                  {data.independentDocumentTypes}{' '}
                  {data.independentDocumentTypes === 1
                    ? 'document type'
                    : 'document types'}
                  )
                </span>
              )}
            </div>
          </div>
        </div>

        <div
          className={`self-start rounded-xl border p-4 md:self-auto ${scorePanelClasses}`}
        >
          <div className="text-right">
            <div className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Overall score
            </div>

            <div className={`text-4xl font-extrabold ${scoreTextClass}`}>
              {Math.round(score)}
              <span className="ml-0.5 text-lg font-normal text-slate-400 dark:text-slate-500">
                /100
              </span>
            </div>

            <div className="mt-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
              {data.tierLabel}
            </div>
          </div>
        </div>
      </div>

      {data.pillars && (
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <PillarCard
            label="Agreement"
            value={data.pillars.agreement}
            barClassName="bg-blue-500"
          />

          <PillarCard
            label="Independent evidence"
            value={data.pillars.corroboration}
            barClassName="bg-teal-500"
          />

          <PillarCard
            label="Coverage"
            value={data.pillars.coverage}
            barClassName="bg-indigo-500"
          />

          <PillarCard
            label="Extraction reliability"
            value={data.pillars.extractionReliability}
            barClassName="bg-amber-500"
          />
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/40">
          <p className="text-xs text-slate-500 dark:text-slate-400">Fields evaluated</p>

          <p className="mt-1 font-semibold text-slate-900 dark:text-white">
            {data.summary.presentComparableFields} of{' '}
            {data.summary.expectedComparableFields}
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/40">
          <p className="text-xs text-slate-500 dark:text-slate-400">Independent evidence</p>

          <p className="mt-1 font-semibold text-slate-900 dark:text-white">
            {data.independentDocumentTypes}{' '}
            {data.independentDocumentTypes === 1 ? 'type' : 'types'}
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/40">
          <p className="text-xs text-slate-500 dark:text-slate-400">Needs review</p>

          <p className="mt-1 font-semibold text-amber-600 dark:text-amber-300">
            {data.summary.needsReviewFields}
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/40">
          <p className="text-xs text-slate-500 dark:text-slate-400">Critical conflicts</p>

          <p
            className={`mt-1 font-semibold ${data.summary.criticalConflicts > 0
                ? 'text-rose-600 dark:text-rose-300'
                : 'text-emerald-600 dark:text-emerald-300'
              }`}
          >
            {data.summary.criticalConflicts}
          </p>
        </div>
      </div>

      {data.reasons.length > 0 && (
        <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800/60 dark:bg-slate-950/40">
          <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <FileText className="h-4 w-4 text-blue-500 dark:text-blue-400" />
            Key consistency observations
          </h4>

          <ul className="space-y-2">
            {data.reasons.map((reason, index) => {
              const tone = getObservationTone(reason);

              return (
                <li
                  key={`${reason}-${index}`}
                  className="flex items-start gap-2.5 text-sm text-slate-700 dark:text-slate-300"
                >
                  <ObservationIcon tone={tone} />
                  <span>{reason}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-800/80 dark:bg-slate-950/80 dark:text-slate-400">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />

        <span>
          <strong>Advisory limitation:</strong> {data.disclaimer}
        </span>
      </div>
    </section>
  );
};

export default IdentityResolutionConfidenceCard;