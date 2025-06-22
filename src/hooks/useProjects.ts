
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Project } from '@/types';
import { toast } from 'sonner';

export const useProjects = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch projects from database (RLS ensures user isolation)
  const fetchProjects = async () => {
    try {
      // Verify user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setProjects([]);
        setLoading(false);
        return;
      }

      console.log('Fetching projects for user:', user.id);

      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('priority', { ascending: true });

      if (error) throw error;

      console.log('Projects fetched:', data?.length || 0);

      const formattedProjects: Project[] = (data || []).map(project => ({
        id: project.id,
        name: project.name,
        estimatedHours: project.estimated_hours,
        priority: project.priority,
        status: project.status as 'pending' | 'scheduled' | 'completed',
        scheduledSessions: [],
        description: project.description,
        createdAt: new Date(project.created_at)
      }));

      setProjects(formattedProjects);
    } catch (error) {
      console.error('Error fetching projects:', error);
      toast.error('Failed to load projects');
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  // Create new project
  const createProject = async (projectData: {
    name: string;
    estimatedHours: number;
    description?: string;
  }) => {
    try {
      // Get the current user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }
      
      console.log('Creating project for user:', user.id);
      
      // Get the highest priority number to make this project the lowest priority
      const maxPriority = projects.length > 0 ? Math.max(...projects.map(p => p.priority)) : 0;
      
      const { data, error } = await supabase
        .from('projects')
        .insert({
          name: projectData.name,
          estimated_hours: projectData.estimatedHours,
          description: projectData.description,
          priority: maxPriority + 1,
          status: 'pending',
          user_id: user.id // Explicitly set user_id for RLS
        })
        .select()
        .single();

      if (error) throw error;

      const newProject: Project = {
        id: data.id,
        name: data.name,
        estimatedHours: data.estimated_hours,
        priority: data.priority,
        status: data.status as 'pending' | 'scheduled' | 'completed',
        scheduledSessions: [],
        description: data.description,
        createdAt: new Date(data.created_at)
      };

      setProjects(prev => [...prev, newProject]);
      toast.success('Project created successfully');
      return newProject;
    } catch (error) {
      console.error('Error creating project:', error);
      toast.error('Failed to create project');
      throw error;
    }
  };

  // Update project
  const updateProject = async (updatedProject: Project) => {
    try {
      const currentProject = projects.find(p => p.id === updatedProject.id);
      const estimatedHoursChanged = currentProject && currentProject.estimatedHours !== updatedProject.estimatedHours;

      const { error } = await supabase
        .from('projects')
        .update({
          name: updatedProject.name,
          estimated_hours: updatedProject.estimatedHours,
          description: updatedProject.description,
          priority: updatedProject.priority,
          status: updatedProject.status,
          updated_at: new Date().toISOString()
        })
        .eq('id', updatedProject.id);

      if (error) throw error;

      setProjects(prev => 
        prev.map(project => 
          project.id === updatedProject.id ? updatedProject : project
        )
      );
      
      toast.success('Project updated successfully');
      return { estimatedHoursChanged };
    } catch (error) {
      console.error('Error updating project:', error);
      toast.error('Failed to update project');
      throw error;
    }
  };

  // Update project priorities after drag and drop
  const updateProjectPriorities = async (reorderedProjects: Project[]) => {
    try {
      const updatePromises = reorderedProjects.map((project, index) => 
        supabase
          .from('projects')
          .update({ 
            priority: index + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', project.id)
      );

      const results = await Promise.all(updatePromises);
      
      const failedUpdates = results.filter(result => result.error);
      if (failedUpdates.length > 0) {
        throw new Error('Some priority updates failed');
      }

      const updatedProjects = reorderedProjects.map((project, index) => ({
        ...project,
        priority: index + 1
      }));

      setProjects(updatedProjects);
    } catch (error) {
      console.error('Error updating project priorities:', error);
      toast.error('Failed to update project order');
      throw error;
    }
  };

  // Delete project with cleanup
  const deleteProject = async (projectId: string, onSessionsDeleted?: () => void) => {
    try {
      console.log(`Starting deletion of project ${projectId}`);
      
      // Clean up existing sessions and calendar events first
      await cleanupProjectSessions();
      
      // Delete the project
      const { error: projectError } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId);

      if (projectError) throw projectError;

      setProjects(prev => prev.filter(project => project.id !== projectId));
      toast.success('Project deleted and all sessions cleared for recalculation');
      
      if (onSessionsDeleted) {
        onSessionsDeleted();
      }
    } catch (error) {
      console.error('Error deleting project:', error);
      toast.error('Failed to delete project');
      throw error;
    }
  };

  // Helper function to clean up sessions
  const cleanupProjectSessions = async () => {
    try {
      const { data: allScheduledSessions } = await supabase
        .from('scheduled_sessions')
        .select('id, google_event_id, project_name')
        .eq('status', 'scheduled')
        .not('google_event_id', 'is', null);
        
      if (allScheduledSessions && allScheduledSessions.length > 0) {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: connection } = await supabase
          .from('calendar_connections')
          .select('id')
          .eq('user_id', user?.id)
          .eq('provider', 'google')
          .eq('is_active', true)
          .maybeSingle();
        
        if (connection) {
          toast.info(`Deleting ${allScheduledSessions.length} existing calendar events...`);
          
          for (const session of allScheduledSessions) {
            try {
              await supabase.functions.invoke('delete-calendar-event', {
                body: { googleEventId: session.google_event_id }
              });
            } catch (error) {
              console.error(`Failed to delete calendar event:`, error);
            }
          }
        }
      }
      
      // Delete all scheduled sessions
      await supabase
        .from('scheduled_sessions')
        .delete()
        .eq('status', 'scheduled');
        
    } catch (error) {
      console.error('Error cleaning up sessions:', error);
      // Continue with project deletion even if cleanup fails
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  return {
    projects,
    loading,
    createProject,
    updateProject,
    updateProjectPriorities,
    deleteProject,
    refetch: fetchProjects
  };
};
