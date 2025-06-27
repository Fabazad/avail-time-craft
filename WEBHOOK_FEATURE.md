# Google Calendar Webhook Integration

This feature automatically recalculates user sessions when events are created or updated in their connected Google Calendar.

## How It Works

### 1. Webhook Setup

When a user connects their Google Calendar:

- The system automatically sets up a webhook (watch) for their calendar
- The webhook is configured to notify our system when events are created, updated, or deleted
- Webhook information is stored in the `calendar_connections` table

### 2. Webhook Processing

When Google Calendar sends a webhook notification:

- The `google-calendar-webhook` function receives the notification
- It identifies which user's calendar triggered the webhook
- It automatically triggers the `recalculate-schedule` function for that specific user
- The user's sessions are recalculated to avoid conflicts with the new/updated calendar events

### 3. Webhook Management

- Webhooks expire after 30 days (Google's limit)
- The `refresh-calendar-webhook` function automatically refreshes expired webhooks
- Users can manually refresh webhooks from the UI

## Database Schema

The `calendar_connections` table has been extended with webhook fields:

```sql
ALTER TABLE public.calendar_connections
ADD COLUMN webhook_id TEXT,
ADD COLUMN webhook_expiration TIMESTAMP WITH TIME ZONE,
ADD COLUMN sync_enabled BOOLEAN DEFAULT true,
ADD COLUMN last_sync_at TIMESTAMP WITH TIME ZONE;
```

## Edge Functions

### 1. `setup-calendar-webhook`

- Sets up a new webhook when a user connects their calendar
- Called automatically after successful OAuth authentication
- Creates a unique webhook ID and stores expiration time

### 2. `google-calendar-webhook`

- Receives webhook notifications from Google Calendar
- Identifies the specific user whose calendar changed
- Triggers session recalculation for that user
- Updates the `last_sync_at` timestamp

### 3. `refresh-calendar-webhook`

- Refreshes expired or expiring webhooks
- Can be called manually or scheduled as a background task
- Stops old webhooks and creates new ones
- Handles token refresh if needed

## User Interface

The Google Calendar Integration component now shows:

- Webhook status (Active/Expired)
- Last sync timestamp
- Manual refresh button
- Visual indicators for webhook health

## Benefits

1. **Real-time Updates**: Sessions are automatically recalculated when calendar events change
2. **Conflict Avoidance**: New calendar events are immediately considered in scheduling
3. **User Experience**: No manual intervention required
4. **Reliability**: Automatic webhook refresh ensures continuous monitoring

## Configuration

The webhook system requires these environment variables:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Monitoring

Webhook health can be monitored through:

- Database queries on `calendar_connections` table
- Supabase function logs
- UI indicators in the Google Calendar Integration component

## Troubleshooting

### Webhook Not Working

1. Check if webhook is expired in the database
2. Verify Google Calendar permissions
3. Check Supabase function logs
4. Try manual webhook refresh

### Multiple Recalculations

- The system is designed to handle multiple webhook notifications
- Each recalculation is idempotent
- Duplicate notifications are handled gracefully

### Performance

- Webhooks only trigger recalculation for the affected user
- Background processing prevents UI blocking
- Efficient database queries minimize processing time
