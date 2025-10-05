-- Create user_preferences table for cross-device sync
CREATE TABLE IF NOT EXISTS public.user_preferences (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    device_id TEXT NOT NULL,
    preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON public.user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_last_updated ON public.user_preferences(last_updated DESC);

-- Enable Row Level Security
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only read their own preferences
CREATE POLICY "Users can view their own preferences"
    ON public.user_preferences
    FOR SELECT
    USING (user_id = auth.uid()::text);

-- Policy: Users can insert their own preferences
CREATE POLICY "Users can insert their own preferences"
    ON public.user_preferences
    FOR INSERT
    WITH CHECK (user_id = auth.uid()::text);

-- Policy: Users can update their own preferences
CREATE POLICY "Users can update their own preferences"
    ON public.user_preferences
    FOR UPDATE
    USING (user_id = auth.uid()::text)
    WITH CHECK (user_id = auth.uid()::text);

-- Policy: Users can delete their own preferences
CREATE POLICY "Users can delete their own preferences"
    ON public.user_preferences
    FOR DELETE
    USING (user_id = auth.uid()::text);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on row update
CREATE TRIGGER update_user_preferences_updated_at_trigger
    BEFORE UPDATE ON public.user_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_user_preferences_updated_at();

-- Enable realtime for user_preferences table
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_preferences;

COMMENT ON TABLE public.user_preferences IS 'Stores user preferences for cross-device synchronization';
COMMENT ON COLUMN public.user_preferences.user_id IS 'Reference to the user (matches auth.users.id)';
COMMENT ON COLUMN public.user_preferences.device_id IS 'Unique identifier for the device that made the last update';
COMMENT ON COLUMN public.user_preferences.preferences IS 'JSON object containing all user preferences';
COMMENT ON COLUMN public.user_preferences.last_updated IS 'Timestamp of the last preference update';
COMMENT ON COLUMN public.user_preferences.version IS 'Version number for conflict resolution';
