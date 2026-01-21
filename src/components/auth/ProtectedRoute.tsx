import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AuthSpinner } from './AuthSpinner';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: ('citizen' | 'official')[];
  requireOnboarding?: boolean;
}

export function ProtectedRoute({ 
  children, 
  allowedRoles,
  requireOnboarding = true,
}: ProtectedRouteProps) {
  const { user, userProfile, loading } = useAuth();
  const location = useLocation();

  // Show loading while checking auth state
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <AuthSpinner size="lg" text="Verifying access..." />
      </div>
    );
  }

  // Not logged in - redirect to auth
  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // No profile yet (shouldn't happen, but handle gracefully)
  if (!userProfile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <AuthSpinner size="lg" text="Loading profile..." />
      </div>
    );
  }

  // No role selected - redirect to role selection
  if (!userProfile.role) {
    return <Navigate to="/role-selection" replace />;
  }

  // Onboarding not complete - redirect to onboarding
  if (requireOnboarding && !userProfile.onboardingComplete) {
    const onboardingPath = userProfile.role === 'citizen' 
      ? '/onboarding/citizen' 
      : '/onboarding/official';
    return <Navigate to={onboardingPath} replace />;
  }

  // Check role-based access
  if (allowedRoles && !allowedRoles.includes(userProfile.role)) {
    // Redirect to the correct dashboard for their role
    const dashboardPath = userProfile.role === 'citizen' 
      ? '/dashboard/citizen' 
      : '/dashboard/official';
    return <Navigate to={dashboardPath} replace />;
  }

  return <>{children}</>;
}
