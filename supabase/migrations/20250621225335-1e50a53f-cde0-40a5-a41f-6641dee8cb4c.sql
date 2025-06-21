
-- Let's check if RLS policies exist and are properly configured
-- First, let's add RLS policies for projects table
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Create policy for projects - users can only see their own projects
CREATE POLICY "Users can view their own projects" 
  ON public.projects 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Create policy for projects - users can create their own projects
CREATE POLICY "Users can create their own projects" 
  ON public.projects 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Create policy for projects - users can update their own projects
CREATE POLICY "Users can update their own projects" 
  ON public.projects 
  FOR UPDATE 
  USING (auth.uid() = user_id);

-- Create policy for projects - users can delete their own projects
CREATE POLICY "Users can delete their own projects" 
  ON public.projects 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Now let's add RLS policies for availability_rules table
ALTER TABLE public.availability_rules ENABLE ROW LEVEL SECURITY;

-- Create policy for availability_rules - users can only see their own rules
CREATE POLICY "Users can view their own availability rules" 
  ON public.availability_rules 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Create policy for availability_rules - users can create their own rules
CREATE POLICY "Users can create their own availability rules" 
  ON public.availability_rules 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Create policy for availability_rules - users can update their own rules
CREATE POLICY "Users can update their own availability rules" 
  ON public.availability_rules 
  FOR UPDATE 
  USING (auth.uid() = user_id);

-- Create policy for availability_rules - users can delete their own rules
CREATE POLICY "Users can delete their own availability rules" 
  ON public.availability_rules 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Also add RLS policies for scheduled_sessions table
ALTER TABLE public.scheduled_sessions ENABLE ROW LEVEL SECURITY;

-- Create policy for scheduled_sessions - users can only see their own sessions
CREATE POLICY "Users can view their own scheduled sessions" 
  ON public.scheduled_sessions 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Create policy for scheduled_sessions - users can create their own sessions
CREATE POLICY "Users can create their own scheduled sessions" 
  ON public.scheduled_sessions 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Create policy for scheduled_sessions - users can update their own sessions
CREATE POLICY "Users can update their own scheduled sessions" 
  ON public.scheduled_sessions 
  FOR UPDATE 
  USING (auth.uid() = user_id);

-- Create policy for scheduled_sessions - users can delete their own sessions
CREATE POLICY "Users can delete their own scheduled sessions" 
  ON public.scheduled_sessions 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Add RLS policies for calendar_connections table
ALTER TABLE public.calendar_connections ENABLE ROW LEVEL SECURITY;

-- Create policy for calendar_connections - users can only see their own connections
CREATE POLICY "Users can view their own calendar connections" 
  ON public.calendar_connections 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Create policy for calendar_connections - users can create their own connections
CREATE POLICY "Users can create their own calendar connections" 
  ON public.calendar_connections 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Create policy for calendar_connections - users can update their own connections
CREATE POLICY "Users can update their own calendar connections" 
  ON public.calendar_connections 
  FOR UPDATE 
  USING (auth.uid() = user_id);

-- Create policy for calendar_connections - users can delete their own connections
CREATE POLICY "Users can delete their own calendar connections" 
  ON public.calendar_connections 
  FOR DELETE 
  USING (auth.uid() = user_id);
