import { Router, Request, Response } from 'express';
import { complaintService } from '../services/complaint.service.js';
import { firebaseService } from '../services/firebase.service.js';
import { slaWatchdogService } from '../services/slaWatchdog.service.js';
import { geminiService } from '../services/gemini.service.js';
import { v4 as uuidv4 } from 'uuid';
import admin from 'firebase-admin';

const router = Router();

interface SubmitComplaintRequest {
  citizenId: string;
  citizenName: string;
  title: string;
  imageBase64: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  locationName: string;
}

interface UpdateProgressRequest {
  officialId: string;
  status: 'acknowledged' | 'in_progress' | 'on_hold' | 'resolved';
  notes?: string;
}

interface UpdateStatusRequestV2 {
  status: 'in_progress' | 'resolved';
  note?: string;
}

/**
 * POST /api/complaints/submit
 * Submit a new complaint with image-based analysis
 */
router.post('/submit', async (req: Request, res: Response) => {
  try {
    const { citizenId, citizenName, title, imageBase64, coordinates, locationName } =
      req.body as SubmitComplaintRequest;

    // Validate required fields
    if (!citizenId || !citizenName || !title || !imageBase64 || !coordinates || !locationName) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['citizenId', 'citizenName', 'title', 'imageBase64', 'coordinates', 'locationName'],
      });
    }

    // Validate coordinates
    if (typeof coordinates.latitude !== 'number' || typeof coordinates.longitude !== 'number') {
      return res.status(400).json({
        error: 'Invalid coordinates',
        details: 'coordinates must have numeric latitude and longitude',
      });
    }

    const result = await complaintService.submitComplaint(
      citizenId,
      citizenName,
      title,
      imageBase64,
      coordinates,
      locationName
    );

    // Handle rejection (fake report)
    if (!result.success) {
      return res.status(200).json({
        success: false,
        rejected: true,
        reason: result.reason,
        confidenceScore: result.confidenceScore,
      });
    }

    // Success - complaint created
    res.status(201).json({
      success: true,
      complaint: result.complaint,
      message: 'Complaint submitted successfully',
    });
  } catch (error) {
    console.error('Error submitting complaint:', error);
    res.status(500).json({
      error: 'Failed to submit complaint',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/complaints/:complaintId
 * Get complaint details
 */
router.get('/:complaintId', async (req: Request, res: Response) => {
  try {
    const { complaintId } = req.params;
    const complaint = await firebaseService.getComplaint(complaintId);

    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    res.json(complaint);
  } catch (error) {
    console.error('Error fetching complaint:', error);
    res.status(500).json({
      error: 'Failed to fetch complaint',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/complaints/citizen/:citizenId
 * Get all complaints for a citizen
 */
router.get('/citizen/:citizenId', async (req: Request, res: Response) => {
  try {
    const { citizenId } = req.params;
    const complaints = await firebaseService.getComplaintsByCitizen(citizenId);

    res.json({
      success: true,
      count: complaints.length,
      complaints,
    });
  } catch (error) {
    console.error('Error fetching citizen complaints:', error);
    res.status(500).json({
      error: 'Failed to fetch complaints',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/complaints/official/:officialId
 * Get all complaints assigned to an official
 */
router.get('/official/:officialId', async (req: Request, res: Response) => {
  try {
    const { officialId } = req.params;
    const decoded = decodeURIComponent(officialId);
    const looksLikeDepartment = decoded.includes(' ') || decoded.includes('/') || decoded.length > 40;

    // Hackathon requirement: /api/complaints/official/:department
    // Backward compatible: if param looks like a UID, treat it as officialId (existing UI depends on this).
    const complaints = looksLikeDepartment
      ? await firebaseService.getComplaintsByDepartment(decoded)
      : await firebaseService.getComplaintsByOfficial(officialId);

    res.json({
      success: true,
      count: complaints.length,
      complaints,
    });
  } catch (error) {
    console.error('Error fetching official complaints:', error);
    res.status(500).json({
      error: 'Failed to fetch complaints',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/complaints/:id/timeline
 * Return full chronological timeline for explainability
 */
router.get('/:id/timeline', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const complaint = await firebaseService.getComplaint(id);
    if (!complaint) return res.status(404).json({ error: 'Complaint not found' });

    const timeline = await firebaseService.getTimeline(id);
    res.json({ success: true, complaintId: id, timeline });
  } catch (error) {
    console.error('Error fetching timeline:', error);
    res.status(500).json({
      error: 'Failed to fetch timeline',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/complaints/:id/status
 * Minimal official update (hackathon requirement)
 */
router.post('/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, note } = req.body as UpdateStatusRequestV2;

    if (!status || !['in_progress', 'resolved'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status', allowed: ['in_progress', 'resolved'] });
    }

    const complaint = await firebaseService.getComplaint(id);
    if (!complaint) return res.status(404).json({ error: 'Complaint not found' });

    await firebaseService.updateComplaintFields(id, {
      status,
      updatedAt: new Date(),
    });

    await firebaseService.appendTimelineEvent(id, {
      type: 'official',
      action: status === 'resolved' ? 'resolved' : 'in_progress',
      message: note ? `Official update: ${note}` : `Official marked complaint as ${status}.`,
      timestamp: new Date(),
    });

    // If resolved, watchdog will naturally ignore it. We keep SLA deadline as-is (frozen).
    const updated = await firebaseService.getComplaint(id);
    res.json({ success: true, complaint: updated });
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({
      error: 'Failed to update complaint status',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/complaints/department/:department
 * Get all complaints for a department
 */
router.get('/department/:department', async (req: Request, res: Response) => {
  try {
    const { department } = req.params;
    const complaints = await firebaseService.getComplaintsByDepartment(department);

    res.json({
      success: true,
      count: complaints.length,
      complaints,
    });
  } catch (error) {
    console.error('Error fetching department complaints:', error);
    res.status(500).json({
      error: 'Failed to fetch complaints',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * PUT /api/complaints/:complaintId/progress
 * Update complaint progress (official action)
 */
router.put('/:complaintId/progress', async (req: Request, res: Response) => {
  try {
    const { complaintId } = req.params;
    const { officialId, status, notes } = req.body as UpdateProgressRequest;

    if (!officialId || !status) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['officialId', 'status'],
      });
    }

    const complaint = await complaintService.updateComplaintProgress(
      complaintId,
      officialId,
      status,
      notes
    );

    res.json({
      success: true,
      complaint,
      message: 'Complaint progress updated',
    });
  } catch (error) {
    console.error('Error updating complaint progress:', error);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';

    if (errorMsg.includes('Unauthorized')) {
      return res.status(403).json({ error: errorMsg });
    }

    res.status(500).json({
      error: 'Failed to update complaint',
      details: errorMsg,
    });
  }
});

/**
 * POST /api/complaints/check-escalations
 * Trigger escalation check (should be called by scheduler)
 */
router.post('/check-escalations', async (req: Request, res: Response) => {
  try {
    // For demo: do NOT require Gemini / Vertex. Use SLA watchdog tick.
    const result = await slaWatchdogService.tick();
    const escalatedIds = result.updatedIds;

    res.json({
      success: true,
      escalated: escalatedIds.length,
      complaintIds: escalatedIds,
      message: `${escalatedIds.length} complaints escalated`,
    });
  } catch (error) {
    console.error('Error checking escalations:', error);
    res.status(500).json({
      error: 'Failed to check escalations',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/complaints/official/:officialId/stats
 * Get dashboard stats for an official
 */
router.get('/official/:officialId/stats', async (req: Request, res: Response) => {
  try {
    const { officialId } = req.params;
    const stats = await complaintService.getOfficialStats(officialId);

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      error: 'Failed to fetch stats',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/complaints/official/:officialId/ai-brief
 * Advisory AI briefing for top unresolved complaints (read-only)
 */
router.get('/official/:officialId/ai-brief', async (req: Request, res: Response) => {
  try {
    const { officialId } = req.params;
    const complaints = await firebaseService.getComplaintsByOfficial(officialId);
    const unresolved = complaints
      .filter((c) => c.status !== 'resolved')
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 3);

    if (!unresolved.length) {
      return res.json({
        success: true,
        brief: 'AI Briefing (Advisory): No unresolved complaints currently assigned.',
      });
    }

    let briefText: string;
    try {
      briefText = await geminiService.officialBrief({
        complaints: unresolved.map((c) => ({
          id: c.id,
          description: c.description,
          department: c.category, // Using category as department
          severity: c.severity,
          priority: c.priority,
          status: c.status,
        })),
      });
    } catch (err) {
      console.warn('AI brief generation failed:', err);
      briefText =
        'AI Briefing (Advisory): Unable to generate AI summary. Use system metrics and timelines for decisions.';
    }

    // Log advisory interaction in timelines for explainability
    const now = new Date();
    await Promise.all(
      unresolved.map((c) =>
        firebaseService.appendTimelineEvent(c.id, {
          type: 'system',
          action: 'ai_official_brief',
          message:
            'AI advisory brief referenced this complaint when summarizing top unresolved issues for officials.',
          timestamp: now,
        })
      )
    );

    res.json({
      success: true,
      brief: briefText,
    });
  } catch (error) {
    console.error('Error generating AI brief:', error);
    res.status(500).json({
      error: 'Failed to generate AI brief',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/complaints/_debug/live-stats
 * Returns real-time escalation and SLA warning counts for the UI.
 * Hackathon judges need to see this count jump when SLA expires.
 */
router.get('/_debug/live-stats', async (req: Request, res: Response) => {
  try {
    const db = admin.firestore();
    const snap = await db
      .collection('complaints')
      .where('status', 'in', ['submitted', 'analyzed', 'assigned', 'acknowledged', 'in_progress', 'on_hold', 'sla_warning', 'escalated'])
      .get();

    let activeCount = 0;
    let slaWarningCount = 0;
    let escalatedCount = 0;
    let resolvedTodayCount = 0;
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    for (const doc of snap.docs) {
      const data = doc.data();
      if (data.status === 'escalated') escalatedCount++;
      else if (data.status === 'sla_warning') slaWarningCount++;
      else if (data.status !== 'resolved') activeCount++;
    }

    // Also count resolved today
    const resolvedSnap = await db
      .collection('complaints')
      .where('status', '==', 'resolved')
      .get();
    for (const doc of resolvedSnap.docs) {
      const data = doc.data();
      const updatedAt = data.updatedAt?.toDate?.() || new Date(data.updatedAt);
      if (updatedAt >= startOfDay) resolvedTodayCount++;
    }

    res.json({
      success: true,
      activeCount,
      slaWarningCount,
      escalatedCount,
      resolvedTodayCount,
      total: snap.size,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error('Error fetching live stats:', error);
    res.status(500).json({
      error: 'Failed to fetch stats',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/complaints/_debug/seed-demo
 * Seeds 3 demo complaints:
 * - 1 normal (deadline in future)
 * - 1 SLA-breached (will go to sla_warning on next watchdog tick)
 * - 1 already warned (will escalate on next watchdog tick)
 *
 * NOTE: This is a hackathon convenience endpoint. Keep off production deployments.
 */
router.post('/_debug/seed-demo', async (req: Request, res: Response) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'Forbidden in production' });
    }

    const now = new Date();
    const demoSeconds = Number(process.env.DEMO_SLA_SECONDS ?? '10');
    const mk = (overdueHours: number, status: any, escalationLevel: 0 | 1 | 2 | 3, description: string) => {
      const id = uuidv4();
      const createdAt = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      const baseMs = demoSeconds > 0 ? demoSeconds * 1000 : Math.abs(overdueHours) * 60 * 60 * 1000;
      const slaDeadline =
        overdueHours > 0
          ? new Date(now.getTime() - (demoSeconds > 0 ? demoSeconds * 1000 : overdueHours * 60 * 60 * 1000))
          : new Date(now.getTime() + baseMs);
      const department = 'Public Works';
      return {
        id,
        citizenId: 'demo_citizen',
        citizenName: 'Demo Citizen',
        citizenLocation: 'Ward 12',
        description,
        issueType: 'road_damage',
        severity: 'medium',
        assignedDepartment: department,
        department,
        priority: escalationLevel > 0 ? 8 : 5,
        status,
        assignedOfficialId: 'demo_official',
        escalationLevel,
        escalationHistory: [],
        auditLog: [],
        createdAt,
        updatedAt: now,
        slaHours: demoSeconds > 0 ? demoSeconds / 3600 : 48,
        slaDeadline,
        expectedResolutionTime: slaDeadline,
      };
    };

    const normal = mk(-0.0028, 'assigned', 0, 'Normal demo complaint: pothole near school gate.');
    const breached = mk(0.05, 'assigned', 0, 'Breached demo complaint: garbage overflow not cleared.');
    const warned = mk(0.05, 'sla_warning', 1, 'Escalation demo complaint: street light outage causing safety risk.');

    await firebaseService.createComplaint(normal as any);
    await firebaseService.createComplaint(breached as any);
    await firebaseService.createComplaint(warned as any);

    // Append a clarifying timeline note for judges
    await firebaseService.appendTimelineEvent(normal.id, {
      type: 'system',
      action: 'seeded',
      message: 'Seeded demo complaint (normal).',
      timestamp: now,
    });
    await firebaseService.appendTimelineEvent(breached.id, {
      type: 'system',
      action: 'seeded',
      message: 'Seeded demo complaint (SLA breached; should warn on next watchdog tick).',
      timestamp: now,
    });
    await firebaseService.appendTimelineEvent(warned.id, {
      type: 'system',
      action: 'seeded',
      message: 'Seeded demo complaint (already warned; should escalate on next watchdog tick).',
      timestamp: now,
    });

    res.json({
      success: true,
      complaints: [
        { id: normal.id, status: normal.status, slaDeadline: normal.slaDeadline },
        { id: breached.id, status: breached.status, slaDeadline: breached.slaDeadline },
        { id: warned.id, status: warned.status, slaDeadline: warned.slaDeadline },
      ],
      hint: 'Wait up to 60s (or call POST /api/complaints/check-escalations) to see auto-escalation.',
    });
  } catch (error) {
    console.error('Error seeding demo data:', error);
    res.status(500).json({
      error: 'Failed to seed demo data',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
