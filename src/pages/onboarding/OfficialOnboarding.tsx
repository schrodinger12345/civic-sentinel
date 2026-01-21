import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { OnboardingProgress } from '@/components/auth/OnboardingProgress';
import { AuthSpinner } from '@/components/auth/AuthSpinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import {
  User,
  Building2,
  Briefcase,
  MapPin,
  ArrowRight,
  ArrowLeft,
  AlertTriangle,
  Clock,
  TrendingUp,
  Shield,
  Brain,
  Scale,
  FileSearch,
  LayoutDashboard,
} from 'lucide-react';

const TOTAL_STEPS = 4;

export default function OfficialOnboarding() {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1 form data
  const [fullName, setFullName] = useState('');
  const [department, setDepartment] = useState('');
  const [designation, setDesignation] = useState('');
  const [jurisdiction, setJurisdiction] = useState('');

  // Step 2 acknowledgement
  const [acknowledged, setAcknowledged] = useState(false);

  const { user, userProfile, updateUserProfile, completeOnboarding, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Redirect checks
  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/auth', { replace: true });
      } else if (!userProfile?.role) {
        navigate('/role-selection', { replace: true });
      } else if (userProfile.role !== 'official') {
        navigate('/onboarding/citizen', { replace: true });
      } else if (userProfile.onboardingComplete) {
        navigate('/dashboard/official', { replace: true });
      }
    }
  }, [user, userProfile, authLoading, navigate]);

  // Pre-fill name from Google profile
  useEffect(() => {
    if (userProfile?.displayName && !fullName) {
      setFullName(userProfile.displayName);
    }
  }, [userProfile]);

  const handleStep1Continue = async () => {
    if (!fullName.trim() || !department.trim() || !designation.trim() || !jurisdiction.trim()) {
      toast({
        title: 'Required fields',
        description: 'Please fill in all fields.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      await updateUserProfile({
        displayName: fullName.trim(),
        department: department.trim(),
        designation: designation.trim(),
        jurisdiction: jurisdiction.trim(),
      });
      setCurrentStep(2);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save profile. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStep2Continue = () => {
    if (!acknowledged) {
      toast({
        title: 'Acknowledgement required',
        description: 'Please acknowledge your responsibilities to continue.',
        variant: 'destructive',
      });
      return;
    }
    setCurrentStep(3);
  };

  const handleStep3Continue = () => {
    setCurrentStep(4);
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      await completeOnboarding();
      navigate('/dashboard/official', { replace: true });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to complete setup. Please try again.',
        variant: 'destructive',
      });
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <AuthSpinner size="lg" text="Loading..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background system-grid relative overflow-hidden flex items-center justify-center p-6">
      {/* Ambient Glows */}
      <div className="ambient-glow ambient-glow-tl" />
      <div className="ambient-glow ambient-glow-br" />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="w-full max-w-xl"
      >
        {/* Progress */}
        <div className="mb-10">
          <OnboardingProgress
            currentStep={currentStep}
            totalSteps={TOTAL_STEPS}
            stepLabels={['Identity', 'Responsibility', 'Overview', 'Start']}
          />
        </div>

        {/* Step Content */}
        <AnimatePresence mode="wait">
          {currentStep === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="glass-panel p-8"
            >
              <h2 className="text-2xl font-bold mb-2">Identity & Role Verification</h2>
              <p className="text-muted-foreground mb-6">
                This information is used for accountability and escalation routing.
              </p>

              <div className="p-3 rounded-lg bg-warning/10 border border-warning/20 mb-6">
                <p className="text-xs text-warning flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  All actions under your account are logged and auditable.
                </p>
              </div>

              <div className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-sm">Full Name *</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="fullName"
                      placeholder="Your full name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="pl-10 h-12 bg-white/5 border-white/10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="department" className="text-sm">Department *</Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="department"
                      placeholder="e.g., Public Works, Sanitation"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className="pl-10 h-12 bg-white/5 border-white/10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="designation" className="text-sm">Designation *</Label>
                  <div className="relative">
                    <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="designation"
                      placeholder="e.g., Junior Engineer, Ward Officer"
                      value={designation}
                      onChange={(e) => setDesignation(e.target.value)}
                      className="pl-10 h-12 bg-white/5 border-white/10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="jurisdiction" className="text-sm">Jurisdiction (City / Ward) *</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="jurisdiction"
                      placeholder="e.g., Mumbai - Ward 45"
                      value={jurisdiction}
                      onChange={(e) => setJurisdiction(e.target.value)}
                      className="pl-10 h-12 bg-white/5 border-white/10"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-8 flex justify-end">
                <Button
                  onClick={handleStep1Continue}
                  disabled={loading}
                  className="h-12 px-6 bg-primary hover:bg-primary/90"
                >
                  {loading ? <AuthSpinner size="sm" /> : (
                    <>
                      Continue
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          )}

          {currentStep === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="glass-panel p-8"
            >
              <h2 className="text-2xl font-bold mb-2 text-warning">Responsibility Acknowledgement</h2>
              <p className="text-muted-foreground mb-6">
                Please read and acknowledge your responsibilities as a government official on this platform.
              </p>

              <div className="space-y-4 mb-8">
                {[
                  {
                    icon: AlertTriangle,
                    title: 'Accountability for Assigned Issues',
                    description: 'You are personally accountable for resolving all issues assigned to you within SLA deadlines.',
                  },
                  {
                    icon: Clock,
                    title: 'SLA Monitoring',
                    description: 'Service Level Agreements are actively monitored. Missed deadlines are automatically flagged.',
                  },
                  {
                    icon: TrendingUp,
                    title: 'Automatic Escalation',
                    description: 'If issues are not addressed in time, they automatically escalate to higher authorities.',
                  },
                  {
                    icon: Shield,
                    title: 'Performance Tracking',
                    description: 'Your resolution times, escalation rates, and overall performance are tracked and transparent.',
                  },
                ].map((item, index) => (
                  <motion.div
                    key={item.title}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-start gap-4 p-4 rounded-xl bg-warning/5 border border-warning/10"
                  >
                    <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center flex-shrink-0">
                      <item.icon className="w-5 h-5 text-warning" />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-1">{item.title}</h3>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="flex items-start gap-3 p-4 rounded-xl bg-white/5 border border-white/10 mb-6">
                <Checkbox
                  id="acknowledge"
                  checked={acknowledged}
                  onCheckedChange={(checked) => setAcknowledged(checked as boolean)}
                  className="mt-0.5"
                />
                <Label htmlFor="acknowledge" className="text-sm cursor-pointer leading-relaxed">
                  I understand and accept my responsibilities as a government official on CivicFix AI.
                  I acknowledge that my actions and performance will be monitored and tracked.
                </Label>
              </div>

              <div className="flex justify-between">
                <Button
                  variant="ghost"
                  onClick={() => setCurrentStep(1)}
                  className="h-12"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button
                  onClick={handleStep2Continue}
                  disabled={!acknowledged}
                  className={`h-12 px-6 ${acknowledged ? 'bg-primary hover:bg-primary/90' : 'bg-white/10 cursor-not-allowed'}`}
                >
                  I Accept
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </motion.div>
          )}

          {currentStep === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="glass-panel p-8"
            >
              <h2 className="text-2xl font-bold mb-2">System Overview</h2>
              <p className="text-muted-foreground mb-8">
                How CivicFix AI manages issue resolution.
              </p>

              <div className="space-y-4">
                {[
                  {
                    icon: Brain,
                    title: 'AI Prioritization',
                    description: 'Issues are automatically prioritized by AI based on severity, impact, and urgency. You cannot manually override priority.',
                    color: 'primary',
                  },
                  {
                    icon: Scale,
                    title: 'Escalation Logic',
                    description: 'SLA breaches trigger automatic escalation. 24hr → Supervisor, 48hr → Department Head, 72hr → Commissioner.',
                    color: 'warning',
                  },
                  {
                    icon: FileSearch,
                    title: 'Transparent Audit Trail',
                    description: 'Every action, status change, and communication is logged. Citizens can view the complete history.',
                    color: 'success',
                  },
                ].map((item, index) => (
                  <motion.div
                    key={item.title}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-start gap-4 p-4 rounded-xl bg-white/5 border border-white/[0.06]"
                  >
                    <div className={`w-10 h-10 rounded-lg bg-${item.color}/10 flex items-center justify-center flex-shrink-0`}>
                      <item.icon className={`w-5 h-5 text-${item.color}`} />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-1">{item.title}</h3>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="mt-6 p-4 rounded-xl bg-primary/5 border border-primary/20">
                <p className="text-sm text-primary/80">
                  <strong>Note:</strong> The goal is not to punish officials, but to ensure accountability and build public trust through transparency.
                </p>
              </div>

              <div className="mt-8 flex justify-between">
                <Button
                  variant="ghost"
                  onClick={() => setCurrentStep(2)}
                  className="h-12"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button
                  onClick={handleStep3Continue}
                  className="h-12 px-6 bg-primary hover:bg-primary/90"
                >
                  Continue
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </motion.div>
          )}

          {currentStep === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="glass-panel p-8 text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.2 }}
                className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center"
              >
                <div className="w-10 h-10 rounded-xl bg-primary glow-primary flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-primary-foreground" />
                </div>
              </motion.div>

              <h2 className="text-2xl font-bold mb-2">Welcome, {fullName.split(' ')[0]}!</h2>
              <p className="text-muted-foreground mb-2">
                You're ready to start managing civic issues.
              </p>
              <p className="text-sm text-primary mb-8">
                {designation} • {department}
              </p>

              <Button
                onClick={handleComplete}
                disabled={loading}
                className="h-12 px-8 bg-primary hover:bg-primary/90"
              >
                {loading ? <AuthSpinner size="sm" /> : (
                  <>
                    <LayoutDashboard className="w-4 h-4 mr-2" />
                    Enter Official Dashboard
                  </>
                )}
              </Button>

              <button
                onClick={() => setCurrentStep(3)}
                className="mt-6 text-sm text-muted-foreground hover:text-foreground block mx-auto"
              >
                <ArrowLeft className="w-3 h-3 inline mr-1" />
                Go back
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
