# Frontend-Backend Integration Guide

## Overview

The React frontend needs to be updated to call the Express backend API endpoints. This guide shows where and how to integrate.

## API Endpoints Reference

All endpoints are prefixed with `http://localhost:5000/api`

### Complaint Operations

#### 1. Submit Complaint
```typescript
POST /complaints/submit

Request:
{
  citizenId: string;
  citizenName: string;
  citizenLocation: string;
  description: string;
  imageUrl?: string;
}

Response:
{
  success: true;
  complaint: Complaint;
  message: string;
}
```

#### 2. Get User's Complaints
```typescript
GET /complaints/citizen/:citizenId

Response:
{
  success: true;
  count: number;
  complaints: Complaint[];
}
```

#### 3. Get Official's Assigned Complaints
```typescript
GET /complaints/official/:officialId

Response:
{
  success: true;
  count: number;
  complaints: Complaint[];
}
```

#### 4. Get Complaint Details
```typescript
GET /complaints/:complaintId

Response: Complaint
```

#### 5. Update Complaint Progress
```typescript
PUT /complaints/:complaintId/progress

Request:
{
  officialId: string;
  status: 'acknowledged' | 'in_progress' | 'on_hold' | 'resolved';
  notes?: string;
}

Response:
{
  success: true;
  complaint: Complaint;
  message: string;
}
```

#### 6. Get Official Dashboard Stats
```typescript
GET /complaints/official/:officialId/stats

Response:
{
  success: true;
  stats: {
    total: number;
    byStatus: { ... };
    byPriority: { ... };
    escalated: number;
    averageResolutionTime: number;
    slaCompliance: number;
  };
}
```

## Frontend Integration Points

### 1. Citizen Onboarding (`CitizenOnboarding.tsx`)

When completing onboarding, the citizen should see an option to report an issue.

**Current:** Redirects to dashboard with `?action=report` parameter
**Next:** Create a complaint submission modal

### 2. Citizen Dashboard (`CitizenDashboard.tsx`)

**Tasks to implement:**

```typescript
// a) Load user's complaints on mount
useEffect(() => {
  const fetchComplaints = async () => {
    const response = await fetch(
      `http://localhost:5000/api/complaints/citizen/${userProfile?.uid}`
    );
    const data = await response.json();
    setComplaints(data.complaints);
    updateStats(data.complaints);
  };
  
  if (userProfile?.uid) {
    fetchComplaints();
  }
}, [userProfile?.uid]);

// b) Report new issue button
const handleReportIssue = async (formData: {
  description: string;
  imageUrl?: string;
}) => {
  const response = await fetch(
    'http://localhost:5000/api/complaints/submit',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        citizenId: userProfile?.uid,
        citizenName: userProfile?.displayName,
        citizenLocation: userProfile?.location,
        description: formData.description,
        imageUrl: formData.imageUrl,
      }),
    }
  );
  
  const data = await response.json();
  // Show success toast, refresh list
};

// c) Track individual complaint status
const handleViewComplaint = (complaintId: string) => {
  // Navigate to detail page with complaint info
};
```

### 3. Official Dashboard (`OfficialDashboard.tsx`)

**Tasks to implement:**

```typescript
// a) Load assigned complaints on mount
useEffect(() => {
  const fetchComplaints = async () => {
    const response = await fetch(
      `http://localhost:5000/api/complaints/official/${userProfile?.uid}`
    );
    const data = await response.json();
    setComplaints(data.complaints);
  };
  
  if (userProfile?.uid) {
    fetchComplaints();
  }
}, [userProfile?.uid]);

// b) Load dashboard stats
useEffect(() => {
  const fetchStats = async () => {
    const response = await fetch(
      `http://localhost:5000/api/complaints/official/${userProfile?.uid}/stats`
    );
    const data = await response.json();
    setStats(data.stats);
  };
  
  if (userProfile?.uid) {
    fetchStats();
  }
}, [userProfile?.uid]);

// c) Update complaint progress
const handleUpdateStatus = async (
  complaintId: string,
  status: string,
  notes?: string
) => {
  const response = await fetch(
    `http://localhost:5000/api/complaints/${complaintId}/progress`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        officialId: userProfile?.uid,
        status,
        notes,
      }),
    }
  );
  
  const data = await response.json();
  // Update UI with new complaint state
};
```

### 4. System Console (`System.tsx`)

For viewing system decision logs and AI reasoning:

```typescript
// Display complaint analysis results
// Show escalation decisions
// Show audit trail
```

## Creating New Components

### 1. ComplaintSubmissionModal

```tsx
// src/components/ComplaintSubmissionModal.tsx
interface Props {
  isOpen: boolean;
  onClose: () => void;
  citizenId: string;
  citizenName: string;
  citizenLocation: string;
  onSuccess: (complaint: Complaint) => void;
}

export function ComplaintSubmissionModal({ 
  isOpen, 
  onClose, 
  citizenId,
  citizenName,
  citizenLocation,
  onSuccess 
}: Props) {
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        'http://localhost:5000/api/complaints/submit',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            citizenId,
            citizenName,
            citizenLocation,
            description,
            imageUrl: imageUrl || undefined,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to submit complaint');
      }

      const { complaint } = await response.json();
      
      toast({
        title: 'Success',
        description: 'Your complaint has been submitted and analyzed.',
        variant: 'default',
      });

      onSuccess(complaint);
      onClose();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to submit complaint. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Report a Civic Issue</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="description">Issue Description</Label>
            <Textarea
              id="description"
              placeholder="Describe the issue in detail..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-2"
              rows={5}
            />
          </div>

          <div>
            <Label htmlFor="imageUrl">Image URL (Optional)</Label>
            <Input
              id="imageUrl"
              type="url"
              placeholder="https://example.com/issue.jpg"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="mt-2"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!description.trim() || loading}
          >
            {loading ? 'Submitting...' : 'Submit Complaint'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### 2. ComplaintCard

```tsx
// src/components/ComplaintCard.tsx
interface Props {
  complaint: Complaint;
  isOfficial?: boolean;
  onUpdateStatus?: (status: string, notes?: string) => Promise<void>;
}

export function ComplaintCard({ complaint, isOfficial, onUpdateStatus }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState('');
  const [updating, setUpdating] = useState(false);

  const handleStatusUpdate = async (newStatus: string) => {
    if (onUpdateStatus) {
      setUpdating(true);
      try {
        await onUpdateStatus(newStatus, notes);
        setNotes('');
      } finally {
        setUpdating(false);
      }
    }
  };

  return (
    <div className="glass-panel p-4 mb-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="font-semibold text-lg">{complaint.issueType}</h3>
          <p className="text-muted-foreground text-sm mt-1">
            {complaint.description.substring(0, 100)}...
          </p>
          <div className="flex gap-2 mt-3">
            <Badge variant={getSeverityVariant(complaint.severity)}>
              {complaint.severity}
            </Badge>
            <Badge variant="outline">{complaint.status}</Badge>
            {complaint.escalationLevel > 0 && (
              <Badge variant="destructive">
                Escalation Level {complaint.escalationLevel}
              </Badge>
            )}
          </div>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-muted-foreground hover:text-foreground"
        >
          {expanded ? '−' : '+'}
        </button>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <div className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Department</p>
              <p className="font-medium">{complaint.assignedDepartment}</p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Priority</p>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-2 bg-white/10 rounded-full">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${complaint.priority * 10}%` }}
                  />
                </div>
                <span className="text-sm font-medium">{complaint.priority}/10</span>
              </div>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Expected Resolution</p>
              <p className="font-medium">
                {new Date(complaint.expectedResolutionTime).toLocaleDateString()}
              </p>
            </div>

            {isOfficial && complaint.status !== 'resolved' && (
              <div className="space-y-2 mt-4 pt-4 border-t border-white/10">
                <Textarea
                  placeholder="Add status update notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="text-sm"
                  rows={2}
                />
                <div className="flex gap-2">
                  {(['acknowledged', 'in_progress', 'on_hold', 'resolved'] as const).map(
                    (status) => (
                      <Button
                        key={status}
                        size="sm"
                        variant={complaint.status === status ? 'default' : 'outline'}
                        onClick={() => handleStatusUpdate(status)}
                        disabled={updating}
                      >
                        {status.replace('_', ' ')}
                      </Button>
                    )
                  )}
                </div>
              </div>
            )}

            {/* Audit Trail */}
            <div className="mt-4 pt-4 border-t border-white/10">
              <p className="text-sm font-medium mb-2">Activity Log</p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {complaint.auditLog.slice(-5).map((entry, idx) => (
                  <div key={idx} className="text-xs text-muted-foreground">
                    <span className="font-mono">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </span>
                    {' - '}
                    {entry.action}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

## Environment Variables

Update frontend environment if backend is on different URL:

```env
# .env (in root or .env.local)
VITE_API_URL=http://localhost:5000/api
```

Update frontend to use:
```typescript
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
```

## Error Handling

Always handle API errors gracefully:

```typescript
const fetchComplaints = async () => {
  try {
    const response = await fetch(`${API_URL}/complaints/citizen/${userId}`);
    
    if (!response.ok) {
      if (response.status === 401) {
        // Redirect to login
        navigate('/auth');
        return;
      }
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    setComplaints(data.complaints);
  } catch (error) {
    console.error('Error fetching complaints:', error);
    toast({
      title: 'Error',
      description: 'Failed to load complaints. Please try again.',
      variant: 'destructive',
    });
  }
};
```

## Real-Time Updates

For production, consider WebSocket updates:

```typescript
// Connect to backend WebSocket
const ws = new WebSocket('ws://localhost:5000');

ws.onmessage = (event) => {
  const { type, data } = JSON.parse(event.data);
  
  if (type === 'complaint_updated') {
    // Update complaint in UI
    setComplaints(prev => 
      prev.map(c => c.id === data.id ? data : c)
    );
  }
  
  if (type === 'complaint_escalated') {
    // Show notification
    toast({
      title: 'Escalation Alert',
      description: `Complaint ${data.id} has been escalated`,
      variant: 'warning',
    });
  }
};
```

## Testing

Use these commands to test API endpoints:

```bash
# Test health
curl http://localhost:5000/api/health

# Submit complaint
curl -X POST http://localhost:5000/api/complaints/submit \
  -H "Content-Type: application/json" \
  -d '{
    "citizenId": "user1",
    "citizenName": "John",
    "citizenLocation": "Downtown",
    "description": "Pothole on Main St"
  }'

# Get user complaints
curl http://localhost:5000/api/complaints/citizen/user1
```
