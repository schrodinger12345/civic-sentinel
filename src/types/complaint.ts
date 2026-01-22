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

export type AuthenticityStatus = 'fake' | 'uncertain' | 'real';

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
  citizenLocation: string; // Human-readable location name
  description: string; // AI-generated from image

  // Image-based reporting fields
  title: string; // User-provided title/subject
  imageBase64: string; // Base64-encoded image
  coordinates: {
    latitude: number;
    longitude: number;
  };

  createdAt: string | Date;
  updatedAt: string | Date;

  // AI-determined fields
  category: string; // Type of issue (pothole, garbage, streetlight, etc.)
  severity: 'low' | 'medium' | 'high' | 'critical';
  priority: number;

  // Authenticity scoring
  confidenceScore: number; // 0.0 - 1.0
  authenticityStatus: AuthenticityStatus; // fake/uncertain/real

  // Status tracking
  status: ComplaintStatus;
  assignedOfficialId?: string;
  
  /**
   * AGENTIC STATE MACHINE (AUTHORITATIVE)
   * nextEscalationAt is the ONLY source of truth for when to escalate.
   * DO NOT compute from createdAt + slaSeconds.
   * Frontend MUST read this value, never derive it.
   */
  nextEscalationAt: string | Date;
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
