# CivicFix Backend - Quick Reference

## What Was Built

A complete **Node.js/Express backend** with **Gemini AI integration** for CivicFix AI civic issue resolution system.

### Core Components

```
backend/
├── src/
│   ├── index.ts                    # Express server entry point
│   ├── types/
│   │   └── complaint.ts            # TypeScript types & interfaces
│   ├── services/
│   │   ├── gemini.service.ts       # Gemini AI integration
│   │   ├── firebase.service.ts     # Firestore database operations
│   │   └── complaint.service.ts    # Business logic & state management
│   ├── routes/
│   │   └── complaints.ts           # API endpoints
│   └── utils/                      # Utilities (if needed)
├── package.json                    # Dependencies & scripts
├── tsconfig.json                   # TypeScript config
└── .env.example                    # Environment template
```

## What It Does

### 1. Complaint Intake & Analysis
```
POST /api/complaints/submit
├─ Receive complaint from citizen
├─ Send to Gemini AI for analysis
├─ Gemini extracts: type, severity, department, priority, SLA
└─ Store in Firestore with AI results
```

### 2. Status Tracking
```
GET /api/complaints/citizen/{id}      # User's complaints
GET /api/complaints/official/{id}     # Official's assigned issues
PUT /api/complaints/{id}/progress     # Update complaint status
```

### 3. Escalation Management
```
POST /api/complaints/check-escalations
├─ Check all active complaints
├─ Evaluate with Gemini: should this escalate?
├─ If yes: update escalation level, notify stakeholders
└─ Return escalated complaint IDs
```

### 4. Dashboard Analytics
```
GET /api/complaints/official/{id}/stats
└─ Returns: total, by-status, by-priority, SLA compliance, avg resolution time
```

## Quick Start

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Configure Environment
```bash
# Copy template
cp .env.example .env

# Edit .env with your credentials:
FIREBASE_PROJECT_ID=...
FIREBASE_PRIVATE_KEY=...
FIREBASE_CLIENT_EMAIL=...
GOOGLE_CLOUD_PROJECT=...
GOOGLE_CLOUD_LOCATION=us-central1
```

### 3. Run Development Server
```bash
npm run dev
# Server: http://localhost:5000
```

### 4. Test API
```bash
curl http://localhost:5000/api/health

# Should return:
# {"status":"ok","timestamp":"2024-01-21T...","environment":"development"}
```

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/complaints/submit` | Submit new complaint |
| GET | `/api/complaints/:id` | Get complaint details |
| GET | `/api/complaints/citizen/:id` | Get user's complaints |
| GET | `/api/complaints/official/:id` | Get assigned complaints |
| GET | `/api/complaints/department/:dept` | Get department complaints |
| PUT | `/api/complaints/:id/progress` | Update status (official) |
| POST | `/api/complaints/check-escalations` | Trigger escalation check |
| GET | `/api/complaints/official/:id/stats` | Dashboard stats |

## Gemini AI Integration

### What Gemini Does

1. **Complaint Analysis** (On Submission)
   ```
   Input: "There's a large pothole on Main Street causing damage"
   Output: {
     issueType: "pothole",
     severity: "high",
     department: "Public Works",
     priority: 8,
     suggestedSLA: 24
   }
   ```

2. **Escalation Evaluation** (Every 2 Hours)
   ```
   Input: complaint object + elapsed time + current status
   Output: {
     shouldEscalate: true/false,
     reason: "No progress for 24 hours",
     nextLevel: 0|1|2|3
   }
   ```

### Cost Considerations
- Uses **Gemini 1.5 Flash** (cheaper than Pro)
- Called only at key decision points (submission + escalation checks)
- Typical cost: $0.001-0.003 per complaint analyzed

## Firebase Firestore

### Collection: `complaints`
Stores all complaint documents with:
- Complaint details (description, location, images)
- AI analysis results (type, severity, department)
- Status tracking (current state, history)
- Escalation info (level, history)
- Audit log (complete activity trail)

### Security Rules
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth.uid != null;
    }
  }
}
```

## Complaint Lifecycle

```
SUBMITTED → ANALYZED (Gemini) → ASSIGNED → ACKNOWLEDGED → IN_PROGRESS → RESOLVED
                                                ↓
                                            ON_HOLD
                                                ↓
                                         (if deadline missed) 
                                         ESCALATED (Level 1→2→3)
```

## Escalation Logic

**Automatic escalation triggers:**
- No acknowledgment after 6 hours → Level 0→1 (Supervisor)
- No progress after 12 hours → Level 0→1 (Supervisor)
- No progress after SLA → Level 1→2 (Dept Head)
- No progress after 48h at L2 → Level 2→3 (Commissioner)
- On hold for >48 hours → Escalate

**Gemini evaluates each case** contextually to avoid false escalations.

## Error Handling

Common errors and solutions:

| Error | Cause | Solution |
|-------|-------|----------|
| Firebase auth error | Bad credentials in .env | Check FIREBASE_* variables |
| Gemini API error | GCP project not enabled | Run `gcloud services enable aiplatform.googleapis.com` |
| CORS error | Frontend on different URL | Update FRONTEND_URL in .env |
| Port in use | Port 5000 already occupied | Use different port: `PORT=5001 npm run dev` |

## Monitoring & Debugging

### Logs
- Server logs all API requests with timestamp
- Check terminal output while server running

### Test Routes
```bash
# Health check
curl http://localhost:5000/api/health

# Submit test complaint
curl -X POST http://localhost:5000/api/complaints/submit \
  -H "Content-Type: application/json" \
  -d '{
    "citizenId":"test","citizenName":"Test","citizenLocation":"Test",
    "description":"Test pothole"
  }'
```

### Firebase Console
- View data in real-time
- Check subcollections
- Monitor usage and costs

### Google Cloud Console
- Check Vertex AI API usage
- View logs for Gemini calls
- Monitor quotas and billing

## Integration with Frontend

Frontend calls these endpoints:

```typescript
// Submit complaint
fetch('http://localhost:5000/api/complaints/submit', {
  method: 'POST',
  body: JSON.stringify({
    citizenId, citizenName, citizenLocation, description
  })
})

// Get user's complaints
fetch(`http://localhost:5000/api/complaints/citizen/${userId}`)

// Update complaint status (official)
fetch(`http://localhost:5000/api/complaints/${id}/progress`, {
  method: 'PUT',
  body: JSON.stringify({ officialId, status, notes })
})
```

See **INTEGRATION.md** for detailed frontend implementation.

## Deployment

### Build for Production
```bash
npm run build
# Creates dist/ folder with compiled code
```

### Deploy to Cloud Run (Recommended)
```bash
# Push to Google Cloud Run
gcloud run deploy civicfix-backend \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

### Deploy to Other Platforms
- **Railway.app**: Connect GitHub repo, auto-deploy
- **Render.com**: Add `Procfile`, deploy
- **Fly.io**: Use `fly deploy`
- **Heroku**: `git push heroku main`

## Documentation Files

1. **SETUP.md** - Environment configuration and prerequisites
2. **ARCHITECTURE.md** - System design and data flow diagrams
3. **INTEGRATION.md** - Frontend integration guide with code examples
4. **backend/README.md** - Backend-specific documentation

## Key Features Implemented

✅ Gemini AI integration for complaint analysis
✅ Automatic department assignment
✅ Dynamic priority and SLA calculation
✅ Continuous SLA monitoring
✅ AI-driven escalation decisions
✅ Complete audit trail
✅ RESTful API endpoints
✅ TypeScript type safety
✅ Firebase integration
✅ CORS support

## What's Next

1. **Frontend Integration** - Connect React components to API
2. **Background Jobs** - Set up scheduler for escalation checks
3. **Notifications** - Email/SMS alerts for status changes
4. **Real-time Updates** - WebSocket support for live updates
5. **Performance** - Add caching and optimize queries
6. **Security** - Add JWT authentication and request validation

## Support

- **Backend Logs**: Check terminal output
- **API Errors**: HTTP status codes with error messages
- **Gemini Issues**: Check Google Cloud Console
- **Firebase Issues**: Check Firestore Console
- **Code Issues**: TypeScript provides type safety and IDE hints

---

**Ready to integrate with frontend!** 🚀
