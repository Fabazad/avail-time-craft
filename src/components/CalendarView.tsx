
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Project, ScheduledSession, AvailabilityRule } from '@/types';
import { ChevronLeft, ChevronRight, Calendar, Clock, CheckCircle } from 'lucide-react';
import { format, startOfWeek, addDays, isSameDay, isToday, addWeeks, subWeeks } from 'date-fns';

interface CalendarViewProps {
  projects: Project[];
  scheduledSessions: ScheduledSession[];
  availabilityRules: AvailabilityRule[];
  onCompleteSession: (sessionId: string) => void;
}

export const CalendarView = ({ 
  projects, 
  scheduledSessions, 
  availabilityRules, 
  onCompleteSession 
}: CalendarViewProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const navigateWeek = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => direction === 'next' ? addWeeks(prev, 1) : subWeeks(prev, 1));
  };

  const getSessionsForDay = (date: Date) => {
    return scheduledSessions.filter(session => 
      isSameDay(session.startTime, date)
    );
  };

  const getAvailabilityForDay = (date: Date) => {
    const dayOfWeek = date.getDay();
    return availabilityRules.filter(rule => 
      rule.isActive && rule.dayOfWeek.includes(dayOfWeek)
    );
  };

  const getProjectColor = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return 'bg-gray-500';
    
    const colors = [
      'bg-blue-500', 'bg-green-500', 'bg-purple-500', 
      'bg-orange-500', 'bg-pink-500', 'bg-teal-500'
    ];
    return colors[parseInt(projectId) % colors.length];
  };

  const getSessionStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-3 h-3 text-green-600" />;
      case 'conflicted':
        return <Clock className="w-3 h-3 text-red-600" />;
      default:
        return <Clock className="w-3 h-3 text-blue-600" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Calendar Header */}
      <Card className="bg-white/70 backdrop-blur-sm border-blue-200/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-gray-800">Schedule Calendar</CardTitle>
              <p className="text-gray-600 text-sm">
                {format(weekStart, 'MMM dd')} - {format(addDays(weekStart, 6), 'MMM dd, yyyy')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateWeek('prev')}
                className="border-blue-200 hover:bg-blue-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentDate(new Date())}
                className="border-blue-200 hover:bg-blue-50"
              >
                Today
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateWeek('next')}
                className="border-blue-200 hover:bg-blue-50"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Calendar Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-7 gap-4">
        {weekDays.map((day, index) => {
          const daySessions = getSessionsForDay(day);
          const dayAvailability = getAvailabilityForDay(day);
          const isCurrentDay = isToday(day);

          return (
            <Card 
              key={index} 
              className={`bg-white/70 backdrop-blur-sm border-blue-200/50 ${
                isCurrentDay ? 'ring-2 ring-blue-500 ring-offset-2' : ''
              }`}
            >
              <CardHeader className="pb-3">
                <div className="text-center">
                  <div className={`font-semibold ${
                    isCurrentDay ? 'text-blue-600' : 'text-gray-800'
                  }`}>
                    {format(day, 'EEE')}
                  </div>
                  <div className={`text-2xl font-bold ${
                    isCurrentDay ? 'text-blue-600' : 'text-gray-700'
                  }`}>
                    {format(day, 'd')}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {/* Availability Indicators */}
                {dayAvailability.length > 0 && (
                  <div className="mb-3">
                    <div className="text-xs text-gray-500 mb-1">Available</div>
                    {dayAvailability.map((rule, idx) => (
                      <div key={idx} className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded mb-1">
                        {rule.startTime} - {rule.endTime}
                      </div>
                    ))}
                  </div>
                )}

                {/* Scheduled Sessions */}
                <div className="space-y-2">
                  {daySessions.map((session) => (
                    <div 
                      key={session.id} 
                      className={`p-2 rounded-lg text-white text-xs ${getProjectColor(session.projectId)} ${
                        session.status === 'completed' ? 'opacity-60' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between mb-1">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">
                            {session.projectName}
                          </div>
                          <div className="opacity-90">
                            {format(session.startTime, 'HH:mm')} - {format(session.endTime, 'HH:mm')}
                          </div>
                        </div>
                        <div className="ml-1">
                          {getSessionStatusIcon(session.status)}
                        </div>
                      </div>
                      
                      {session.status === 'scheduled' && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => onCompleteSession(session.id)}
                          className="w-full mt-2 h-6 text-xs bg-white/20 hover:bg-white/30 text-white border-white/30"
                        >
                          Mark Done
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Empty State */}
                {daySessions.length === 0 && dayAvailability.length === 0 && (
                  <div className="text-center py-4 text-gray-400 text-xs">
                    No schedule
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Legend */}
      <Card className="bg-white/70 backdrop-blur-sm border-blue-200/50">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 justify-center">
            <div className="flex items-center gap-2 text-sm">
              <div className="w-3 h-3 bg-green-100 border border-green-300 rounded"></div>
              <span className="text-gray-600">Available Time</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-3 h-3 text-blue-600" />
              <span className="text-gray-600">Scheduled</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="w-3 h-3 text-green-600" />
              <span className="text-gray-600">Completed</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="w-3 h-3 bg-blue-600 rounded ring-2 ring-blue-500"></div>
              <span className="text-gray-600">Today</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
