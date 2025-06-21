
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X } from 'lucide-react';
import { Project } from '@/types';

interface ProjectEditFormProps {
  project: Project;
  onSubmit: (project: Project) => void;
  onCancel: () => void;
}

export const ProjectEditForm = ({ project, onSubmit, onCancel }: ProjectEditFormProps) => {
  const [formData, setFormData] = useState({
    name: project.name,
    estimatedHours: project.estimatedHours.toString(),
    description: project.description || ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.estimatedHours) {
      return;
    }

    onSubmit({
      ...project,
      name: formData.name.trim(),
      estimatedHours: parseFloat(formData.estimatedHours),
      description: formData.description.trim() || undefined
    });
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Card className="border-0 shadow-none">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-xl font-semibold text-gray-800">
          Edit Project
        </CardTitle>
        <Button 
          variant="ghost" 
          size="sm"
          onClick={onCancel}
          className="h-8 w-8 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Project Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Enter project name..."
              className="border-blue-200 focus:border-blue-400"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="hours">Estimated Hours</Label>
            <Input
              id="hours"
              type="number"
              min="0.5"
              step="0.5"
              value={formData.estimatedHours}
              onChange={(e) => handleChange('estimatedHours', e.target.value)}
              placeholder="0"
              className="border-blue-200 focus:border-blue-400"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Add project details..."
              className="border-blue-200 focus:border-blue-400 resize-none"
              rows={3}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button 
              type="submit" 
              className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
            >
              Update Project
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              onClick={onCancel}
              className="border-blue-200 hover:bg-blue-50"
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
