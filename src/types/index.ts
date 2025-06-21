export interface Project {
  id: string;
  name: string;
  estimatedHours: number;
  priority: number;
  status: 'pending' | 'scheduled' | 'completed';
  scheduledSessions: string[]; // IDs of scheduled sessions
  description?: string;
  createdAt?: Date;
  dueDate?: Date;
  startDate?: Date; // Calculated from first scheduled session
  endDate?: Date; // Calculated from last scheduled session
}

export interface AvailabilityRule {
  id: string;
  name: string;
  dayOfWeek: number[]; // 0 = Sunday, 1 = Monday, etc.
  startTime: string; // HH:MM format
  endTime: string; // HH:MM format
  isActive: boolean;
  duration?: number; // Optional minimum session duration in minutes
}

export interface ScheduledSession {
  id: string;
  projectId: string;
  projectName: string;
  startTime: Date;
  endTime: Date;
  duration: number; // in hours
  status: 'scheduled' | 'completed' | 'conflicted';
  priority: number;
  color?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  isExternal?: boolean; // From Google Calendar or other external source
}

export interface TimeSlot {
  start: Date;
  end: Date;
  duration: number; // in hours
  isAvailable: boolean;
}
