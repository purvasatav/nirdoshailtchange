import React, { useState } from 'react';
import type {
  IdentityTrustGraphData,
  DocumentDisplayStatus,
  RelationStatus,
} from '../types/identityTrustGraph';
import { ShieldCheck, FileText, Info } from 'lucide-react';

interface Props {
  graph?: IdentityTrustGraphData | null;
}

function getEvidenceStrengthMessage(docCount: number): string {
  if (docCount === 1) {
    return 'This visualization is based on a single uploaded document. Cross-document consistency cannot yet be established. Upload additional independent identity documents for stronger peer evidence.';
  }
  if (docCount === 2) {
    return 'Based on 2 independent document types. Confidence is evidence-capped because only two sources are available. Additional documents can strengthen cross-document evidence.';
  }
  if (docCount === 3) {
    return 'This visualization is based on 3 uploaded document types, providing stronger cross-document peer evidence for consistency analysis.';
  }
  return 'This visualization is based on multiple independent document types, providing robust peer evidence for cross-document consistency analysis.';
}

function getStatusColorHex(status: DocumentDisplayStatus | RelationStatus): string {
  switch (status) {
    case 'strong_agreement':
    case 'agreement':
      return '#10b981'; // emerald-500

    case 'review_recommended':
    case 'expected_variation':
      return '#f59e0b'; // amber-500

    case 'conflict_detected':
    case 'conflict':
      return '#f43f5e'; // rose-500

    case 'insufficient_evidence':
    default:
      return '#64748b'; // slate-500
  }
}

function getStatusBadgeClass(status: RelationStatus): string {
  switch (status) {
    case 'agreement':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30';
    case 'expected_variation':
      return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30';
    case 'conflict':
      return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/30';
    case 'insufficient_evidence':
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/30';
  }
}

function getStatusLabel(status: RelationStatus): string {
  switch (status) {
    case 'agreement':
      return 'Agreement';
    case 'expected_variation':
      return 'Expected Variation';
    case 'conflict':
      return 'Conflict Detected';
    case 'insufficient_evidence':
    default:
      return 'Insufficient Evidence';
  }
}

function formatDocTypeName(docType: string): string {
  return docType
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export const IdentityTrustGraph: React.FC<Props> = ({ graph }) => {
  if (!graph || !Array.isArray(graph.documentNodes) || graph.documentNodes.length === 0) {
    return null;
  }

  const [selectedDocId, setSelectedDocId] = useState<string | null>(
    graph.documentNodes[0]?.id || null
  );

  const selectedNode =
    graph.documentNodes.find((node) => node.id === selectedDocId) ||
    graph.documentNodes[0];

  const totalDocs = graph.documentNodes.length;
  const centerX = 400;
  const centerY = 160;
  const radius = Math.min(220, Math.max(150, 100 + totalDocs * 25));

  // Compute node positions around center (horizontal placement for 2 docs)
  const nodePositions = graph.documentNodes.map((node, index) => {
    let angle: number;
    if (totalDocs === 2) {
      angle = index === 0 ? Math.PI : 0;
    } else {
      angle = (2 * Math.PI * index) / totalDocs - Math.PI / 2;
    }
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);
    return { node, x, y };
  });

  const centralColor = getStatusColorHex(graph.centralNode.displayStatus);

  return (
    <section className="mb-8 rounded-xl border border-slate-200 bg-white p-6 text-slate-900 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:shadow-xl">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-3 text-indigo-600 dark:text-indigo-400">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-wide text-slate-900 dark:text-white">
              Visual Identity Evidence Graph
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Document-level evidence relations derived strictly from consensus rules
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300">
            <FileText className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
            {totalDocs} Uploaded {totalDocs === 1 ? 'Document' : 'Documents'}
          </span>
        </div>
      </div>

      {/* Evidence Strength Info Note */}
      <div className="mb-6 flex items-start gap-2.5 rounded-lg border border-blue-500/30 bg-blue-50 p-3.5 text-xs text-blue-900 dark:border-blue-500/20 dark:bg-blue-500/5 dark:text-blue-300">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
        <div>
          <span className="font-bold text-slate-900 dark:text-white block mb-0.5">Evidence Strength</span>
          <p className="leading-relaxed text-blue-800 dark:text-blue-200/90">
            {getEvidenceStrengthMessage(graph.summary?.totalDocuments || totalDocs)}
          </p>
        </div>
      </div>

      {/* SVG Canvas */}
      <div className="relative mb-6 rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800/80 dark:bg-slate-950/70">
        <svg
          viewBox="0 0 800 320"
          className="w-full h-auto max-h-[340px] overflow-visible"
        >
          <defs>
            <filter id="glow-central" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Connection Lines */}
          {nodePositions.map(({ node, x, y }) => {
            const edgeColor = getStatusColorHex(node.displayStatus);
            const isSelected = selectedDocId === node.id;
            return (
              <line
                key={`edge-${node.id}`}
                x1={centerX}
                y1={centerY}
                x2={x}
                y2={y}
                stroke={edgeColor}
                strokeWidth={isSelected ? 4 : 2}
                strokeDasharray={
                  node.displayStatus === 'insufficient_evidence' ? '6 4' : 'none'
                }
                opacity={isSelected ? 1 : 0.75}
                className="transition-all duration-300"
              />
            );
          })}

          {/* Central Node */}
          <g filter="url(#glow-central)">
            <circle
              cx={centerX}
              cy={centerY}
              r={46}
              className="fill-white dark:fill-slate-900"
              stroke={centralColor}
              strokeWidth={3}
            />
            <circle
              cx={centerX}
              cy={centerY}
              r={38}
              fill={centralColor}
              fillOpacity={0.15}
            />
            <text
              x={centerX}
              y={centerY - 6}
              textAnchor="middle"
              className="fill-slate-900 dark:fill-slate-100"
              fontSize={11}
              fontWeight="bold"
            >
              Consensus Profile
            </text>
            <text
              x={centerX}
              y={centerY + 10}
              textAnchor="middle"
              className="fill-slate-500 dark:fill-slate-400"
              fontSize={9}
            >
              Cross-document evidence
            </text>
          </g>

          {/* Document Nodes */}
          {nodePositions.map(({ node, x, y }) => {
            const nodeColor = getStatusColorHex(node.displayStatus);
            const isSelected = selectedDocId === node.id;

            return (
              <g
                key={`node-${node.id}`}
                transform={`translate(${x}, ${y})`}
                onClick={() => setSelectedDocId(node.id)}
                className="cursor-pointer transition-transform duration-200 hover:scale-105"
              >
                {isSelected && (
                  <circle
                    r={36}
                    fill="none"
                    className="stroke-slate-900 dark:stroke-white"
                    strokeWidth={2}
                    strokeDasharray="4 3"
                    opacity={0.8}
                  />
                )}
                <circle
                  r={30}
                  className="fill-white dark:fill-slate-800"
                  stroke={nodeColor}
                  strokeWidth={isSelected ? 3 : 2}
                />
                <circle
                  r={24}
                  fill={nodeColor}
                  fillOpacity={0.15}
                />
                <text
                  x={0}
                  y={-2}
                  textAnchor="middle"
                  className="fill-slate-900 dark:fill-white"
                  fontSize={10}
                  fontWeight="bold"
                >
                  {formatDocTypeName(node.docType)}
                </text>
                <text
                  x={0}
                  y={10}
                  textAnchor="middle"
                  className="fill-slate-500 dark:fill-slate-400"
                  fontSize={8}
                >
                  {node.relations.length} {node.relations.length === 1 ? 'relation' : 'relations'}
                </text>
                <text
                  x={0}
                  y={44}
                  textAnchor="middle"
                  className="fill-slate-700 dark:fill-slate-300"
                  fontSize={10}
                  fontWeight="semibold"
                >
                  {node.title.length > 18 ? `${node.title.slice(0, 16)}...` : node.title}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Status Legend */}
        <div className="mt-3 flex flex-wrap items-center justify-center gap-4 border-t border-slate-200 dark:border-slate-800/80 pt-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-emerald-500" />
            <span className="text-slate-700 dark:text-slate-300">Agreement</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-amber-500" />
            <span className="text-slate-700 dark:text-slate-300">Expected Variation / Review</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-rose-500" />
            <span className="text-slate-700 dark:text-slate-300">Conflict Detected</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-slate-500" />
            <span className="text-slate-700 dark:text-slate-300">Insufficient Evidence</span>
          </div>
        </div>
      </div>

      {/* Selected Document Field Evidence Relations Panel */}
      {selectedNode && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950/60">
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3 dark:border-slate-800/80">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                FIELD EVIDENCE BY DOCUMENT
              </span>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {selectedNode.title} ({formatDocTypeName(selectedNode.docType)})
              </h3>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 font-medium dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20">
                {selectedNode.summary.agreement} Agreement
              </span>
              {selectedNode.summary.expected_variation > 0 && (
                <span className="rounded-full bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-0.5 font-medium dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20">
                  {selectedNode.summary.expected_variation} Variation
                </span>
              )}
              {selectedNode.summary.conflict > 0 && (
                <span className="rounded-full bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-0.5 font-medium dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20">
                  {selectedNode.summary.conflict} Conflict
                </span>
              )}
              {selectedNode.summary.insufficient_evidence > 0 && (
                <span className="rounded-full bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-0.5 font-medium dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/20">
                  {selectedNode.summary.insufficient_evidence} Insufficient
                </span>
              )}
            </div>
          </div>

          {selectedNode.relations.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 italic">
              No comparable identity field relations derived for this document.
            </p>
          ) : (
            <div className="space-y-3">
              {selectedNode.relations.map((rel, idx) => {
                const badgeClass = getStatusBadgeClass(rel.status);
                const badgeLabel = getStatusLabel(rel.status);

                return (
                  <div
                    key={`${rel.fieldKey}-${idx}`}
                    className="rounded-lg border border-slate-200 bg-white p-3.5 transition-colors hover:border-slate-300 dark:border-slate-800/80 dark:bg-slate-900/80 dark:hover:border-slate-700"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                      <div>
                        <span className="text-sm font-semibold text-slate-900 dark:text-white">
                          {rel.label}
                        </span>
                        <span className="ml-2 font-mono text-xs text-slate-500 dark:text-slate-400">
                          {rel.fieldKey}
                        </span>
                      </div>
                      <span
                        className={`self-start sm:self-auto rounded-full border px-2.5 py-0.5 text-xs font-semibold ${badgeClass}`}
                      >
                        {badgeLabel}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs mb-2">
                      <div className="rounded bg-slate-50 p-2 border border-slate-200 dark:bg-slate-950/60 dark:border-slate-800/60">
                        <span className="text-slate-500 dark:text-slate-400 block font-medium">
                          Document Value:
                        </span>
                        <span className="text-slate-800 dark:text-slate-200 font-mono font-semibold truncate block mt-0.5">
                          {rel.documentValue || 'Not available'}
                        </span>
                      </div>

                      <div className="rounded bg-slate-50 p-2 border border-slate-200 dark:bg-slate-950/60 dark:border-slate-800/60">
                        <span className="text-slate-500 dark:text-slate-400 block font-medium">
                          Consensus Value:
                        </span>
                        <span className="text-indigo-600 dark:text-indigo-300 font-mono font-semibold truncate block mt-0.5">
                          {rel.consensusValue || 'No consensus formed'}
                        </span>
                      </div>
                    </div>

                    {rel.explanation && (
                      <p className="text-xs text-slate-600 leading-relaxed bg-slate-100 p-2 rounded border border-slate-200 dark:bg-slate-950/30 dark:text-slate-400 dark:border-slate-800/40">
                        {rel.explanation}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default IdentityTrustGraph;
