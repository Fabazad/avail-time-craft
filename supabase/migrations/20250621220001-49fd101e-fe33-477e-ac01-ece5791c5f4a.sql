
-- Drop the google_calendar_events table and its indexes
DROP INDEX IF EXISTS idx_google_calendar_events_user_id;
DROP INDEX IF EXISTS idx_google_calendar_events_time_range;
DROP TABLE IF EXISTS public.google_calendar_events;
