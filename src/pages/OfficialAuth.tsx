import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthSpinner } from '@/components/auth/AuthSpinner';

export default function OfficialAuth() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Seamless entry: skip auth and redirect directly to official dashboard
    const timer = setTimeout(() => {
      setLoading(false);
      navigate('/dashboard/official', { replace: true });
    }, 800);
    
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <AuthSpinner size="lg" text="Accessing Official Dashboard..." />
    </div>
  );
}
