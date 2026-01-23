import { Router, Request, Response } from 'express';
import { geminiService } from '../services/gemini.service.js';
import { firebaseService } from '../services/firebase.service.js';
import admin from 'firebase-admin';

const router = Router();

/**
 * POST /api/ai/voice-complaint
 * Process voice recording and create complaint
 */
router.post('/voice-complaint', async (req: Request, res: Response) => {
  try {
    const { audioBase64, mimeType, citizenId, citizenName, coordinates, locationName } = req.body;

    if (!audioBase64 || !citizenId) {
      return res.status(400).json({ error: 'Missing audioBase64 or citizenId' });
    }

    console.log('🎤 Processing voice complaint...');
    
    // Analyze voice with Gemini
    const voiceResult = await geminiService.analyzeVoiceComplaint(audioBase64, mimeType || 'audio/webm');

    res.json({
      success: true,
      transcription: voiceResult.transcription,
      category: voiceResult.category,
      severity: voiceResult.severity,
      urgency: voiceResult.urgency,
      isEmergency: voiceResult.isEmergency,
      sentimentScore: voiceResult.sentimentScore,
      message: 'Voice analyzed successfully. Use this data to create complaint.',
    });
  } catch (err: any) {
    console.error('Voice complaint failed:', err);
    res.status(500).json({ error: err.message || 'Failed to process voice' });
  }
});

/**
 * POST /api/ai/detect-duplicate
 * Check if complaint is duplicate
 */
router.post('/detect-duplicate', async (req: Request, res: Response) => {
  try {
    const { title, description, location, citizenId } = req.body;

    if (!title || !description) {
      return res.status(400).json({ error: 'Missing title or description' });
    }

    // Get recent complaints for comparison
    const db = admin.firestore();
    const snap = await db.collection('complaints')
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();

    const existingComplaints = snap.docs.map(doc => {
      const d = doc.data();
      return {
        id: doc.id,
        title: d.title || '',
        description: d.description || '',
        location: d.coordinates,
      };
    });

    const result = await geminiService.detectDuplicate(
      { title, description, location: location || { lat: 0, lng: 0 } },
      existingComplaints
    );

    res.json({
      success: true,
      ...result,
    });
  } catch (err: any) {
    console.error('Duplicate detection failed:', err);
    res.status(500).json({ error: err.message || 'Failed to detect duplicate' });
  }
});

/**
 * POST /api/ai/verify-resolution
 * Verify if complaint was resolved using before/after images
 */
router.post('/verify-resolution', async (req: Request, res: Response) => {
  try {
    const { complaintId, afterImageBase64 } = req.body;

    if (!complaintId || !afterImageBase64) {
      return res.status(400).json({ error: 'Missing complaintId or afterImageBase64' });
    }

    // Get the complaint
    const complaint = await firebaseService.getComplaint(complaintId);
    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    if (!complaint.imageBase64) {
      return res.status(400).json({ error: 'Original image not available for comparison' });
    }

    console.log('🖼️ Verifying resolution with AI...');
    
    const result = await geminiService.verifyResolution(
      complaint.imageBase64,
      afterImageBase64,
      complaint.category
    );

    // Update complaint with verification result
    const db = admin.firestore();
    await db.collection('complaints').doc(complaintId).update({
      afterImageBase64,
      resolutionVerified: result.isResolved,
      resolutionConfidence: result.confidenceScore,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Add timeline event
    await firebaseService.appendTimelineEvent(complaintId, {
      type: 'system',
      action: 'resolution_verification',
      message: result.isResolved 
        ? `✅ AI verified resolution (${(result.confidenceScore * 100).toFixed(0)}% confidence): ${result.reasoning}`
        : `⚠️ AI could not verify resolution: ${result.reasoning}`,
      timestamp: new Date(),
    });

    res.json({
      success: true,
      ...result,
    });
  } catch (err: any) {
    console.error('Resolution verification failed:', err);
    res.status(500).json({ error: err.message || 'Failed to verify resolution' });
  }
});

/**
 * POST /api/ai/chat
 * AI Chatbot for citizens
 */
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { conversation, citizenId, citizenName } = req.body;

    if (!conversation || !Array.isArray(conversation)) {
      return res.status(400).json({ error: 'Missing or invalid conversation array' });
    }

    // Get citizen context
    let activeComplaints = 0;
    if (citizenId) {
      const complaints = await firebaseService.getComplaintsByCitizen(citizenId);
      activeComplaints = complaints.filter(c => c.status !== 'resolved').length;
    }

    const result = await geminiService.chatWithCitizen(
      conversation,
      citizenName ? { name: citizenName, activeComplaints } : undefined
    );

    res.json({
      success: true,
      ...result,
    });
  } catch (err: any) {
    console.error('Chatbot failed:', err);
    res.status(500).json({ error: err.message || 'Chatbot unavailable' });
  }
});

/**
 * POST /api/ai/detect-emergency
 * Check text for emergency situations
 */
router.post('/detect-emergency', async (req: Request, res: Response) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Missing text' });
    }

    const result = await geminiService.detectEmergency(text);

    res.json({
      success: true,
      ...result,
    });
  } catch (err: any) {
    console.error('Emergency detection failed:', err);
    res.status(500).json({ error: err.message || 'Detection failed' });
  }
});

/**
 * GET /api/ai/department-report/:department
 * Generate AI performance report for department
 */
router.get('/department-report/:department', async (req: Request, res: Response) => {
  try {
    const { department } = req.params;

    // Get department metrics from complaints
    const db = admin.firestore();
    const snap = await db.collection('complaints')
      .where('category', '==', department)
      .get();

    const complaints = snap.docs.map(d => d.data());
    const totalComplaints = complaints.length;
    const resolvedCount = complaints.filter(c => c.status === 'resolved').length;
    const escalatedCount = complaints.filter(c => c.escalationLevel > 0).length;
    const slaBreachCount = complaints.filter(c => c.escalationLevel >= 1).length;

    // Calculate average resolution time
    let avgResolutionHours = 0;
    const resolved = complaints.filter(c => c.status === 'resolved' && c.createdAt && c.updatedAt);
    if (resolved.length > 0) {
      const totalHours = resolved.reduce((sum, c) => {
        const created = c.createdAt?.toDate?.() || new Date(c.createdAt);
        const updated = c.updatedAt?.toDate?.() || new Date(c.updatedAt);
        return sum + (updated.getTime() - created.getTime()) / (1000 * 60 * 60);
      }, 0);
      avgResolutionHours = totalHours / resolved.length;
    }

    const report = await geminiService.generateDepartmentReport(department, {
      totalComplaints,
      resolvedCount,
      avgResolutionHours,
      escalatedCount,
      slaBreachCount,
    });

    res.json({
      success: true,
      department,
      metrics: { totalComplaints, resolvedCount, avgResolutionHours, escalatedCount, slaBreachCount },
      report,
    });
  } catch (err: any) {
    console.error('Department report failed:', err);
    res.status(500).json({ error: err.message || 'Report generation failed' });
  }
});

/**
 * GET /api/ai/predictions
 * Get predictive issue forecasting
 */
router.get('/predictions', async (req: Request, res: Response) => {
  try {
    const db = admin.firestore();
    const snap = await db.collection('complaints')
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();

    const historicalData = snap.docs.map(doc => {
      const d = doc.data();
      return {
        category: d.category || 'other',
        location: d.citizenLocation || 'Unknown',
        createdAt: d.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      };
    });

    const result = await geminiService.predictUpcomingIssues(historicalData);

    res.json({
      success: true,
      ...result,
    });
  } catch (err: any) {
    console.error('Predictions failed:', err);
    res.status(500).json({ error: err.message || 'Prediction failed' });
  }
});

export default router;
