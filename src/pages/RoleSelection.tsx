import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { RoleCard } from '@/components/auth/RoleCard';
import { AuthSpinner } from '@/components/auth/AuthSpinner';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Users, Building2, ArrowRight } from 'lucide-react';

export default function RoleSelection() {
  const [selectedRole, setSelectedRole] = useState<'citizen' | 'official' | null>(null);
  const [loading, setLoading] = useState(false);

  const { user, userProfile, setUserRole, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Redirect if no user or already has role
  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/auth', { replace: true });
      } else if (userProfile?.role) {
        // Already has role, redirect to appropriate flow
        if (userProfile.onboardingComplete) {
          const dashboard = userProfile.role === 'citizen' ? '/dashboard/citizen' : '/dashboard/official';
          navigate(dashboard, { replace: true });
        } else {
          const onboarding = userProfile.role === 'citizen' ? '/onboarding/citizen' : '/onboarding/official';
          navigate(onboarding, { replace: true });
        }
      }
    }
  }, [user, userProfile, authLoading, navigate]);

  const handleContinue = async () => {
    if (!selectedRole) {
      toast({
        title: 'Please select a role',
        description: 'Choose how you will use CivicFix AI to continue.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      await setUserRole(selectedRole);
      const onboarding = selectedRole === 'citizen' ? '/onboarding/citizen' : '/onboarding/official';
      navigate(onboarding, { replace: true });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save your selection. Please try again.',
        variant: 'destructive',
      });
    } finally {
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
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-3xl"
      >
        {/* Header */}
        <div className="text-center mb-10">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-6"
          >
            <div className="w-8 h-8 rounded-lg bg-primary glow-primary" />
          </motion.div>

          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
            How will you use <span className="text-primary text-glow-primary">CivicFix AI</span>?
          </h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            Select your role to personalize your experience and access the right tools.
          </p>
        </div>

        {/* Role Cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-10">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <RoleCard
              icon={Users}
              title="Citizen"
              description="Report civic issues and track their resolution transparently. AI ensures your complaints are never ignored."
              selected={selectedRole === 'citizen'}
              onClick={() => setSelectedRole('citizen')}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
          >
            <RoleCard
              icon={Building2}
              title="Government Official"
              description="Manage and resolve assigned issues. Be accountable with SLA monitoring and transparent performance tracking."
              selected={selectedRole === 'official'}
              onClick={() => setSelectedRole('official')}
            />
          </motion.div>
        </div>

        {/* Continue Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="flex justify-center"
        >
          <Button
            onClick={handleContinue}
            disabled={!selectedRole || loading}
            className="h-12 px-8 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
          >
            {loading ? (
              <AuthSpinner size="sm" />
            ) : (
              <>
                Continue
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </motion.div>

        {/* User info */}
        {userProfile && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-8 text-center text-sm text-muted-foreground"
          >
            Signed in as{' '}
            <span className="text-foreground font-medium">
              {userProfile.displayName || userProfile.email}
            </span>
          </motion.p>
        )}
      </motion.div>
    </div>
  );
}
