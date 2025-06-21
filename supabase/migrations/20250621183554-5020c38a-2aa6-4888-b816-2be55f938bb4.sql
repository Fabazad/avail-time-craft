
-- Add Google Calendar integration tables and update existing ones
CREATE TABLE IF NOT EXISTS public.google_calendar_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  calendar_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  summary TEXT,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(calendar_id, event_id)
);

-- Enable RLS on Google Calendar events
ALTER TABLE public.google_calendar_events ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for Google Calendar events
CREATE POLICY "Users can view their own calendar events" 
  ON public.google_calendar_events 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own calendar events" 
  ON public.google_calendar_events 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own calendar events" 
  ON public.google_calendar_events 
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own calendar events" 
  ON public.google_calendar_events 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Update calendar_connections table to store additional fields
ALTER TABLE public.calendar_connections 
ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS sync_enabled BOOLEAN DEFAULT true;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_google_calendar_events_user_id ON public.google_calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_google_calendar_events_time_range ON public.google_calendar_events(start_time, end_time);
