# CivicFix AI - Setup Guide

## Quick Start (5 minutes)

### Frontend (Already Running)
- React/TypeScript application
- Running on `http://localhost:8080`
- Handles user authentication and complaint submission UI

### Backend Setup

#### 1. Install Backend Dependencies

```bash
cd backend
npm install
```

#### 2. Get Firebase Credentials

You need a Firebase project with Firestore enabled.

From Firebase Console:
1. Go to Project Settings → Service Accounts
2. Click "Generate New Private Key"
3. This downloads a JSON file with your credentials

Extract these values from the JSON:
```
FIREBASE_PROJECT_ID: "firebase_project_id"
FIREBASE_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL: "firebase-adminsdk-xxxxx@xxxxx.iam.gserviceaccount.com"
```

#### 3. Get Google Cloud Credentials for Gemini

You need Google Cloud project with Vertex AI enabled.

```bash
# Install Google Cloud CLI
# https://cloud.google.com/sdk/docs/install

# Authenticate
gcloud auth login

# Set project
gcloud config set project YOUR_GCP_PROJECT_ID

# Enable Vertex AI API
gcloud services enable aiplatform.googleapis.com

# Create application default credentials
gcloud auth application-default login
```

#### 4. Configure Environment

Create `.env` file in `backend/` directory:

```env
PORT=5000
NODE_ENV=development

# Firebase
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_PRIVATE_KEY=your_private_key_with_newlines
FIREBASE_CLIENT_EMAIL=your_service_account_email

# Google Cloud Vertex AI (Gemini)
GOOGLE_CLOUD_PROJECT=your_gcp_project_id
GOOGLE_CLOUD_LOCATION=us-central1

# CORS
FRONTEND_URL=http://localhost:8080
```

**Important**: For `FIREBASE_PRIVATE_KEY`, replace literal `\n` with actual newlines:
```
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEF...
-----END PRIVATE KEY-----"
```

#### 5. Set Up Firestore Database

In Firebase Console:
1. Create a Firestore database
2. Choose "Start in production mode"
3. Select your region (us-central1 recommended)
4. Create a security rule that allows this backend service account access

Example Firestore rules:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read/write for service account
    match /{document=**} {
      allow read, write: if request.auth.uid != null;
    }
  }
}
```

#### 6. Start Backend Server

```bash
npm run dev
```

Output should show:
```
🚀 CivicFix Backend Server
📍 Running on: http://localhost:5000
🌍 Frontend URL: http://localhost:8080
📊 Health check: http://localhost:5000/api/health
```

#### 7. Verify Setup

Test the health endpoint:
```bash
curl http://localhost:5000/api/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-21T10:30:45.123Z",
  "environment": "development"
}
```

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    React Frontend                            │
│          (Citizen & Official Dashboards)                    │
│              http://localhost:8080                           │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTP API Calls
                     ↓
┌─────────────────────────────────────────────────────────────┐
│                   Express Backend                            │
│            http://localhost:5000/api                         │
│                                                              │
│  Routes:                                                    │
│  - POST   /complaints/submit       (Submit new complaint)  │
│  - GET    /complaints/:id          (Get complaint details)  │
│  - GET    /complaints/citizen/:id  (Get user complaints)   │
│  - PUT    /complaints/:id/progress (Update status)         │
│  - POST   /check-escalations       (Escalation trigger)    │
└────┬──────────────────────────┬──────────────────────┬─────┘
     │                          │                      │
     ↓                          ↓                      ↓
┌──────────────┐    ┌────────────────────┐   ┌──────────────┐
│   Gemini AI  │    │ Firebase Firestore │   │ Google Cloud │
│              │    │                    │   │              │
│ Analyzes:    │    │ Stores:            │   │ Auth:        │
│ - Issue type │    │ - Complaints       │   │ - Credentials│
│ - Severity   │    │ - Status history   │   │ - Logs       │
│ - Department │    │ - Audit trail      │   │ - Monitoring │
│ - Priority   │    │ - Escalations      │   │              │
│              │    │                    │   │              │
│ Evaluates:   │    │                    │   │              │
│ - Escalation │    │                    │   │              │
│   triggers   │    │                    │   │              │
└──────────────┘    └────────────────────┘   └──────────────┘
```

## Testing the System

### 1. Submit a Test Complaint

```bash
curl -X POST http://localhost:5000/api/complaints/submit \
  -H "Content-Type: application/json" \
  -d '{
    "citizenId": "test-user-123",
    "citizenName": "John Doe",
    "citizenLocation": "Downtown Main Street",
    "description": "Large pothole on Main Street near the library. Vehicles are getting stuck.",
    "imageUrl": "https://example.com/pothole.jpg"
  }'
```

### 2. Retrieve the Complaint

```bash
# Use the complaint ID from the response above
curl http://localhost:5000/api/complaints/COMPLAINT_ID
```

### 3. Check Frontend Integration

1. Open http://localhost:8080
2. Sign in as a citizen
3. Submit a complaint through the UI
4. Verify it appears in your dashboard
5. As an official, acknowledge and update status

## Troubleshooting

### Firebase Connection Error
```
Error: Failed to initialize Firebase
```

**Solution**: Check your `.env` file credentials
- Verify `FIREBASE_PROJECT_ID` matches your Firebase project
- Ensure `FIREBASE_PRIVATE_KEY` has actual newlines (not `\n` strings)
- Verify service account has Firestore permissions

### Gemini API Error
```
Error: PERMISSION_DENIED: Permission denied on resource
```

**Solution**: 
- Ensure Vertex AI API is enabled: `gcloud services enable aiplatform.googleapis.com`
- Run `gcloud auth application-default login` again
- Check GCP project ID matches `GOOGLE_CLOUD_PROJECT`

### CORS Error in Frontend
```
Access to XMLHttpRequest blocked by CORS policy
```

**Solution**: Update `FRONTEND_URL` in backend `.env` to match your frontend URL

### Port Already in Use
```
Error: listen EADDRINUSE: address already in use :::5000
```

**Solution**:
```bash
# Kill the process using port 5000
lsof -ti:5000 | xargs kill -9

# Or use a different port
PORT=5001 npm run dev
```

## Running Escalation Checks

By default, escalation checks need to be triggered. In production, set up a scheduler:

```bash
# Trigger escalation check every 2 hours
curl -X POST http://localhost:5000/api/complaints/check-escalations
```

For production, use a tool like:
- **node-cron** for simple scheduling
- **Bull** + **Redis** for robust job queues
- **Google Cloud Scheduler** to call the endpoint

## Next Steps

1. **Frontend Integration**: Update React components to call the backend API
2. **Authentication**: Add JWT tokens between frontend and backend
3. **Notifications**: Implement email/SMS alerts for escalations
4. **Analytics**: Add dashboards for system-wide metrics
5. **Deployment**: Deploy backend to Cloud Run, Render, or Railway

## Architecture Decision: Why Node.js?

- **Fast prototyping**: Easy to set up Express server
- **JavaScript/TypeScript**: Share types between frontend and backend
- **Gemini Integration**: Simple with Google Cloud SDK
- **Firebase**: Native Node.js SDK support
- **Scalable**: Can easily add Redis for caching, Bull for job queues
- **Hackathon-friendly**: Minimal boilerplate, quick iteration
