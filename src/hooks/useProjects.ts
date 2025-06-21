import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Project } from '@/types';
import { toast } from 'sonner';

export const useProjects = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch projects from database
  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('priority', { ascending: true });

      if (error) throw error;

      const formattedProjects: Project[] = data.map(project => ({
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
          user_id: user.id // Add the user ID
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

  // Update project - Enhanced to return whether estimated hours changed
  const updateProject = async (updatedProject: Project) => {
    try {
      // Get the current project to check if estimated hours changed
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
      
      // Return whether estimated hours changed to trigger recalculation
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
      // Update each project's priority individually
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
      
      // Check if any updates failed
      const failedUpdates = results.filter(result => result.error);
      if (failedUpdates.length > 0) {
        throw new Error('Some priority updates failed');
      }

      // Update local state
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

  // Delete project - Enhanced to clear ALL scheduled sessions before deletion and trigger full recalculation
  const deleteProject = async (projectId: string, onSessionsDeleted?: () => void) => {
    try {
      console.log(`Starting deletion of project ${projectId}`);
      
      // First, delete ALL existing Google Calendar events for scheduled sessions
      const { data: allScheduledSessions, error: fetchError } = await supabase
        .from('scheduled_sessions')
        .select('id, google_event_id, project_name')
        .eq('status', 'scheduled')
        .not('google_event_id', 'is', null);
        
      if (fetchError) {
        console.error('Error fetching scheduled sessions:', fetchError);
        throw fetchError;
      }
      
      if (allScheduledSessions && allScheduledSessions.length > 0) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          
          // Check if user has an active calendar connection
          const { data: connection } = await supabase
            .from('calendar_connections')
            .select('id')
            .eq('user_id', user?.id)
            .eq('provider', 'google')
            .eq('is_active', true)
            .maybeSingle();
          
          if (connection) {
            // Delete all existing calendar events
            let successCount = 0;
            let errorCount = 0;

            toast.info(`Deleting ${allScheduledSessions.length} existing calendar events...`);

            for (const session of allScheduledSessions) {
              try {
                await supabase.functions.invoke('delete-calendar-event', {
                  body: {
                    googleEventId: session.google_event_id
                  }
                });
                successCount++;
              } catch (error) {
                console.error(`Failed to delete calendar event:`, error);
                errorCount++;
              }
            }

            // Show summary toast for deletions
            if (successCount > 0 && errorCount === 0) {
              toast.success(`All ${successCount} existing calendar events deleted successfully!`);
            } else if (successCount > 0 && errorCount > 0) {
              toast.warning(`${successCount} events deleted, ${errorCount} failed to delete`);
            } else if (errorCount > 0) {
              toast.error(`Failed to delete existing calendar events`);
            }
          }
        } catch (calendarError) {
          console.error('Error deleting existing calendar events:', calendarError);
          toast.error('Failed to delete existing calendar events', {
            description: calendarError.message || 'Unknown error occurred'
          });
          // Continue with project deletion even if calendar deletion fails
        }
      }
      
      // Then, delete ALL scheduled sessions (not just for this project)
      const { error: allSessionsError } = await supabase
        .from('scheduled_sessions')
        .delete()
        .eq('status', 'scheduled');

      if (allSessionsError) {
        console.error('Error deleting all scheduled sessions:', allSessionsError);
        throw allSessionsError;
      }
      
      console.log(`Successfully deleted all scheduled sessions`);

      // Finally, delete the project
      const { error: projectError } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId);

      if (projectError) {
        console.error('Error deleting project:', projectError);
        throw projectError;
      }
      
      console.log(`Successfully deleted project ${projectId}`);

      setProjects(prev => prev.filter(project => project.id !== projectId));
      toast.success('Project deleted and all sessions cleared for recalculation');
      
      // Call the callback to refresh sessions in the UI
      if (onSessionsDeleted) {
        onSessionsDeleted();
      }
    } catch (error) {
      console.error('Error deleting project:', error);
      toast.error('Failed to delete project');
      throw error;
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
