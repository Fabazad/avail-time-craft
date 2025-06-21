
import { useState } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableProjectItem } from './SortableProjectItem';
import { Project, ScheduledSession } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface SortableProjectsListProps {
  projects: Project[];
  scheduledSessions: ScheduledSession[];
  onUpdateProject: (project: Project) => void;
  onReorderProjects: (reorderedProjects: Project[]) => void;
}

export const SortableProjectsList = ({ 
  projects, 
  scheduledSessions, 
  onUpdateProject,
  onReorderProjects 
}: SortableProjectsListProps) => {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: any) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      const oldIndex = projects.findIndex(project => project.id === active.id);
      const newIndex = projects.findIndex(project => project.id === over.id);
      
      const reorderedProjects = arrayMove(projects, oldIndex, newIndex);
      onReorderProjects(reorderedProjects);
    }
  };

  return (
    <Card className="p-6 bg-white/70 backdrop-blur-sm border-blue-200/50">
      <CardHeader className="px-0 pt-0">
        <CardTitle className="text-2xl font-semibold text-gray-800">All Projects</CardTitle>
        <p className="text-sm text-gray-600">Drag and drop to reorder by priority</p>
      </CardHeader>
      <CardContent className="px-0">
        <DndContext 
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={projects.map(p => p.id)} strategy={verticalListSortingStrategy}>
            <div className="grid gap-4">
              {projects.map(project => (
                <SortableProjectItem 
                  key={project.id}
                  project={project}
                  scheduledSessions={scheduledSessions}
                  onUpdateProject={onUpdateProject}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </CardContent>
    </Card>
  );
};
