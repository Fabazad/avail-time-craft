
import { useState, useEffect } from 'react';
import { Dashboard } from '@/components/Dashboard';
import { ProjectForm } from '@/components/ProjectForm';
import { AvailabilityManager } from '@/components/AvailabilityManager';
import { CalendarView } from '@/components/CalendarView';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Calendar, Clock, Settings } from 'lucide-react';
import { Project, AvailabilityRule, ScheduledSession } from '@/types';
import { SchedulingEngine } from '@/utils/schedulingEngine';

const Index = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [availabilityRules, setAvailabilityRules] = useState<AvailabilityRule[]>([
    {
      id: '1',
      name: 'Weekday Evenings',
      dayOfWeek: [1, 2, 3, 4, 5], // Mon-Fri
      startTime: '19:00',
      endTime: '22:00',
      isActive: true
    }
  ]);
  const [scheduledSessions, setScheduledSessions] = useState<ScheduledSession[]>([]);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');

  const schedulingEngine = new SchedulingEngine();

  useEffect(() => {
    // Recalculate schedule whenever projects or availability changes
    const newSessions = schedulingEngine.generateSchedule(projects, availabilityRules);
    setScheduledSessions(newSessions);
  }, [projects, availabilityRules]);

  const handleAddProject = (project: Omit<Project, 'id' | 'status' | 'scheduledSessions'>) => {
    const newProject: Project = {
      ...project,
      id: Date.now().toString(),
      status: 'pending',
      scheduledSessions: []
    };
    setProjects(prev => [...prev, newProject]);
    setShowProjectForm(false);
  };

  const handleUpdateProject = (updatedProject: Project) => {
    setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
  };

  const handleDeleteProject = (projectId: string) => {
    setProjects(prev => prev.filter(p => p.id !== projectId));
  };

  const handleCompleteSession = (sessionId: string) => {
    setScheduledSessions(prev => 
      prev.map(session => 
        session.id === sessionId 
          ? { ...session, status: 'completed' }
          : session
      )
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
            Smart Project Scheduler
          </h1>
          <p className="text-gray-600 text-lg">
            Intelligently schedule your projects within your available time
          </p>
        </div>

        {/* Main Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6 gap-4">
            <TabsList className="grid w-full lg:w-auto grid-cols-4 lg:grid-cols-4 bg-white/70 backdrop-blur-sm border border-blue-200/50">
              <TabsTrigger value="dashboard" className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">Dashboard</span>
              </TabsTrigger>
              <TabsTrigger value="calendar" className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span className="hidden sm:inline">Calendar</span>
              </TabsTrigger>
              <TabsTrigger value="availability" className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span className="hidden sm:inline">Availability</span>
              </TabsTrigger>
              <TabsTrigger value="projects" className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Projects</span>
              </TabsTrigger>
            </TabsList>

            <Button 
              onClick={() => setShowProjectForm(true)}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Project
            </Button>
          </div>

          <TabsContent value="dashboard" className="space-y-6">
            <Dashboard 
              projects={projects}
              scheduledSessions={scheduledSessions}
              onCompleteSession={handleCompleteSession}
              onUpdateProject={handleUpdateProject}
              onDeleteProject={handleDeleteProject}
            />
          </TabsContent>

          <TabsContent value="calendar" className="space-y-6">
            <CalendarView 
              projects={projects}
              scheduledSessions={scheduledSessions}
              availabilityRules={availabilityRules}
              onCompleteSession={handleCompleteSession}
            />
          </TabsContent>

          <TabsContent value="availability" className="space-y-6">
            <AvailabilityManager 
              availabilityRules={availabilityRules}
              onUpdateRules={setAvailabilityRules}
            />
          </TabsContent>

          <TabsContent value="projects" className="space-y-6">
            <Card className="p-6 bg-white/70 backdrop-blur-sm border-blue-200/50">
              <h2 className="text-2xl font-semibold mb-4 text-gray-800">All Projects</h2>
              <div className="grid gap-4">
                {projects.map(project => (
                  <Card key={project.id} className="p-4 bg-white/50 border-blue-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-800">{project.name}</h3>
                        <p className="text-sm text-gray-600">
                          {project.estimatedHours}h • Priority {project.priority} • {project.status}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleUpdateProject({...project, status: project.status === 'completed' ? 'pending' : 'completed'})}
                        >
                          {project.status === 'completed' ? 'Reopen' : 'Complete'}
                        </Button>
                        <Button 
                          size="sm" 
                          variant="destructive"
                          onClick={() => handleDeleteProject(project.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Project Form Modal */}
        {showProjectForm && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-2xl max-w-md w-full">
              <ProjectForm 
                onSubmit={handleAddProject}
                onCancel={() => setShowProjectForm(false)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
