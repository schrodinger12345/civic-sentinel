import { Router, Request, Response } from 'express';
import { firebaseService } from '../services/firebase.service.js';

const router = Router();

/**
 * GET /api/users/:userId/currency
 * Get user's current currency balance
 */
router.get('/:userId/currency', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' });
    }

    const currency = await firebaseService.getUserCurrency(userId);

    res.json({ currency });
  } catch (err: any) {
    console.error('Failed to get user currency:', err);
    res.status(500).json({ error: err.message || 'Failed to get user currency' });
  }
});

/**
 * POST /api/users/:userId/currency/award
 * Award currency to user
 */
router.post('/:userId/currency/award', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { amount, reason } = req.body;

    if (!userId || !amount || !reason) {
      return res.status(400).json({ error: 'Missing userId, amount, or reason' });
    }

    await firebaseService.awardCurrency(userId, amount, reason);
    const newBalance = await firebaseService.getUserCurrency(userId);

    res.json({ success: true, newBalance });
  } catch (err: any) {
    console.error('Failed to award currency:', err);
    res.status(500).json({ error: err.message || 'Failed to award currency' });
  }
});

export default router;
