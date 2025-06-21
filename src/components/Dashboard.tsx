import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Project, ScheduledSession, AvailabilityRule } from '@/types';
import { Calendar, Clock, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { format, isToday, isTomorrow, addDays } from 'date-fns';
import { updateProjectWithDates } from '@/utils/projectUtils';
import { useScheduleRecalculation } from '@/hooks/useScheduleRecalculation';

interface DashboardProps {
  projects: Project[];
  scheduledSessions: ScheduledSession[];
  availabilityRules: AvailabilityRule[];
  onCompleteSession?: (sessionId: string) => void;
  onUpdateProject?: (project: Project) => void;
  onDeleteProject?: (projectId: string) => void;
  onScheduleRecalculated?: () => void;
}

export const Dashboard = ({ 
  projects, 
  scheduledSessions, 
  availabilityRules,
  onCompleteSession,
  onUpdateProject,
  onDeleteProject,
  onScheduleRecalculated 
}: DashboardProps) => {
  const { recalculateSchedule, isRecalculating } = useScheduleRecalculation();

  const activeProjects = projects.filter(p => p.status !== 'completed');
  const completedProjects = projects.filter(p => p.status === 'completed');
  
  const todaySessions = scheduledSessions.filter(session => 
    isToday(session.startTime) && session.status === 'scheduled'
  );
  
  const upcomingSessions = scheduledSessions.filter(session => 
    session.startTime > new Date() && session.status === 'scheduled'
  ).slice(0, 5);

  const handleRecalculateSchedule = async () => {
    try {
      await recalculateSchedule();
      if (onScheduleRecalculated) {
        onScheduleRecalculated();
      }
    } catch (error) {
      // Error handling is done in the hook
    }
  };

  const getProjectProgress = (project: Project) => {
    const projectSessions = scheduledSessions.filter(s => s.projectId === project.id);
    const completedHours = projectSessions
      .filter(s => s.status === 'completed')
      .reduce((sum, s) => sum + s.duration, 0);
    return (completedHours / project.estimatedHours) * 100;
  };

  const getPriorityColor = (priority: number) => {
    if (priority === 1) return 'bg-red-500';
    if (priority === 2) return 'bg-orange-500';
    if (priority === 3) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const formatSessionTime = (session: ScheduledSession) => {
    if (isToday(session.startTime)) {
      return `Today ${format(session.startTime, 'HH:mm')}`;
    }
    if (isTomorrow(session.startTime)) {
      return `Tomorrow ${format(session.startTime, 'HH:mm')}`;
    }
    return format(session.startTime, 'MMM dd, HH:mm');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Stats Overview */}
      <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm">Active Projects</p>
                <p className="text-2xl font-bold">{activeProjects.length}</p>
              </div>
              <Calendar className="w-8 h-8 text-blue-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white border-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm">Completed</p>
                <p className="text-2xl font-bold">{completedProjects.length}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm">Today's Sessions</p>
                <p className="text-2xl font-bold">{todaySessions.length}</p>
              </div>
              <Clock className="w-8 h-8 text-purple-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white border-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-100 text-sm">Total Hours</p>
                <p className="text-2xl font-bold">
                  {projects.reduce((sum, p) => sum + p.estimatedHours, 0)}
                </p>
              </div>
              <AlertCircle className="w-8 h-8 text-orange-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recalculate Schedule Button */}
      <div className="lg:col-span-3 mb-4">
        <Button 
          onClick={handleRecalculateSchedule}
          disabled={isRecalculating}
          className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-200"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isRecalculating ? 'animate-spin' : ''}`} />
          {isRecalculating ? 'Recalculating Schedule...' : 'Recalculate Schedule'}
        </Button>
      </div>

      {/* Active Projects */}
      <Card className="lg:col-span-2 bg-white/70 backdrop-blur-sm border-blue-200/50">
        <CardHeader>
          <CardTitle className="text-gray-800">Active Projects</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {activeProjects.map((project) => {
              const progress = getProjectProgress(project);
              const projectWithDates = updateProjectWithDates(project, scheduledSessions);
              
              return (
                <div key={project.id} className="p-4 bg-white/50 rounded-lg border border-blue-100">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-800">{project.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge 
                          className={`${getPriorityColor(project.priority)} text-white text-xs px-2 py-0.5`}
                        >
                          Priority {project.priority}
                        </Badge>
                        <span className="text-sm text-gray-600">
                          {project.estimatedHours}h estimated
                        </span>
                      </div>
                      {/* Project Dates */}
                      {projectWithDates.startDate && projectWithDates.endDate && (
                        <div className="mt-2 text-xs text-gray-500">
                          <div className="flex items-center gap-4">
                            <span>
                              <strong>Start:</strong> {format(projectWithDates.startDate, 'MMM dd, HH:mm')}
                            </span>
                            <span>
                              <strong>End:</strong> {format(projectWithDates.endDate, 'MMM dd, HH:mm')}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {onUpdateProject && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => onUpdateProject({...project, status: 'completed'})}
                        >
                          Complete
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                      <span>Progress</span>
                      <span>{Math.round(progress)}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                </div>
              );
            })}
            {activeProjects.length === 0 && (
              <p className="text-gray-500 text-center py-8">
                No active projects. Create your first project to get started!
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Upcoming Sessions */}
      <Card className="bg-white/70 backdrop-blur-sm border-blue-200/50">
        <CardHeader>
          <CardTitle className="text-gray-800">Upcoming Sessions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {upcomingSessions.map((session) => (
              <div key={session.id} className="p-3 bg-white/50 rounded-lg border border-blue-100">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-800 text-sm">
                      {session.projectName}
                    </h4>
                    <p className="text-xs text-gray-600">
                      {formatSessionTime(session)} • {session.duration}h
                    </p>
                  </div>
                  {onCompleteSession && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => onCompleteSession(session.id)}
                      className="text-xs px-2 py-1"
                    >
                      Done
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {upcomingSessions.length === 0 && (
              <p className="text-gray-500 text-center py-8 text-sm">
                No upcoming sessions scheduled
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Today's Focus */}
      {todaySessions.length > 0 && (
        <Card className="lg:col-span-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-0">
          <CardHeader>
            <CardTitle className="text-white">Today's Focus</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {todaySessions.map((session) => (
                <div key={session.id} className="p-4 bg-white/20 backdrop-blur-sm rounded-lg">
                  <h4 className="font-semibold mb-1">{session.projectName}</h4>
                  <p className="text-sm text-indigo-100">
                    {format(session.startTime, 'HH:mm')} - {format(session.endTime, 'HH:mm')}
                  </p>
                  <p className="text-xs text-indigo-200 mt-1">
                    {session.duration} hour{session.duration !== 1 ? 's' : ''}
                  </p>
                  {onCompleteSession && (
                    <Button 
                      size="sm" 
                      variant="secondary"
                      onClick={() => onCompleteSession(session.id)}
                      className="mt-2 bg-white/20 hover:bg-white/30 text-white border-white/30"
                    >
                      Mark Complete
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
