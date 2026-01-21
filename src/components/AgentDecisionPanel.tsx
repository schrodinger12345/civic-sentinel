import { motion } from 'framer-motion';
import { Brain, Clock, Shield, Zap, AlertTriangle } from 'lucide-react';
import { AgentDecision } from '@/types/complaint';

interface AgentDecisionPanelProps {
    decision: AgentDecision | undefined;
    complaintDescription?: string;
    className?: string;
}

/**
 * Displays agent decision with STRICT source-gating.
 * 
 * CRITICAL RULES (epistemic honesty):
 * - If source === 'gemini': Show verbatim Gemini output
 * - If source === 'fallback': Show fallback notice, NO fake JSON
 * - NEVER blur the line between AI and system defaults
 */
export function AgentDecisionPanel({
    decision,
    complaintDescription,
    className = '',
}: AgentDecisionPanelProps) {
    if (!decision) {
        return (
            <div className={`glass-panel-dark p-4 ${className}`}>
                <div className="flex items-center gap-2 text-muted-foreground">
                    <Brain className="w-4 h-4" />
                    <span className="text-sm">No agent decision data available</span>
                </div>
            </div>
        );
    }

    const isGemini = decision.source === 'gemini';

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`glass-panel border ${isGemini ? 'border-green-500/30' : 'border-yellow-500/30'
                } p-4 space-y-4 ${className}`}
        >
            {/* CASE A: Gemini ran successfully */}
            {isGemini && decision.raw && (
                <>
                    {/* Header - GEMINI */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Zap className="w-5 h-5 text-green-400" />
                            <span className="text-sm font-bold text-green-400">
                                Gemini Agent Decision (Verbatim)
                            </span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            <span>{new Date(decision.decidedAt as any).toLocaleString()}</span>
                        </div>
                    </div>

                    {/* Input */}
                    {complaintDescription && (
                        <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                            <div className="text-xs font-mono uppercase text-muted-foreground mb-1">
                                Input (Complaint)
                            </div>
                            <p className="text-sm text-foreground">"{complaintDescription}"</p>
                        </div>
                    )}

                    {/* Raw Gemini JSON - THE PROOF */}
                    <div className="bg-black/40 rounded-lg p-3 border border-green-500/30">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-mono uppercase text-green-400">
                                Raw Gemini JSON (unmodified)
                            </span>
                        </div>
                        <pre className="text-xs font-mono text-green-400 overflow-x-auto whitespace-pre-wrap">
                            {JSON.stringify({
                                department: decision.raw.department,
                                severity: decision.raw.severity,
                                priority: decision.raw.priority,
                                sla_seconds: decision.raw.sla_seconds,
                                reasoning: decision.raw.reasoning,
                            }, null, 2)}
                        </pre>
                    </div>

                    {/* AI Reasoning */}
                    {decision.raw.reasoning && (
                        <div className="space-y-1">
                            <div className="text-xs font-mono uppercase text-muted-foreground">
                                Gemini Reasoning
                            </div>
                            <p className="text-sm text-foreground/90 italic">
                                "{decision.raw.reasoning}"
                            </p>
                        </div>
                    )}
                </>
            )}

            {/* CASE B: Gemini failed - FALLBACK */}
            {!isGemini && (
                <>
                    {/* Header - FALLBACK */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-yellow-400" />
                            <span className="text-sm font-bold text-yellow-400">
                                Fallback Classification (AI Unavailable)
                            </span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            <span>{new Date(decision.decidedAt as any).toLocaleString()}</span>
                        </div>
                    </div>

                    {/* Fallback Notice */}
                    <div className="bg-yellow-500/10 rounded-lg p-4 border border-yellow-500/30">
                        <p className="text-sm text-yellow-200 font-medium mb-2">
                            {decision.reason || 'Gemini unavailable'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            This decision was made using deterministic system defaults.<br />
                            SLA enforcement still applies identically.
                        </p>
                    </div>

                    {/* No raw JSON shown - that would be dishonest */}
                </>
            )}

            {/* Enforcement Badge - applies to BOTH cases */}
            <div className="flex items-center gap-2 pt-2 border-t border-white/10">
                <Shield className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                    Enforced by: <span className="text-foreground font-medium">Deterministic SLA Watchdog</span>
                    {isGemini ? ' (AI classification accepted)' : ' (using system defaults)'}
                </span>
            </div>
        </motion.div>
    );
}

