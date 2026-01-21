import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { OnboardingProgress } from '@/components/auth/OnboardingProgress';
import { AuthSpinner } from '@/components/auth/AuthSpinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  User,
  MapPin,
  Phone,
  ArrowRight,
  ArrowLeft,
  Shield,
  Eye,
  Zap,
  FileText,
  LayoutDashboard,
} from 'lucide-react';

const TOTAL_STEPS = 3;

export default function CitizenOnboarding() {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1 form data
  const [fullName, setFullName] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');

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
      } else if (userProfile.role !== 'citizen') {
        navigate('/onboarding/official', { replace: true });
      } else if (userProfile.onboardingComplete) {
        navigate('/dashboard/citizen', { replace: true });
      }
    }
  }, [user, userProfile, authLoading, navigate]);

  // Pre-fill name from Google profile
  useEffect(() => {
    if (userProfile?.displayName && !fullName) {
      setFullName(userProfile.displayName);
    }
  }, [userProfile]);

  // Try to detect location
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          // In production, reverse geocode this. For now, just show coordinates
          setLocation(`${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`);
        },
        () => {
          // Silently fail if location access denied
        }
      );
    }
  }, []);

  const handleStep1Continue = async () => {
    if (!fullName.trim() || !city.trim()) {
      toast({
        title: 'Required fields',
        description: 'Please enter your name and city.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      await updateUserProfile({
        displayName: fullName.trim(),
        city: city.trim(),
        phone: phone.trim() || undefined,
        location: location.trim() || undefined,
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
    setCurrentStep(3);
  };

  const handleComplete = async (action: 'report' | 'dashboard') => {
    setLoading(true);
    try {
      await completeOnboarding();
      if (action === 'report') {
        // For now, redirect to dashboard with query param
        navigate('/dashboard/citizen?action=report', { replace: true });
      } else {
        navigate('/dashboard/citizen', { replace: true });
      }
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
            stepLabels={['Profile', 'How It Works', 'Get Started']}
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
              <h2 className="text-2xl font-bold mb-2">Tell us about yourself</h2>
              <p className="text-muted-foreground mb-8">
                This helps us personalize your experience.
              </p>

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
                  <Label htmlFor="city" className="text-sm">City *</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="city"
                      placeholder="Your city"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="pl-10 h-12 bg-white/5 border-white/10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-sm">Phone Number (Optional)</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+91 XXXXX XXXXX"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="pl-10 h-12 bg-white/5 border-white/10"
                    />
                  </div>
                </div>

                {location && (
                  <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                    <p className="text-xs text-muted-foreground mb-1">Detected Location</p>
                    <p className="text-sm font-mono">{location}</p>
                  </div>
                )}
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
              <h2 className="text-2xl font-bold mb-2">How CivicFix AI Works</h2>
              <p className="text-muted-foreground mb-8">
                Understanding your role in the system.
              </p>

              <div className="space-y-4">
                {[
                  {
                    icon: Shield,
                    title: 'AI Takes Ownership',
                    description: 'Once submitted, CivicFix AI owns your complaint. No follow-ups required from your side.',
                    color: 'primary',
                  },
                  {
                    icon: Eye,
                    title: 'Real-Time Monitoring',
                    description: 'AI continuously monitors progress and SLA compliance for every complaint.',
                    color: 'primary',
                  },
                  {
                    icon: Zap,
                    title: 'Automatic Escalation',
                    description: 'If deadlines are missed, the system automatically escalates to higher authorities.',
                    color: 'warning',
                  },
                  {
                    icon: FileText,
                    title: 'Full Transparency',
                    description: 'Track every action taken on your complaint. Everything is logged and auditable.',
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

              <div className="mt-8 flex justify-between">
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
                  className="h-12 px-6 bg-primary hover:bg-primary/90"
                >
                  I Understand
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
              className="glass-panel p-8 text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.2 }}
                className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-success/10 flex items-center justify-center"
              >
                <div className="w-10 h-10 rounded-xl bg-success glow-success flex items-center justify-center">
                  <svg className="w-6 h-6 text-success-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </motion.div>

              <h2 className="text-2xl font-bold mb-2">You're All Set!</h2>
              <p className="text-muted-foreground mb-8 max-w-sm mx-auto">
                Report your first civic issue or explore your dashboard.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  onClick={() => handleComplete('report')}
                  disabled={loading}
                  className="h-12 px-6 bg-primary hover:bg-primary/90"
                >
                  {loading ? <AuthSpinner size="sm" /> : (
                    <>
                      <FileText className="w-4 h-4 mr-2" />
                      Report an Issue
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleComplete('dashboard')}
                  disabled={loading}
                  className="h-12 px-6 border-white/20 hover:bg-white/5"
                >
                  <LayoutDashboard className="w-4 h-4 mr-2" />
                  Go to Dashboard
                </Button>
              </div>

              <button
                onClick={() => setCurrentStep(2)}
                className="mt-6 text-sm text-muted-foreground hover:text-foreground"
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
