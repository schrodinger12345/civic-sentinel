import 'dotenv/config'; // Load env vars before anything else
import express from 'express';
import cors from 'cors';
import admin from 'firebase-admin';
import { initializeFirebase } from './services/firebase.service.js';
import complaintsRouter from './routes/complaints.js';
import { slaWatchdogService } from './services/slaWatchdog.service.js';
import { testGeminiConnection } from './services/gemini.service.js';


const app = express();
const PORT = Number(process.env.PORT || 5000);
const HOST = process.env.HOST || '0.0.0.0';
const DISPLAY_HOST = process.env.HOST_DISPLAY || '127.0.0.1';

// Middleware
app.use(cors({
  origin: [
    'http://localhost:8080',
    'http://localhost:8081',
    'http://127.0.0.1:8080',
    'http://127.0.0.1:8081',
    process.env.FRONTEND_URL || 'http://localhost:8080',
  ],
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Initialize Firebase
try {
  initializeFirebase();
  console.log('Firebase initialized successfully');
} catch (error) {
  console.error('Failed to initialize Firebase:', error);
  process.exit(1);
}

// Start autonomous SLA watchdog (no external scheduler required)
slaWatchdogService.start();

// TEMPORARY: Test Gemini connection on startup
testGeminiConnection().then((ok) => {
  if (ok) {
    console.log('🧠 Gemini API connection verified');
  } else {
    console.error('⚠️  Gemini API NOT working - check GEMINI_API_KEY in .env');
  }
});

// Routes
app.use('/api/complaints', complaintsRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// Temporary Firestore connectivity check
app.post('/api/_debug/firestore', async (req, res) => {
  try {
    await admin.firestore().collection('debug').add({
      ok: true,
      time: Date.now(),
    });
    res.json({ status: 'firestore connected' });
  } catch (err: any) {
    console.error('Firestore debug error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path,
  });
});

// Start server
app.listen(PORT, HOST, () => {
  console.log(`\n🚀 CivicFix Backend Server`);
  console.log(`📍 Running on: http://${DISPLAY_HOST}:${PORT}`);
  console.log(`🌍 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:8080'}`);
  console.log(`📊 Health check: http://${DISPLAY_HOST}:${PORT}/api/health\n`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully...');
  process.exit(0);
});
