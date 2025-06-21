
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AutoAuthProps {
  children: React.ReactNode;
}

export const AutoAuth = ({ children }: AutoAuthProps) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const authenticateUser = async () => {
      try {
        // Check if user is already signed in
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          setIsAuthenticated(true);
          setLoading(false);
          return;
        }

        // Auto-create and sign in a test user with a valid email format
        const testEmail = 'testuser@gmail.com';
        const testPassword = 'testpassword123';

        console.log('Attempting to sign in test user...');

        // Try to sign in first
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: testEmail,
          password: testPassword,
        });

        if (signInError && signInError.message.includes('Invalid login credentials')) {
          console.log('User does not exist, creating new user...');
          
          // User doesn't exist, create account
          const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email: testEmail,
            password: testPassword,
            options: {
              emailRedirectTo: `${window.location.origin}/`
            }
          });

          if (signUpError) {
            console.error('Error creating user:', signUpError);
            toast.error('Failed to create test user');
            return;
          }

          if (signUpData.user) {
            console.log('Test user created successfully');
            toast.success('Test user created and logged in');
            setIsAuthenticated(true);
          }
        } else if (signInData.user) {
          console.log('Test user signed in successfully');
          toast.success('Test user logged in');
          setIsAuthenticated(true);
        } else if (signInError) {
          console.error('Error signing in:', signInError);
          toast.error('Failed to authenticate');
        }

      } catch (error) {
        console.error('Authentication error:', error);
        toast.error('Authentication failed');
      } finally {
        setLoading(false);
      }
    };

    authenticateUser();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Authenticating...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Authentication failed. Please refresh the page.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
