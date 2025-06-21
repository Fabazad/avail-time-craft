
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { ProjectForm } from '@/components/ProjectForm';
import { Dashboard } from '@/components/Dashboard';
import { SortableProjectsList } from '@/components/SortableProjectsList';
import { useProjects } from '@/hooks/useProjects';
import { useScheduledSessions } from '@/hooks/useScheduledSessions';

const Index = () => {
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'projects'>('dashboard');
  
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
    completeSession 
  } = useScheduledSessions();

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

  const handleReorderProjects = async (reorderedProjects: any[]) => {
    await updateProjectPriorities(reorderedProjects);
  };

  if (projectsLoading || sessionsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading projects...</p>
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
            </p>
          </div>
          <Button 
            onClick={() => setShowForm(true)}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
          >
            <Plus className="w-5 h-5 mr-2" />
            New Project
          </Button>
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
            All Projects
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
                onUpdateProject={updateProject}
                onDeleteProject={deleteProject}
              />
            )}
            
            {activeTab === 'projects' && (
              <SortableProjectsList
                projects={projects}
                scheduledSessions={scheduledSessions}
                onUpdateProject={updateProject}
                onReorderProjects={handleReorderProjects}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Index;
