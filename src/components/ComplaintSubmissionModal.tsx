import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { Complaint, AgentDecision } from '@/types/complaint';
import { useToast } from '@/hooks/use-toast';
import { Brain, Zap, Clock, CheckCircle2, Loader2 } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  citizenId: string;
  citizenName: string;
  citizenLocation: string;
  onSuccess: (complaint: Complaint) => void;
}

export function ComplaintSubmissionModal({
  isOpen,
  onClose,
  citizenId,
  citizenName,
  citizenLocation,
  onSuccess,
}: Props) {
  const { toast } = useToast();
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<'input' | 'processing' | 'result'>('input');
  const [result, setResult] = useState<Complaint | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setDescription('');
      setLoading(false);
      setPhase('input');
      setResult(null);
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!description.trim()) return;
    setLoading(true);
    setPhase('processing');

    try {
      const { complaint } = await api.submitComplaint({
        citizenId,
        citizenName,
        citizenLocation,
        description: description.trim(),
      });

      setResult(complaint);
      setPhase('result');
      onSuccess(complaint);
    } catch (error) {
      toast({
        title: 'Submission failed',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
      setPhase('input');
    } finally {
      setLoading(false);
    }
  };

  const handleDone = () => {
    toast({
      title: 'Complaint submitted',
      description: 'AI classified and routed your issue. Watch the SLA countdown!',
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            {phase === 'input' && 'Report a Civic Issue'}
            {phase === 'processing' && 'Gemini AI Processing...'}
            {phase === 'result' && '✅ AI Classification Complete'}
          </DialogTitle>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {/* INPUT PHASE */}
          {phase === 'input' && (
            <motion.div
              key="input"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className="grid gap-2">
                <Label>Issue Description</Label>
                <Textarea
                  rows={5}
                  placeholder="Describe the issue, location details, and impact...&#10;Example: Garbage piling up near hospital gate for 3 days, causing health hazard."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="rounded-lg bg-primary/10 border border-primary/20 p-3 text-sm">
                <div className="flex items-start gap-2">
                  <Zap className="w-4 h-4 text-primary mt-0.5" />
                  <div>
                    <p className="text-primary font-semibold">Gemini AI will classify this complaint:</p>
                    <p className="text-muted-foreground text-xs mt-1">
                      → Department (Sanitation, Public Works, etc.)<br />
                      → Severity (LOW, MEDIUM, HIGH, CRITICAL)<br />
                      → Priority (1-10)<br />
                      → SLA deadline (10s for demo)
                    </p>
                  </div>
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={!description.trim()}>
                  Submit to Gemini AI
                </Button>
              </DialogFooter>
            </motion.div>
          )}

          {/* PROCESSING PHASE */}
          {phase === 'processing' && (
            <motion.div
              key="processing"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="py-8 text-center"
            >
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/20 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Calling Gemini AI...</h3>
              <p className="text-sm text-muted-foreground">
                Analyzing complaint and generating classification
              </p>
              <div className="mt-4 mx-auto max-w-xs p-3 rounded-lg bg-white/5 border border-white/10">
                <p className="text-xs font-mono text-primary animate-pulse">
                  POST /api/complaints/submit<br />
                  → geminiService.analyzeComplaint()<br />
                  → Building agentDecision...
                </p>
              </div>
            </motion.div>
          )}

          {/* RESULT PHASE - SOURCE-GATED DISPLAY */}
          {phase === 'result' && result && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {/* CASE A: Gemini ran successfully */}
              {result.agentDecision?.source === 'gemini' && result.agentDecision.raw && (
                <>
                  {/* Success Banner - GEMINI */}
                  <div className="rounded-lg bg-green-500/10 border border-green-500/30 p-3 flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                    <div>
                      <p className="text-sm font-semibold text-green-400">
                        Gemini AI Classification Complete
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Complaint ID: {result.id.slice(0, 8)}...
                      </p>
                    </div>
                  </div>

                  {/* Raw Gemini JSON - THE PROOF */}
                  <div className="rounded-lg bg-black/40 border border-green-500/30 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Zap className="w-4 h-4 text-green-400" />
                      <span className="text-sm font-bold text-green-400">
                        Gemini AI Response (Verbatim)
                      </span>
                    </div>
                    <pre className="text-xs font-mono text-green-400 overflow-x-auto whitespace-pre-wrap bg-black/40 rounded p-3">
                      {JSON.stringify({
                        department: result.agentDecision.raw.department,
                        severity: result.agentDecision.raw.severity,
                        priority: result.agentDecision.raw.priority,
                        sla_seconds: result.agentDecision.raw.sla_seconds,
                        reasoning: result.agentDecision.raw.reasoning,
                      }, null, 2)}
                    </pre>
                  </div>
                </>
              )}

              {/* CASE B: Gemini failed - FALLBACK (no fake JSON!) */}
              {result.agentDecision?.source === 'fallback' && (
                <>
                  {/* Banner - FALLBACK */}
                  <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/30 p-3 flex items-center gap-3">
                    <Clock className="w-5 h-5 text-yellow-400" />
                    <div>
                      <p className="text-sm font-semibold text-yellow-400">
                        Fallback Classification (AI Unavailable)
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Complaint ID: {result.id.slice(0, 8)}...
                      </p>
                    </div>
                  </div>

                  {/* Fallback Notice - NO FAKE JSON */}
                  <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/30 p-4">
                    <p className="text-sm text-yellow-200 font-medium mb-2">
                      {result.agentDecision.reason || 'Gemini unavailable'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      This decision was made using deterministic system defaults.<br />
                      SLA enforcement still applies identically.
                    </p>
                  </div>
                </>
              )}

              {/* Applied Values - shown for both cases */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-white/5 border border-white/10 p-3">
                  <div className="text-xs text-muted-foreground uppercase mb-1">Department</div>
                  <div className="text-sm font-semibold">{result.assignedDepartment}</div>
                </div>
                <div className="rounded-lg bg-white/5 border border-white/10 p-3">
                  <div className="text-xs text-muted-foreground uppercase mb-1">Severity</div>
                  <div className={`text-sm font-semibold uppercase ${result.severity === 'critical' ? 'text-destructive' :
                      result.severity === 'high' ? 'text-warning' :
                        'text-primary'
                    }`}>{result.severity}</div>
                </div>
                <div className="rounded-lg bg-white/5 border border-white/10 p-3">
                  <div className="text-xs text-muted-foreground uppercase mb-1">Priority</div>
                  <div className="text-sm font-semibold">{result.priority}/10</div>
                </div>
                <div className="rounded-lg bg-warning/10 border border-warning/30 p-3">
                  <div className="text-xs text-warning uppercase mb-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> SLA Deadline
                  </div>
                  <div className="text-sm font-semibold text-warning">10 seconds</div>
                </div>
              </div>

              {/* Source indicator */}
              <div className="text-xs text-muted-foreground text-center">
                Classification source: <span className={
                  result.agentDecision?.source === 'gemini'
                    ? 'text-green-400 font-semibold'
                    : 'text-yellow-400 font-semibold'
                }>
                  {result.agentDecision?.source === 'gemini' ? 'Gemini AI' : 'System Defaults'}
                </span>
              </div>

              {/* Enforcement Notice */}
              <div className="rounded-lg bg-white/5 border border-white/10 p-3 text-xs text-muted-foreground">
                <strong className="text-foreground">Next:</strong> SLA watchdog will check every 60s.
                When SLA expires, complaint auto-escalates. Watch the 🚨 Escalations count jump!
              </div>

              <DialogFooter>
                <Button onClick={handleDone} className="w-full">
                  Done - Watch SLA Countdown
                </Button>
              </DialogFooter>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}

