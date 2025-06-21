
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { ProjectForm } from '@/components/ProjectForm';
import { Dashboard } from '@/components/Dashboard';
import { SortableProjectsList } from '@/components/SortableProjectsList';
import { AvailabilityManager } from '@/components/AvailabilityManager';
import { CalendarView } from '@/components/CalendarView';
import { useProjects } from '@/hooks/useProjects';
import { useScheduledSessions } from '@/hooks/useScheduledSessions';
import { useAvailability } from '@/hooks/useAvailability';
import { scheduleProjects } from '@/utils/schedulingEngine';
import { toast } from 'sonner';

const Index = () => {
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'projects' | 'availability' | 'calendar'>('dashboard');
  const [isRecalculating, setIsRecalculating] = useState(false);
  
  const { 
    projects, 
    loading: projectsLoading, 
    createProject, 
    updateProject, 
    updateProjectPriorities,
    deleteProject 
  } = useProjects();
  
  const { 
    scheduledSessions, 
    loading: sessionsLoading, 
    completeSession,
    refetch: refetchSessions
  } = useScheduledSessions();

  const {
    availabilityRules,
    loading: availabilityLoading,
    updateAvailabilityRules
  } = useAvailability();

  // Trigger automatic scheduling when projects or availability rules change
  const recalculateSchedule = async () => {
    if (projects.length === 0 || availabilityRules.length === 0 || isRecalculating) {
      return;
    }

    console.log('Recalculating schedule with', projects.length, 'projects and', availabilityRules.length, 'availability rules');
    setIsRecalculating(true);

    try {
      // Only schedule projects that are not completed
      const activeProjects = projects.filter(p => p.status !== 'completed');
      
      if (activeProjects.length > 0) {
        await scheduleProjects(activeProjects, availabilityRules);
        await refetchSessions();
        toast.success('Schedule updated successfully');
      }
    } catch (error) {
      console.error('Error recalculating schedule:', error);
      toast.error('Failed to update schedule');
    } finally {
      setIsRecalculating(false);
    }
  };

  // Trigger recalculation when projects or availability rules change
  useEffect(() => {
    // Debounce the recalculation to avoid multiple calls
    const timeoutId = setTimeout(() => {
      recalculateSchedule();
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [projects.length, availabilityRules.length, JSON.stringify(projects.map(p => ({ id: p.id, status: p.status, priority: p.priority }))), JSON.stringify(availabilityRules.map(r => ({ id: r.id, isActive: r.isActive })))]);

  const handleCreateProject = async (projectData: {
    name: string;
    estimatedHours: number;
    description?: string;
  }) => {
    try {
      await createProject(projectData);
      setShowForm(false);
    } catch (error) {
      // Error handling is done in the hook
    }
  };

  const handleUpdateProject = async (updatedProject: any) => {
    await updateProject(updatedProject);
  };

  const handleDeleteProject = async (projectId: string) => {
    await deleteProject(projectId);
  };

  const handleReorderProjects = async (reorderedProjects: any[]) => {
    await updateProjectPriorities(reorderedProjects);
  };

  const handleUpdateAvailabilityRules = async (rules: any[]) => {
    await updateAvailabilityRules(rules);
  };

  if (projectsLoading || sessionsLoading || availabilityLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-800 mb-2">
              Project Scheduler
            </h1>
            <p className="text-gray-600">
              Manage your projects and schedule work sessions efficiently
              {isRecalculating && (
                <span className="ml-2 text-blue-600 text-sm">
                  <span className="inline-block animate-spin rounded-full h-3 w-3 border-b border-blue-600 mr-1"></span>
                  Updating schedule...
                </span>
              )}
            </p>
          </div>
          {activeTab === 'projects' && (
            <Button 
              onClick={() => setShowForm(true)}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
            >
              <Plus className="w-5 h-5 mr-2" />
              New Project
            </Button>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-1 mb-6 bg-white/50 p-1 rounded-lg backdrop-blur-sm border border-blue-200/50">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex-1 py-3 px-6 rounded-md font-medium transition-all duration-200 ${
              activeTab === 'dashboard'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-800 hover:bg-white/50'
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('projects')}
            className={`flex-1 py-3 px-6 rounded-md font-medium transition-all duration-200 ${
              activeTab === 'projects'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-800 hover:bg-white/50'
            }`}
          >
            Projects
          </button>
          <button
            onClick={() => setActiveTab('availability')}
            className={`flex-1 py-3 px-6 rounded-md font-medium transition-all duration-200 ${
              activeTab === 'availability'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-800 hover:bg-white/50'
            }`}
          >
            Availability
          </button>
          <button
            onClick={() => setActiveTab('calendar')}
            className={`flex-1 py-3 px-6 rounded-md font-medium transition-all duration-200 ${
              activeTab === 'calendar'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-800 hover:bg-white/50'
            }`}
          >
            Calendar
          </button>
        </div>

        {/* Content */}
        {showForm ? (
          <div className="max-w-2xl mx-auto">
            <ProjectForm 
              onSubmit={handleCreateProject}
              onCancel={() => setShowForm(false)}
            />
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <Dashboard 
                projects={projects}
                scheduledSessions={scheduledSessions}
                onCompleteSession={completeSession}
                onUpdateProject={handleUpdateProject}
                onDeleteProject={handleDeleteProject}
              />
            )}
            
            {activeTab === 'projects' && (
              <SortableProjectsList
                projects={projects}
                scheduledSessions={scheduledSessions}
                onUpdateProject={handleUpdateProject}
                onDeleteProject={handleDeleteProject}
                onReorderProjects={handleReorderProjects}
              />
            )}

            {activeTab === 'availability' && (
              <AvailabilityManager
                availabilityRules={availabilityRules}
                onUpdateRules={handleUpdateAvailabilityRules}
              />
            )}

            {activeTab === 'calendar' && (
              <CalendarView
                projects={projects}
                scheduledSessions={scheduledSessions}
                availabilityRules={availabilityRules}
                onCompleteSession={completeSession}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Index;
