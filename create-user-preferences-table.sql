-- Create user_preferences table for cloud sync

BEGIN;

-- Create the table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.user_preferences (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE,
    device_id TEXT NOT NULL,
    preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "service_role_full_access" ON public.user_preferences;
DROP POLICY IF EXISTS "users_manage_own_preferences" ON public.user_preferences;

-- Service role has full access
CREATE POLICY "service_role_full_access"
    ON public.user_preferences
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Users can manage their own preferences
CREATE POLICY "users_manage_own_preferences"
    ON public.user_preferences
    FOR ALL
    TO authenticated
    USING (user_id::text = auth.uid()::text)
    WITH CHECK (user_id::text = auth.uid()::text);

-- Grant permissions
GRANT ALL ON public.user_preferences TO service_role;
GRANT ALL ON public.user_preferences TO authenticated;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS user_preferences_user_id_idx ON public.user_preferences(user_id);

COMMIT;

SELECT 'user_preferences table created successfully!' as status;
