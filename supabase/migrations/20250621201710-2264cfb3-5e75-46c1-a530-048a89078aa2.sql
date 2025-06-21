
-- Add google_event_id column to scheduled_sessions table
ALTER TABLE public.scheduled_sessions 
ADD COLUMN google_event_id TEXT;

-- Add index for faster lookups
CREATE INDEX idx_scheduled_sessions_google_event_id 
ON public.scheduled_sessions(google_event_id);
