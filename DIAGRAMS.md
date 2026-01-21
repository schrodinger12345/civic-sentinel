# CivicFix AI - System Diagrams

## 1. Request Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     CITIZEN SUBMITS COMPLAINT                   │
│                      (React Frontend)                           │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           │ POST /api/complaints/submit
                           │ {citizenId, name, location, description}
                           ↓
┌──────────────────────────────────────────────────────────────────┐
│                    EXPRESS.JS SERVER                            │
│                                                                  │
│  1. Validate input                                              │
│  2. Create complaint object                                     │
│  3. Call Gemini AI Service                                      │
└──────────────┬──────────────────────────────────────────────────┘
               │
               │ Complaint text + location
               ↓
┌──────────────────────────────────────────────────────────────────┐
│              GEMINI AI - ANALYZE COMPLAINT                       │
│                                                                  │
│  Prompt: "Classify this complaint about: [text]"               │
│                                                                 │
│  Analysis:                                                      │
│  - Issue Type: Identify category                               │
│  - Severity: low/medium/high/critical                          │
│  - Department: Responsible agency                              │
│  - Priority: 1-10 scale                                        │
│  - SLA: Suggested resolution time (hours)                      │
│  - Public Impact: Affected people & consequences               │
│                                                                 │
│  Returns: {issueType, severity, department, priority, SLA}    │
└──────────────┬──────────────────────────────────────────────────┘
               │
               │ Analysis results
               ↓
┌──────────────────────────────────────────────────────────────────┐
│             FIREBASE FIRESTORE - STORE COMPLAINT                │
│                                                                  │
│  Collection: complaints                                         │
│  Document ID: UUID                                              │
│  Data:                                                          │
│  {                                                              │
│    citizenId, citizenName, description,                        │
│    issueType, severity, department, priority,                  │
│    status: "analyzed",                                         │
│    expectedResolutionTime,                                     │
│    escalationLevel: 0,                                         │
│    auditLog: [{action, actor, timestamp}],                    │
│    createdAt, updatedAt                                        │
│  }                                                              │
└──────────────┬──────────────────────────────────────────────────┘
               │
               │ HTTP 201 Created
               │ {success: true, complaint: {...}}
               ↓
┌──────────────────────────────────────────────────────────────────┐
│                  CITIZEN SEES CONFIRMATION                       │
│                                                                  │
│  ✓ Complaint submitted successfully                            │
│  - Issue Type: Pothole                                         │
│  - Severity: High                                              │
│  - Department: Public Works                                    │
│  - Priority: 8/10                                              │
│  - SLA: 24 hours                                               │
│                                                                 │
│  Complaint tracked in dashboard                                │
└──────────────────────────────────────────────────────────────────┘
```

## 2. Escalation Check Flow

```
BACKGROUND SCHEDULER RUNS EVERY 2 HOURS
│
├─→ GET /api/complaints/check-escalations
│
├─→ Query Firestore for "active" complaints:
│   WHERE status IN [assigned, acknowledged, in_progress, on_hold]
│
├─→ FOR EACH COMPLAINT:
│   │
│   ├─→ CALCULATE METRICS:
│   │   - hoursElapsed = NOW - createdAt
│   │   - hoursSinceUpdate = NOW - updatedAt
│   │   - currentLevel = escalationLevel
│   │   - currentStatus = status
│   │
│   ├─→ CALL GEMINI:
│   │   Input: {
│   │     complaintId,
│   │     description,
│   │     elapsedHours,
│   │     currentStatus,
│   │     currentEscalationLevel,
│   │     lastUpdate
│   │   }
│   │
│   │   Prompt: "Should this complaint be escalated based on:
│   │   - Current status: [status]
│   │   - Hours since update: [hours]
│   │   - Current escalation level: [level]
│   │
│   │   Rules:
│   │   - No ack in 6h → escalate to L1
│   │   - No progress in 12h → escalate to L1
│   │   - No progress after SLA → escalate
│   │   - On hold 48h+ → escalate"
│   │
│   ├─→ GEMINI RESPONSE:
│   │   {
│   │     shouldEscalate: boolean,
│   │     reason: "No progress for 24 hours",
│   │     nextLevel: 0|1|2|3
│   │   }
│   │
│   └─→ IF shouldEscalate = true:
│       │
│       ├─→ UPDATE FIRESTORE:
│       │   - escalationLevel = nextLevel
│       │   - escalationHistory.push({level, reason, timestamp})
│       │   - status = "escalated"
│       │   - updatedAt = NOW
│       │
│       ├─→ ADD AUDIT ENTRY:
│       │   {
│       │     action: "Escalated to level X",
│       │     actor: "system",
│       │     timestamp: NOW,
│       │     details: {reason: "..."}
│       │   }
│       │
│       ├─→ SEND NOTIFICATIONS:
│       │   - Email to next level official
│       │   - SMS to supervisor
│       │   - In-app notification to citizen
│       │
│       └─→ LOG ESCALATION:
│           Add to results array
│
└─→ RETURN RESULTS:
    {
      escalated: [complaintId1, complaintId2, ...],
      count: 2,
      message: "2 complaints escalated"
    }
```

## 3. Data Structure Diagram

```
COMPLAINTS COLLECTION (Firestore)
│
├─ Complaint Document 1 (UUID)
│  ├─ citizenId: "user123"
│  ├─ citizenName: "John Doe"
│  ├─ description: "Large pothole..."
│  ├─ issueType: "pothole"
│  ├─ severity: "high"
│  ├─ assignedDepartment: "Public Works"
│  ├─ priority: 8
│  ├─ status: "in_progress"
│  ├─ createdAt: 2024-01-21T10:00:00Z
│  ├─ updatedAt: 2024-01-21T14:30:00Z
│  ├─ expectedResolutionTime: 2024-01-22T10:00:00Z
│  ├─ escalationLevel: 0
│  ├─ escalationHistory: []
│  └─ auditLog: [
│     {
│       timestamp: 2024-01-21T10:00:00Z,
│       action: "Complaint submitted and analyzed",
│       actor: "system",
│       details: {
│         analysisReasoning: "Public safety hazard...",
│         publicImpact: "Affects 500+ commuters"
│       }
│     },
│     {
│       timestamp: 2024-01-21T11:00:00Z,
│       action: "Status changed to acknowledged",
│       actor: "official",
│       details: {notes: "Work team dispatched"}
│     },
│     {
│       timestamp: 2024-01-21T14:30:00Z,
│       action: "Status changed to in_progress",
│       actor: "official",
│       details: {notes: "Repair materials arrived"}
│     }
│  ]
│
├─ Complaint Document 2 (UUID)
│  ├─ ...
│  └─ escalationHistory: [
│     {
│       timestamp: 2024-01-21T22:00:00Z,
│       level: 1,
│       reason: "No progress for 24 hours",
│       escalatedTo: "supervisor-456"
│     }
│  ]
│
└─ ... more complaints
```

## 4. API Route Mapping

```
┌─────────────────────────────────────────────────────────────┐
│                    API ENDPOINTS                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  POST /api/complaints/submit                               │
│  ├─ Called by: Citizen                                     │
│  ├─ Does: Submit complaint, call Gemini, save to Firebase │
│  └─ Returns: 201 + complaint object                        │
│                                                             │
│  GET /api/complaints/:complaintId                          │
│  ├─ Called by: Citizen or Official                         │
│  ├─ Does: Fetch single complaint with full history        │
│  └─ Returns: 200 + complaint object                        │
│                                                             │
│  GET /api/complaints/citizen/:citizenId                    │
│  ├─ Called by: Citizen (Dashboard)                         │
│  ├─ Does: List all complaints by citizen                  │
│  └─ Returns: 200 + [complaints]                            │
│                                                             │
│  GET /api/complaints/official/:officialId                  │
│  ├─ Called by: Official (Dashboard)                        │
│  ├─ Does: List assigned complaints with priority sort     │
│  └─ Returns: 200 + [complaints]                            │
│                                                             │
│  GET /api/complaints/department/:department                │
│  ├─ Called by: Admin                                       │
│  ├─ Does: List all complaints for department              │
│  └─ Returns: 200 + [complaints]                            │
│                                                             │
│  PUT /api/complaints/:complaintId/progress                 │
│  ├─ Called by: Official                                    │
│  ├─ Does: Update status, add audit entry                  │
│  ├─ Body: {officialId, status, notes}                     │
│  └─ Returns: 200 + updated complaint                       │
│                                                             │
│  POST /api/complaints/check-escalations                    │
│  ├─ Called by: Scheduler (every 2 hours)                  │
│  ├─ Does: Check all active complaints for escalation       │
│  ├─ Logic: For each → call Gemini → decide & update       │
│  └─ Returns: 200 + {escalated: [...]}                      │
│                                                             │
│  GET /api/complaints/official/:officialId/stats            │
│  ├─ Called by: Official (Dashboard)                        │
│  ├─ Does: Calculate stats from assigned complaints         │
│  └─ Returns: 200 + {stats}                                 │
│                                                             │
│  GET /api/health                                           │
│  ├─ Called by: Monitoring                                  │
│  ├─ Does: Return server status                             │
│  └─ Returns: 200 + {status: "ok"}                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 5. Service Layer Architecture

```
REQUEST ARRIVES AT EXPRESS
│
├─→ Route Handler (routes/complaints.ts)
│  │
│  ├─ Validate input
│  ├─ Extract parameters
│  └─ Call appropriate service
│
├─→ Service Layer (services/)
│  │
│  ├─ ComplaintService (business logic)
│  │  ├─ submitComplaint()
│  │  ├─ updateComplaintProgress()
│  │  ├─ checkAndProcessEscalations()
│  │  ├─ getOfficialStats()
│  │  └─ ... other business logic
│  │
│  ├─ GeminiService (AI integration)
│  │  ├─ analyzeComplaint()
│  │  ├─ evaluateEscalation()
│  │  └─ generateReasoningNotes()
│  │
│  └─ FirebaseService (data operations)
│     ├─ createComplaint()
│     ├─ getComplaint()
│     ├─ updateComplaintStatus()
│     ├─ escalateComplaint()
│     ├─ getAllActiveComplaints()
│     └─ ... other database ops
│
└─→ Response
   ├─ JSON with results
   ├─ Appropriate HTTP status
   └─ Error handling
```

## 6. Deployment Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                   DEVELOPMENT                               │
│                                                              │
│  Local Machine:                                              │
│  ├─ npm run dev (Frontend on :8080)                         │
│  ├─ npm run dev (Backend on :5000)                          │
│  └─ .env with dev credentials                              │
└──────────────────────────────────────────────────────────────┘
         ↓ npm run build (both)
┌──────────────────────────────────────────────────────────────┐
│                    PRODUCTION                               │
│                                                              │
│  Frontend:                                                   │
│  ├─ dist/ artifacts → Vercel/Netlify                        │
│  ├─ Production Firebase project                            │
│  └─ Custom domain                                           │
│                                                              │
│  Backend:                                                    │
│  ├─ dist/ artifacts → Google Cloud Run                      │
│  ├─ Production GCP project (Gemini)                         │
│  ├─ Production Firebase (Firestore)                         │
│  ├─ Environment variables (Cloud Secret Manager)            │
│  └─ Managed service with auto-scaling                       │
│                                                              │
│  Database:                                                   │
│  ├─ Firestore (production instance)                         │
│  ├─ Backup enabled                                          │
│  ├─ Security rules enabled                                  │
│  └─ Monitoring & alerts                                     │
│                                                              │
│  AI Service:                                                 │
│  ├─ Google Cloud Vertex AI (Gemini)                         │
│  ├─ Quotas set                                              │
│  ├─ Billing alerts                                          │
│  └─ Performance monitoring                                  │
└──────────────────────────────────────────────────────────────┘
```

---

These diagrams show:
1. How a complaint flows through the system
2. How escalation checks work periodically
3. The data structure in Firestore
4. All available API endpoints
5. How services interact
6. Development vs production setup
