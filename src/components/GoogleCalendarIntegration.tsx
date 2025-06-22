
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { AlertCircle, Calendar, CheckCircle, RefreshCw, Unlink } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

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
  const [connecting, setConnecting] = useState(false);

  // Fetch existing connection with explicit user_id filter
  const fetchConnection = async () => {
    try {
      // Get current user first
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setConnection(null);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("calendar_connections")
        .select("*")
        .eq("user_id", user.id) // Explicit filter by user_id
        .eq("provider", "google")
        .eq("is_active", true)
        .maybeSingle();

      if (error) throw error;
      setConnection(data);
    } catch (error) {
      console.error("Error fetching calendar connection:", error);
      toast.error("Failed to load calendar connection");
    } finally {
      setLoading(false);
    }
  };

  // Connect to Google Calendar
  const connectGoogleCalendar = async () => {
    setConnecting(true);
    try {
      // Check if user is authenticated first
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please log in first to connect your Google Calendar");
        setConnecting(false);
        return;
      }

      // Get Google Client ID from Supabase secrets via edge function
      const { data: configData, error: configError } = await supabase.functions.invoke('get-google-config');
      
      if (configError || !configData.clientId) {
        toast.error("Google OAuth configuration not found. Please check your Supabase secrets.");
        setConnecting(false);
        return;
      }

      const googleClientId = configData.clientId;

      // Generate OAuth URL with correct redirect URI and expanded scope for calendar write access
      const redirectUri = window.location.origin;
      const scope = "https://www.googleapis.com/auth/calendar"; // Full calendar access (read/write)
      const state = crypto.randomUUID();

      // Store state for verification
      sessionStorage.setItem("oauth_state", state);

      const authUrl =
        `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${encodeURIComponent(googleClientId)}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `response_type=code&` +
        `scope=${encodeURIComponent(scope)}&` +
        `access_type=offline&` +
        `prompt=consent&` +
        `state=${encodeURIComponent(state)}`;

      console.log("Opening OAuth URL:", authUrl);
      console.log("Redirect URI:", redirectUri);

      // Redirect to Google OAuth (no popup, direct redirect)
      window.location.href = authUrl;
    } catch (error) {
      console.error("Error connecting to Google Calendar:", error);
      toast.error("Failed to connect to Google Calendar");
      setConnecting(false);
    }
  };

  // Handle OAuth callback (when user returns from Google)
  useEffect(() => {
    const handleOAuthCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get("code");
      const state = urlParams.get("state");
      const storedState = sessionStorage.getItem("oauth_state");

      if (code && state && state === storedState) {
        try {
          // Clear the URL parameters
          window.history.replaceState({}, document.title, window.location.pathname);
          sessionStorage.removeItem("oauth_state");

          console.log("Processing OAuth callback with code:", code);

          // Get current session to ensure we're authenticated
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            toast.error("Authentication required. Please log in first.");
            return;
          }

          // Call the edge function to exchange code for tokens
          const { data, error } = await supabase.functions.invoke(
            "google-calendar-auth",
            {
              body: { code, state },
              headers: {
                Authorization: `Bearer ${session.access_token}`,
              }
            }
          );

          if (error) {
            console.error("Edge function error:", error);
            throw error;
          }

          console.log("Edge function response:", data);
          toast.success("Google Calendar connected successfully!");
          fetchConnection();
        } catch (error) {
          console.error("OAuth callback error:", error);
          const errorMessage = error.message || "Failed to connect to Google Calendar";
          toast.error(errorMessage);
        }
      }
    };

    handleOAuthCallback();
  }, []);

  const disconnectCalendar = async () => {
    if (!connection) return;

    try {
      // Get current user to ensure we only update our own connection
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("User not authenticated");
        return;
      }

      const { error } = await supabase
        .from("calendar_connections")
        .update({ is_active: false })
        .eq("id", connection.id)
        .eq("user_id", user.id); // Explicit filter by user_id

      if (error) throw error;

      setConnection(null);
      toast.success("Google Calendar disconnected");
    } catch (error) {
      console.error("Error disconnecting calendar:", error);
      toast.error("Failed to disconnect calendar");
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
              Connect your Google Calendar to avoid scheduling conflicts with existing events
              and automatically create calendar events for your work sessions.
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
              <div>Connected: {format(new Date(connection.created_at), "PPp")}</div>
            </div>

            <div className="text-xs text-gray-500 bg-blue-50 p-2 rounded">
              <AlertCircle className="w-3 h-3 inline mr-1" />
              Your scheduled sessions will automatically avoid conflicts with Google
              Calendar events and create calendar events for your work sessions.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
