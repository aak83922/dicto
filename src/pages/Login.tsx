import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';

export function Login() {
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  return (
    <div className="max-w-md mx-auto mt-8 bg-white p-8 rounded-lg shadow-md">
      <h1 className="text-2xl font-bold text-center mb-6">Welcome to YourTube</h1>
      <Auth
        supabaseClient={supabase}
        appearance={{
          theme: ThemeSupa,
          variables: {
            default: {
              colors: {
                brand: '#dc2626',
                brandAccent: '#b91c1c',
              },
            },
          },
          className: {
            container: 'gap-4',
            button: 'bg-red-600 hover:bg-red-700',
            input: 'rounded-md border-gray-300',
          },
        }}
        providers={[]}
        theme="light"
      />
      <p className="mt-6 text-center text-sm text-gray-600">
        By signing up, you agree to our Terms of Service and Privacy Policy
      </p>
    </div>
  );
}