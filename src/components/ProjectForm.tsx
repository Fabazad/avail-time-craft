
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface ProjectFormProps {
  onSubmit: (project: {
    name: string;
    estimatedHours: number;
    description?: string;
  }) => void;
  onCancel: () => void;
}

export const ProjectForm = ({ onSubmit, onCancel }: ProjectFormProps) => {
  const [formData, setFormData] = useState({
    name: '',
    estimatedHours: '',
    description: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.estimatedHours) {
      return;
    }

    onSubmit({
      name: formData.name.trim(),
      estimatedHours: parseFloat(formData.estimatedHours),
      description: formData.description.trim() || undefined
    });
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
      <div className="space-y-2">
        <Label htmlFor="name" className="text-sm font-medium">Project Name</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => handleChange('name', e.target.value)}
          placeholder="Enter project name..."
          className="border-blue-200 focus:border-blue-400 h-10 sm:h-11"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="hours" className="text-sm font-medium">Estimated Hours</Label>
        <Input
          id="hours"
          type="number"
          min="0.5"
          step="0.5"
          value={formData.estimatedHours}
          onChange={(e) => handleChange('estimatedHours', e.target.value)}
          placeholder="0"
          className="border-blue-200 focus:border-blue-400 h-10 sm:h-11"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description" className="text-sm font-medium">Description (Optional)</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => handleChange('description', e.target.value)}
          placeholder="Add project details..."
          className="border-blue-200 focus:border-blue-400 resize-none min-h-[80px]"
          rows={3}
        />
      </div>

      <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4">
        <Button 
          type="button" 
          variant="outline" 
          onClick={onCancel}
          className="border-blue-200 hover:bg-blue-50 h-10 sm:h-11"
        >
          Cancel
        </Button>
        <Button 
          type="submit" 
          className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 h-10 sm:h-11"
        >
          Create Project
        </Button>
      </div>
    </form>
  );
};
