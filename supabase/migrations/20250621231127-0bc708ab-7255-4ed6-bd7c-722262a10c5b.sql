
-- Ensure RLS is enabled and policies are properly set for all tables

-- Projects table RLS policies (these should already exist, but let's make sure)
DO $$ 
BEGIN
    -- Check if policies exist, if not create them
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'projects' AND policyname = 'Users can view their own projects'
    ) THEN
        CREATE POLICY "Users can view their own projects" 
        ON public.projects 
        FOR SELECT 
        USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'projects' AND policyname = 'Users can create their own projects'
    ) THEN
        CREATE POLICY "Users can create their own projects" 
        ON public.projects 
        FOR INSERT 
        WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'projects' AND policyname = 'Users can update their own projects'
    ) THEN
        CREATE POLICY "Users can update their own projects" 
        ON public.projects 
        FOR UPDATE 
        USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'projects' AND policyname = 'Users can delete their own projects'
    ) THEN
        CREATE POLICY "Users can delete their own projects" 
        ON public.projects 
        FOR DELETE 
        USING (auth.uid() = user_id);
    END IF;
END $$;

-- Availability rules RLS policies (these should already exist, but let's make sure)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'availability_rules' AND policyname = 'Users can view their own availability rules'
    ) THEN
        CREATE POLICY "Users can view their own availability rules" 
        ON public.availability_rules 
        FOR SELECT 
        USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'availability_rules' AND policyname = 'Users can create their own availability rules'
    ) THEN
        CREATE POLICY "Users can create their own availability rules" 
        ON public.availability_rules 
        FOR INSERT 
        WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'availability_rules' AND policyname = 'Users can update their own availability rules'
    ) THEN
        CREATE POLICY "Users can update their own availability rules" 
        ON public.availability_rules 
        FOR UPDATE 
        USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'availability_rules' AND policyname = 'Users can delete their own availability rules'
    ) THEN
        CREATE POLICY "Users can delete their own availability rules" 
        ON public.availability_rules 
        FOR DELETE 
        USING (auth.uid() = user_id);
    END IF;
END $$;

-- Scheduled sessions RLS policies (these should already exist, but let's make sure)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'scheduled_sessions' AND policyname = 'Users can view their own scheduled sessions'
    ) THEN
        CREATE POLICY "Users can view their own scheduled sessions" 
        ON public.scheduled_sessions 
        FOR SELECT 
        USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'scheduled_sessions' AND policyname = 'Users can create their own scheduled sessions'
    ) THEN
        CREATE POLICY "Users can create their own scheduled sessions" 
        ON public.scheduled_sessions 
        FOR INSERT 
        WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'scheduled_sessions' AND policyname = 'Users can update their own scheduled sessions'
    ) THEN
        CREATE POLICY "Users can update their own scheduled sessions" 
        ON public.scheduled_sessions 
        FOR UPDATE 
        USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'scheduled_sessions' AND policyname = 'Users can delete their own scheduled sessions'
    ) THEN
        CREATE POLICY "Users can delete their own scheduled sessions" 
        ON public.scheduled_sessions 
        FOR DELETE 
        USING (auth.uid() = user_id);
    END IF;
END $$;

-- Calendar connections RLS policies (these should already exist, but let's make sure)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'calendar_connections' AND policyname = 'Users can view their own calendar connections'
    ) THEN
        CREATE POLICY "Users can view their own calendar connections" 
        ON public.calendar_connections 
        FOR SELECT 
        USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'calendar_connections' AND policyname = 'Users can create their own calendar connections'
    ) THEN
        CREATE POLICY "Users can create their own calendar connections" 
        ON public.calendar_connections 
        FOR INSERT 
        WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'calendar_connections' AND policyname = 'Users can update their own calendar connections'
    ) THEN
        CREATE POLICY "Users can update their own calendar connections" 
        ON public.calendar_connections 
        FOR UPDATE 
        USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'calendar_connections' AND policyname = 'Users can delete their own calendar connections'
    ) THEN
        CREATE POLICY "Users can delete their own calendar connections" 
        ON public.calendar_connections 
        FOR DELETE 
        USING (auth.uid() = user_id);
    END IF;
END $$;
