
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { ProjectForm } from '@/components/ProjectForm';
import { Dashboard } from '@/components/Dashboard';
import { SortableProjectsList } from '@/components/SortableProjectsList';
import { AvailabilityManager } from '@/components/AvailabilityManager';
import { useProjects } from '@/hooks/useProjects';
import { useScheduledSessions } from '@/hooks/useScheduledSessions';
import { useAvailability } from '@/hooks/useAvailability';
import { useScheduleRecalculation } from '@/hooks/useScheduleRecalculation';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { GoogleCalendarIntegration } from '@/components/GoogleCalendarIntegration';
import { AuthGuard } from '@/components/AuthGuard';
import { UserMenu } from '@/components/UserMenu';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const IndexContent = () => {
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Custom hooks for data management
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

  const { recalculateSchedule, isRecalculating } = useScheduleRecalculation();

  // Auto-recalculate schedule when data changes
  useEffect(() => {
    if (projects.length === 0 || availabilityRules.length === 0) return;
    
    const timeoutId = setTimeout(async () => {
      try {
        await recalculateSchedule();
        await refetchScheduledSessions();
      } catch (error) {
        // Error handling is done in the hook
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [
    projects.length, 
    availabilityRules.length, 
    JSON.stringify(projects.map(p => ({ id: p.id, status: p.status, priority: p.priority }))), 
    JSON.stringify(availabilityRules.map(r => ({ id: r.id, isActive: r.isActive })))
  ]);

  // Event handlers
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
      
      if (result?.estimatedHoursChanged) {
        console.log('Estimated hours changed, recalculating schedule...');
        await recalculateSchedule();
        await refetchScheduledSessions();
      }
    } catch (error) {
      // Error handling is done in the hook
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    await deleteProject(projectId, async () => {
      await refetchScheduledSessions();
    });
  };

  const handleReorderProjects = async (reorderedProjects: any[]) => {
    await updateProjectPriorities(reorderedProjects);
  };

  const handleUpdateAvailabilityRules = async (rules: any[]) => {
    await updateAvailabilityRules(rules);
  };

  const handleScheduleRecalculated = async () => {
    await refetchScheduledSessions();
  };

  if (projectsLoading || sessionsLoading || availabilityLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="flex items-center justify-between py-6 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center space-x-4">
              <div className="flex items-center justify-center w-10 h-10 bg-blue-600 rounded-full">
                <span className="text-white text-lg font-medium">PS</span>
              </div>
              <div>
                <h1 className="text-2xl font-normal text-gray-900">
                  Project Scheduler
                </h1>
                {isRecalculating && (
                  <div className="flex items-center space-x-2 mt-1">
                    <div className="animate-spin rounded-full h-3 w-3 border border-blue-600 border-t-transparent"></div>
                    <span className="text-xs text-gray-500">Updating schedule...</span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {activeTab === 'projects' && (
                <Button 
                  onClick={() => setShowForm(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-6 py-2 text-sm font-medium shadow-sm hover:shadow-md transition-all"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  New Project
                </Button>
              )}
              <UserMenu />
            </div>
          </div>

          {/* Content */}
          <div className="py-8">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
              <TabsList className="inline-flex h-10 items-center justify-center rounded-full bg-white p-1 shadow-sm border border-gray-200">
                <TabsTrigger 
                  value="dashboard" 
                  className="inline-flex items-center justify-center whitespace-nowrap rounded-full px-6 py-2 text-sm font-medium transition-all data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-sm"
                >
                  Dashboard
                </TabsTrigger>
                <TabsTrigger 
                  value="projects" 
                  className="inline-flex items-center justify-center whitespace-nowrap rounded-full px-6 py-2 text-sm font-medium transition-all data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-sm"
                >
                  Projects
                </TabsTrigger>
                <TabsTrigger 
                  value="availability" 
                  className="inline-flex items-center justify-center whitespace-nowrap rounded-full px-6 py-2 text-sm font-medium transition-all data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-sm"
                >
                  Availability
                </TabsTrigger>
              </TabsList>

              <TabsContent value="dashboard" className="space-y-6">
                <Dashboard
                  projects={projects}
                  scheduledSessions={scheduledSessions}
                  availabilityRules={availabilityRules}
                  onCompleteSession={completeSession}
                  onUpdateProject={handleUpdateProject}
                  onDeleteProject={handleDeleteProject}
                  onScheduleRecalculated={handleScheduleRecalculated}
                />
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
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
            </Tabs>
          </div>

          {/* Project Form Modal */}
          <Dialog open={showForm} onOpenChange={setShowForm}>
            <DialogContent className="sm:max-w-md rounded-xl">
              <DialogHeader>
                <DialogTitle className="text-xl font-normal">Create New Project</DialogTitle>
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
