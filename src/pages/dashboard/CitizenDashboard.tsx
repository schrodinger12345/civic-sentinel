import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  Plus,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  LogOut,
  User,
  Bell,
  Search,
  MapPin,
  AlertTriangle,
} from 'lucide-react';
import { Complaint, TimelineEvent } from '@/types/complaint';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { normalizeDate, formatDate, formatRelativeTime } from '@/lib/dateUtils';
import { KanbanBoard } from '@/components/kanban/KanbanBoard';
import { AiChatWidget } from '@/components/ai/AiChatWidget';

export default function CitizenDashboard() {
  const { userProfile, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [nowTick, setNowTick] = useState(Date.now());
  const [selected, setSelected] = useState<Complaint | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

  // Geolocation state
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationName, setLocationName] = useState<string>('');
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationLoading, setLocationLoading] = useState(true);

  // Request geolocation on mount
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser');
      setLocationLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const coords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setCoordinates(coords);
        setLocationError(null);

        // Reverse geocode to get address
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.latitude}&lon=${coords.longitude}&zoom=18&addressdetails=1`,
            { headers: { 'User-Agent': 'CivicFixAI/1.0' } }
          );
          const data = await response.json();
          const address = data.display_name || `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`;
          setLocationName(address);
        } catch {
          setLocationName(`${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`);
        }
        setLocationLoading(false);
      },
      (error) => {
        console.error('Geolocation error:', error);
        setLocationError('Location access is required to submit reports. Please enable location permissions.');
        setLocationLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  // Handle report action from onboarding - redirect to report page
  useEffect(() => {
    if (searchParams.get('action') === 'report') {
      navigate('/report');
    }
  }, [searchParams, navigate]);

  useEffect(() => {
    const fetchComplaints = async (isBackground = false) => {
      if (!userProfile?.uid) {
        console.log('🔍 No userProfile.uid, skipping fetch');
        return;
      }
      if (!isBackground) setLoading(true);
      try {
        const result = await api.getCitizenComplaints(userProfile.uid);
        // 🔥 DEFENSIVE: Always ensure we have an array
        setComplaints(result?.complaints ?? []);
        setLoadError(null);
      } catch (error) {
        console.error('❌ Failed to fetch complaints:', error);
        // Only show toast error on initial load, not polling
        if (!isBackground) {
          toast({
            title: 'Could not load complaints',
            description: error instanceof Error ? error.message : 'Please try again.',
            variant: 'destructive',
          });
          setLoadError(error instanceof Error ? error.message : 'Unable to load complaints');
        }
      } finally {
        if (!isBackground) setLoading(false);
      }
    };

    fetchComplaints();

    // Poll for updates every 5 seconds (Citizen needs to see real-time officer moves)
    const interval = setInterval(() => fetchComplaints(true), 5000);
    return () => clearInterval(interval);
  }, [userProfile?.uid, toast]);

  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  const filteredComplaints = useMemo(() => {
    // 🔥 DEFENSIVE: Ensure we always work with an array
    const safeComplaints = Array.isArray(complaints) ? complaints : [];
    const term = search.toLowerCase();
    if (!term) return safeComplaints;
    return safeComplaints.filter((c) =>
      [c.description, c.category, c.title]
        .filter(Boolean)
        .some((field) => field?.toLowerCase().includes(term))
    );
  }, [complaints, search]);

  const stats = useMemo(() => {
    // 🔥 DEFENSIVE: Ensure we always work with an array
    const safeComplaints = Array.isArray(complaints) ? complaints : [];
    const total = safeComplaints.length;
    const resolved = safeComplaints.filter((c) => c.status === 'resolved').length;
    const escalated = safeComplaints.filter((c) => c.escalationLevel > 0 || c.status === 'escalated').length;
    const pending = total - resolved;
    return [
      { label: 'Total Complaints', value: total, icon: FileText, color: 'primary' },
      { label: 'Pending', value: pending, icon: Clock, color: 'warning' },
      { label: 'Resolved', value: resolved, icon: CheckCircle2, color: 'success' },
      { label: 'Escalated', value: escalated, icon: AlertCircle, color: 'destructive' },
    ];
  }, [complaints]);

  const severityColor = (severity: string) => {
    if (severity === 'critical') return 'text-destructive';
    if (severity === 'high') return 'text-warning';
    if (severity === 'medium') return 'text-primary';
    return 'text-muted-foreground';
  };

  const statusLabel = (status: Complaint['status']) => status.replace('_', ' ');

  // 🔥 SLA: Use ONLY nextEscalationAt (backend authoritative source)
  const getDeadline = (c: Complaint) => {
    if (!c.nextEscalationAt) {
      return null;
    }
    const date = normalizeDate(c.nextEscalationAt);
    return date;
  };

  const getEscalationColor = (level: number) => {
    if (level === 0) return 'text-muted-foreground';
    if (level === 1) return 'text-yellow-400';
    if (level === 2) return 'text-orange-400';
    return 'text-red-400';
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
      setTimeline(res?.timeline ?? []);
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

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="nav-blur sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary glow-primary" />
              <span className="text-lg font-semibold">CivicFix AI</span>
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
                  <p className="text-sm font-medium">{userProfile?.displayName || 'Citizen'}</p>
                  <p className="text-xs text-muted-foreground">{userProfile?.city || 'Location'}</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <User className="w-5 h-5 text-primary" />
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
              Welcome back, {userProfile?.displayName?.split(' ')[0] || 'Citizen'}!
            </motion.h1>
            <p className="text-muted-foreground mt-1">
              Track your complaints and report new issues.
            </p>
          </div>

          <Button className="bg-primary hover:bg-primary/90 h-11" onClick={() => navigate('/report')}>
            <Plus className="w-4 h-4 mr-2" />
            Report New Issue
          </Button>
        </div>

        {/* Location Status Banner */}
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

        {locationError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-3"
          >
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-400">Location Required</p>
              <p className="text-xs text-muted-foreground">{locationError}</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.location.reload()}
              className="text-xs"
            >
              Retry
            </Button>
          </motion.div>
        )}

        {coordinates && !locationError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-3 rounded-lg bg-green-500/10 border border-green-500/30 flex items-center gap-2"
          >
            <MapPin className="w-4 h-4 text-green-400" />
            <span className="text-xs text-green-400 font-medium">Location Active:</span>
            <span className="text-xs text-muted-foreground truncate flex-1">{locationName}</span>
          </motion.div>
        )}

        {loadError && !loading && (
          <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-200">
            Unable to load complaints. Please retry.
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map((stat, index) => (
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

        {/* Complaint Board */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass-panel p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold">Your Complaint Board</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 text-sm bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          {loading ? (
             <div className="py-12 text-center text-muted-foreground">Loading board...</div>
          ) : (
            <div className="min-h-[500px]">
                <KanbanBoard
                   complaints={filteredComplaints}
                   onDragEnd={() => {}} // No-op for read-only
                   onView={openTimeline}
                   isDragEnabled={false} // READ-ONLY MODE
                   showCitizenName={false}
                   columnTitles={{
                     todo: 'Submitted Complaints',
                     in_progress: 'In Progress',
                     done: 'Resolved'
                   }}
                />
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
                        {formatDate(e.timestamp)}
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
      </main>
      
      {/* AI Chat Widget */}
      <AiChatWidget />
    </div>
  );
}
