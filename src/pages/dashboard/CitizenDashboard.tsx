import { useEffect } from 'react';
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
} from 'lucide-react';

export default function CitizenDashboard() {
  const { userProfile, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Handle report action from onboarding
  useEffect(() => {
    if (searchParams.get('action') === 'report') {
      // Could open report modal here
    }
  }, [searchParams]);

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  // Mock data for demonstration
  const stats = [
    { label: 'Total Complaints', value: 0, icon: FileText, color: 'primary' },
    { label: 'Pending', value: 0, icon: Clock, color: 'warning' },
    { label: 'Resolved', value: 0, icon: CheckCircle2, color: 'success' },
    { label: 'Escalated', value: 0, icon: AlertCircle, color: 'destructive' },
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

          <Button className="bg-primary hover:bg-primary/90 h-11">
            <Plus className="w-4 h-4 mr-2" />
            Report New Issue
          </Button>
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

        {/* Recent Complaints */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass-panel p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold">Your Complaints</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search..."
                className="pl-9 pr-4 py-2 text-sm bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Empty state */}
          <div className="py-16 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/5 flex items-center justify-center">
              <FileText className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-2">No complaints yet</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
              Report your first civic issue and CivicFix AI will ensure it gets resolved.
            </p>
            <Button className="bg-primary hover:bg-primary/90">
              <Plus className="w-4 h-4 mr-2" />
              Report an Issue
            </Button>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
