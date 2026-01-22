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
} from 'lucide-react';
import { api } from '@/lib/api';
import { Complaint, OfficialStats, TimelineEvent } from '@/types/complaint';
import { useToast } from '@/hooks/use-toast';
import { normalizeDate, formatDate } from '@/lib/dateUtils';

export default function OfficialDashboard() {
  const { userProfile, logout } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [stats, setStats] = useState<OfficialStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState(Date.now());
  const [selected, setSelected] = useState<Complaint | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [aiBrief, setAIBrief] = useState<string | null>(null);
  const [liveEscalated, setLiveEscalated] = useState(0);
  const [flash, setFlash] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  useEffect(() => {
    const loadData = async () => {
      if (!userProfile?.uid) return;
      setLoading(true);
      setLoadError(null);
      try {
        const [{ complaints }, { stats }, aiBriefRes] = await Promise.all([
          api.getOfficialComplaints(userProfile.department || userProfile.uid),
          api.getOfficialStats(userProfile.uid),
          api
            .getOfficialAIBrief(userProfile.uid)
            .catch(() => ({ success: false, brief: '' } as { success: boolean; brief: string })),
        ]);
        // 🔥 DEFENSIVE: Always ensure we have an array
        setComplaints(complaints ?? []);
        setStats(stats);
        if (aiBriefRes?.brief) {
          setAIBrief(aiBriefRes.brief);
        }
      } catch (error) {
        console.error('Failed to load official data:', error);
        // 🔥 DEFENSIVE: Preserve existing list on error, show banner
        setLoadError(error instanceof Error ? error.message : 'Unable to connect to server.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [userProfile?.uid, toast]);

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

  const filteredComplaints = useMemo(() => {
    // 🔥 DEFENSIVE: Ensure we always work with an array
    const safeComplaints = complaints ?? [];
    const term = search.toLowerCase();
    if (!term) return safeComplaints;
    return safeComplaints.filter((c) =>
      [c.description, c.issueType, c.assignedDepartment]
        .filter(Boolean)
        .some((field) => field?.toLowerCase().includes(term))
    );
  }, [complaints, search]);

  const statCards = useMemo(() => {
    // 🔥 DEFENSIVE: Ensure we always work with an array
    const safeComplaints = complaints ?? [];
    const assigned = stats?.byStatus.assigned ?? 0;
    const dueToday = safeComplaints.filter((c) => c.status !== 'resolved').length;
    const resolved = stats?.byStatus.resolved ?? 0;
    const escalated = stats?.escalated ?? 0;
    return [
      { label: 'Assigned Issues', value: assigned, icon: FileText, color: 'primary' },
      { label: 'Due Today', value: dueToday, icon: Clock, color: 'warning' },
      { label: 'Resolved', value: resolved, icon: CheckCircle2, color: 'success' },
      { label: 'Escalated', value: escalated, icon: AlertTriangle, color: 'destructive' },
    ];
  }, [stats, complaints]);

  const performanceMetrics = useMemo(
    () => [
      { label: 'Avg. Resolution Time', value: stats ? `${stats.averageResolutionTime}h` : '--' },
      { label: 'SLA Compliance', value: stats ? `${stats.slaCompliance}%` : '--' },
      { label: 'Escalation Rate', value: stats ? `${stats.escalated} active` : '--' },
    ],
    [stats]
  );

  const severityColor = (severity: string) => {
    if (severity === 'critical') return 'text-destructive';
    if (severity === 'high') return 'text-warning';
    if (severity === 'medium') return 'text-primary';
    return 'text-muted-foreground';
  };

  const statusLabel = (status: Complaint['status']) => status.replace('_', ' ');

  // 🔥 AGENTIC STATE MACHINE: Read nextEscalationAt directly, DO NOT compute
  const getDeadline = (c: Complaint) => {
    // Use authoritative nextEscalationAt field only
    return normalizeDate(c.nextEscalationAt);
  };

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

          {loading ? (
            <div className="py-12 text-center text-muted-foreground">Loading assigned issues...</div>
          ) : filteredComplaints.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/5 flex items-center justify-center">
                <FileText className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-2">No assigned issues</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                When citizens report issues in your jurisdiction, they will appear here for resolution.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredComplaints.map((complaint) => (
                <div key={complaint.id} className="glass-panel p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold capitalize">{complaint.issueType}</span>
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
                        <span>Dept: {complaint.assignedDepartment}</span>
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
                      </div>
                    </div>
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
                </div>
              ))}
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
      </main>
    </div>
  );
}
