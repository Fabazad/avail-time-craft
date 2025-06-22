
-- Enable RLS on all tables if not already enabled
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_connections ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to recreate them properly
DROP POLICY IF EXISTS "Users can view their own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can create their own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can update their own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can delete their own projects" ON public.projects;

DROP POLICY IF EXISTS "Users can view their own availability rules" ON public.availability_rules;
DROP POLICY IF EXISTS "Users can create their own availability rules" ON public.availability_rules;
DROP POLICY IF EXISTS "Users can update their own availability rules" ON public.availability_rules;
DROP POLICY IF EXISTS "Users can delete their own availability rules" ON public.availability_rules;

DROP POLICY IF EXISTS "Users can view their own scheduled sessions" ON public.scheduled_sessions;
DROP POLICY IF EXISTS "Users can create their own scheduled sessions" ON public.scheduled_sessions;
DROP POLICY IF EXISTS "Users can update their own scheduled sessions" ON public.scheduled_sessions;
DROP POLICY IF EXISTS "Users can delete their own scheduled sessions" ON public.scheduled_sessions;

DROP POLICY IF EXISTS "Users can view their own calendar connections" ON public.calendar_connections;
DROP POLICY IF EXISTS "Users can create their own calendar connections" ON public.calendar_connections;
DROP POLICY IF EXISTS "Users can update their own calendar connections" ON public.calendar_connections;
DROP POLICY IF EXISTS "Users can delete their own calendar connections" ON public.calendar_connections;

-- Create comprehensive RLS policies for projects table
CREATE POLICY "Users can view their own projects" 
  ON public.projects 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own projects" 
  ON public.projects 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects" 
  ON public.projects 
  FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects" 
  ON public.projects 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Create comprehensive RLS policies for availability_rules table
CREATE POLICY "Users can view their own availability rules" 
  ON public.availability_rules 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own availability rules" 
  ON public.availability_rules 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own availability rules" 
  ON public.availability_rules 
  FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own availability rules" 
  ON public.availability_rules 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Create comprehensive RLS policies for scheduled_sessions table
CREATE POLICY "Users can view their own scheduled sessions" 
  ON public.scheduled_sessions 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own scheduled sessions" 
  ON public.scheduled_sessions 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own scheduled sessions" 
  ON public.scheduled_sessions 
  FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own scheduled sessions" 
  ON public.scheduled_sessions 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Create comprehensive RLS policies for calendar_connections table
CREATE POLICY "Users can view their own calendar connections" 
  ON public.calendar_connections 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own calendar connections" 
  ON public.calendar_connections 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own calendar connections" 
  ON public.calendar_connections 
  FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own calendar connections" 
  ON public.calendar_connections 
  FOR DELETE 
  USING (auth.uid() = user_id);
