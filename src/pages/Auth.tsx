
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          toast.error(error.message);
        } else {
          toast.success('Signed in successfully!');
          navigate('/');
        }
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`
          }
        });

        if (error) {
          toast.error(error.message);
        } else {
          toast.success('Account created! Please check your email to confirm your account.');
        }
      }
    } catch (error) {
      toast.error('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* Logo and Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-600 rounded-full mb-6">
            <span className="text-white text-xl font-medium">PS</span>
          </div>
          <h1 className="text-2xl font-normal text-gray-900 mb-2">
            {isLogin ? 'Sign in' : 'Create your account'}
          </h1>
          <p className="text-sm text-gray-600">
            to continue to Project Scheduler
          </p>
        </div>

        {/* Main Card */}
        <Card className="border border-gray-200 shadow-sm rounded-lg overflow-hidden">
          <CardHeader className="px-8 pt-8 pb-0">
            <form onSubmit={handleAuth} className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-12 text-base border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                  />
                </div>
                
                <div>
                  <Input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="h-12 text-base border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                  />
                </div>
              </div>
              
              <div className="flex items-center justify-between pt-4">
                <button
                  type="button"
                  onClick={() => setIsLogin(!isLogin)}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
                >
                  {isLogin ? 'Create account' : 'Sign in instead'}
                </button>
                
                <Button 
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-2.5 h-auto text-sm font-medium rounded-full transition-all shadow-sm hover:shadow-md"
                  disabled={loading}
                >
                  {loading ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Please wait...</span>
                    </div>
                  ) : (
                    isLogin ? 'Sign in' : 'Create'
                  )}
                </Button>
              </div>
            </form>
          </CardHeader>
          
          <CardContent className="px-8 pb-8 pt-4">
            <div className="text-center">
              <div className="text-xs text-gray-500 space-x-4">
                <a href="#" className="hover:text-gray-700 transition-colors">Privacy</a>
                <span>•</span>
                <a href="#" className="hover:text-gray-700 transition-colors">Terms</a>
                <span>•</span>
                <a href="#" className="hover:text-gray-700 transition-colors">Help</a>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
