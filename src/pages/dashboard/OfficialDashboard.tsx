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

export default function OfficialDashboard() {
  const { userProfile, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  // Mock data for demonstration
  const stats = [
    { label: 'Assigned Issues', value: 0, icon: FileText, color: 'primary' },
    { label: 'Due Today', value: 0, icon: Clock, color: 'warning' },
    { label: 'Resolved', value: 0, icon: CheckCircle2, color: 'success' },
    { label: 'Escalated', value: 0, icon: AlertTriangle, color: 'destructive' },
  ];

  const performanceMetrics = [
    { label: 'Avg. Resolution Time', value: '--', change: null },
    { label: 'SLA Compliance', value: '--', change: null },
    { label: 'Escalation Rate', value: '--', change: null },
  ];

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
                className="pl-9 pr-4 py-2 text-sm bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Empty state */}
          <div className="py-16 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/5 flex items-center justify-center">
              <FileText className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-2">No assigned issues</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              When citizens report issues in your jurisdiction, they will appear here for resolution.
            </p>
          </div>
        </motion.div>

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
