import admin from 'firebase-admin';
import { firebaseService } from './firebase.service.js';
import { Complaint } from '../types/complaint.js';
import { toDate, toFirestoreDate } from '../utils/firestore.js';

// 🔥 SLA is intentionally 10 seconds for demo determinism
const SLA_MS = 10_000;

// Only process complaints that are not resolved and have an escalation due
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

const MAX_BATCH_SIZE = 5; // Max complaints to process per tick
const WATCHDOG_INTERVAL_MS = 1000; // 1 second checks for demo

/**
 * SLA Watchdog - enforces deterministic 10-second escalation intervals.
 * Uses ONLY nextEscalationAt as the source of truth.
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
    }, WATCHDOG_INTERVAL_MS);
    console.log(`⏱️  SLA watchdog started (${WATCHDOG_INTERVAL_MS}ms interval, SLA=${SLA_MS}ms)`);
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

    const now = new Date();
    const nowTs = admin.firestore.Timestamp.fromDate(now);
    const updatedIds: string[] = [];

    console.log(`[SLA WATCHDOG] Tick at ${now.toISOString()}`);

    try {
      const db = admin.firestore();

      // Find complaints that need escalation (nextEscalationAt <= now and not resolved)
      const snap = await db
        .collection('complaints')
        .where('status', '!=', 'resolved')
        .where('nextEscalationAt', '<=', nowTs)
        .orderBy('nextEscalationAt', 'asc')
        .limit(MAX_BATCH_SIZE)
        .get();

      const complaints = snap.docs.map(doc => {
        const data = doc.data() as Complaint;
        return {
          ...data,
          id: doc.id,
          nextEscalationAt: data.nextEscalationAt ? toDate(data.nextEscalationAt) : null,
          createdAt: data.createdAt ? toDate(data.createdAt) : null,
          updatedAt: data.updatedAt ? toDate(data.updatedAt) : null,
        };
      });

      // Process each complaint that needs escalation
      for (const complaint of complaints) {
        try {
          const currentLevel = complaint.escalationLevel ?? 0;
          let newLevel: 0 | 1 | 2 | 3;
          let newStatus: string;
          let message: string;

          // Determine new escalation level and status
          if (currentLevel === 0) {
            newLevel = 1;
            newStatus = 'sla_warning';
            message = 'SLA breached – Level 1 escalation';
          } else if (currentLevel === 1) {
            newLevel = 2;
            newStatus = 'escalated';
            message = 'SLA breached – Level 2 escalation';
          } else if (currentLevel === 2) {
            newLevel = 3;
            newStatus = 'escalated';
            message = 'SLA breached – Level 3 escalation (final warning)';
          } else {
            newLevel = 3;
            newStatus = 'resolved';
            message = 'Complaint auto-resolved after final escalation';
          }

          // 🔥 Next escalation is ALWAYS now + 10 seconds (unless resolved)
          const nextEscalationAt = newStatus !== 'resolved'
            ? new Date(now.getTime() + SLA_MS)
            : null;

          // Prepare update data - NO legacy fields
          const updateData: any = {
            escalationLevel: newLevel,
            status: newStatus,
            updatedAt: now,
            nextEscalationAt: nextEscalationAt ? toFirestoreDate(nextEscalationAt) : null,
          };

          console.log(`[SLA] Complaint ${complaint.id} - Level ${currentLevel} → ${newLevel} (${newStatus}), next: ${nextEscalationAt?.toISOString() ?? 'N/A'}`);

          // Perform atomic update
          await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(db.collection('complaints').doc(complaint.id));
            if (!doc.exists) return;

            const currentData = doc.data() as Complaint;
            if (currentData.status === 'resolved') return;

            // Update the document
            transaction.update(db.collection('complaints').doc(complaint.id), updateData);

            // Add timeline event
            const timelineEvent = {
              type: 'system' as const,
              action: newStatus === 'resolved' ? 'resolved' : 'escalated',
              message,
              timestamp: now,
            };
            transaction.update(db.collection('complaints').doc(complaint.id), {
              timeline: admin.firestore.FieldValue.arrayUnion(timelineEvent)
            });

            // Add audit log entry
            const auditEntry = {
              timestamp: nowTs,
              action: newStatus === 'resolved'
                ? 'Auto-resolved after final escalation'
                : `Escalated to level ${newLevel}`,
              actor: 'system' as const,
              details: {
                previousLevel: currentLevel,
                newLevel,
                previousStatus: currentData.status,
                newStatus,
                nextEscalationAt: updateData.nextEscalationAt
              }
            };
            transaction.update(db.collection('complaints').doc(complaint.id), {
              auditLog: admin.firestore.FieldValue.arrayUnion(auditEntry)
            });
          });

          console.log(`[SLA] ✅ ${complaint.id}: Level ${currentLevel} → ${newLevel} (${newStatus})`);
          updatedIds.push(complaint.id);

        } catch (error: any) {
          if (error.code === 'RESOURCE_EXHAUSTED' || error.code === 8) {
            console.warn(`[SLA] Quota exceeded processing ${complaint.id}, will retry next tick`);
            break;
          }
          console.error(`[SLA] Error processing ${complaint.id}:`, error);
        }
      }

      if (updatedIds.length > 0) {
        console.log(`🚨 SLA watchdog processed ${updatedIds.length} complaint(s): ${updatedIds.join(', ')}`);
      }

      return {
        scanned: snap.size,
        escalated: updatedIds.length,
        updatedIds
      };
    } finally {
      this.running = false;
    }
  }
}

export const slaWatchdogService = new SLAWatchdogService();
