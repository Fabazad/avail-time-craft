-- Add webhook-related fields to calendar_connections table
ALTER TABLE public.calendar_connections 
ADD COLUMN webhook_id TEXT,
ADD COLUMN webhook_expiration TIMESTAMP WITH TIME ZONE,
ADD COLUMN sync_enabled BOOLEAN DEFAULT true,
ADD COLUMN last_sync_at TIMESTAMP WITH TIME ZONE;

-- Add index for webhook_id for faster lookups
CREATE INDEX idx_calendar_connections_webhook_id ON public.calendar_connections(webhook_id); 