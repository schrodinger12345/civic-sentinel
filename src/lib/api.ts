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

  // 🔥 DEFENSIVE: Handle both array and object responses
  getCitizenComplaints: async (citizenId: string): Promise<{ complaints: Complaint[] }> => {
    try {
      const data = await request<Complaint[] | { complaints?: Complaint[] }>(
        `/complaints/citizen/${citizenId}`
      );
      // Backend may return array directly OR { complaints: [] }
      if (Array.isArray(data)) {
        return { complaints: data };
      }
      return { complaints: data?.complaints ?? [] };
    } catch (error) {
      console.error('Failed to fetch citizen complaints:', error);
      throw error; // Let caller decide how to handle; preserves existing UI state
    }
  },

  // 🔥 DEFENSIVE: Handle both array and object responses
  getOfficialComplaints: async (officialId: string): Promise<{ complaints: Complaint[] }> => {
    try {
      const data = await request<Complaint[] | { complaints?: Complaint[] }>(
        `/complaints/official/${encodeURIComponent(officialId)}`
      );
      if (Array.isArray(data)) {
        return { complaints: data };
      }
      return { complaints: data?.complaints ?? [] };
    } catch (error) {
      console.error('Failed to fetch official complaints:', error);
      throw error;
    }
  },

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

  // 🔥 DEFENSIVE: Handle missing timeline
  getComplaintTimeline: async (complaintId: string): Promise<{ timeline: TimelineEvent[] }> => {
    try {
      const data = await request<{ timeline?: TimelineEvent[] } | TimelineEvent[]>(
        `/complaints/${complaintId}/timeline`
      );
      if (Array.isArray(data)) {
        return { timeline: data };
      }
      return { timeline: data?.timeline ?? [] };
    } catch (error) {
      console.error('Failed to fetch timeline:', error);
      return { timeline: [] };
    }
  },

  updateComplaintStatusV2: (complaintId: string, payload: { status: 'in_progress' | 'resolved'; note?: string }) =>
    request<{ success: boolean; complaint: Complaint }>(`/complaints/${complaintId}/status`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getOfficialAIBrief: (officialId: string) =>
    request<{ success: boolean; brief: string }>(`/complaints/official/${officialId}/ai-brief`),

  /** Get dashboard stats with escalation counters */
  getDashboardStats: async () => {
    try {
      return await request<{
        counters: Record<string, number>;
        raw: { total: number; escalated: number; slaBreaches: number; resolvedToday: number; pending: number; critical: number };
      }>(`/complaints/dashboard/stats`);
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error);
      return { counters: {}, raw: { total: 0, escalated: 0, slaBreaches: 0, resolvedToday: 0, pending: 0, critical: 0 } };
    }
  },

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

