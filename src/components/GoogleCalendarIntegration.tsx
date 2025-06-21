
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Calendar, RefreshCw, Unlink, CheckCircle, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

interface CalendarConnection {
  id: string;
  provider: string;
  calendar_id: string;
  is_active: boolean;
  last_sync_at: string | null;
  sync_enabled: boolean;
  created_at: string;
}

export const GoogleCalendarIntegration = () => {
  const [connection, setConnection] = useState<CalendarConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [connecting, setConnecting] = useState(false);

  // Fetch existing connection
  const fetchConnection = async () => {
    try {
      const { data, error } = await supabase
        .from('calendar_connections')
        .select('*')
        .eq('provider', 'google')
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      setConnection(data);
    } catch (error) {
      console.error('Error fetching calendar connection:', error);
      toast.error('Failed to load calendar connection');
    } finally {
      setLoading(false);
    }
  };

  // Connect to Google Calendar
  const connectGoogleCalendar = async () => {
    setConnecting(true);
    try {
      // Generate OAuth URL
      const clientId = 'YOUR_GOOGLE_CLIENT_ID'; // This will be set via secrets
      const redirectUri = `${window.location.origin}/api/auth/google/callback`;
      const scope = 'https://www.googleapis.com/auth/calendar.readonly';
      
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${clientId}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `response_type=code&` +
        `scope=${encodeURIComponent(scope)}&` +
        `access_type=offline&` +
        `prompt=consent`;

      // For now, show instructions to user
      toast.info('Google Calendar integration requires setup. Please configure your Google OAuth credentials.');
      
    } catch (error) {
      console.error('Error connecting to Google Calendar:', error);
      toast.error('Failed to connect to Google Calendar');
    } finally {
      setConnecting(false);
    }
  };

  // Sync calendar events
  const syncCalendar = async () => {
    if (!connection) return;
    
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-google-calendar');

      if (error) throw error;

      toast.success(data.message || 'Calendar synced successfully');
      await fetchConnection(); // Refresh connection data
    } catch (error) {
      console.error('Error syncing calendar:', error);
      toast.error('Failed to sync calendar');
    } finally {
      setSyncing(false);
    }
  };

  // Disconnect calendar
  const disconnectCalendar = async () => {
    if (!connection) return;

    try {
      const { error } = await supabase
        .from('calendar_connections')
        .update({ is_active: false })
        .eq('id', connection.id);

      if (error) throw error;

      setConnection(null);
      toast.success('Google Calendar disconnected');
    } catch (error) {
      console.error('Error disconnecting calendar:', error);
      toast.error('Failed to disconnect calendar');
    }
  };

  useEffect(() => {
    fetchConnection();
  }, []);

  if (loading) {
    return (
      <Card className="bg-white/70 backdrop-blur-sm border-blue-200/50">
        <CardContent className="p-6">
          <div className="animate-pulse">Loading calendar integration...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white/70 backdrop-blur-sm border-blue-200/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-gray-800">
          <Calendar className="w-5 h-5" />
          Google Calendar Integration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!connection ? (
          <div className="text-center space-y-4">
            <p className="text-gray-600">
              Connect your Google Calendar to avoid scheduling conflicts with existing events.
            </p>
            <Button
              onClick={connectGoogleCalendar}
              disabled={connecting}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {connecting ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Calendar className="w-4 h-4 mr-2" />
                  Connect Google Calendar
                </>
              )}
            </Button>
            <p className="text-xs text-gray-500">
              Note: Google OAuth setup required. Contact administrator to configure credentials.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium">Connected</span>
                <Badge variant="outline" className="text-xs">
                  Google Calendar
                </Badge>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={disconnectCalendar}
                className="text-red-600 border-red-200 hover:bg-red-50"
              >
                <Unlink className="w-4 h-4 mr-1" />
                Disconnect
              </Button>
            </div>

            <div className="text-sm text-gray-600 space-y-1">
              <div>Calendar ID: {connection.calendar_id}</div>
              {connection.last_sync_at && (
                <div>
                  Last synced: {format(new Date(connection.last_sync_at), 'PPp')}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                onClick={syncCalendar}
                disabled={syncing}
                size="sm"
                className="bg-green-600 hover:bg-green-700"
              >
                {syncing ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Sync Now
                  </>
                )}
              </Button>
            </div>

            <div className="text-xs text-gray-500 bg-blue-50 p-2 rounded">
              <AlertCircle className="w-3 h-3 inline mr-1" />
              Your scheduled sessions will automatically avoid conflicts with Google Calendar events.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
