
import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Project, ScheduledSession } from '@/types';
import { updateProjectWithDates } from '@/utils/projectUtils';
import { format } from 'date-fns';
import { GripVertical, Edit, Trash2 } from 'lucide-react';
import { ProjectEditForm } from './ProjectEditForm';

interface SortableProjectItemProps {
  project: Project;
  scheduledSessions: ScheduledSession[];
  onUpdateProject: (project: Project) => void;
  onDeleteProject: (projectId: string) => void;
}

export const SortableProjectItem = ({ 
  project, 
  scheduledSessions, 
  onUpdateProject,
  onDeleteProject 
}: SortableProjectItemProps) => {
  const [isEditing, setIsEditing] = useState(false);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: project.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const projectWithDates = updateProjectWithDates(project, scheduledSessions);

  const getPriorityColor = (priority: number) => {
    if (priority === 1) return 'bg-red-500';
    if (priority === 2) return 'bg-orange-500';
    if (priority === 3) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleUpdate = async (updatedProject: Project) => {
    await onUpdateProject(updatedProject);
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete "${project.name}"? This action cannot be undone.`)) {
      onDeleteProject(project.id);
    }
  };

  if (isEditing) {
    return (
      <Card className="p-4 bg-white/50 border-blue-100">
        <ProjectEditForm
          project={project}
          onSubmit={handleUpdate}
          onCancel={() => setIsEditing(false)}
        />
      </Card>
    );
  }

  return (
    <Card 
      ref={setNodeRef} 
      style={style} 
      className="p-4 bg-white/50 border-blue-100 cursor-grab active:cursor-grabbing"
    >
      <div className="flex items-center gap-3">
        <div 
          {...attributes} 
          {...listeners}
          className="flex items-center justify-center w-8 h-8 text-gray-400 hover:text-gray-600 cursor-grab"
        >
          <GripVertical className="w-5 h-5" />
        </div>
        
        <div className="flex items-center justify-between flex-1">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-gray-800">{project.name}</h3>
              <div className={`w-3 h-3 rounded-full ${getPriorityColor(project.priority)}`} title={`Priority ${project.priority}`} />
            </div>
            <p className="text-sm text-gray-600">
              {project.estimatedHours}h • Priority {project.priority} • {project.status}
            </p>
            {project.description && (
              <p className="text-xs text-gray-500 mt-1">{project.description}</p>
            )}
            {projectWithDates.startDate && projectWithDates.endDate && (
              <div className="mt-2 text-xs text-gray-500">
                <div className="flex items-center gap-4">
                  <span>
                    <strong>Start:</strong> {format(projectWithDates.startDate, 'MMM dd, yyyy HH:mm')}
                  </span>
                  <span>
                    <strong>End:</strong> {format(projectWithDates.endDate, 'MMM dd, yyyy HH:mm')}
                  </span>
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button 
              size="sm" 
              variant="outline"
              onClick={handleEdit}
              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
            >
              <Edit className="w-4 h-4" />
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => onUpdateProject({...project, status: project.status === 'completed' ? 'pending' : 'completed'})}
            >
              {project.status === 'completed' ? 'Reopen' : 'Complete'}
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={handleDelete}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};
