import { v4 as uuidv4 } from 'uuid';
import { Complaint, GeminiAnalysisResult, AgentDecision, AuthenticityStatus } from '../types/complaint.js';
import { geminiService } from './gemini.service.js';
import { firebaseService } from './firebase.service.js';

// 🔥 SLA is intentionally 10 seconds for demo determinism
const SLA_MS = 10_000;

// Result type for submission - can be a complaint or a rejection
export type SubmitComplaintResult =
  | { success: true; complaint: Complaint }
  | { success: false; rejected: true; reason: string; confidenceScore: number };

export class ComplaintService {
  /**
   * Submit a new complaint with image-based analysis
   * Returns rejection if confidence score < 0.2 (fake report)
   */
  async submitComplaint(
    citizenId: string,
    citizenName: string,
    title: string,
    imageBase64: string,
    coordinates: { latitude: number; longitude: number },
    locationName: string
  ): Promise<SubmitComplaintResult> {
    // Step 1: Analyze image with Gemini Vision
    let analysis: GeminiAnalysisResult;
    let usedAI = false;

    try {
      analysis = await geminiService.analyzeImage(imageBase64, title, coordinates);
      usedAI = true;
      console.log('✅ Gemini Vision analysis successful:', analysis);
    } catch (error) {
      console.error('❌ Gemini Vision analysis failed:', error);
      console.error('Title was:', title);
      console.error('Coordinates were:', coordinates);

      // Fallback for dev/demo mode - mark as uncertain
      analysis = {
        generatedDescription: `Issue reported: ${title}. Location: ${locationName}. (AI analysis unavailable)`,
        category: 'other',
        severity: 'medium',
        priority: 5,
        confidenceScore: 0.5,
        authenticityStatus: 'uncertain',
      };
    }

    // Step 2: Check if report is fake (confidence < 0.2)
    if (analysis.confidenceScore < 0.2) {
      console.log('🚫 Report rejected as fake. Confidence:', analysis.confidenceScore);
      return {
        success: false,
        rejected: true,
        reason: 'Report flagged as potentially fake by AI analysis. Please submit a clear photo of an actual civic issue.',
        confidenceScore: analysis.confidenceScore,
      };
    }

    // Step 3: Create complaint object with FIXED 10-second SLA
    const now = new Date();
    const nextEscalationAt = new Date(now.getTime() + SLA_MS);

    // Build agentDecision object - NEVER recomputed after submission
    const agentDecision: AgentDecision = usedAI
      ? {
        source: 'gemini',
        raw: {
          department: analysis.category,
          severity: analysis.severity.toUpperCase(),
          priority: analysis.priority,
          sla_seconds: SLA_MS / 1000, // Always 10 seconds
          reasoning: `AI confidence: ${(analysis.confidenceScore * 100).toFixed(1)}%`,
        },
        decidedAt: now,
      }
      : {
        source: 'fallback',
        reason: 'Gemini Vision unavailable',
        decidedAt: now,
      };

    const complaint: Complaint = {
      id: uuidv4(),
      citizenId,
      citizenName,
      citizenLocation: locationName,
      description: analysis.generatedDescription,

      // Image-based fields
      title,
      imageBase64,
      coordinates,

      createdAt: now,
      updatedAt: now,

      // AI analysis results
      category: analysis.category,
      severity: analysis.severity,
      priority: analysis.priority,

      // Authenticity scoring
      confidenceScore: analysis.confidenceScore,
      authenticityStatus: analysis.authenticityStatus,

      // Status tracking - nextEscalationAt is the SINGLE SOURCE OF TRUTH for SLA
      status: 'analyzed',
      nextEscalationAt,

      // Agent Decision - verbatim Gemini output for proof of agency
      agentDecision,

      // Escalation
      escalationLevel: 0,
      escalationHistory: [],

      // Audit
      auditLog: [
        {
          timestamp: now,
          action: `Complaint submitted. SLA: ${SLA_MS / 1000}s. Category: ${analysis.category}, Severity: ${analysis.severity}`,
          actor: 'system',
          details: {
            title,
            coordinates,
            authenticityStatus: analysis.authenticityStatus,
          },
        },
      ],
    };

    // 🔥 DEFENSIVE: Hard delete legacy SLA fields before write
    delete (complaint as any).slaHours;
    delete (complaint as any).slaDeadline;
    delete (complaint as any).expectedResolutionTime;

    // 🔥 ASSERTION: SLA must be exactly 10 seconds
    const slaDiff = complaint.nextEscalationAt!.getTime() - complaint.createdAt.getTime();
    if (slaDiff !== SLA_MS) {
      throw new Error(`SLA VIOLATION: nextEscalationAt is ${slaDiff}ms, expected ${SLA_MS}ms`);
    }

    console.log(`🕐 SLA set: createdAt=${now.toISOString()}, nextEscalationAt=${nextEscalationAt.toISOString()}, diff=${slaDiff}ms`);

    // Step 4: Save to Firebase
    await firebaseService.createComplaint(complaint);

    // Step 5: Timeline AI advisory logging (explainability)
    if (usedAI) {
      const message = `AI analyzed image: category=${analysis.category}, severity=${analysis.severity.toUpperCase()}, confidence=${(analysis.confidenceScore * 100).toFixed(1)}%`;
      await firebaseService.appendTimelineEvent(complaint.id, {
        type: 'system',
        action: 'ai_image_analysis',
        message,
        timestamp: now,
      });
    } else {
      await firebaseService.appendTimelineEvent(complaint.id, {
        type: 'system',
        action: 'ai_fallback',
        message: 'AI image analysis unavailable. System applied fallback defaults.',
        timestamp: now,
      });
    }

    return { success: true, complaint };
  }

  /**
   * Check for complaints that need escalation (run periodically)
   */
  async checkAndProcessEscalations(): Promise<string[]> {
    // Escalation is now handled exclusively by the SLA watchdog for determinism.
    return [];
  }

  /**
   * Update complaint progress (official action)
   */
  async updateComplaintProgress(
    complaintId: string,
    officialId: string,
    status: 'acknowledged' | 'in_progress' | 'on_hold' | 'resolved',
    notes?: string
  ): Promise<Complaint> {
    const complaint = await firebaseService.getComplaint(complaintId);
    if (!complaint) throw new Error('Complaint not found');

    if (complaint.assignedOfficialId !== officialId) {
      throw new Error('Unauthorized: complaint not assigned to this official');
    }

    // Update status
    await firebaseService.updateComplaintStatus(complaintId, status, 'official', {
      notes,
      timestamp: new Date(),
    });

    // If resolved, record completion time
    if (status === 'resolved') {
      const timeToResolve =
        (new Date().getTime() - complaint.createdAt.getTime()) / (1000 * 60 * 60);

      const auditEntry = {
        timestamp: new Date(),
        action: `Complaint resolved in ${Math.round(timeToResolve)} hours`,
        actor: 'official' as const,
        details: { officialId, notes },
      };

      await firebaseService.updateComplaintFields(complaintId, {
        auditLog: [...complaint.auditLog, auditEntry],
      });
    }

    return await firebaseService.getComplaint(complaintId) as Complaint;
  }

  /**
   * Get complaint with full history for citizen/official view
   */
  async getComplaintDetails(complaintId: string): Promise<Complaint | null> {
    return await firebaseService.getComplaint(complaintId);
  }

  /**
   * Get dashboard stats for official
   */
  async getOfficialStats(officialId: string) {
    const complaints = await firebaseService.getComplaintsByOfficial(officialId);

    return {
      total: complaints.length,
      byStatus: {
        assigned: complaints.filter(c => c.status === 'assigned').length,
        acknowledged: complaints.filter(c => c.status === 'acknowledged').length,
        inProgress: complaints.filter(c => c.status === 'in_progress').length,
        onHold: complaints.filter(c => c.status === 'on_hold').length,
        resolved: complaints.filter(c => c.status === 'resolved').length,
        escalated: complaints.filter(c => c.status === 'escalated').length,
      },
      byPriority: {
        high: complaints.filter(c => c.priority >= 8).length,
        medium: complaints.filter(c => c.priority >= 5 && c.priority < 8).length,
        low: complaints.filter(c => c.priority < 5).length,
      },
      escalated: complaints.filter(c => c.escalationLevel > 0).length,
      averageResolutionTime: this.calculateAvgResolutionTime(complaints),
      slaCompliance: this.calculateSLACompliance(complaints),
    };
  }

  private calculateAvgResolutionTime(complaints: Complaint[]): number {
    const resolved = complaints.filter(c => c.status === 'resolved');
    if (resolved.length === 0) return 0;

    const total = resolved.reduce((sum, c) => {
      return sum + (c.updatedAt.getTime() - c.createdAt.getTime());
    }, 0);

    return Math.round(total / resolved.length / (1000 * 60 * 60)); // hours
  }

  private calculateSLACompliance(complaints: Complaint[]): number {
    const completed = complaints.filter(c => c.status === 'resolved');
    if (completed.length === 0) return 100;

    // SLA compliance: resolved before nextEscalationAt (if set)
    const compliant = completed.filter(
      c => c.nextEscalationAt && c.updatedAt.getTime() <= c.nextEscalationAt.getTime()
    ).length;

    return Math.round((compliant / completed.length) * 100);
  }
}

export const complaintService = new ComplaintService();
