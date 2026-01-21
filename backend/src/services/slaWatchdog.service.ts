import admin from 'firebase-admin';
import { firebaseService } from './firebase.service.js';
import { Complaint } from '../types/complaint.js';
import { geminiService } from './gemini.service.js';

const ACTIVE_STATUSES = [
  'submitted',
  'analyzed',
  'assigned',
  'acknowledged',
  'in_progress',
  'on_hold',
  'sla_warning',
  'escalated',
] as const;

function getDeadline(complaint: Complaint): Date {
  return complaint.slaDeadline ?? complaint.expectedResolutionTime;
}

/**
 * Runs inside the Node process (no external scheduler) and enforces SLA deadlines.
 * - every 60s
 * - finds overdue, non-resolved complaints
 * - increments escalationLevel, updates status, extends SLA, appends timeline
 */
export class SLAWatchdogService {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  start() {
    if (this.timer) return;
    // jitter start slightly so multiple instances don't align perfectly
    const initialDelayMs = 500 + Math.floor(Math.random() * 1500);
    setTimeout(() => this.tick().catch((e) => console.error('SLA watchdog tick failed:', e)), initialDelayMs);
    this.timer = setInterval(() => {
      this.tick().catch((e) => console.error('SLA watchdog tick failed:', e));
    }, 60_000);
    console.log('⏱️  SLA watchdog started (60s interval)');
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /**
   * One scan cycle.
   * Exported for manual trigger via existing route if needed.
   */
  async tick(): Promise<{ scanned: number; escalated: number; updatedIds: string[] }> {
    if (this.running) return { scanned: 0, escalated: 0, updatedIds: [] };
    this.running = true;
    try {
      const db = admin.firestore();
      const now = new Date();
      const nowTs = admin.firestore.Timestamp.fromDate(now);

      // Query by status first (cheap index), filter by deadline in memory for compatibility.
      const snap = await db
        .collection('complaints')
        .where('status', 'in', [...ACTIVE_STATUSES])
        .orderBy('updatedAt', 'desc')
        .limit(250)
        .get();

      const complaints = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as any[];
      const overdue = complaints.filter((c) => {
        const deadline = c.slaDeadline?.toDate?.() || c.expectedResolutionTime?.toDate?.();
        if (!deadline) return false;
        return deadline.getTime() < now.getTime();
      });

      const updatedIds: string[] = [];
      const escalatedForAI: {
        id: string;
        department: string;
        severity: string;
        status: string;
        elapsedSeconds: number;
      }[] = [];
      for (const raw of overdue) {
        const complaint = (await firebaseService.getComplaint(raw.id)) as Complaint | null;
        if (!complaint) continue;
        if (complaint.status === 'resolved') continue;

        const deadline = getDeadline(complaint);
        if (deadline.getTime() >= now.getTime()) continue; // double-check after fresh read

        const prevLevel = complaint.escalationLevel ?? 0;
        const nextLevel = Math.min(prevLevel + 1, 3) as 0 | 1 | 2 | 3;

        // Status transitions per spec:
        // - first breach -> sla_warning
        // - second breach -> escalated
        // - further breaches keep escalated (but keep leveling up to max 3)
        const nextStatus =
          nextLevel === 1 ? ('sla_warning' as const) : ('escalated' as const);

        const elapsedSeconds = Math.max(
          1,
          Math.round((now.getTime() - complaint.createdAt.getTime()) / 1000)
        );
        const hoursElapsed = complaint.slaHours ?? Math.max(1, Math.round(elapsedSeconds / 3600));
        const message = `System auto-escalated due to SLA breach (${hoursElapsed}h elapsed, no action).`;

        const demoSeconds = Number(process.env.DEMO_SLA_SECONDS ?? '10');
        const extensionMs =
          demoSeconds > 0 ? demoSeconds * 1000 : 24 * 60 * 60 * 1000;
        const newDeadline = new Date(now.getTime() + extensionMs);

        await firebaseService.updateComplaintFields(complaint.id, {
          escalationLevel: nextLevel,
          status: nextStatus,
          updatedAt: now,
          slaDeadline: newDeadline,
          expectedResolutionTime: newDeadline, // keep legacy UI consistent
        });

        await firebaseService.appendTimelineEvent(complaint.id, {
          type: 'system',
          action: nextStatus === 'sla_warning' ? 'sla_warning' : 'escalated',
          message,
          timestamp: now,
        });

        // Also append a short audit entry for older UI flows
        await db.collection('complaints').doc(complaint.id).update({
          auditLog: admin.firestore.FieldValue.arrayUnion({
            timestamp: nowTs,
            action: nextStatus === 'sla_warning' ? 'SLA warning issued' : `Escalated to level ${nextLevel}`,
            actor: 'system',
            details: { prevLevel, nextLevel, previousDeadline: admin.firestore.Timestamp.fromDate(deadline), newDeadline: admin.firestore.Timestamp.fromDate(newDeadline) },
          }),
        });

        updatedIds.push(complaint.id);
        escalatedForAI.push({
          id: complaint.id,
          department: complaint.department ?? complaint.assignedDepartment,
          severity: complaint.severity,
          status: nextStatus,
          elapsedSeconds,
        });
      }

      if (updatedIds.length) {
        console.log(
          `🚨 SLA watchdog updated ${updatedIds.length} complaint(s): ${updatedIds.join(', ')}`
        );
      }

      // Fire-and-forget advisory explanations; escalation already enforced.
      if (escalatedForAI.length) {
        void this.addEscalationExplanations(escalatedForAI).catch((e) =>
          console.error('Failed to add AI escalation justifications:', e)
        );
      }

      return { scanned: snap.size, escalated: updatedIds.length, updatedIds };
    } finally {
      this.running = false;
    }
  }

  /**
   * Advisory Gemini explanations for already-escalated complaints.
   * Not part of the critical path; failures fall back to deterministic messaging.
   */
  private async addEscalationExplanations(
    escalations: {
      id: string;
      department: string;
      severity: string;
      status: string;
      elapsedSeconds: number;
    }[]
  ): Promise<void> {
    for (const esc of escalations) {
      try {
        const justification = await geminiService.explainEscalation({
          department: esc.department,
          severity: esc.severity,
          elapsedSeconds: esc.elapsedSeconds,
          status: esc.status,
        });

        const message = justification
          ? `AI justification: ${justification}`
          : 'System escalation enforced due to SLA breach.';

        await firebaseService.appendTimelineEvent(esc.id, {
          type: 'system',
          action: 'ai_escalation_justification',
          message,
          timestamp: new Date(),
        });
      } catch {
        await firebaseService.appendTimelineEvent(esc.id, {
          type: 'system',
          action: 'ai_escalation_justification_failed',
          message: 'System escalation enforced due to SLA breach. AI justification unavailable.',
          timestamp: new Date(),
        });
      }
    }
  }
}

export const slaWatchdogService = new SLAWatchdogService();

