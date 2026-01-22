import admin from 'firebase-admin';
import {
  Complaint,
  ComplaintStatus,
  AuditEntry,
  EscalationEvent,
  TimelineEvent,
  TimelineEventType,
} from '../types/complaint.js';

let db: FirebaseFirestore.Firestore;

export function initializeFirebase() {
  if (admin.apps.length) {
    db = admin.firestore();
    return db;
  }

  const credential = admin.credential.applicationDefault();
  const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID;

  admin.initializeApp({
    credential,
    projectId,
  });

  db = admin.firestore();
  return db;
}

export class FirebaseService {
  /**
   * Create a new complaint in Firestore
   */
  async createComplaint(complaint: Complaint): Promise<Complaint> {
    const docRef = db.collection('complaints').doc(complaint.id);
    const firestoreData: Record<string, any> = {
      ...complaint,
      createdAt: admin.firestore.Timestamp.fromDate(complaint.createdAt),
      updatedAt: admin.firestore.Timestamp.fromDate(complaint.updatedAt),
      // Required lifecycle fields
      department: complaint.department ?? complaint.assignedDepartment,
      escalationHistory: complaint.escalationHistory.map(e => ({
        ...e,
        timestamp: admin.firestore.Timestamp.fromDate(e.timestamp),
      })),
      auditLog: complaint.auditLog.map(entry => ({
        ...entry,
        timestamp: admin.firestore.Timestamp.fromDate(entry.timestamp),
      })),
    };

    // Remove undefined fields to prevent Firestore errors
    Object.keys(firestoreData).forEach(key => {
      if (firestoreData[key] === undefined) {
        delete firestoreData[key];
      }
    });

    // 🔥 DEFENSIVE: Hard delete legacy SLA fields to prevent leaks
    delete firestoreData.slaHours;
    delete firestoreData.slaDeadline;
    delete firestoreData.expectedResolutionTime;

    await docRef.set(firestoreData);

    // Seed initial timeline from audit log (and ensure submit/analyze are represented)
    const timeline = db.collection('complaints').doc(complaint.id).collection('timeline');
    const baseEvents: TimelineEvent[] = [
      {
        type: 'citizen',
        action: 'submitted',
        message: 'Complaint submitted by citizen.',
        timestamp: complaint.createdAt,
      },
      {
        type: 'system',
        action: 'analyzed',
        message: `Complaint analyzed (fallback classification in demo mode). Dept: ${firestoreData.department}.`,
        timestamp: complaint.createdAt,
      },
    ];
    const batch = db.batch();
    for (const ev of baseEvents) {
      const evRef = timeline.doc();
      batch.set(evRef, {
        ...ev,
        timestamp: admin.firestore.Timestamp.fromDate(ev.timestamp),
      });
    }
    await batch.commit();
    return complaint;
  }

  /**
   * Get complaint by ID
   */
  async getComplaint(complaintId: string): Promise<Complaint | null> {
    const doc = await db.collection('complaints').doc(complaintId).get();
    if (!doc.exists) return null;

    const data = doc.data()!;
    return this.firestoreToComplaint(data);
  }

  /**
   * Timeline: append an event (required for explainability)
   */
  async appendTimelineEvent(
    complaintId: string,
    event: { type: TimelineEventType; action: string; message: string; timestamp?: Date }
  ): Promise<void> {
    const timestamp = event.timestamp ?? new Date();
    await db
      .collection('complaints')
      .doc(complaintId)
      .collection('timeline')
      .add({
        type: event.type,
        action: event.action,
        message: event.message,
        timestamp: admin.firestore.Timestamp.fromDate(timestamp),
      });
  }

  /**
   * Timeline: get events in chronological order
   */
  async getTimeline(complaintId: string): Promise<TimelineEvent[]> {
    const snap = await db
      .collection('complaints')
      .doc(complaintId)
      .collection('timeline')
      .orderBy('timestamp', 'asc')
      .get();

    return snap.docs.map((d) => ({
      ...(d.data() as any),
      timestamp: (d.data() as any).timestamp?.toDate?.() || new Date((d.data() as any).timestamp),
    })) as TimelineEvent[];
  }

  /**
   * Get all active complaints that may need escalation
   */
  async getAllActiveComplaints(): Promise<Complaint[]> {
    const snapshot = await db
      .collection('complaints')
      .where('status', 'in', ['assigned', 'acknowledged', 'in_progress', 'on_hold'])
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map(doc => this.firestoreToComplaint(doc.data()!));
  }

  /**
   * Get all complaints for a citizen
   */
  async getComplaintsByCitizen(citizenId: string): Promise<Complaint[]> {
    console.log('🔍 Firestore query - citizenId:', citizenId);
    try {
      const snapshot = await db
        .collection('complaints')
        .where('citizenId', '==', citizenId)
        .get();

      console.log('🔍 Firestore query returned', snapshot.docs.length, 'documents');
      if (snapshot.docs.length > 0) {
        console.log('🔍 First doc citizenId:', snapshot.docs[0].data().citizenId);
      }

      return snapshot.docs.map(doc => this.firestoreToComplaint(doc.data()!));
    } catch (err: any) {
      console.error('❌ Firestore query failed for citizenId', citizenId, err?.stack || err);
      throw err;
    }
  }

  /**
   * Get all complaints assigned to an official
   */
  async getComplaintsByOfficial(officialId: string): Promise<Complaint[]> {
    const snapshot = await db
      .collection('complaints')
      .where('assignedOfficialId', '==', officialId)
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map(doc => this.firestoreToComplaint(doc.data()!));
  }

  /**
   * Get complaints by department
   */
  async getComplaintsByDepartment(department: string): Promise<Complaint[]> {
    const snapshot = await db
      .collection('complaints')
      .where('assignedDepartment', '==', department)
      .orderBy('priority', 'desc')
      .get();

    return snapshot.docs.map(doc => this.firestoreToComplaint(doc.data()!));
  }

  /**
   * Update complaint status and add audit entry
   */
  async updateComplaintStatus(
    complaintId: string,
    newStatus: ComplaintStatus,
    actor: 'system' | 'citizen' | 'official',
    details?: Record<string, any>
  ): Promise<Complaint> {
    const complaint = await this.getComplaint(complaintId);
    if (!complaint) throw new Error('Complaint not found');

    const auditEntry: AuditEntry = {
      timestamp: new Date(),
      action: `Status changed from ${complaint.status} to ${newStatus}`,
      actor,
      details,
    };

    complaint.status = newStatus;
    complaint.updatedAt = new Date();
    complaint.auditLog.push(auditEntry);

    await this.updateComplaint(complaintId, {
      status: newStatus,
      updatedAt: new Date(),
      auditLog: complaint.auditLog,
    });

    await this.appendTimelineEvent(complaintId, {
      type: actor,
      action: 'status_change',
      message: `Status changed from ${complaint.status} to ${newStatus}.`,
      timestamp: auditEntry.timestamp,
    });

    return complaint;
  }

  /**
   * Add escalation event
   */
  async escalateComplaint(
    complaintId: string,
    reason: string,
    escalatedTo?: string
  ): Promise<Complaint> {
    const complaint = await this.getComplaint(complaintId);
    if (!complaint) throw new Error('Complaint not found');

    const nextLevel = Math.min(complaint.escalationLevel + 1, 3) as 0 | 1 | 2 | 3;

    const escalationEvent: EscalationEvent = {
      timestamp: new Date(),
      level: nextLevel,
      reason,
      escalatedTo,
    };

    complaint.escalationLevel = nextLevel;
    complaint.escalationHistory.push(escalationEvent);
    complaint.updatedAt = new Date();

    const auditEntry: AuditEntry = {
      timestamp: new Date(),
      action: `Escalated to level ${nextLevel}`,
      actor: 'system',
      details: { reason },
    };
    complaint.auditLog.push(auditEntry);

    await this.updateComplaint(complaintId, {
      escalationLevel: nextLevel,
      escalationHistory: complaint.escalationHistory,
      updatedAt: new Date(),
      auditLog: complaint.auditLog,
    });

    await this.appendTimelineEvent(complaintId, {
      type: 'system',
      action: 'escalated',
      message: reason,
      timestamp: new Date(),
    });

    return complaint;
  }

  /**
   * Public update (wrapper) for complaint partial fields.
   * Keeps legacy behavior but allows other services to patch required fields.
   */
  async updateComplaintFields(complaintId: string, updates: Partial<Complaint>): Promise<void> {
    await this.updateComplaint(complaintId, updates);
  }

  /**
   * Generic update for complaint
   */
  private async updateComplaint(
    complaintId: string,
    updates: Partial<Complaint>
  ): Promise<void> {
    const docRef = db.collection('complaints').doc(complaintId);

    const firestoreUpdates: Record<string, any> = {};

    for (const [key, value] of Object.entries(updates)) {
      if (value instanceof Date) {
        firestoreUpdates[key] = admin.firestore.Timestamp.fromDate(value);
      } else if (key === 'escalationHistory' && Array.isArray(value)) {
        firestoreUpdates[key] = value.map(e => ({
          ...e,
          timestamp: admin.firestore.Timestamp.fromDate(e.timestamp),
        }));
      } else if (key === 'auditLog' && Array.isArray(value)) {
        firestoreUpdates[key] = value.map(entry => ({
          ...entry,
          timestamp: admin.firestore.Timestamp.fromDate(entry.timestamp),
        }));
      } else {
        firestoreUpdates[key] = value;
      }
    }

    await docRef.update(firestoreUpdates);
  }

  /**
   * Convert Firestore document to Complaint object
   */
  private firestoreToComplaint(data: any): Complaint {
    return {
      ...data,
      createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
      updatedAt: data.updatedAt?.toDate?.() || new Date(data.updatedAt),
      escalationHistory: (data.escalationHistory || []).map((e: any) => ({
        ...e,
        timestamp: e.timestamp?.toDate?.() || new Date(e.timestamp),
      })),
      auditLog: (data.auditLog || []).map((entry: any) => ({
        ...entry,
        timestamp: entry.timestamp?.toDate?.() || new Date(entry.timestamp),
      })),
    } as Complaint;
  }
}

export const firebaseService = new FirebaseService();
