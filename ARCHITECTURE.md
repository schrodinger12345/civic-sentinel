# CivicFix AI - Complete Architecture & Implementation Guide

## System Overview

CivicFix AI is a full-stack civic issue resolution platform combining:
- **React Frontend** (Vite + TypeScript) - User interfaces
- **Node.js/Express Backend** - API server with business logic
- **Gemini AI** - Complaint analysis and decision-making
- **Firebase Firestore** - Real-time database
- **Google Cloud** - Infrastructure

## Technology Stack

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND LAYER                            │
├─────────────────────────────────────────────────────────────┤
│ React 18 + TypeScript + Vite                                │
│ - Citizen Dashboard: Submit complaints, track status        │
│ - Official Dashboard: View assigned issues, update progress │
│ - System Console: View AI decisions and reasoning           │
│ UI: shadcn/ui components + Tailwind CSS                    │
│ State: React Context + TanStack Query                       │
│ Auth: Firebase Authentication                               │
└────────────────────────┬────────────────────────────────────┘
                         │ REST API (JSON)
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                    API LAYER (Express)                       │
├─────────────────────────────────────────────────────────────┤
│ Node.js 18+ + TypeScript                                    │
│                                                              │
│ Endpoints:                                                  │
│ POST   /api/complaints/submit         - New complaint       │
│ GET    /api/complaints/:id            - Complaint details   │
│ GET    /api/complaints/citizen/:id    - User complaints     │
│ GET    /api/complaints/official/:id   - Assigned issues     │
│ PUT    /api/complaints/:id/progress   - Update status       │
│ POST   /api/complaints/check-escalations - Escalation loop │
│ GET    /api/complaints/official/:id/stats - Dashboard      │
└────┬──────────────────────┬──────────────┬──────────────────┘
     │                      │              │
     ↓ Analyze              ↓ Store        ↓ Auth
┌──────────────┐  ┌─────────────────┐  ┌──────────────┐
│  Gemini AI   │  │    Firestore    │  │ Google Cloud │
│              │  │                 │  │              │
│ Input:       │  │ Collections:    │  │ Services:    │
│ - Complaint  │  │ - users         │  │ - Vertex AI  │
│   text       │  │ - complaints    │  │ - Firestore  │
│ - Location   │  │ - departments   │  │ - Auth       │
│ - History    │  │                 │  │              │
│              │  │ Queries:        │  │              │
│ Output:      │  │ - By citizen    │  │              │
│ - Issue type │  │ - By official   │  │              │
│ - Severity   │  │ - By department │  │              │
│ - Department │  │ - Active issues │  │              │
│ - Priority   │  │                 │  │              │
│ - SLA        │  │ Real-time:      │  │              │
│              │  │ - Status sync   │  │              │
│ Evaluation:  │  │ - Escalation    │  │              │
│ - Escalation │  │ - Audit trail   │  │              │
│   decision   │  │                 │  │              │
└──────────────┘  └─────────────────┘  └──────────────┘
```

## Complaint Lifecycle

```
┌────────────────┐
│    SUBMITTED   │
│ (by citizen)   │
└────────┬───────┘
         │ Backend receives complaint
         ↓
┌────────────────┐
│    ANALYZING   │ ← Gemini AI analyzes:
│   (Gemini AI)  │   - Issue type
└────────┬───────┘   - Severity level
         │           - Department
         │           - Priority (1-10)
         │           - SLA (hours)
         ↓
┌────────────────┐
│    ANALYZED    │ ← AI decision stored
│ (AI decision)  │   in Firestore
└────────┬───────┘
         │
         ↓
┌────────────────┐
│    ASSIGNED    │ ← Official/Department
│ (to official)  │   receives notification
└────────┬───────┘
         │
         ↓
┌────────────────────────────────────────────┐
│  OFFICIAL RECEIVES & TAKES ACTION          │
│                                            │
│  ┌─────────┐    ┌──────────────┐         │
│  │ ACK      │    │ IN_PROGRESS  │         │
│  │ NOWLEDGE │    │ (work started)         │
│  └──────────┘    └──────────────┘         │
│                                            │
│  ┌──────────┐    ┌───────────────┐       │
│  │ ON_HOLD  │    │ RESOLVED      │       │
│  │ (blocked)│    │ (completed)   │       │
│  └──────────┘    └───────────────┘       │
└────────┬───────────────────────────────────┘
         │
         ├─── [SLA Monitor Checks Every 2 Hours] ───┐
         │                                            │
         ↓ If no progress...                         │
┌────────────────────────────────────────────┐       │
│  ESCALATION TRIGGERED (by Gemini)         │       │
│  ├─ Level 0 → 1: Supervisor                │       │
│  ├─ Level 1 → 2: Department Head           │       │
│  └─ Level 2 → 3: Commissioner              │       │
└────────┬───────────────────────────────────┘       │
         │                                            │
         └────────────────────────────────────────────┘
         │
         ↓ Once resolved
┌────────────────────────────┐
│  RESOLVED / CLOSED         │
│  - Time to resolution: X h │
│ - SLA compliance: Yes/No   │
│ - Audit trail: Complete   │
└────────────────────────────┘
```

## Data Models

### Complaint Schema

```typescript
{
  // Identification
  id: string (UUID)
  citizenId: string
  citizenName: string
  citizenLocation: string
  description: string
  imageUrl?: string
  
  // Timestamps
  createdAt: Date
  updatedAt: Date
  expectedResolutionTime: Date (SLA deadline)
  
  // AI Analysis Results
  issueType: string
  severity: "low" | "medium" | "high" | "critical"
  assignedDepartment: string
  priority: number (1-10)
  
  // Status Tracking
  status: "submitted" | "analyzed" | "assigned" | "acknowledged" 
         | "in_progress" | "on_hold" | "resolved" | "escalated"
  assignedOfficialId?: string
  
  // Escalation Management
  escalationLevel: 0 | 1 | 2 | 3
  escalationHistory: [
    {
      timestamp: Date
      level: number
      reason: string
      escalatedTo?: string
    }
  ]
  
  // Audit Trail
  auditLog: [
    {
      timestamp: Date
      action: string
      actor: "system" | "citizen" | "official"
      details?: object
    }
  ]
}
```

## API Request Flow Example

### Scenario: Citizen Reports a Pothole

```
1. CITIZEN SUBMITS COMPLAINT
   ┌─────────────────────────────────┐
   │ React Form Submission           │
   │ - Description: "Large pothole..." │
   │ - Location: "Main Street"       │
   │ - Image: URL                    │
   └────────────────┬────────────────┘
                    │ POST /api/complaints/submit
                    ↓
   ┌──────────────────────────────────────────┐
   │ Express Backend                          │
   │ 1. Create complaint object               │
   │ 2. Call Gemini AI for analysis           │
   └────────────┬───────────────────────────┘
                │
                ↓ Gemini Processes:
   ┌──────────────────────────────────────────┐
   │ Gemini AI Analysis                       │
   │                                          │
   │ Input Analysis:                          │
   │ "Large pothole on Main Street            │
   │  causing vehicle damage"                 │
   │                                          │
   │ Output Decision:                         │
   │ {                                        │
   │   issueType: "pothole",                 │
   │   severity: "high",                     │
   │   department: "Public Works",           │
   │   priority: 8,                          │
   │   suggestedSLA: 24,                     │
   │   reasoning: "Public safety hazard...",│
   │   publicImpact: "Affects ~500 commuters"│
   │ }                                        │
   └────────────┬───────────────────────────┘
                │
                ↓ Save to Firestore
   ┌──────────────────────────────────────────┐
   │ Firestore Creation                       │
   │ complaints collection:                   │
   │ {                                        │
   │   id: "uuid-123",                       │
   │   citizenId: "user-456",                │
   │   description: "Large pothole...",      │
   │   issueType: "pothole",                 │
   │   severity: "high",                     │
   │   assignedDepartment: "Public Works",   │
   │   priority: 8,                          │
   │   status: "analyzed",                   │
   │   createdAt: 2024-01-21T10:00:00,      │
   │   expectedResolutionTime: 2024-01-22... │
   │   auditLog: [                           │
   │     {                                   │
   │       action: "Complaint analyzed...",  │
   │       actor: "system",                  │
   │       timestamp: ...                    │
   │     }                                   │
   │   ]                                     │
   │ }                                        │
   └────────────┬───────────────────────────┘
                │
                ↓ Response to Frontend
   ┌──────────────────────────────────────────┐
   │ HTTP 201 Created                         │
   │ {                                        │
   │   success: true,                        │
   │   complaint: { ...full object... },     │
   │   message: "Complaint submitted..."     │
   │ }                                        │
   └────────────┬───────────────────────────┘
                │
                ↓ UI Update
   ┌──────────────────────────────────────────┐
   │ React Component                          │
   │ - Show success toast                     │
   │ - Display complaint ID                   │
   │ - Show AI analysis results               │
   │ - Redirect to dashboard                  │
   └──────────────────────────────────────────┘
```

## Escalation Decision Flow

```
EVERY 2 HOURS - Background Check Triggered
│
├─→ GET all "active" complaints
│   (status: assigned, acknowledged, in_progress, on_hold)
│
├─→ FOR EACH COMPLAINT:
│   │
│   ├─→ Calculate metrics:
│   │   - Hours elapsed since submission
│   │   - Hours since last status update
│   │   - Current escalation level
│   │   - Days on hold (if applicable)
│   │
│   ├─→ Call Gemini with context:
│   │   Input: {
│   │     complaintId, description, elapsedHours,
│   │     currentStatus, escalationLevel, lastUpdate
│   │   }
│   │
│   │   Gemini evaluates against rules:
│   │   - No ack in 6h → escalate to L1 (Supervisor)
│   │   - No progress in 12h → escalate to L1
│   │   - No progress after L1 SLA → escalate to L2 (Dept Head)
│   │   - No progress after L2 SLA → escalate to L3 (Commissioner)
│   │   - On hold >48h without justification → escalate
│   │
│   │   Output: {
│   │     shouldEscalate: boolean,
│   │     reason: "explanation",
│   │     nextLevel: 0|1|2|3
│   │   }
│   │
│   └─→ IF shouldEscalate:
│       ├─→ Update complaint in Firestore:
│       │   - escalationLevel++
│       │   - escalationHistory.push({...})
│       │   - status: "escalated"
│       │
│       ├─→ Add audit entry:
│       │   - action: "Escalated to level X"
│       │   - actor: "system"
│       │   - reason: reason from Gemini
│       │
│       └─→ Send notification:
│           - Email/SMS to next level official
│           - Citizen notified of escalation
│
└─→ RETURN escalated complaint IDs for logging
```

## Key Features

### 1. **AI-Powered Classification**
- Gemini analyzes complaint text to extract meaning
- Determines issue type, severity, and responsible department
- Calculates appropriate SLA based on severity

### 2. **Continuous Monitoring**
- System checks complaint progress every 2 hours
- Evaluates whether escalation is needed
- Uses Gemini to assess contextual urgency

### 3. **Automatic Escalation**
- Progressive escalation: Supervisor → Dept Head → Commissioner
- Triggered by SLA breaches or inaction
- Full audit trail of all escalations

### 4. **Real-Time Status Tracking**
- Citizens see live status updates
- Officials get assigned complaints immediately
- Audit log shows every action and timestamp

### 5. **Transparency & Accountability**
- Every decision logged with reasoning
- Citizens can view complete history
- Officials can see why issues were escalated

## Development Workflow

### Setup (First Time)

```bash
# 1. Clone and install
git clone <repo>
cd civic-sentinel

# 2. Install frontend dependencies
npm install

# 3. Install backend dependencies
cd backend
npm install
cd ..

# 4. Configure Firebase & Google Cloud
# - Get Firebase credentials
# - Get Google Cloud credentials for Gemini
# - Create backend/.env

# 5. Create Firestore database
# - Firebase Console → Firestore
# - Start in production mode

# 6. Start both servers
npm run dev          # Frontend on 8080
# In another terminal:
cd backend && npm run dev  # Backend on 5000
```

### Development Cycle

```bash
# 1. Make frontend changes
# - Edit components in src/
# - Hot reload at localhost:8080

# 2. Make backend changes
# - Edit API routes/services in backend/src/
# - Auto-reload via tsx watch

# 3. Test integration
# - Submit complaint from frontend
# - Check Firestore
# - Verify Gemini analysis results

# 4. Debug issues
# - Check browser console (frontend)
# - Check terminal output (backend)
# - Check Firestore console
# - Check Google Cloud logs
```

## Production Deployment

### Frontend
- Build: `npm run build` → `dist/`
- Deploy to: Vercel, Netlify, or Cloud Static
- Environment: Production Firebase project

### Backend
- Build: `cd backend && npm run build` → `dist/`
- Deploy to:
  - Google Cloud Run (recommended)
  - Railway.app
  - Render.com
- Environment: Production Firebase + GCP project

### Database
- Use Firebase production instance
- Enable security rules
- Set up backup schedules

### Monitoring
- Google Cloud logging
- Error tracking (Sentry recommended)
- Performance monitoring
- Uptime checks

## Next Steps for Implementation

1. **Complete Frontend Integration**
   - Add complaint submission modal to citizen dashboard
   - Show real complaint data in official dashboard
   - Display AI analysis results

2. **Add Background Scheduler**
   - Implement node-cron for escalation checks
   - Or use Google Cloud Scheduler

3. **Notification System**
   - Email notifications for escalations
   - SMS alerts for critical issues
   - In-app notifications

4. **Advanced Features**
   - Image upload to Cloud Storage
   - Real-time WebSocket updates
   - Mobile app API
   - Advanced analytics

5. **Performance**
   - Add Redis caching
   - Optimize Firestore queries
   - Rate limiting and throttling

6. **Security**
   - JWT authentication
   - API key management
   - Input validation
   - DDOS protection
