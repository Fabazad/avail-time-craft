
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AvailabilityRule } from '@/types';
import { toast } from 'sonner';

export const useAvailability = () => {
  const [availabilityRules, setAvailabilityRules] = useState<AvailabilityRule[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch availability rules from database with explicit user_id filter
  const fetchAvailabilityRules = async () => {
    try {
      // Verify user is authenticated
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        console.error('Auth error:', userError);
        setAvailabilityRules([]);
        setLoading(false);
        return;
      }
      
      if (!user) {
        console.log('No authenticated user, clearing availability rules');
        setAvailabilityRules([]);
        setLoading(false);
        return;
      }

      console.log('Fetching availability rules for user:', user.id);

      // Fetch availability rules with explicit user_id filter
      const { data, error } = await supabase
        .from('availability_rules')
        .select('*')
        .eq('user_id', user.id) // Explicit filter by user_id
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching availability rules:', error);
        throw error;
      }

      console.log('Raw availability rules from database:', data?.length || 0);

      const formattedRules: AvailabilityRule[] = (data || []).map(rule => ({
        id: rule.id,
        name: rule.name,
        dayOfWeek: rule.day_of_week,
        startTime: rule.start_time,
        endTime: rule.end_time,
        isActive: rule.is_active,
        duration: rule.duration,
        createdAt: new Date(rule.created_at)
      }));

      console.log('Formatted availability rules:', formattedRules.length);
      setAvailabilityRules(formattedRules);
    } catch (error) {
      console.error('Error fetching availability rules:', error);
      toast.error('Failed to load availability rules');
      setAvailabilityRules([]);
    } finally {
      setLoading(false);
    }
  };

  // Save availability rules to database
  const updateAvailabilityRules = async (rules: AvailabilityRule[]) => {
    try {
      console.log('Updating availability rules:', rules.length);

      // First, get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      console.log('Updating availability rules for user:', user.id);

      // Delete existing rules for this user with explicit user_id filter
      const { error: deleteError } = await supabase
        .from('availability_rules')
        .delete()
        .eq('user_id', user.id); // Explicit filter by user_id

      if (deleteError) {
        console.error('Error deleting existing rules:', deleteError);
        throw deleteError;
      }

      // Insert new rules
      if (rules.length > 0) {
        const rulesToInsert = rules.map(rule => ({
          id: rule.id,
          name: rule.name,
          day_of_week: rule.dayOfWeek,
          start_time: rule.startTime,
          end_time: rule.endTime,
          is_active: rule.isActive,
          duration: rule.duration,
          user_id: user.id // Explicitly set user_id
        }));

        const { error: insertError } = await supabase
          .from('availability_rules')
          .insert(rulesToInsert);

        if (insertError) {
          console.error('Error inserting new rules:', insertError);
          throw insertError;
        }
      }

      setAvailabilityRules(rules);
      toast.success('Availability rules updated');
    } catch (error) {
      console.error('Error saving availability rules:', error);
      toast.error('Failed to save availability rules');
    }
  };

  useEffect(() => {
    fetchAvailabilityRules();
  }, []);

  return {
    availabilityRules,
    loading,
    updateAvailabilityRules,
    refetch: fetchAvailabilityRules
  };
};
