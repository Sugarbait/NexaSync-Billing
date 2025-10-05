# Cloud Sync & Cross-Device Access Setup

This billing system now includes cloud sync functionality that enables cross-device access and real-time synchronization of user preferences and settings.

## Features

✅ **Cross-Device Sync**: Your preferences sync automatically across all your devices
✅ **Real-Time Updates**: Changes on one device instantly appear on all other devices
✅ **Automatic Background Sync**: Syncs every 30 seconds in the background
✅ **Manual Sync**: Click the cloud icon to force an immediate sync
✅ **Offline Support**: Works offline and syncs when connection is restored
✅ **Conflict Resolution**: Server-side conflict resolution ensures data consistency

## What Gets Synced?

- Theme preferences (light/dark/system)
- Selected customer filters
- Dashboard date range selections
- Table page sizes and preferences
- Notification settings
- Favorite customers list
- Last viewed page

## Setup Instructions

### 1. Create the User Preferences Table in Supabase

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project: **nexasync-billing**
3. Navigate to **SQL Editor** in the left sidebar
4. Click **New Query**
5. Copy and paste the entire content of `/supabase/migrations/20250105_add_user_preferences.sql`
6. Click **Run** to execute the migration

The SQL migration will:
- Create the `user_preferences` table
- Set up Row Level Security (RLS) policies
- Enable real-time subscriptions
- Add indexes for performance
- Create automatic timestamp triggers

### 2. Enable Realtime in Supabase (If Not Already Enabled)

1. In Supabase Dashboard, go to **Database** → **Replication**
2. Find the `user_preferences` table
3. Toggle **Realtime** to ON
4. Click **Save**

### 3. Verify the Setup

1. Log in to the billing admin on one device
2. Make a change (e.g., select a customer filter or change theme)
3. Open the billing admin on another device or browser
4. Log in with the same account
5. You should see the same preferences applied automatically

## Usage

### Sync Status Indicator

The cloud icon in the header shows the sync status:

- 🌥️ **Green cloud with checkmark**: Successfully synced
- 🌥️ **Gray cloud**: Sync enabled, waiting for data
- 🔄 **Spinning icon**: Currently syncing
- ☁️❌ **Cloud with X**: Sync disabled or error

Click the cloud icon to manually force a sync.

### Programmatic Usage

You can use the cloud sync service in your components:

```typescript
import { useCloudSync } from '@/components/providers/CloudSyncProvider'

function MyComponent() {
  const { preferences, updatePreferences, forceSync } = useCloudSync()

  // Update a preference
  const handleThemeChange = async (theme: 'light' | 'dark') => {
    await updatePreferences({ theme })
  }

  // Force sync now
  const handleSync = async () => {
    await forceSync()
  }

  return (
    <div>
      <p>Current theme: {preferences?.theme}</p>
      <button onClick={() => handleThemeChange('dark')}>
        Switch to Dark Mode
      </button>
      <button onClick={handleSync}>Sync Now</button>
    </div>
  )
}
```

## Architecture

### Components

1. **CloudSyncService** (`lib/services/cloudSyncService.ts`):
   - Core sync logic
   - Handles Supabase operations
   - Manages device IDs and sync state

2. **CloudSyncProvider** (`components/providers/CloudSyncProvider.tsx`):
   - React context provider
   - Wraps the app and provides sync functionality
   - Listens for real-time updates

3. **SyncStatusIndicator** (`components/ui/SyncStatusIndicator.tsx`):
   - Visual indicator in the header
   - Shows last sync time
   - Allows manual sync trigger

### Data Flow

```
User Action → UpdatePreferences → Sync to Supabase → Real-time Broadcast → Other Devices
```

1. User makes a change on Device A
2. CloudSyncService saves to Supabase
3. Supabase broadcasts change via realtime
4. Device B receives update via subscription
5. Device B updates UI automatically

## Troubleshooting

### Sync Not Working

1. Check Supabase connection in Network tab
2. Verify `user_preferences` table exists
3. Ensure realtime is enabled for the table
4. Check RLS policies are correctly set up

### Manual Sync Not Triggering

1. Check browser console for errors
2. Verify user is logged in
3. Click the cloud icon to force sync
4. Check sync status in localStorage: `lastSync_[userId]`

### Preferences Not Persisting

1. Check browser localStorage is enabled
2. Verify Supabase RLS policies allow user access
3. Check Network tab for failed API requests

## Security

- **Row Level Security**: Users can only access their own preferences
- **Device Tracking**: Each device has a unique ID
- **Encrypted Transit**: All data encrypted via HTTPS
- **No PHI/PII**: Only user preferences are synced (no sensitive billing data)

## Performance

- Background sync runs every 30 seconds
- Real-time updates are instant (< 100ms)
- LocalStorage caching for offline support
- Indexed database queries for fast lookups

## Future Enhancements

- [ ] Conflict resolution UI for manual merge
- [ ] Sync history and audit log
- [ ] Export/import preferences
- [ ] Multi-tenancy support
- [ ] Compression for large preference objects
