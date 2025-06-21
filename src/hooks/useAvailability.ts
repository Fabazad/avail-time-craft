
import { useState, useEffect } from 'react';
import { AvailabilityRule } from '@/types';
import { toast } from 'sonner';

export const useAvailability = () => {
  const [availabilityRules, setAvailabilityRules] = useState<AvailabilityRule[]>([]);
  const [loading, setLoading] = useState(true);

  // Load availability rules from localStorage
  const loadAvailabilityRules = () => {
    try {
      const stored = localStorage.getItem('availabilityRules');
      if (stored) {
        const rules = JSON.parse(stored);
        setAvailabilityRules(rules);
      }
    } catch (error) {
      console.error('Error loading availability rules:', error);
      toast.error('Failed to load availability rules');
    } finally {
      setLoading(false);
    }
  };

  // Save availability rules to localStorage
  const saveAvailabilityRules = (rules: AvailabilityRule[]) => {
    try {
      localStorage.setItem('availabilityRules', JSON.stringify(rules));
      setAvailabilityRules(rules);
      toast.success('Availability rules updated');
    } catch (error) {
      console.error('Error saving availability rules:', error);
      toast.error('Failed to save availability rules');
    }
  };

  useEffect(() => {
    loadAvailabilityRules();
  }, []);

  return {
    availabilityRules,
    loading,
    updateAvailabilityRules: saveAvailabilityRules,
    refetch: loadAvailabilityRules
  };
};
