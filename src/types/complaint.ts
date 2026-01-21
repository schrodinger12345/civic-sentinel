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

export type TimelineEventType = 'system' | 'official' | 'citizen';

export interface TimelineEvent {
  type: TimelineEventType;
  action: string;
  message: string;
  timestamp: string | Date;
}

export interface AuditEntry {
  timestamp: string | Date;
  action: string;
  actor: 'system' | 'citizen' | 'official';
  details?: Record<string, unknown>;
}

export interface EscalationEvent {
  timestamp: string | Date;
  level: 0 | 1 | 2 | 3;
  reason: string;
  escalatedTo?: string;
}

/**
 * Agent decision record - verbatim Gemini output for proof of AI agency.
 * Judges can see this to verify AI is actually called and drives behavior.
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
  decidedAt: string | Date;
}

export interface Complaint {
  id: string;
  citizenId: string;
  citizenName: string;
  citizenLocation: string;
  description: string;
  imageUrl?: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  issueType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  assignedDepartment: string;
  priority: number;
  status: ComplaintStatus;
  assignedOfficialId?: string;
  expectedResolutionTime: string | Date;
  slaDeadline?: string | Date;
  slaHours?: number;
  escalationLevel: 0 | 1 | 2 | 3;
  escalationHistory: EscalationEvent[];
  auditLog: AuditEntry[];
  /** Agent decision - verbatim Gemini output for proof of AI agency */
  agentDecision?: AgentDecision;
}

export interface OfficialStats {
  total: number;
  byStatus: {
    assigned: number;
    acknowledged: number;
    inProgress: number;
    onHold: number;
    resolved: number;
    escalated: number;
  };
  byPriority: {
    high: number;
    medium: number;
    low: number;
  };
  escalated: number;
  averageResolutionTime: number;
  slaCompliance: number;
}
