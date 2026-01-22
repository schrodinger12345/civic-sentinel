import { useState } from 'react';
import { useNavigate, useLocation, useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { AuthSpinner } from '@/components/auth/AuthSpinner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Mail, Lock, Eye, EyeOff, ArrowLeft, Users } from 'lucide-react';

export default function AuthGateway() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const { loginWithEmail, signUpWithEmail, loginWithGoogle, userProfile, setUserRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const from = (location.state as any)?.from?.pathname || '/';
  const isCitizenFlow = searchParams.get('role') === 'citizen';

  // Handle redirect after auth
  const handleAuthSuccess = async () => {
    // If coming from citizen flow, set role automatically
    if (isCitizenFlow) {
      try {
        await setUserRole('citizen');
        navigate('/onboarding/citizen', { replace: true });
        return;
      } catch (error) {
        console.error('Error setting citizen role:', error);
      }
    }
    
    // Will be redirected by the routing logic based on profile state
    if (userProfile?.onboardingComplete) {
      const dashboard = userProfile.role === 'citizen' ? '/dashboard/citizen' : '/dashboard/official';
      navigate(dashboard, { replace: true });
    } else if (userProfile?.role) {
      const onboarding = userProfile.role === 'citizen' ? '/onboarding/citizen' : '/onboarding/official';
      navigate(onboarding, { replace: true });
    } else {
      navigate('/role-selection', { replace: true });
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({
        title: 'Missing fields',
        description: 'Please enter both email and password.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        await loginWithEmail(email, password);
      } else {
        await signUpWithEmail(email, password);
      }
      // Small delay to allow profile to be created/fetched
      setTimeout(handleAuthSuccess, 500);
    } catch (error: any) {
      let message = 'An error occurred. Please try again.';
      if (error.code === 'auth/invalid-credential') {
        message = 'Invalid email or password.';
      } else if (error.code === 'auth/email-already-in-use') {
        message = 'This email is already registered. Please login.';
      } else if (error.code === 'auth/weak-password') {
        message = 'Password should be at least 6 characters.';
      } else if (error.code === 'auth/invalid-email') {
        message = 'Please enter a valid email address.';
      }
      toast({
        title: isLogin ? 'Login failed' : 'Sign up failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setLoading(true);
    try {
      await loginWithGoogle();
      setTimeout(handleAuthSuccess, 500);
    } catch (error: any) {
      if (error.code !== 'auth/popup-closed-by-user') {
        toast({
          title: 'Google sign-in failed',
          description: 'Unable to complete Google sign-in. Please try again.',
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  };

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
        className="w-full max-w-md relative"
      >
        {/* Back Button */}
        <Link
          to="/get-started"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to role selection
        </Link>

        {/* Auth Card */}
        <div className="glass-panel p-8 md:p-10">
          {/* Logo */}
          <div className="text-center mb-8">
            <motion.div
              className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl ${isCitizenFlow ? 'bg-cyan-500/10' : 'bg-primary/10'} mb-4`}
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              {isCitizenFlow ? (
                <Users className="w-8 h-8 text-cyan-400" />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-primary glow-primary" />
              )}
            </motion.div>
            <h1 className="text-2xl font-bold text-foreground">
              {isCitizenFlow ? 'Citizen Portal' : <>Welcome to <span className="text-primary">CivicFix AI</span></>}
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              {isLogin ? 'Sign in to continue' : 'Create your account'}
            </p>
          </div>

          {/* Google OAuth Button */}
          <Button
            type="button"
            variant="outline"
            className="w-full h-12 mb-6 bg-white hover:bg-gray-100 text-gray-900 border-0 font-medium"
            onClick={handleGoogleAuth}
            disabled={loading}
          >
            {loading ? (
              <AuthSpinner size="sm" />
            ) : (
              <>
                <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Continue with Google
              </>
            )}
          </Button>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-3 text-muted-foreground">or</span>
            </div>
          </div>

          {/* Email/Password Form */}
          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm text-muted-foreground">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-12 bg-white/5 border-white/10 focus:border-primary"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm text-muted-foreground">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10 h-12 bg-white/5 border-white/10 focus:border-primary"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
              disabled={loading}
            >
              {loading ? (
                <AuthSpinner size="sm" />
              ) : isLogin ? (
                'Sign In'
              ) : (
                'Create Account'
              )}
            </Button>
          </form>

          {/* Toggle Login/Signup */}
          <p className="mt-6 text-center text-sm text-muted-foreground">
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-primary hover:underline font-medium"
              disabled={loading}
            >
              {isLogin ? 'Sign up' : 'Sign in'}
            </button>
          </p>

          {/* Forgot Password */}
          {isLogin && (
            <p className="mt-2 text-center">
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-primary"
                onClick={() => toast({ title: 'Coming soon', description: 'Password reset will be available soon.' })}
              >
                Forgot password?
              </button>
            </p>
          )}
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-muted-foreground">
          By continuing, you agree to CivicFix AI's Terms of Service and Privacy Policy.
        </p>
      </motion.div>
    </div>
  );
}
