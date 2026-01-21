# CivicFix Backend - Node.js Server

A Node.js Express backend for CivicFix AI with Gemini integration for complaint analysis and escalation management.

## Architecture

```
Backend Server (Node.js/Express)
    ↓
Gemini AI Service (Complaint Analysis & Escalation Decision)
    ↓
Firebase Firestore (Complaint Storage & State Management)
    ↓
React Frontend (Citizen & Official Dashboards)
```

## Features

- **Complaint Analysis with Gemini**: Automatically classifies issue type, severity, and assigns department
- **AI-Driven Escalation**: Uses Gemini to evaluate whether complaints should be escalated based on elapsed time and status
- **State Management**: Tracks complaint lifecycle (submitted → analyzed → assigned → acknowledged → in_progress → resolved/escalated)
- **Audit Trail**: Every action is logged for transparency
- **Dashboard Statistics**: Real-time metrics for officials including SLA compliance

## Setup

### 1. Prerequisites

- Node.js 18+
- Firebase project with Firestore
- Google Cloud project with Vertex AI access (for Gemini)

### 2. Install Dependencies

```bash
cd backend
npm install
```

### 3. Configure Environment

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Required environment variables:

```env
# Server
PORT=5000
NODE_ENV=development

# Firebase Admin SDK
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_PRIVATE_KEY=your_private_key
FIREBASE_CLIENT_EMAIL=your_service_account_email

# Google Cloud / Gemini
GOOGLE_CLOUD_PROJECT=your_gcp_project_id
GOOGLE_CLOUD_LOCATION=us-central1

# Frontend
FRONTEND_URL=http://localhost:8080
```

### 4. Run Development Server

```bash
npm run dev
```

Server will start on `http://localhost:5000`

### 5. Build for Production

```bash
npm run build
npm start
```

## API Endpoints

### Complaints

#### Submit Complaint
```
POST /api/complaints/submit
Content-Type: application/json

{
  "citizenId": "user123",
  "citizenName": "John Doe",
  "citizenLocation": "Downtown Area",
  "description": "Large pothole on Main Street causing vehicle damage",
  "imageUrl": "https://example.com/image.jpg" (optional)
}
```

Response:
```json
{
  "success": true,
  "complaint": {
    "id": "uuid",
    "status": "analyzed",
    "issueType": "pothole",
    "severity": "high",
    "assignedDepartment": "Public Works",
    "priority": 8,
    "expectedResolutionTime": "2024-01-22T12:00:00Z",
    "auditLog": [...]
  }
}
```

#### Get Complaint Details
```
GET /api/complaints/:complaintId
```

#### Get Citizen's Complaints
```
GET /api/complaints/citizen/:citizenId
```

#### Get Official's Assigned Complaints
```
GET /api/complaints/official/:officialId
```

#### Get Department Complaints
```
GET /api/complaints/department/:departmentName
```

#### Update Complaint Progress
```
PUT /api/complaints/:complaintId/progress
Content-Type: application/json

{
  "officialId": "official123",
  "status": "in_progress",
  "notes": "Work started, repair materials on site"
}
```

#### Check Escalations
```
POST /api/complaints/check-escalations
```

(Should be called by a background scheduler every 1-2 hours)

#### Get Official Dashboard Stats
```
GET /api/complaints/official/:officialId/stats
```

## How It Works

### 1. Complaint Submission Flow

```
Citizen submits complaint
         ↓
Gemini analyzes text → extracts issue type, severity, department
         ↓
System creates complaint record with AI-determined fields
         ↓
Stored in Firebase with initial status "analyzed"
         ↓
Ready for assignment to department
```

### 2. Escalation Logic

The system runs periodic checks (`check-escalations` endpoint) to evaluate if complaints need escalation:

**Escalation Triggers:**
- Level 0→1 (Supervisor): No acknowledgment after 6 hours OR no progress after 12 hours
- Level 1→2 (Dept Head): No progress after 24 hours since initial deadline
- Level 2→3 (Commissioner): No progress after 48 hours since level 2 escalation
- Auto-escalation if complaint is on hold for >48 hours without justification

Gemini evaluates each complaint context and determines if escalation is warranted.

### 3. State Lifecycle

```
submitted → analyzed → assigned → acknowledged → in_progress → resolved
                                    ↓
                                 on_hold → in_progress
                                    ↓
                              (if deadline missed)
                                    ↓
                                escalated
```

## Integration with Frontend

The React frontend connects to this backend API:

```typescript
// Submit complaint
const response = await fetch('http://localhost:5000/api/complaints/submit', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    citizenId: user.uid,
    citizenName: userProfile.displayName,
    citizenLocation: userProfile.location,
    description: complaintText,
    imageUrl: imageUrl
  })
});

// Get complaints
const response = await fetch(
  `http://localhost:5000/api/complaints/citizen/${userId}`
);

// Update progress (official)
const response = await fetch(
  `http://localhost:5000/api/complaints/${complaintId}/progress`,
  {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      officialId: officialId,
      status: 'in_progress',
      notes: 'Working on repair'
    })
  }
);
```

## Monitoring & Debugging

- Server logs all requests with timestamps
- Firebase console for data inspection
- Google Cloud Console for Gemini API usage
- Health check endpoint: `GET /api/health`

## Future Enhancements

- [ ] Background job scheduler (BullMQ) for automated escalation checks
- [ ] Email/SMS notifications
- [ ] Real-time WebSocket updates
- [ ] Advanced analytics and reporting
- [ ] Mobile app API authentication
- [ ] Rate limiting and request throttling
- [ ] Complaint image storage (Cloud Storage)
- [ ] Multi-language support
