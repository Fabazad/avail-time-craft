
import { Project, ScheduledSession } from '@/types';

export const calculateProjectDates = (
  project: Project, 
  scheduledSessions: ScheduledSession[]
): { startDate?: Date; endDate?: Date } => {
  const projectSessions = scheduledSessions.filter(s => s.projectId === project.id && s.status !== 'conflicted');
  
  if (projectSessions.length === 0) {
    return { startDate: undefined, endDate: undefined };
  }

  const sortedSessions = projectSessions.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  
  return {
    startDate: sortedSessions[0].startTime,
    endDate: sortedSessions[sortedSessions.length - 1].endTime
  };
};

export const updateProjectWithDates = (
  project: Project, 
  scheduledSessions: ScheduledSession[]
): Project => {
  const { startDate, endDate } = calculateProjectDates(project, scheduledSessions);
  return {
    ...project,
    startDate,
    endDate
  };
};
