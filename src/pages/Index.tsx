
import { useState, useEffect, useCallback } from 'react';
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { GoogleCalendarIntegration } from '@/components/GoogleCalendarIntegration';
import { AuthGuard } from '@/components/AuthGuard';
import { UserMenu } from '@/components/UserMenu';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const IndexContent = () => {
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
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
    refetch: refetchScheduledSessions
  } = useScheduledSessions();

  const {
    availabilityRules,
    loading: availabilityLoading,
    updateAvailabilityRules
  } = useAvailability();

  // Trigger automatic scheduling when projects or availability rules change
  const recalculateSchedule = useCallback(async () => {
    if (projects.length === 0 || availabilityRules.length === 0) return;
    
    setIsRecalculating(true);
    try {
      // The scheduleProjects function now fetches Google Calendar events internally
      await scheduleProjects(projects, availabilityRules);
      await refetchScheduledSessions();
      toast.success('Schedule updated with calendar conflicts considered');
    } catch (error) {
      console.error('Error recalculating schedule:', error);
      toast.error('Failed to update schedule');
    } finally {
      setIsRecalculating(false);
    }
  }, [projects, availabilityRules, refetchScheduledSessions]);

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
    try {
      const result = await updateProject(updatedProject);
      
      // If estimated hours changed, recalculate the schedule immediately
      if (result?.estimatedHoursChanged) {
        console.log('Estimated hours changed, recalculating schedule...');
        await recalculateSchedule();
      }
    } catch (error) {
      // Error handling is done in the hook
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    await deleteProject(projectId, refetchScheduledSessions);
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
    <TooltipProvider>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="container mx-auto p-3 sm:p-4 lg:p-6 space-y-6 sm:space-y-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-800 mb-1 sm:mb-2">
                Project Scheduler
              </h1>
              <p className="text-sm sm:text-base text-gray-600">
                Manage your projects and schedule work sessions efficiently
                {isRecalculating && (
                  <span className="ml-2 text-blue-600 text-xs sm:text-sm">
                    <span className="inline-block animate-spin rounded-full h-3 w-3 border-b border-blue-600 mr-1"></span>
                    Updating schedule...
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-3 sm:gap-4">
              {activeTab === 'projects' && (
                <Button 
                  onClick={() => setShowForm(true)}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 text-sm sm:text-base"
                >
                  <Plus className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" />
                  New Project
                </Button>
              )}
              <UserMenu />
            </div>
          </div>

          {/* Navigation Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 bg-white/70 backdrop-blur-sm border border-blue-200/50 p-1 h-auto">
              <TabsTrigger value="dashboard" className="data-[state=active]:bg-white data-[state=active]:shadow-sm text-xs sm:text-sm py-2 sm:py-2.5">
                Dashboard
              </TabsTrigger>
              <TabsTrigger value="projects" className="data-[state=active]:bg-white data-[state=active]:shadow-sm text-xs sm:text-sm py-2 sm:py-2.5">
                Projects
              </TabsTrigger>
              <TabsTrigger value="availability" className="data-[state=active]:bg-white data-[state=active]:shadow-sm text-xs sm:text-sm py-2 sm:py-2.5">
                Availability
              </TabsTrigger>
              <TabsTrigger value="calendar" className="data-[state=active]:bg-white data-[state=active]:shadow-sm text-xs sm:text-sm py-2 sm:py-2.5">
                Calendar
              </TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard">
              <Dashboard
                projects={projects}
                scheduledSessions={scheduledSessions}
                availabilityRules={availabilityRules}
                onCompleteSession={completeSession}
                onUpdateProject={handleUpdateProject}
                onDeleteProject={handleDeleteProject}
              />
              <div className="mt-6">
                <GoogleCalendarIntegration />
              </div>
            </TabsContent>

            <TabsContent value="projects">
              <SortableProjectsList
                projects={projects}
                scheduledSessions={scheduledSessions}
                onUpdateProject={handleUpdateProject}
                onDeleteProject={handleDeleteProject}
                onReorderProjects={handleReorderProjects}
              />
            </TabsContent>

            <TabsContent value="availability">
              <AvailabilityManager
                availabilityRules={availabilityRules}
                onUpdateRules={handleUpdateAvailabilityRules}
              />
            </TabsContent>

            <TabsContent value="calendar">
              <CalendarView
                projects={projects}
                scheduledSessions={scheduledSessions}
                availabilityRules={availabilityRules}
                onCompleteSession={completeSession}
              />
            </TabsContent>
          </Tabs>

          {/* Project Form Modal */}
          <Dialog open={showForm} onOpenChange={setShowForm}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create New Project</DialogTitle>
              </DialogHeader>
              <ProjectForm 
                onSubmit={handleCreateProject}
                onCancel={() => setShowForm(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </TooltipProvider>
  );
};

const Index = () => {
  return (
    <AuthGuard>
      <IndexContent />
    </AuthGuard>
  );
};

export default Index;
