import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Calendar, Briefcase, Target, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { format, startOfDay, endOfDay } from 'date-fns';

export default function ApplicationTracking() {
  const { user } = useAuth();
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dailyTarget, setDailyTarget] = useState(5);
  const [todayCount, setTodayCount] = useState(0);

  useEffect(() => {
    fetchApplications();
    fetchDailyTarget();
  }, [user]);

  const fetchDailyTarget = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('daily_application_target')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data?.daily_application_target) {
        setDailyTarget(data.daily_application_target);
      }
    } catch (error: any) {
      console.error('Error fetching daily target:', error);
    }
  };

  const fetchApplications = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('applications')
        .select(`
          *,
          optimizations (
            ats_score,
            job_descriptions (
              title,
              company,
              description
            )
          )
        `)
        .eq('user_id', user.id)
        .order('applied_at', { ascending: false });

      if (error) throw error;

      setApplications(data || []);

      // Count today's applications
      const today = new Date();
      const todayStart = startOfDay(today);
      const todayEnd = endOfDay(today);
      
      const todayApps = (data || []).filter((app: any) => {
        const appDate = new Date(app.applied_at);
        return appDate >= todayStart && appDate <= todayEnd;
      });
      
      setTodayCount(todayApps.length);
    } catch (error: any) {
      console.error('Error fetching applications:', error);
      toast.error('Failed to load applications');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (applicationId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('applications')
        .delete()
        .eq('id', applicationId);

      if (error) throw error;

      toast.success('Application removed');
      fetchApplications(); // Refresh the list
    } catch (error: any) {
      console.error('Error deleting application:', error);
      toast.error('Failed to remove application');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-pulse">Loading applications...</div>
      </div>
    );
  }

  const progressPercentage = Math.min((todayCount / dailyTarget) * 100, 100);

  return (
    <div className="space-y-6">
      <Card className="shadow-[var(--shadow-elegant)] border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            Today's Progress
          </CardTitle>
          <CardDescription>
            {todayCount} of {dailyTarget} applications today
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Progress value={progressPercentage} className="h-3" />
          <p className="text-sm text-muted-foreground mt-2">
            {todayCount >= dailyTarget 
              ? '🎉 Daily goal achieved!' 
              : `${dailyTarget - todayCount} more to reach your daily goal`}
          </p>
        </CardContent>
      </Card>

      {applications.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No applications tracked yet. Download a resume PDF and mark it as applied!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {applications.map((app) => (
            <Card key={app.id} className="shadow-[var(--shadow-card)]">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1">
                    <CardTitle className="flex items-center gap-2">
                      {app.optimizations?.job_descriptions?.title || 'Untitled Position'}
                      {app.optimizations?.ats_score && (
                        <Badge variant="secondary" className="ml-2">
                          ATS: {app.optimizations.ats_score}%
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-4 flex-wrap">
                      {app.optimizations?.job_descriptions?.company && (
                        <span className="flex items-center gap-1">
                          <Briefcase className="w-3 h-3" />
                          {app.optimizations.job_descriptions.company}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Applied on {format(new Date(app.applied_at), 'MMM d, yyyy')}
                      </span>
                    </CardDescription>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(app.id)}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
