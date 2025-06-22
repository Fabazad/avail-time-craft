
-- Make user_id columns NOT NULL for proper RLS enforcement
-- First check if there are any NULL values that need to be handled

-- For projects table
DO $$ 
BEGIN 
    -- Only alter if column is nullable
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'projects' 
        AND column_name = 'user_id' 
        AND is_nullable = 'YES'
    ) THEN
        ALTER TABLE public.projects ALTER COLUMN user_id SET NOT NULL;
    END IF;
END $$;

-- For availability_rules table
DO $$ 
BEGIN 
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'availability_rules' 
        AND column_name = 'user_id' 
        AND is_nullable = 'YES'
    ) THEN
        ALTER TABLE public.availability_rules ALTER COLUMN user_id SET NOT NULL;
    END IF;
END $$;

-- For scheduled_sessions table
DO $$ 
BEGIN 
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'scheduled_sessions' 
        AND column_name = 'user_id' 
        AND is_nullable = 'YES'
    ) THEN
        ALTER TABLE public.scheduled_sessions ALTER COLUMN user_id SET NOT NULL;
    END IF;
END $$;

-- For calendar_connections table
DO $$ 
BEGIN 
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'calendar_connections' 
        AND column_name = 'user_id' 
        AND is_nullable = 'YES'
    ) THEN
        ALTER TABLE public.calendar_connections ALTER COLUMN user_id SET NOT NULL;
    END IF;
END $$;

-- Add foreign key constraints only if they don't exist
DO $$ 
BEGIN 
    -- Add projects foreign key if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'projects_user_id_fkey'
    ) THEN
        ALTER TABLE public.projects 
        ADD CONSTRAINT projects_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    -- Add availability_rules foreign key if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'availability_rules_user_id_fkey'
    ) THEN
        ALTER TABLE public.availability_rules 
        ADD CONSTRAINT availability_rules_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    -- Add scheduled_sessions foreign key if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'scheduled_sessions_user_id_fkey'
    ) THEN
        ALTER TABLE public.scheduled_sessions 
        ADD CONSTRAINT scheduled_sessions_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    -- Add calendar_connections foreign key if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'calendar_connections_user_id_fkey'
    ) THEN
        ALTER TABLE public.calendar_connections 
        ADD CONSTRAINT calendar_connections_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;
