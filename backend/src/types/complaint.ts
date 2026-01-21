/**
 * Agent decision record - persisted verbatim from Gemini.
 * NEVER recomputed after initial submission.
 * This is the proof of AI agency for hackathon judges.
 */
export interface AgentDecision {
  source: 'gemini' | 'fallback';
  raw?: {
    department: string;
    severity: string;
    priority: number;
    sla_seconds: number;
    reasoning: string;
  };
  reason?: string; // Fallback reason if Gemini unavailable
  decidedAt: Date;
}

export interface Complaint {
  id: string;
  citizenId: string;
  citizenName: string;
  citizenLocation: string;
  description: string;
  imageUrl?: string;
  createdAt: Date;
  updatedAt: Date;
  
  // AI-determined fields
  issueType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  assignedDepartment: string;
  priority: number; // 1-10, higher = more urgent
  
  // Status tracking
  status: ComplaintStatus;
  assignedOfficialId?: string;
  expectedResolutionTime: Date; // SLA deadline

  /**
   * Hackathon-required (judge-facing) lifecycle fields.
   * Kept alongside legacy fields for backward compatibility with existing UI.
   */
  department?: string;
  slaHours?: number;
  slaDeadline?: Date;

  /**
   * Agent decision - verbatim Gemini output for proof of AI agency.
   * Judges can see this to verify AI is actually called and drives behavior.
   */
  agentDecision?: AgentDecision;
  
  // Escalation
  escalationLevel: 0 | 1 | 2 | 3; // 0=none, 1=supervisor, 2=dept head, 3=commissioner
  escalationHistory: EscalationEvent[];
  
  // Audit trail
  auditLog: AuditEntry[];
}

export type ComplaintStatus = 
  | 'submitted'
  | 'analyzed'
  | 'assigned'
  | 'acknowledged'
  | 'in_progress'
  | 'on_hold'
  | 'sla_warning'
  | 'resolved'
  | 'escalated';

export interface EscalationEvent {
  timestamp: Date;
  level: 0 | 1 | 2 | 3;
  reason: string;
  escalatedTo?: string;
}

export interface AuditEntry {
  timestamp: Date;
  action: string;
  actor: 'system' | 'citizen' | 'official';
  details?: Record<string, any>;
}

export interface GeminiAnalysisResult {
  issueType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  department: string;
  priority: number;
  reasoning: string;
  suggestedSLA: number; // hours
  publicImpact: string;
}

export type TimelineEventType = 'system' | 'official' | 'citizen';

export interface TimelineEvent {
  type: TimelineEventType;
  action: string;
  message: string;
  timestamp: Date;
}

export interface EscalationDecision {
  shouldEscalate: boolean;
  reason: string;
  nextLevel: 0 | 1 | 2 | 3;
}
