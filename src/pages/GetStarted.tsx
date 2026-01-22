import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { AuthSpinner } from '@/components/auth/AuthSpinner';
import { Users, Building2, ArrowRight, Shield } from 'lucide-react';

export default function GetStarted() {
  const { user, userProfile, loading } = useAuth();
  const navigate = useNavigate();

  // If user is already logged in, redirect to appropriate page
  useEffect(() => {
    if (!loading && user && userProfile) {
      if (userProfile.onboardingComplete) {
        const dashboard = userProfile.role === 'citizen' ? '/dashboard/citizen' : '/dashboard/official';
        navigate(dashboard, { replace: true });
      } else if (userProfile.role) {
        const onboarding = userProfile.role === 'citizen' ? '/onboarding/citizen' : '/onboarding/official';
        navigate(onboarding, { replace: true });
      }
    }
  }, [user, userProfile, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <AuthSpinner size="lg" text="Loading..." />
      </div>
    );
  }

  const roleOptions = [
    {
      id: 'citizen',
      icon: Users,
      title: 'Citizen',
      description: 'Report civic issues and track their resolution. Your complaints will never be ignored.',
      path: '/auth?role=citizen',
      gradient: 'from-blue-500/20 to-cyan-500/20',
      iconColor: 'text-cyan-400',
    },
    {
      id: 'official',
      icon: Building2,
      title: 'Government Official',
      description: 'Access your dashboard to manage and resolve assigned civic issues.',
      path: '/auth/official',
      gradient: 'from-amber-500/20 to-orange-500/20',
      iconColor: 'text-amber-400',
    },
  ];

  return (
    <div className="min-h-screen bg-background system-grid relative overflow-hidden flex items-center justify-center p-6">
      {/* Ambient Glows */}
      <div className="ambient-glow ambient-glow-tl" />
      <div className="ambient-glow ambient-glow-br" />

      {/* Animated grid background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              radial-gradient(circle at 20% 50%, hsla(173, 77%, 54%, 0.03) 0%, transparent 50%),
              radial-gradient(circle at 80% 50%, hsla(173, 77%, 54%, 0.02) 0%, transparent 50%)
            `,
          }}
          animate={{
            backgroundPosition: ['0% 0%', '100% 100%'],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            repeatType: 'reverse',
          }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-4xl"
      >
        {/* Header */}
        <div className="text-center mb-12">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
            className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 mb-6"
          >
            <Shield className="w-10 h-10 text-primary" />
          </motion.div>

          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            Welcome to <span className="text-primary text-glow-primary">CivicFix AI</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Choose how you'd like to get started. Select your role to continue.
          </p>
        </div>

        {/* Role Cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-10">
          {roleOptions.map((option, index) => (
            <motion.button
              key={option.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + index * 0.1 }}
              onClick={() => navigate(option.path)}
              className="group relative glass-panel p-8 text-left hover:border-primary/50 transition-all duration-300 cursor-pointer"
            >
              {/* Gradient overlay on hover */}
              <div
                className={`absolute inset-0 bg-gradient-to-br ${option.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl`}
              />

              <div className="relative">
                {/* Icon */}
                <div className="w-14 h-14 rounded-xl bg-white/5 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                  <option.icon className={`w-7 h-7 ${option.iconColor}`} />
                </div>

                {/* Content */}
                <h2 className="text-xl font-semibold text-foreground mb-3 flex items-center gap-2">
                  {option.title}
                  <ArrowRight className="w-5 h-5 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
                </h2>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {option.description}
                </p>
              </div>
            </motion.button>
          ))}
        </div>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-center text-xs text-muted-foreground"
        >
          By continuing, you agree to CivicFix AI's Terms of Service and Privacy Policy.
        </motion.p>
      </motion.div>
    </div>
  );
}
