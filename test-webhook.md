# Testing the Google Calendar Webhook Feature

## Prerequisites

1. User has connected their Google Calendar
2. User has some projects and availability rules set up
3. User has scheduled sessions

## Test Steps

### 1. Verify Webhook Setup

1. Connect to Google Calendar
2. Check the Google Calendar Integration component
3. Verify webhook status shows "Active"
4. Note the webhook expiration date

### 2. Test Calendar Event Creation

1. Create a new event in Google Calendar
2. Wait for webhook notification (usually within a few seconds)
3. Check if sessions were recalculated
4. Verify the new event is considered in scheduling

### 3. Test Calendar Event Update

1. Update an existing event in Google Calendar
2. Wait for webhook notification
3. Check if sessions were recalculated
4. Verify the updated event is considered in scheduling

### 4. Test Calendar Event Deletion

1. Delete an event in Google Calendar
2. Wait for webhook notification
3. Check if sessions were recalculated
4. Verify the deleted event is no longer blocking scheduling

### 5. Test Webhook Refresh

1. Wait for webhook to expire (or manually trigger refresh)
2. Click "Refresh Webhook" button
3. Verify webhook status shows "Active" again
4. Test that new calendar events still trigger recalculation

## Expected Behavior

### When Calendar Event is Created/Updated:

- Webhook notification is received
- Sessions are automatically recalculated
- New sessions avoid conflicts with the calendar event
- User sees updated schedule without manual intervention

### When Webhook Expires:

- Webhook status shows "Expired"
- Manual refresh is available
- Automatic refresh can be triggered
- System continues to work (just without real-time updates)

### Error Handling:

- Failed webhook setups don't break calendar connection
- Token refresh is handled automatically
- Multiple webhook notifications are handled gracefully
- Database errors are logged but don't crash the system

## Monitoring

Check these logs during testing:

- Supabase function logs for webhook processing
- Browser console for any frontend errors
- Database queries to verify webhook status updates

## Common Issues

1. **Webhook not triggering**: Check if webhook is expired or if Google Calendar permissions are correct
2. **Multiple recalculations**: This is expected behavior, the system handles it gracefully
3. **Token refresh errors**: Check if refresh tokens are valid
4. **Database errors**: Verify the migration has been applied correctly
