import React from 'react';
import type {
  IdentityTrustGraphData,
  RelationStatus,
  DocumentDisplayStatus,
} from '../types/identityTrustGraph';

interface Props {
  graph?: IdentityTrustGraphData | null;
}

function getPrintStatusColorHex(status: DocumentDisplayStatus | RelationStatus): string {
  switch (status) {
    case 'strong_agreement':
    case 'agreement':
      return '#059669'; // emerald-600

    case 'review_recommended':
    case 'expected_variation':
      return '#d97706'; // amber-600

    case 'conflict_detected':
    case 'conflict':
      return '#e11d48'; // rose-600

    case 'insufficient_evidence':
    default:
      return '#475569'; // slate-600
  }
}

function getPrintBadgeClass(status: RelationStatus): string {
  switch (status) {
    case 'agreement':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'expected_variation':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'conflict':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    case 'insufficient_evidence':
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}

function getPrintBadgeLabel(status: RelationStatus): string {
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

export const IdentityTrustGraphPrint: React.FC<Props> = ({ graph }) => {
  if (!graph || !Array.isArray(graph.documentNodes) || graph.documentNodes.length === 0) {
    return null;
  }

  const totalDocs = graph.documentNodes.length;
  const centerX = 350;
  const centerY = 140;
  const radius = Math.min(180, Math.max(120, 80 + totalDocs * 20));

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

  const centralColor = getPrintStatusColorHex(graph.centralNode.displayStatus);

  return (
    <section className="my-6 rounded-lg border border-slate-200 bg-white p-6 text-slate-900 shadow-none">
      {/* Printable Header */}
      <div className="mb-4 border-b border-slate-200 pb-3">
        <h2 className="text-lg font-bold text-slate-900">
          Visual Identity Evidence Graph
        </h2>
        <p className="text-xs text-slate-600">
          Static Evidence Map ({totalDocs} Uploaded {totalDocs === 1 ? 'Document' : 'Documents'})
        </p>
      </div>

      {/* Static SVG Diagram */}
      <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50/50 p-2">
        <svg viewBox="0 0 700 280" className="w-full h-auto max-h-[280px]">
          {/* Connection Lines */}
          {nodePositions.map(({ node, x, y }) => {
            const edgeColor = getPrintStatusColorHex(node.displayStatus);
            return (
              <line
                key={`print-edge-${node.id}`}
                x1={centerX}
                y1={centerY}
                x2={x}
                y2={y}
                stroke={edgeColor}
                strokeWidth={2}
                strokeDasharray={
                  node.displayStatus === 'insufficient_evidence' ? '4 3' : 'none'
                }
              />
            );
          })}

          {/* Central Node */}
          <g>
            <circle
              cx={centerX}
              cy={centerY}
              r={38}
              fill="#ffffff"
              stroke={centralColor}
              strokeWidth={3}
            />
            <text
              x={centerX}
              y={centerY - 4}
              textAnchor="middle"
              fill="#0f172a"
              fontSize={10}
              fontWeight="bold"
            >
              Consensus Profile
            </text>
            <text
              x={centerX}
              y={centerY + 10}
              textAnchor="middle"
              fill="#64748b"
              fontSize={8}
            >
              Cross-document evidence
            </text>
          </g>

          {/* Document Nodes */}
          {nodePositions.map(({ node, x, y }) => {
            const nodeColor = getPrintStatusColorHex(node.displayStatus);

            return (
              <g key={`print-node-${node.id}`} transform={`translate(${x}, ${y})`}>
                <circle
                  r={26}
                  fill="#ffffff"
                  stroke={nodeColor}
                  strokeWidth={2}
                />
                <text
                  x={0}
                  y={-1}
                  textAnchor="middle"
                  fill="#0f172a"
                  fontSize={9}
                  fontWeight="bold"
                >
                  {formatDocTypeName(node.docType)}
                </text>
                <text
                  x={0}
                  y={10}
                  textAnchor="middle"
                  fill="#64748b"
                  fontSize={7}
                >
                  {node.relations.length} relations
                </text>
                <text
                  x={0}
                  y={38}
                  textAnchor="middle"
                  fill="#334155"
                  fontSize={9}
                  fontWeight="semibold"
                >
                  {node.title.length > 16 ? `${node.title.slice(0, 14)}...` : node.title}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Legend */}
        <div className="mt-2 flex flex-wrap items-center justify-center gap-4 text-[10px] text-slate-700">
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-600 inline-block" /> Agreement
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-600 inline-block" /> Expected Variation / Review
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-600 inline-block" /> Conflict Detected
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-600 inline-block" /> Insufficient Evidence
          </span>
        </div>
      </div>

      {/* All Documents Field Evidence Static Breakdown for Print */}
      <div className="space-y-4">
        {graph.documentNodes.map((node) => (
          <div
            key={`print-doc-${node.id}`}
            className="rounded-md border border-slate-200 bg-white p-3 break-inside-avoid"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-2">
              <h4 className="text-sm font-bold text-slate-900">
                📄 {node.title} ({formatDocTypeName(node.docType)})
              </h4>
              <span className="text-xs font-semibold text-slate-600">
                {node.relations.length} relations
              </span>
            </div>

            {node.relations.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No comparable field relations.</p>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-1 font-semibold">Field</th>
                    <th className="py-1 font-semibold">Document Value</th>
                    <th className="py-1 font-semibold">Consensus Value</th>
                    <th className="py-1 font-semibold">Relation Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {node.relations.map((rel, idx) => (
                    <tr key={`rel-${idx}`}>
                      <td className="py-1.5 font-medium text-slate-800">{rel.label}</td>
                      <td className="py-1.5 font-mono text-slate-700">{rel.documentValue || '-'}</td>
                      <td className="py-1.5 font-mono text-slate-700">{rel.consensusValue || '-'}</td>
                      <td className="py-1.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${getPrintBadgeClass(rel.status)}`}>
                          {getPrintBadgeLabel(rel.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};

export default IdentityTrustGraphPrint;
