
-- Create projects table
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  name TEXT NOT NULL,
  description TEXT,
  estimated_hours DECIMAL NOT NULL,
  priority INTEGER NOT NULL DEFAULT 999,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'scheduled', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create availability rules table
CREATE TABLE public.availability_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  name TEXT NOT NULL,
  day_of_week INTEGER[] NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  duration INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create scheduled sessions table
CREATE TABLE public.scheduled_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  project_id UUID REFERENCES public.projects ON DELETE CASCADE,
  project_name TEXT NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  duration DECIMAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'conflicted')),
  priority INTEGER NOT NULL,
  color TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create calendar connections table for future calendar integration
CREATE TABLE public.calendar_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  provider TEXT NOT NULL CHECK (provider IN ('google', 'outlook', 'apple')),
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  calendar_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add Row Level Security (RLS) policies
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_connections ENABLE ROW LEVEL SECURITY;

-- Projects policies (allow access without authentication for now, but ready for auth)
CREATE POLICY "Anyone can view projects" ON public.projects FOR SELECT USING (true);
CREATE POLICY "Anyone can create projects" ON public.projects FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update projects" ON public.projects FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete projects" ON public.projects FOR DELETE USING (true);

-- Availability rules policies
CREATE POLICY "Anyone can view availability rules" ON public.availability_rules FOR SELECT USING (true);
CREATE POLICY "Anyone can create availability rules" ON public.availability_rules FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update availability rules" ON public.availability_rules FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete availability rules" ON public.availability_rules FOR DELETE USING (true);

-- Scheduled sessions policies
CREATE POLICY "Anyone can view scheduled sessions" ON public.scheduled_sessions FOR SELECT USING (true);
CREATE POLICY "Anyone can create scheduled sessions" ON public.scheduled_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update scheduled sessions" ON public.scheduled_sessions FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete scheduled sessions" ON public.scheduled_sessions FOR DELETE USING (true);

-- Calendar connections policies
CREATE POLICY "Anyone can view calendar connections" ON public.calendar_connections FOR SELECT USING (true);
CREATE POLICY "Anyone can create calendar connections" ON public.calendar_connections FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update calendar connections" ON public.calendar_connections FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete calendar connections" ON public.calendar_connections FOR DELETE USING (true);

-- Create indexes for better performance
CREATE INDEX idx_projects_user_id ON public.projects(user_id);
CREATE INDEX idx_projects_priority ON public.projects(priority);
CREATE INDEX idx_availability_rules_user_id ON public.availability_rules(user_id);
CREATE INDEX idx_scheduled_sessions_user_id ON public.scheduled_sessions(user_id);
CREATE INDEX idx_scheduled_sessions_project_id ON public.scheduled_sessions(project_id);
CREATE INDEX idx_calendar_connections_user_id ON public.calendar_connections(user_id);
