# Scheduled Gmail Sync

This document explains the automated sync functionality for keeping mailboxes synchronized with Gmail.

## Overview

The application now includes automated scheduled sync that runs on a configurable interval to keep all user mailboxes synchronized with Gmail in the background.

## Features

- ✅ **Automated Sync**: Runs on a cron schedule (default: every 30 minutes)
- ✅ **Configurable Schedule**: Customizable via environment variables
- ✅ **User Management**: Automatically syncs all users with valid OAuth tokens
- ✅ **Rate Limiting**: Built-in delays between users to respect Gmail API limits
- ✅ **Error Handling**: Robust error handling with detailed logging
- ✅ **Manual Triggers**: Ability to trigger scheduled sync manually
- ✅ **Status Monitoring**: Real-time status and configuration display

## Configuration

### Environment Variables

Add these to your `.env` file:

```bash
# Scheduled Sync Configuration
SCHEDULED_SYNC_ENABLED=true                    # Enable/disable scheduled sync
SYNC_CRON_SCHEDULE="*/30 * * * *"              # Cron expression (every 30 min)
SYNC_INTERVAL_MINUTES=30                       # Sync interval in minutes
CRON_SECRET=your-secret-cron-key-change-this   # Security key for API calls
```

### Cron Schedule Format

The `SYNC_CRON_SCHEDULE` uses standard cron format:
- `*/30 * * * *` - Every 30 minutes
- `0 */2 * * *` - Every 2 hours
- `0 9-17 * * 1-5` - Every hour during business hours (9 AM to 5 PM, Monday to Friday)

## Architecture

### Components

1. **Scheduled Sync API** (`/api/sync/scheduled`)
   - Protected endpoint that performs sync for all users
   - Requires authorization via `CRON_SECRET`
   - Returns detailed sync results

2. **Cron Scheduler** (`~/lib/cron-scheduler.ts`)
   - Manages cron job lifecycle
   - Handles graceful startup/shutdown
   - Supports manual triggering

3. **Server Startup** (`~/lib/server-startup.ts`)
   - Initializes scheduled sync on server start
   - Handles graceful shutdown
   - Process signal handling

4. **tRPC Integration** (`~/server/api/routers/sync.ts`)
   - Frontend API for managing scheduled sync
   - Status monitoring endpoints
   - Manual trigger functionality

### Flow

1. **Server Startup** → Cron scheduler initializes
2. **Scheduled Execution** → Cron job triggers at configured intervals
3. **User Discovery** → Find users needing sync (based on last sync time)
4. **Batch Processing** → Sync each user with rate limiting
5. **Result Logging** → Log success/failure for monitoring

## API Endpoints

### tRPC Endpoints

- `sync.getScheduledSyncStatus` - Get current status and configuration
- `sync.triggerScheduledSync` - Manually trigger a scheduled sync

### REST API Endpoints

- `POST /api/sync/scheduled` - Internal scheduled sync execution
- `GET /api/sync/status` - Get sync status and trigger manual sync

## Usage

### Development

The scheduled sync automatically starts when you run:

```bash
npm run dev
```

Check the console for initialization logs:
```
[ServerStartup] Starting scheduled sync...
[CronScheduler] ✅ Scheduled sync started with cron: */30 * * * *
```

### Production

1. Set environment variables in your production environment
2. Deploy the application
3. Monitor logs for scheduled sync execution

### Manual Triggers

You can manually trigger a scheduled sync via:

1. **Frontend UI**: Go to sync panel and click "Trigger Manual Sync"
2. **API Call**: POST to `/api/sync/status`
3. **tRPC**: Call `sync.triggerScheduledSync`

## Monitoring

### Logs

The scheduled sync produces detailed logs:

```
[Scheduled Sync] Starting scheduled sync for all users
[Scheduled Sync] Found 3 users needing sync
[Scheduled Sync] ✅ User user@example.com synced successfully: 15 threads, 42 messages
[Scheduled Sync] Completed: 3 successful, 0 failed
```

### UI Status

The sync panel shows:
- Scheduled sync status (enabled/disabled/running)
- Current cron schedule
- Manual trigger button
- Recent sync history

### Error Handling

- Individual user sync failures don't stop the overall process
- Detailed error messages are logged
- Failed syncs are retried on the next scheduled run
- OAuth token refresh is handled automatically

## Security

- **API Protection**: Scheduled sync endpoint requires `CRON_SECRET`
- **User Isolation**: Each user's data is synced independently
- **Token Management**: OAuth tokens are securely stored and refreshed
- **Rate Limiting**: Built-in delays respect Gmail API limits

## Performance

- **Batch Processing**: Users are synced sequentially to avoid overwhelming the system
- **Intelligent Scheduling**: Only syncs users who haven't been synced recently
- **Efficient Queries**: Optimized database queries for user discovery
- **Memory Management**: Each sync runs independently with proper cleanup

## Troubleshooting

### Common Issues

1. **Sync Not Running**
   - Check `SCHEDULED_SYNC_ENABLED=true`
   - Verify cron expression format
   - Check server logs for initialization errors

2. **Users Not Syncing**
   - Verify OAuth tokens are valid
   - Check `SYNC_INTERVAL_MINUTES` setting
   - Review individual user error messages

3. **API Errors**
   - Ensure `CRON_SECRET` is set correctly
   - Check Gmail API quotas and limits
   - Verify database connectivity

### Debug Mode

Set detailed logging by checking console output for:
- `[CronScheduler]` messages
- `[Scheduled Sync]` messages
- `[ServerStartup]` messages

## Future Enhancements

Potential improvements:
- Web dashboard for sync management
- Webhook-based sync triggers
- Per-user sync frequency settings
- Sync priority based on user activity
- Integration with monitoring services