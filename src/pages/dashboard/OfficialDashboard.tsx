import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  LogOut,
  User,
  Bell,
  Search,
  TrendingUp,
  BarChart3,
  ChevronDown,
  AlertCircle,
  Brain,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Complaint, TimelineEvent } from '@/types/complaint';
import { useToast } from '@/hooks/use-toast';
import { normalizeDate, formatDate } from '@/lib/dateUtils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

export default function OfficialDashboard() {
  const { userProfile, logout } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'resolved'>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState(Date.now());
  const [selected, setSelected] = useState<Complaint | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [aiBrief, setAIBrief] = useState<string | null>(null);
  const [liveEscalated, setLiveEscalated] = useState(0);
  const [flash, setFlash] = useState(false);
  const [expandedIssues, setExpandedIssues] = useState<Record<string, boolean>>({});
  const [recommendationModal, setRecommendationModal] = useState<{ isOpen: boolean; complaint: Complaint | null }>({
    isOpen: false,
    complaint: null,
  });

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  useEffect(() => {
    setLoading(true);
    setLoadError(null);

    api
      .getAllComplaints()
      .then((res) => {
        setComplaints(res.complaints ?? []);
      })
      .catch((err) => {
        console.error('Failed to load complaints', err);
        setComplaints([]);
        setLoadError(err instanceof Error ? err.message : 'Unable to load complaints.');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!userProfile?.uid) return;

    api
      .getOfficialAIBrief(userProfile.uid)
      .then((res) => {
        if (res?.brief) {
          setAIBrief(res.brief);
        }
      })
      .catch(() => { });
  }, [userProfile?.uid]);

  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Poll live escalation count for demo
  useEffect(() => {
    const fetchLive = async () => {
      try {
        const data = await api.getLiveStats();
        if (data.escalatedCount > liveEscalated && liveEscalated > 0) {
          setFlash(true);
          setTimeout(() => setFlash(false), 1000);
        }
        setLiveEscalated(data.escalatedCount);
      } catch { }
    };
    fetchLive();
    const interval = setInterval(fetchLive, 5000);
    return () => clearInterval(interval);
  }, [liveEscalated]);

  // Authoritative deadline reader; keeps hoisted for use in memos
  function getDeadline(c: Complaint) {
    return normalizeDate(c.nextEscalationAt);
  }

  const priorityBucket = (p?: number) => {
    if (p >= 9) return 0; // CRITICAL
    if (p >= 7) return 1; // HIGH
    if (p >= 4) return 2; // MEDIUM
    return 3; // LOW
  };

  const sortedComplaints = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = term
      ? (complaints ?? []).filter((c) =>
        [c.title, c.description, c.category]
          .filter(Boolean)
          .some((field) => field?.toLowerCase().includes(term))
      )
      : complaints ?? [];

    // Apply status filter
    const statusFiltered = filtered.filter((c) => {
      if (filterStatus === 'resolved') return c.status === 'resolved';
      if (filterStatus === 'pending') return c.status !== 'resolved';
      return true; // 'all'
    });

    return [...statusFiltered].sort((a, b) => {
      const pbA = priorityBucket(a.priority);
      const pbB = priorityBucket(b.priority);
      if (pbA !== pbB) return pbA - pbB;

      if (a.escalationLevel !== b.escalationLevel) {
        return b.escalationLevel - a.escalationLevel;
      }

      const da = normalizeDate(a.createdAt)?.getTime() ?? 0;
      const db = normalizeDate(b.createdAt)?.getTime() ?? 0;
      return da - db;
    });
  }, [complaints, search, filterStatus]);

  const statCards = useMemo(() => {
    // 🔥 DEFENSIVE: Ensure we always work with an array
    const safeComplaints = complaints ?? [];
    const now = Date.now();
    const in24h = now + 24 * 60 * 60 * 1000;

    // 🔥 Computed from REAL complaints data - no more relying on separate stats endpoint
    const assigned = safeComplaints.length;
    const dueToday = safeComplaints.filter((c) => {
      if (c.status === 'resolved') return false;
      const deadline = normalizeDate(c.nextEscalationAt);
      return deadline && deadline.getTime() < in24h;
    }).length;
    const resolved = safeComplaints.filter((c) => c.status === 'resolved').length;
    const escalated = safeComplaints.filter((c) => c.escalationLevel > 0).length;
    return [
      { label: 'Assigned Issues', value: assigned, icon: FileText, color: 'primary' },
      { label: 'Due Today', value: dueToday, icon: Clock, color: 'warning' },
      { label: 'Resolved', value: resolved, icon: CheckCircle2, color: 'success' },
      { label: 'Escalated', value: escalated, icon: AlertTriangle, color: 'destructive' },
    ];
  }, [complaints]);

  const performanceMetrics = useMemo(() => {
    const resolved = (complaints ?? []).filter((c) => c.status === 'resolved');
    const resolutionDurations = resolved
      .map((c) => {
        const created = normalizeDate(c.createdAt)?.getTime();
        const updated = normalizeDate(c.updatedAt)?.getTime();
        return created && updated ? updated - created : null;
      })
      .filter((d): d is number => d !== null);

    const avgResolutionHours = resolutionDurations.length
      ? resolutionDurations.reduce((sum, d) => sum + d, 0) / resolutionDurations.length / (1000 * 60 * 60)
      : null;

    const total = complaints.length;
    const compliantCount = (complaints ?? []).filter((c) => c.escalationLevel === 0).length;
    const slaCompliance = total ? Math.round((compliantCount / total) * 100) : null;

    const escalatedActive = (complaints ?? []).filter((c) => c.escalationLevel > 0).length;

    return [
      {
        label: 'Avg. Resolution Time',
        value: avgResolutionHours !== null
          ? `${avgResolutionHours.toFixed(1)}h`
          : 'Insufficient data (computed from history)',
      },
      {
        label: 'SLA Compliance',
        value: slaCompliance !== null ? `${slaCompliance}%` : 'Insufficient data (computed from escalation levels)',
      },
      {
        label: 'Escalation Rate',
        value: `${escalatedActive} active`,
      },
    ];
  }, [complaints]);

  // AI Priority Brief: Computed from existing data, no backend changes
  const aiPriorityBrief = useMemo(() => {
    const safeComplaints = complaints ?? [];
    const now = nowTick;

    // Find issues nearing SLA breach (within next 10 seconds)
    const nearingSLA = safeComplaints.filter((c) => {
      const deadline = getDeadline(c);
      if (!deadline) return false;
      const remaining = deadline.getTime() - now;
      return remaining >= 0 && remaining < 10000;
    }).length;

    // Find already escalated issues
    const escalated = safeComplaints.filter((c) => c.escalationLevel > 0).length;

    // Most common category among unresolved
    const unresolvedByCategory = safeComplaints
      .filter((c) => c.status !== 'resolved')
      .reduce(
        (acc, c) => {
          acc[c.category] = (acc[c.category] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );
    const focusArea = Object.entries(unresolvedByCategory).sort((a, b) => b[1] - a[1])[0]?.[0] || 'General';

    // Risk level based on max escalation
    const maxEscalation = Math.max(...safeComplaints.map((c) => c.escalationLevel || 0), 0);
    const riskLevel = maxEscalation === 0 ? 'LOW' : maxEscalation <= 1 ? 'MEDIUM' : 'HIGH';

    return { nearingSLA, escalated, focusArea, riskLevel, total: safeComplaints.length };
  }, [complaints, nowTick]);

  const severityColor = (severity: string) => {
    if (severity === 'critical') return 'text-destructive';
    if (severity === 'high') return 'text-warning';
    if (severity === 'medium') return 'text-primary';
    return 'text-muted-foreground';
  };

  const statusLabel = (status: Complaint['status']) => status.replace('_', ' ');

  const getEscalationColor = (level: number) => {
    if (level === 0) return 'text-muted-foreground';
    if (level === 1) return 'text-yellow-500';
    if (level === 2) return 'text-orange-500';
    return 'text-red-500';
  };

  const formatRemaining = (ms: number) => {
    const sign = ms < 0 ? '-' : '';
    const abs = Math.abs(ms);
    const totalSec = Math.floor(abs / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${sign}${h}h ${m}m ${s}s`;
  };

  const toggleExpanded = (id: string) => {
    setExpandedIssues((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Mocked AI recommendation based on complaint characteristics
  const generateAIRecommendation = (complaint: Complaint) => {
    const department = complaint.category || 'general';
    const isEscalated = complaint.escalationLevel > 0;
    const isHighPriority = complaint.priority >= 8;
    const escalationContext = isEscalated
      ? `This issue has escalated to Level ${complaint.escalationLevel}. `
      : '';

    const actionMap: Record<string, string> = {
      'Public Works': 'Dispatch maintenance team and notify district supervisor',
      'Water Supply': 'Contact emergency water management response unit',
      'Traffic': 'Escalate to traffic management authority; deploy traffic control',
      'Sanitation': 'Dispatch sanitation crew within 24 hours',
      'Healthcare': 'Refer to public health officer and follow-up required',
      'Education': 'Escalate to district education office',
    };

    const defaultAction = `Escalate to ${department} supervisor for immediate attention`;
    const suggestedAction = actionMap[complaint.category] || defaultAction;

    return {
      action: suggestedAction,
      urgency: isHighPriority ? 'CRITICAL' : isEscalated ? 'HIGH' : 'MEDIUM',
      window: isEscalated ? '< 5 minutes' : isHighPriority ? '< 2 hours' : '< 24 hours',
      risk: escalationContext
        ? `Citizen has already reported this issue multiple times (${complaint.escalationLevel} escalations). Further delay may trigger media attention.`
        : `Respond within SLA to prevent escalation and citizen frustration.`,
    };
  };

  const openTimeline = async (c: Complaint) => {
    setSelected(c);
    setTimeline([]);
    setTimelineLoading(true);
    try {
      const res = await api.getComplaintTimeline(c.id);
      setTimeline(res.timeline);
    } catch (error) {
      toast({
        title: 'Unable to load timeline',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setTimelineLoading(false);
    }
  };

  const handleUpdateStatus = async (
    complaintId: string,
    status: 'acknowledged' | 'in_progress' | 'on_hold' | 'resolved',
    notes?: string
  ) => {
    if (!userProfile?.uid) return;
    setUpdatingId(complaintId);
    try {
      // Hackathon flow: only in_progress/resolved via v2 endpoint (timeline-backed).
      // Keep legacy endpoint for other internal statuses used by existing UI.
      const { complaint } =
        status === 'in_progress' || status === 'resolved'
          ? await api.updateComplaintStatusV2(complaintId, { status, note: notes })
          : await api.updateComplaintStatus(complaintId, {
            officialId: userProfile.uid,
            status,
            notes,
          });
      setComplaints((prev) => prev.map((c) => (c.id === complaint.id ? complaint : c)));
      toast({
        title: 'Status updated',
        description: `Marked as ${statusLabel(status)}`,
      });
    } catch (error) {
      toast({
        title: 'Update failed',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleResolve = async (complaintId: string) => {
    setUpdatingId(complaintId);
    try {
      await api.resolveComplaint(complaintId, 'Resolved by official');
      setComplaints((prev) =>
        prev.map((c) =>
          c.id === complaintId ? { ...c, status: 'resolved', escalationLevel: 0 } : c
        )
      );
      toast({
        title: 'Issue resolved',
        description: 'Marked as resolved and removed from escalation.',
      });
    } catch (error) {
      toast({
        title: 'Failed to resolve',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="nav-blur sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary glow-primary" />
              <span className="text-lg font-semibold">CivicFix AI</span>
              <span className="text-xs px-2 py-1 bg-warning/20 text-warning rounded-full font-medium">
                OFFICIAL
              </span>
              {/* Live Escalation Count for Hackathon Demo */}
              <span className={`text-xs px-2 py-1 bg-destructive/20 text-destructive rounded-full font-medium transition-all ${flash ? 'scale-125 animate-pulse' : ''
                }`}>
                🚨 Escalations: {liveEscalated}
              </span>
            </div>

            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="w-5 h-5" />
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-destructive rounded-full text-[10px] flex items-center justify-center">
                  0
                </span>
              </Button>

              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium">{userProfile?.displayName || 'Official'}</p>
                  <p className="text-xs text-muted-foreground">
                    {userProfile?.designation || 'Designation'} • {userProfile?.department || 'Department'}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-full bg-warning/20 flex items-center justify-center">
                  <User className="w-5 h-5 text-warning" />
                </div>
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                className="text-muted-foreground hover:text-destructive"
              >
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-2xl font-bold"
            >
              Official Dashboard
            </motion.h1>
            <p className="text-muted-foreground mt-1">
              {userProfile?.jurisdiction || 'Your Jurisdiction'} • {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="border-white/20">
              <BarChart3 className="w-4 h-4 mr-2" />
              View Reports
            </Button>
          </div>
        </div>

        {/* Error Banner */}
        {loadError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-lg bg-destructive/10 border border-destructive/20"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-destructive">Live sync interrupted</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {loadError} Showing cached data. Click refresh to retry.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setLoadError(null);
                  window.location.reload();
                }}
              >
                Refresh
              </Button>
            </div>
          </motion.div>
        )}

        {/* 🧠 AI PRIORITY BRIEF - DOMINATES VISUAL HIERARCHY */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-8 p-6 rounded-xl glass-panel border border-primary/30 shadow-lg shadow-primary/10"
        >
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/20">
                <Brain className="w-6 h-6 text-primary" />
              </div>
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                🧠 AI Priority Brief
                <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full">Live</span>
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                {aiPriorityBrief.nearingSLA > 0 && (
                  <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                    <p className="text-sm font-medium text-destructive">⚠️ {aiPriorityBrief.nearingSLA} issue{aiPriorityBrief.nearingSLA !== 1 ? 's' : ''} nearing SLA breach</p>
                    <p className="text-xs text-muted-foreground mt-1">Respond within 10 seconds</p>
                  </div>
                )}
                {aiPriorityBrief.escalated > 0 && (
                  <div className="p-3 rounded-lg bg-warning/5 border border-warning/20">
                    <p className="text-sm font-medium text-warning">🚨 {aiPriorityBrief.escalated} active escalation{aiPriorityBrief.escalated !== 1 ? 's' : ''}</p>
                    <p className="text-xs text-muted-foreground mt-1">Citizens have requested higher attention</p>
                  </div>
                )}
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <p className="text-sm font-medium text-primary">📋 Focus area: {aiPriorityBrief.focusArea}</p>
                  <p className="text-xs text-muted-foreground mt-1">Most common category among {aiPriorityBrief.total} issues</p>
                </div>
                <div className={`p-3 rounded-lg ${aiPriorityBrief.riskLevel === 'HIGH' ? 'bg-destructive/5 border border-destructive/20' : aiPriorityBrief.riskLevel === 'MEDIUM' ? 'bg-warning/5 border border-warning/20' : 'bg-success/5 border border-success/20'}`}>
                  <p className={`text-sm font-medium ${aiPriorityBrief.riskLevel === 'HIGH' ? 'text-destructive' : aiPriorityBrief.riskLevel === 'MEDIUM' ? 'text-warning' : 'text-success'}`}>🔴 Risk level: {aiPriorityBrief.riskLevel}</p>
                  <p className="text-xs text-muted-foreground mt-1">Citizen impact assessment</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statCards.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="glass-panel p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <stat.icon className={`w-5 h-5 text-${stat.color}`} />
                <span className={`text-2xl font-bold text-${stat.color}`}>{stat.value}</span>
              </div>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Performance Metrics */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-panel p-6 mb-8"
        >
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Performance Metrics</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {performanceMetrics.map((metric) => (
              <div key={metric.label} className="p-4 rounded-xl bg-white/5 border border-white/[0.06]">
                <p className="text-sm text-muted-foreground mb-2">{metric.label}</p>
                <p className="text-2xl font-bold font-mono">{metric.value}</p>
              </div>
            ))}
          </div>

          {aiBrief && (
            <div className="mt-6 p-4 rounded-xl bg-white/5 border border-primary/20">
              <p className="text-xs font-semibold text-primary mb-1">AI Briefing (Advisory)</p>
              <p className="text-sm text-muted-foreground whitespace-pre-line">{aiBrief}</p>
            </div>
          )}
        </motion.div>

        {/* Assigned Issues */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass-panel p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold">Assigned Issues</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search issues..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 text-sm bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Filter buttons */}
          <div className="flex gap-2 mb-6">
            <Button
              variant={filterStatus === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterStatus('all')}
            >
              All Issues
            </Button>
            <Button
              variant={filterStatus === 'pending' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterStatus('pending')}
            >
              Pending
            </Button>
            <Button
              variant={filterStatus === 'resolved' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterStatus('resolved')}
            >
              Resolved
            </Button>
          </div>

          {loading && (
            <div className="py-12 text-center text-muted-foreground">Loading assigned issues...</div>
          )}

          {!loading && sortedComplaints.length === 0 && (
            <div className="py-16 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/5 flex items-center justify-center">
                <FileText className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-2">No assigned issues</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                When citizens report issues in your jurisdiction, they will appear here for resolution.
              </p>
            </div>
          )}

          {!loading && sortedComplaints.length > 0 && (
            <div className="space-y-4">
              {sortedComplaints.map((complaint, idx) => {
                const isEscalated = complaint.escalationLevel > 0;
                const deadline = getDeadline(complaint);
                const timeRemaining = deadline ? deadline.getTime() - nowTick : null;
                const isCritical = timeRemaining && timeRemaining < 5000; // Red hot if < 5s

                return (
                  <motion.div
                    key={complaint.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className={`glass-panel p-4 transition-all ${isEscalated
                      ? 'border-2 border-destructive/50 shadow-lg shadow-destructive/20 bg-destructive/5'
                      : isCritical
                        ? 'border border-warning/50 shadow-md shadow-warning/10'
                        : 'border border-white/10'
                      }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold capitalize">{complaint.category}</span>
                          <span className={`text-xs font-medium uppercase ${severityColor(complaint.severity)}`}>
                            {complaint.severity}
                          </span>
                          {complaint.escalationLevel > 0 && (
                            <motion.span
                              key={`escalation-${complaint.id}-${complaint.escalationLevel}`}
                              initial={{ scale: 1.2, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              className={`text-xs font-medium ${getEscalationColor(complaint.escalationLevel)}`}
                            >
                              Escalated L{complaint.escalationLevel}
                            </motion.span>
                          )}
                          {complaint.status === 'sla_warning' && (
                            <span className="text-xs font-medium text-warning">SLA WARNING</span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{complaint.description}</p>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span>Priority: {complaint.priority}/10</span>
                          <span>Status: {statusLabel(complaint.status)}</span>
                          <span>Category: {complaint.category}</span>
                          <span>
                            {complaint.confidenceScore && complaint.confidenceScore > 0
                              ? `Confidence: ${(complaint.confidenceScore * 100).toFixed(0)}%`
                              : 'Confidence: Unavailable (AI Offline)'}
                          </span>
                          <span
                            className="text-primary font-semibold flex items-center gap-1 cursor-help"
                            title="AI suggests. System enforces. No silent failures."
                          >
                            🧠 AI Advisory
                          </span>
                          <span>
                            {(() => {
                              const deadline = getDeadline(complaint);
                              if (!deadline) {
                                return <span className="text-primary text-xs">Auto-Escalates every 10s (Demo)</span>;
                              }
                              const remaining = deadline.getTime() - nowTick;
                              return (
                                <span className={remaining < 0 ? 'text-destructive' : 'text-primary'}>
                                  Next escalation: {formatRemaining(remaining)}
                                </span>
                              );
                            })()}
                          </span>
                          <Button size="sm" variant="ghost" onClick={() => openTimeline(complaint)}>
                            View timeline
                          </Button>
                          {complaint.status !== 'resolved' && (
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleResolve(complaint.id)}
                              disabled={updatingId === complaint.id}
                            >
                              {updatingId === complaint.id ? 'Resolving...' : 'Resolve'}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* AI Explainability */}
                    {complaint.escalationLevel > 0 && (
                      <Collapsible
                        open={expandedIssues[complaint.id] || false}
                        onOpenChange={() => toggleExpanded(complaint.id)}
                        className="mt-4 pt-4 border-t border-white/10"
                      >
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-primary h-8">
                            <ChevronDown className={`w-3 h-3 mr-2 transition-transform ${expandedIssues[complaint.id] ? 'rotate-180' : ''}`} />
                            Why was this escalated?
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-3 space-y-2 text-xs">
                          <div className="p-3 rounded-lg bg-white/5">
                            <p className="text-muted-foreground mb-2"><strong>Escalation Journey:</strong></p>
                            <p className="text-muted-foreground">• L0→L1: SLA approached</p>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    )}

                    {/* AI Recommendation */}
                    <div className="mt-4 pt-4 border-t border-white/10">
                      <Button size="sm" variant="outline" onClick={() => setRecommendationModal({ isOpen: true, complaint })} className="text-xs">
                        🔍 Ask AI for Resolution Suggestion
                      </Button>
                    </div>

                    <div className="flex flex-wrap gap-2 mt-3">
                      {(['acknowledged', 'in_progress', 'on_hold', 'resolved'] as const).map((status) => (
                        <Button
                          key={status}
                          size="sm"
                          variant={complaint.status === status ? 'default' : 'outline'}
                          disabled={updatingId === complaint.id}
                          onClick={() => handleUpdateStatus(complaint.id, status)}
                        >
                          {statusLabel(status)}
                        </Button>
                      ))}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* Timeline Panel */}
        {selected && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel p-6 mt-6"
          >
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-semibold">Timeline</h3>
                <p className="text-xs text-muted-foreground">
                  Complaint {selected.id} • Status: {statusLabel(selected.status)}
                </p>
              </div>
              <Button variant="outline" onClick={() => setSelected(null)}>
                Close
              </Button>
            </div>

            {timelineLoading ? (
              <div className="py-8 text-center text-muted-foreground">Loading timeline...</div>
            ) : (timeline ?? []).length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">No timeline events yet.</div>
            ) : (
              <div className="space-y-3">
                {(timeline ?? []).map((e, idx) => (
                  <div key={idx} className="p-3 rounded-lg bg-white/5 border border-white/[0.06]">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-medium uppercase text-muted-foreground">{e.type}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(e.timestamp, 'Time unknown')}
                      </span>
                    </div>
                    <p className="text-sm mt-1">{e.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">Action: {e.action}</p>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Accountability Notice */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-6 p-4 rounded-xl bg-warning/5 border border-warning/10 flex items-start gap-3"
        >
          <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-warning font-medium">Accountability Notice</p>
            <p className="text-xs text-muted-foreground mt-1">
              All actions are logged. SLA breaches trigger automatic escalation. Resolution times affect your performance metrics.
            </p>
          </div>
        </motion.div>

        {/* AI Recommendation Modal */}
        <Dialog open={recommendationModal.isOpen} onOpenChange={(isOpen) => setRecommendationModal({ ...recommendationModal, isOpen })}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>🔍 AI Suggested Next Action</DialogTitle>
            </DialogHeader>
            {recommendationModal.complaint && (() => {
              const rec = generateAIRecommendation(recommendationModal.complaint);
              return (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                    <p className="text-sm font-semibold text-primary mb-2">Suggested Department Action</p>
                    <p className="text-sm text-muted-foreground">{rec.action}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                      <p className="text-xs font-medium text-muted-foreground">Urgency</p>
                      <p className={`text-sm font-bold mt-1 ${rec.urgency === 'CRITICAL' ? 'text-destructive' : rec.urgency === 'HIGH' ? 'text-warning' : 'text-primary'}`}>
                        {rec.urgency}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                      <p className="text-xs font-medium text-muted-foreground">Resolution Window</p>
                      <p className="text-sm font-bold mt-1 text-primary">{rec.window}</p>
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                    <p className="text-xs font-semibold text-destructive mb-1">⚠️ Risk if delayed:</p>
                    <p className="text-xs text-muted-foreground">{rec.risk}</p>
                  </div>
                  <p className="text-xs text-muted-foreground italic pt-2 border-t border-white/10">
                    This recommendation is based on escalation history, priority score, and SLA compliance. Human judgment is final.
                  </p>
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
