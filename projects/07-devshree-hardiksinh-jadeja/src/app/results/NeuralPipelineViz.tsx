'use client';

import React, { useMemo } from 'react';

interface NeuralPipelineVizProps {
    modelsActive?: string[];
    nlpCount?: number;
    variantScore?: number;
    phenoSim?: number;
    gnnScore?: number;
}

export function NeuralPipelineViz({
    nlpCount = 0,
}: NeuralPipelineVizProps) {
    const nodes = useMemo(() => [
        { id: 'input', label: 'Patient Data', x: 60, y: 80, icon: '📋', color: '#94a3b8', active: true, sub: 'Notes + HPO + VCF' },
        { id: 'nlp', label: 'Semantic Chunking', x: 200, y: 80, icon: '🔤', color: '#22d3ee', active: true, sub: `${nlpCount || 'Multiple'} terms matched` },
        { id: 'faiss', label: 'FAISS Vector DB', x: 340, y: 40, icon: '🗄️', color: '#a78bfa', active: true, sub: `OMIM, PubMed, Drugs` },
        { id: 'prompt', label: 'RAG Context', x: 340, y: 120, icon: '🧠', color: '#34d399', active: true, sub: `Grounded evidence` },
        { id: 'llm', label: 'LLM Reasoner', x: 480, y: 80, icon: '🤖', color: '#facc15', active: true, sub: `GPT-4 API / Mock` },
        { id: 'output', label: 'Structured Diagnosis', x: 640, y: 80, icon: '⚡', color: '#f472b6', active: true, sub: 'Final JSON output' },
    ], [nlpCount]);

    const connections = [
        { from: 'input', to: 'nlp' },
        { from: 'nlp', to: 'faiss' },
        { from: 'nlp', to: 'prompt' },
        { from: 'faiss', to: 'prompt' },
        { from: 'prompt', to: 'llm' },
        { from: 'faiss', to: 'llm' },
        { from: 'llm', to: 'output' },
    ];

    const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]));

    return (
        <div className="glass-card rounded-xl p-4 mb-6 overflow-hidden">
            <div className="flex items-center gap-2 mb-3">
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">LLM-RAG Pipeline</div>
                <div className="flex-1 h-px bg-border/30" />
                <div className="text-[10px] text-muted-foreground font-mono">Retrieval-Augmented Diagnostic Generation</div>
            </div>

            <svg viewBox="0 0 720 170" className="w-full" style={{ maxHeight: 200 }}>
                <defs>
                    <style>{`
            .flow-line {
              stroke-dasharray: 6 8;
              animation: flowDash 1.5s linear infinite;
            }
            @keyframes flowDash {
              to { stroke-dashoffset: -28; }
            }
            .node-pulse {
              animation: nodePulse 2s ease-in-out infinite;
            }
            @keyframes nodePulse {
              0%, 100% { opacity: 0.15; r: 28; }
              50% { opacity: 0.3; r: 34; }
            }
          `}</style>

                    {nodes.map(n => (
                        <filter key={n.id} id={`glow-${n.id}`}>
                            <feGaussianBlur stdDeviation="4" result="blur" />
                            <feMerge>
                                <feMergeNode in="blur" />
                                <feMergeNode in="SourceGraphic" />
                            </feMerge>
                        </filter>
                    ))}
                </defs>

                {connections.map((conn, i) => {
                    const from = nodeMap[conn.from];
                    const to = nodeMap[conn.to];
                    if (!from || !to) return null;
                    const isActive = from.active && to.active;

                    return (
                        <g key={i}>
                            <line
                                x1={from.x} y1={from.y}
                                x2={to.x} y2={to.y}
                                stroke={isActive ? 'rgba(148,163,184,0.15)' : 'rgba(148,163,184,0.06)'}
                                strokeWidth="2"
                            />
                            {isActive && (
                                <line
                                    x1={from.x} y1={from.y}
                                    x2={to.x} y2={to.y}
                                    stroke={to.color}
                                    strokeWidth="2"
                                    className="flow-line"
                                    opacity="0.5"
                                />
                            )}
                        </g>
                    );
                })}

                {nodes.map((n) => (
                    <g key={n.id}>
                        {n.active && (
                            <circle cx={n.x} cy={n.y} r="28" fill={n.color} className="node-pulse" />
                        )}
                        <circle
                            cx={n.x} cy={n.y} r="22"
                            fill={n.active ? 'rgba(15,23,42,0.9)' : 'rgba(15,23,42,0.5)'}
                            stroke={n.active ? n.color : 'rgba(148,163,184,0.2)'}
                            strokeWidth={n.active ? 2 : 1}
                            filter={n.active ? `url(#glow-${n.id})` : undefined}
                        />
                        <text x={n.x} y={n.y + 1} textAnchor="middle" dominantBaseline="middle" className="text-[14px]">
                            {n.icon}
                        </text>
                        <text
                            x={n.x} y={n.y + 36}
                            textAnchor="middle"
                            className="text-[9px] font-bold"
                            fill={n.active ? n.color : 'rgba(148,163,184,0.3)'}
                        >
                            {n.label}
                        </text>
                        <text
                            x={n.x} y={n.y + 47}
                            textAnchor="middle"
                            className="text-[7px] font-mono"
                            fill="rgba(148,163,184,0.4)"
                        >
                            {n.sub}
                        </text>
                    </g>
                ))}
            </svg>
        </div>
    );
}
