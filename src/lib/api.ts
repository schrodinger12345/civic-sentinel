import { Complaint, OfficialStats, TimelineEvent } from '@/types/complaint';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const message = await res.text().catch(() => res.statusText);
    throw new Error(message || `Request failed with ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export const api = {
  submitComplaint: (payload: {
    citizenId: string;
    citizenName: string;
    title: string;
    imageBase64: string;
    coordinates: {
      latitude: number;
      longitude: number;
    };
    locationName: string;
  }) =>
    request<{
      success: boolean;
      complaint?: Complaint;
      rejected?: boolean;
      reason?: string;
      confidenceScore?: number;
      message?: string;
    }>(`/complaints/submit`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getCitizenComplaints: (citizenId: string) =>
    request<{ success: boolean; complaints: Complaint[] }>(
      `/complaints/citizen/${citizenId}`
    ),

  getOfficialComplaints: (officialId: string) =>
    request<{ success: boolean; complaints: Complaint[] }>(
      `/complaints/official/${encodeURIComponent(officialId)}`
    ),

  updateComplaintStatus: (
    complaintId: string,
    payload: { officialId: string; status: string; notes?: string }
  ) =>
    request<{ success: boolean; complaint: Complaint }>(
      `/complaints/${complaintId}/progress`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      }
    ),

  getOfficialStats: (officialId: string) =>
    request<{ success: boolean; stats: OfficialStats }>(
      `/complaints/official/${officialId}/stats`
    ),

  getComplaintTimeline: (complaintId: string) =>
    request<{ success: boolean; complaintId: string; timeline: TimelineEvent[] }>(
      `/complaints/${complaintId}/timeline`
    ),

  updateComplaintStatusV2: (complaintId: string, payload: { status: 'in_progress' | 'resolved'; note?: string }) =>
    request<{ success: boolean; complaint: Complaint }>(`/complaints/${complaintId}/status`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getOfficialAIBrief: (officialId: string) =>
    request<{ success: boolean; brief: string }>(`/complaints/official/${officialId}/ai-brief`),

  /** Get live stats for real-time escalation count (hackathon demo) */
  getLiveStats: () =>
    request<{
      success: boolean;
      activeCount: number;
      slaWarningCount: number;
      escalatedCount: number;
      resolvedTodayCount: number;
      total: number;
      timestamp: string;
    }>(`/complaints/_debug/live-stats`),
};
