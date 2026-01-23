import { Router, Request, Response } from 'express';
import { complaintService } from '../services/complaint.service.js';
import { firebaseService } from '../services/firebase.service.js';
import { slaWatchdogService } from '../services/slaWatchdog.service.js';
import { geminiService } from '../services/gemini.service.js';
import { v4 as uuidv4 } from 'uuid';
import admin from 'firebase-admin';

const router = Router();

/**
 * 🔥 SLA is intentionally 10 seconds for demo determinism
 * NO environment switching. NO AI-suggested hours. ALWAYS 10 seconds.
 */
const SLA_SECONDS = 10;

// Normalize Firestore Timestamp | Date | ISO string | seconds object to milliseconds
function toMillis(value: any): number | null {
  if (!value) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') return new Date(value).getTime();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  return null;
}

/**
 * POST /api/complaints/submit
 */
router.post('/submit', async (req: Request, res: Response) => {
  try {
    const { citizenId, citizenName, title, imageBase64, coordinates, locationName } = req.body;
    console.log('🔍 POST /submit - citizenId:', citizenId, 'title:', title);

    if (!citizenId || !citizenName || !title || !imageBase64 || !coordinates || !locationName) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['citizenId', 'citizenName', 'title', 'imageBase64', 'coordinates', 'locationName'],
      });
    }

    if (typeof coordinates.latitude !== 'number' || typeof coordinates.longitude !== 'number') {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }

    const result = await complaintService.submitComplaint(
      citizenId,
      citizenName,
      title,
      imageBase64,
      coordinates,
      locationName
    );

    if (!result.success) {
      return res.status(200).json(result);
    }

    const serialize = (t: any) => {
      const ms = toMillis(t);
      return ms ? new Date(ms) : t;
    };
    const c = result.complaint;

    const nextEscMs = toMillis(c.nextEscalationAt) ?? Date.now();

    // 🔥 Enhanced response with visibility data
    res.status(201).json({
      success: true,
      complaint: {
        ...c,
        createdAt: serialize(c.createdAt),
        updatedAt: serialize(c.updatedAt),
        nextEscalationAt: serialize(c.nextEscalationAt),
        // Live SLA countdown
        slaCountdown: {
          secondsRemaining: Math.max(0, Math.round((nextEscMs - Date.now()) / 1000)),
          slaSeconds: SLA_SECONDS,
          status: Date.now() >= nextEscMs ? 'BREACHED' : 'ACTIVE',
        },
        // AI credibility banner
        aiAdvisory: {
          used: c.agentDecision?.source === 'gemini',
          label: c.agentDecision?.source === 'gemini'
            ? '✅ AI Advisory (Used)'
            : '⚠️ AI Advisory (Unavailable – System Defaults Applied)',
          confidence: c.confidenceScore,
          authenticity: c.authenticityStatus,
        },
        // AI vs System comparison
        decisionComparison: {
          department: { ai: c.agentDecision?.raw?.department ?? 'N/A', system: c.category },
          severity: { ai: c.agentDecision?.raw?.severity ?? 'N/A', system: c.severity.toUpperCase() },
          sla: { ai: c.agentDecision?.source === 'gemini' ? '48 hrs (suggested)' : 'N/A', system: `${SLA_SECONDS} seconds (Demo)` },
        },
        timeline: (c.timeline || []).map((e: any) => ({
          ...e,
          timestamp: serialize(e.timestamp),
        })),
      },
      message: 'Complaint submitted successfully',
    });
  } catch (err) {
    console.error('Submit failed:', err);
    res.status(500).json({ error: 'Failed to submit complaint' });
  }
});

/**
 * GET /api/complaints/:id/live
 * 🔥 LIVE STATUS with SLA countdown and explainability
 */
router.get('/:id/live', async (req: Request, res: Response) => {
  try {
    const complaint = await firebaseService.getComplaint(req.params.id);
    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    const now = Date.now();
    const nextEsc = toMillis(complaint.nextEscalationAt) ?? now;
    const created = toMillis(complaint.createdAt) ?? now;
    const secondsRemaining = Math.max(0, Math.round((nextEsc - now) / 1000));
    const isBreached = now >= nextEsc;

    // Build explainability string
    let escalationReason = '';
    if (complaint.escalationLevel === 0 && !isBreached) {
      escalationReason = `Awaiting action. ${secondsRemaining}s until escalation.`;
    } else if (complaint.escalationLevel === 0 && isBreached) {
      escalationReason = `This complaint will escalate because no official action occurred within ${SLA_SECONDS} seconds of submission.`;
    } else if (complaint.escalationLevel >= 1) {
      escalationReason = `Escalated to Level ${complaint.escalationLevel} because SLA of ${SLA_SECONDS} seconds was breached ${complaint.escalationLevel} time(s).`;
    }

    // Build human-readable timeline from audit log
    const escalationTimeline = [
      {
        event: 'CREATED',
        timestamp: complaint.createdAt.toISOString(),
        level: 0,
        description: 'Complaint submitted by citizen',
      },
      ...(complaint.auditLog || [])
        .filter((e: any) => e.action.includes('Escalated') || e.action.includes('resolved'))
        .map((e: any) => ({
          event: e.action.includes('resolved') ? 'RESOLVED' : 'ESCALATED',
          timestamp: e.timestamp?.toISOString?.() ?? e.timestamp,
          level: e.details?.newLevel ?? complaint.escalationLevel,
          description: e.action,
        })),
    ];

    res.json({
      id: complaint.id,
      status: complaint.status,
      escalationLevel: complaint.escalationLevel,
      // 🔥 Live SLA countdown
      slaCountdown: {
        secondsRemaining,
        slaSeconds: SLA_SECONDS,
        status: isBreached ? 'BREACHED' : 'ACTIVE',
        nextEscalationAt: complaint.nextEscalationAt?.toISOString(),
      },
      // 🔥 Explainability
      escalationReason,
      // 🔥 Human-readable timeline
      escalationTimeline,
      // AI info
      aiAdvisory: {
        used: complaint.agentDecision?.source === 'gemini',
        label: complaint.agentDecision?.source === 'gemini'
          ? '✅ AI Advisory (Used)'
          : '⚠️ AI Advisory (Unavailable)',
        confidence: complaint.confidenceScore,
      },
    });
  } catch (err) {
    console.error('Live status failed:', err);
    res.status(500).json({ error: 'Failed to get live status' });
  }
});

/**
 * GET /api/complaints/dashboard/stats
 * 🔥 DASHBOARD with big red counters for judges
 */
router.get('/dashboard/stats', async (_req: Request, res: Response) => {
  try {
    const db = admin.firestore();
    const snap = await db.collection('complaints').get();

    let total = 0;
    let escalated = 0;
    let slaBreaches = 0;
    let resolvedToday = 0;
    let pending = 0;
    let critical = 0;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    snap.forEach(doc => {
      const d = doc.data();
      total++;

      if (d.escalationLevel >= 1) escalated++;
      if (d.escalationLevel >= 3) critical++;
      if (d.status !== 'resolved') pending++;

      // Count SLA breaches (any escalation = breach)
      if (d.escalationLevel >= 1) slaBreaches++;

      // Resolved today
      const updatedAt = d.updatedAt?.toDate?.() ?? new Date(d.updatedAt);
      if (d.status === 'resolved' && updatedAt >= todayStart) {
        resolvedToday++;
      }
    });

    res.json({
      // 🔥 Big Red Numbers for Judges
      counters: {
        '🚨 Escalated': escalated,
        '⏳ SLA Breaches': slaBreaches,
        '✅ Resolved Today': resolvedToday,
        '⚠️ Critical (Level 3)': critical,
        '📋 Pending': pending,
        '📊 Total': total,
      },
      // Raw numbers for charts
      raw: { total, escalated, slaBreaches, resolvedToday, pending, critical },
      slaConfig: {
        seconds: SLA_SECONDS,
        description: 'All SLAs are 10 seconds for demo determinism',
      },
    });
  } catch (err) {
    console.error('Dashboard stats failed:', err);
    // 🔥 Safety net: return zeros instead of crashing
    res.json({
      counters: {
        '🚨 Escalated': 0,
        '⏳ SLA Breaches': 0,
        '✅ Resolved Today': 0,
        '⚠️ Critical (Level 3)': 0,
        '📋 Pending': 0,
        '📊 Total': 0,
      },
      raw: { total: 0, escalated: 0, slaBreaches: 0, resolvedToday: 0, pending: 0, critical: 0 },
      error: 'Stats temporarily unavailable',
    });
  }
});

/**
 * PUT /api/complaints/:id/kanban-status
 * Handle drag-and-drop status updates from Kanban board
 */
router.put('/:id/kanban-status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, officialId } = req.body;
    
    // Validate status
    const validStatuses = [
        'submitted', 'analyzed', 'assigned', 
        'in_progress', 'acknowledged', 'on_hold', 'sla_warning', 'escalated',
        'resolved'
    ];
    
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }

    console.log(`📋 Kanban update: ${id} -> ${status} (by ${officialId})`);

    // Use existing service method to handle logic
    await complaintService.updateComplaintProgress(id, officialId || 'unknown', status);

    const complaint = await firebaseService.getComplaint(id);
    res.json({ success: true, complaint });
  } catch (err: any) {
    console.error('Kanban update failed:', err);
    res.status(500).json({ error: err.message || 'Failed to update status' });
  }
});

/**
 * POST /api/complaints/chaos
 * 🔥 CHAOS BUTTON - Simulate stress for judges
 */
router.post('/chaos', async (req: Request, res: Response) => {
  const count = Math.min(req.body.count || 10, 20); // Max 20
  const now = admin.firestore.Timestamp.now();

  const issues = [
    'Pothole on Main Street',
    'Broken streetlight',
    'Garbage overflow',
    'Water leak',
    'Illegal dumping',
    'Road damage',
    'Blocked drain',
    'Traffic sign missing',
    'Sidewalk crack',
    'Public bench broken',
  ];

  const created: string[] = [];

  for (let i = 0; i < count; i++) {
    const id = uuidv4();
    const offsetSeconds = Math.floor(Math.random() * 15) - 5; // -5 to +10 seconds
    const nextEscalationAt = admin.firestore.Timestamp.fromMillis(
      now.toMillis() + offsetSeconds * 1000
    );

    const complaint = {
      id,
      citizenId: `chaos-${i}`,
      citizenName: `Citizen ${i + 1}`,
      citizenLocation: `Ward ${(i % 5) + 1}`,
      description: issues[i % issues.length],
      title: issues[i % issues.length],
      category: 'other',
      severity: ['low', 'medium', 'high'][i % 3],
      priority: (i % 10) + 1,
      status: offsetSeconds < 0 ? 'sla_warning' : 'analyzed',
      escalationLevel: offsetSeconds < -5 ? 1 : 0,
      escalationHistory: [],
      auditLog: [{
        timestamp: now,
        action: 'Chaos test complaint created',
        actor: 'system',
      }],
      createdAt: now,
      updatedAt: now,
      nextEscalationAt,
      confidenceScore: 0.8,
      authenticityStatus: 'real',
      imageBase64: '',
      coordinates: { latitude: 28.6139, longitude: 77.209 },
    };

    await firebaseService.createComplaint(complaint as any);
    created.push(id);
  }

  res.json({
    success: true,
    message: `🔥 CHAOS: Created ${count} complaints. Watch them escalate!`,
    created,
    hint: 'Check /api/complaints/dashboard/stats in 10 seconds to see escalation counters spike!',
  });
});

/**
 * POST /api/complaints/check-escalations
 */
router.post('/check-escalations', async (_req, res) => {
  const result = await slaWatchdogService.tick();
  res.json({
    success: true,
    escalated: result.updatedIds.length,
    complaintIds: result.updatedIds,
  });
});

/**
 * GET /api/complaints/all
 * List all complaints with live SLA status for official oversight
 */
router.get('/all', async (_req: Request, res: Response) => {
  try {
    const db = admin.firestore();
    const snap = await db.collection('complaints')
      .orderBy('createdAt', 'desc')
      .limit(500)
      .get();

    const now = Date.now();
    const complaints = snap.docs.map(doc => {
      const d = doc.data();
      const nextEsc = toMillis(d.nextEscalationAt) ?? now;
      const secondsRemaining = Math.max(0, Math.round((nextEsc - now) / 1000));
      const createdMs = toMillis(d.createdAt) ?? now;

      return {
        id: doc.id,
        citizenId: d.citizenId || '',
        citizenName: d.citizenName || 'Unknown',
        citizenLocation: d.citizenLocation || 'Unknown Location',
        title: d.title || d.description?.slice(0, 50) || 'Untitled',
        description: d.description || '',
        category: d.category || 'general',
        severity: d.severity || 'medium',
        priority: d.priority ?? 0,
        status: d.status || 'submitted',
        escalationLevel: d.escalationLevel || 0,
        confidenceScore: d.confidenceScore ?? 0.5,
        authenticityStatus: d.authenticityStatus || 'uncertain',
        createdAt: d.createdAt?.toDate?.()?.toISOString() || new Date(createdMs).toISOString(),
        updatedAt: d.updatedAt?.toDate?.()?.toISOString() || d.createdAt?.toDate?.()?.toISOString() || new Date(createdMs).toISOString(),
        nextEscalationAt: d.nextEscalationAt?.toDate?.()?.toISOString() || new Date(nextEsc).toISOString(),
        coordinates: d.coordinates || { latitude: 0, longitude: 0 },
        imageBase64: d.imageBase64 || '',
        assignedOfficialId: d.assignedOfficialId,
        escalationHistory: d.escalationHistory || [],
        auditLog: d.auditLog || [],
        agentDecision: d.agentDecision,
        slaCountdown: {
          secondsRemaining,
          status: now >= nextEsc ? 'BREACHED' : 'ACTIVE',
        },
        aiUsed: d.agentDecision?.source === 'gemini',
      };
    });

    res.json({ complaints, count: complaints.length });
  } catch (err) {
    console.error('List failed:', err);
    res.json({ complaints: [], count: 0, error: err instanceof Error ? err.message : 'Failed to list complaints' });
  }
});

/**
 * GET /api/complaints/citizen/:citizenId
 * Get all complaints for a specific citizen (frontend dashboard)
 */
router.get('/citizen/:citizenId', async (req: Request, res: Response) => {
  try {
    const { citizenId } = req.params;
    console.log('🔍 GET /citizen/:citizenId - citizenId:', citizenId);
    const complaints = await firebaseService.getComplaintsByCitizen(citizenId);
    console.log('🔍 Found complaints:', complaints.length);
    const now = Date.now();
    const formatted = complaints.map(c => {
      const nextEscMs = toMillis(c.nextEscalationAt);
      const createdMs = toMillis(c.createdAt);
      const updatedMs = toMillis(c.updatedAt);
      const secondsRemaining = nextEscMs == null ? null : Math.max(0, Math.round((nextEscMs - now) / 1000));

      return {
        ...c,
        createdAt: createdMs,
        updatedAt: updatedMs,
        nextEscalationAt: nextEscMs,
        slaCountdown: {
          secondsRemaining: secondsRemaining ?? 0,
          slaSeconds: SLA_SECONDS,
          status: nextEscMs == null ? 'ACTIVE' : now >= nextEscMs ? 'BREACHED' : 'ACTIVE',
        },
        aiAdvisory: {
          used: c.agentDecision?.source === 'gemini',
          label: c.agentDecision?.source === 'gemini'
            ? '✅ AI Advisory (Used)'
            : '⚠️ AI Advisory (Unavailable)',
          confidence: c.confidenceScore,
        },
      };
    });

    // 🔥 FIX: Return object with complaints array to match frontend API expectations
    res.json({ success: true, complaints: formatted, count: formatted.length });
  } catch (err: any) {
    console.error('❌ Citizen complaints failed:', err?.stack || err);
    // Return non-fatal response so frontend keeps prior state
    res.json({ success: true, complaints: [], count: 0, error: err?.message || 'Failed to get citizen complaints' });
  }
});

/**
 * GET /api/complaints/:id/timeline
 * Return timeline events for a complaint (fallback to auditLog if timeline missing)
 */
router.get('/:id/timeline', async (req: Request, res: Response) => {
  try {
    const complaint = await firebaseService.getComplaint(req.params.id);
    if (!complaint) {
      return res.status(404).json({ error: 'Not found', timeline: [] });
    }

    const timeline = (complaint as any).timeline || [];
    const audit = complaint.auditLog || [];

    // Normalize both sources to the TimelineEvent shape used by the frontend
    const events = [
      ...timeline.map((e: any) => ({
        type: (e.type as any) ?? 'system',
        action: e.action ?? 'update',
        message: e.message ?? e.description ?? 'Event',
        timestamp: e.timestamp ?? e.createdAt ?? new Date().toISOString(),
      })),
      ...audit.map((e) => ({
        type: 'system' as const,
        action: e.action,
        message: e.details ? JSON.stringify(e.details) : e.action,
        timestamp: e.timestamp,
      })),
    ];

    res.json({ timeline: events });
  } catch (err) {
    console.error('Timeline fetch failed:', err);
    res.status(500).json({ error: 'Failed to get timeline', timeline: [] });
  }
});

/**
 * GET /api/complaints/:id
 * Get single complaint details
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const complaint = await firebaseService.getComplaint(req.params.id);
    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    const now = Date.now();
    const nextEsc = toMillis(complaint.nextEscalationAt) ?? now;
    const secondsRemaining = Math.max(0, Math.round((nextEsc - now) / 1000));

    res.json({
      ...complaint,
      createdAt: complaint.createdAt?.toISOString?.() ?? complaint.createdAt,
      updatedAt: complaint.updatedAt?.toISOString?.() ?? complaint.updatedAt,
      nextEscalationAt: complaint.nextEscalationAt?.toISOString?.() ?? complaint.nextEscalationAt,
      slaCountdown: {
        secondsRemaining,
        slaSeconds: SLA_SECONDS,
        status: now >= nextEsc ? 'BREACHED' : 'ACTIVE',
      },
    });
  } catch (err) {
    console.error('Get complaint failed:', err);
    res.status(500).json({ error: 'Failed to get complaint' });
  }
});

/**
 * PUT /api/complaints/:id/resolve
 * Official marks complaint as resolved
 */
router.put('/:id/resolve', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { note } = req.body;

    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();

    await db.collection('complaints').doc(id).update({
      status: 'resolved',
      escalationLevel: 0,
      nextEscalationAt: null,
      updatedAt: now,
      timeline: admin.firestore.FieldValue.arrayUnion({
        type: 'RESOLUTION',
        timestamp: now,
        note: note || 'Manually resolved by official',
      }),
    });

    console.log(`✅ Official resolved complaint ${id}`);
    res.json({ success: true, message: 'Complaint resolved' });
  } catch (err: any) {
    console.error('Resolve complaint failed:', err);
    res.status(500).json({ error: 'Failed to resolve complaint', details: err.message });
  }
});

export default router;

