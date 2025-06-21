
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
      // Get the highest priority number to make this project the lowest priority
      const maxPriority = projects.length > 0 ? Math.max(...projects.map(p => p.priority)) : 0;
      
      const { data, error } = await supabase
        .from('projects')
        .insert({
          name: projectData.name,
          estimated_hours: projectData.estimatedHours,
          description: projectData.description,
          priority: maxPriority + 1,
          status: 'pending'
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

  // Delete project
  const deleteProject = async (projectId: string) => {
    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId);

      if (error) throw error;

      setProjects(prev => prev.filter(project => project.id !== projectId));
      toast.success('Project deleted successfully');
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
