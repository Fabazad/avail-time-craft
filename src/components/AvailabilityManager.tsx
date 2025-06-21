import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { AvailabilityRule } from '@/types';
import { Plus, Edit, Trash2, Clock } from 'lucide-react';

interface AvailabilityManagerProps {
  availabilityRules: AvailabilityRule[];
  onUpdateRules: (rules: AvailabilityRule[]) => void;
}

export const AvailabilityManager = ({ availabilityRules, onUpdateRules }: AvailabilityManagerProps) => {
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<AvailabilityRule | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    dayOfWeek: [] as number[],
    startTime: '',
    endTime: '',
    isActive: true
  });

  const daysOfWeek = [
    { id: 0, name: 'Sunday', short: 'Sun' },
    { id: 1, name: 'Monday', short: 'Mon' },
    { id: 2, name: 'Tuesday', short: 'Tue' },
    { id: 3, name: 'Wednesday', short: 'Wed' },
    { id: 4, name: 'Thursday', short: 'Thu' },
    { id: 5, name: 'Friday', short: 'Fri' },
    { id: 6, name: 'Saturday', short: 'Sat' }
  ];

  const resetForm = () => {
    setFormData({
      name: '',
      dayOfWeek: [],
      startTime: '',
      endTime: '',
      isActive: true
    });
    setEditingRule(null);
    setShowForm(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || formData.dayOfWeek.length === 0 || !formData.startTime || !formData.endTime) {
      return;
    }

    const newRule: AvailabilityRule = {
      id: editingRule ? editingRule.id : Date.now().toString(),
      name: formData.name.trim(),
      dayOfWeek: formData.dayOfWeek,
      startTime: formData.startTime,
      endTime: formData.endTime,
      isActive: formData.isActive
    };

    if (editingRule) {
      onUpdateRules(availabilityRules.map(rule => 
        rule.id === editingRule.id ? newRule : rule
      ));
    } else {
      onUpdateRules([...availabilityRules, newRule]);
    }

    resetForm();
  };

  const handleEdit = (rule: AvailabilityRule) => {
    setFormData({
      name: rule.name,
      dayOfWeek: rule.dayOfWeek,
      startTime: rule.startTime,
      endTime: rule.endTime,
      isActive: rule.isActive
    });
    setEditingRule(rule);
    setShowForm(true);
  };

  const handleDelete = (ruleId: string) => {
    onUpdateRules(availabilityRules.filter(rule => rule.id !== ruleId));
  };

  const toggleRuleActive = (ruleId: string) => {
    onUpdateRules(availabilityRules.map(rule => 
      rule.id === ruleId ? { ...rule, isActive: !rule.isActive } : rule
    ));
  };

  const toggleDay = (dayId: number) => {
    if (formData.dayOfWeek.includes(dayId)) {
      setFormData(prev => ({
        ...prev,
        dayOfWeek: prev.dayOfWeek.filter(d => d !== dayId)
      }));
    } else {
      setFormData(prev =>( {
        ...prev,
        dayOfWeek: [...prev.dayOfWeek, dayId].sort()
      }));
    }
  };

  const formatDays = (days: number[]) => {
    return days.map(d => daysOfWeek.find(day => day.id === d)?.short).join(', ');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-800">Availability Rules</h2>
          <p className="text-gray-600">Define when you're available to work on projects</p>
        </div>
        <Button 
          onClick={() => setShowForm(true)}
          className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Rule
        </Button>
      </div>

      {/* Existing Rules */}
      <div className="grid gap-4">
        {availabilityRules.map((rule) => (
          <Card key={rule.id} className="bg-white/70 backdrop-blur-sm border-blue-200/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-gray-800">{rule.name}</h3>
                    <Badge variant={rule.isActive ? "default" : "secondary"}>
                      {rule.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      <span>{rule.startTime} - {rule.endTime}</span>
                    </div>
                    <div>
                      <span>{formatDays(rule.dayOfWeek)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={rule.isActive}
                    onCheckedChange={() => toggleRuleActive(rule.id)}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEdit(rule)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(rule.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        
        {availabilityRules.length === 0 && (
          <Card className="bg-white/70 backdrop-blur-sm border-blue-200/50">
            <CardContent className="p-8 text-center">
              <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="font-semibold text-gray-800 mb-2">No availability rules</h3>
              <p className="text-gray-600 mb-4">Create your first availability rule to start scheduling projects</p>
              <Button 
                onClick={() => setShowForm(true)}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Rule
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <Card className="max-w-lg w-full bg-white shadow-2xl">
            <CardHeader>
              <CardTitle>
                {editingRule ? 'Edit Availability Rule' : 'Create Availability Rule'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ruleName">Rule Name</Label>
                  <Input
                    id="ruleName"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Weekday Evenings"
                    className="border-blue-200 focus:border-blue-400"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Days of Week</Label>
                  <div className="grid grid-cols-7 gap-2">
                    {daysOfWeek.map((day) => (
                      <Button
                        key={day.id}
                        type="button"
                        size="sm"
                        variant={formData.dayOfWeek.includes(day.id) ? "default" : "outline"}
                        onClick={() => toggleDay(day.id)}
                        className="text-xs"
                      >
                        {day.short}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startTime">Start Time</Label>
                    <Input
                      id="startTime"
                      type="time"
                      value={formData.startTime}
                      onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                      className="border-blue-200 focus:border-blue-400"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endTime">End Time</Label>
                    <Input
                      id="endTime"
                      type="time"
                      value={formData.endTime}
                      onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                      className="border-blue-200 focus:border-blue-400"
                      required
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="isActive"
                    checked={formData.isActive}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
                  />
                  <Label htmlFor="isActive">Active by default</Label>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button 
                    type="submit" 
                    className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                  >
                    {editingRule ? 'Update Rule' : 'Create Rule'}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={resetForm}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
