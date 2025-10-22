import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Calendar, Briefcase } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function OptimizationHistory() {
  const { user } = useAuth();
  const [optimizations, setOptimizations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOptimizations();
  }, [user]);

  const fetchOptimizations = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('optimizations')
        .select(`
          *,
          job_descriptions (
            title,
            company,
            description
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setOptimizations(data || []);
    } catch (error: any) {
      console.error('Error fetching optimizations:', error);
      toast.error('Failed to load optimization history');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async (optimizationId: string) => {
    if (!user) return;

    try {
      // Fetch optimization data
      const { data: optimization, error: optError } = await supabase
        .from('optimizations')
        .select('optimized_latex')
        .eq('id', optimizationId)
        .single();

      if (optError) throw optError;

      // Fetch user's LaTeX API key
      const { data: settings } = await supabase
        .from('user_settings')
        .select('latex_api_key')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!settings?.latex_api_key) {
        toast.error('Please configure your LaTeX API key in Settings');
        return;
      }

      const response = await fetch('https://latex-to-pdf.lovable.app/functions/v1/latex-convert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': settings.latex_api_key,
        },
        body: JSON.stringify({ latex: optimization.optimized_latex }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate PDF');
      }

      const data = await response.json();

      if (!data.success || !data.pdfUrl) {
        throw new Error('Invalid response from PDF service');
      }

      // Create a blob from the data URL
      const pdfBlob = await fetch(data.pdfUrl).then(r => r.blob());
      const url = URL.createObjectURL(pdfBlob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `resume_${optimizationId.slice(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('PDF downloaded successfully!');
    } catch (error: any) {
      console.error('Error downloading PDF:', error);
      toast.error(error.message || 'Failed to generate PDF');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-pulse">Loading history...</div>
      </div>
    );
  }

  if (optimizations.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No optimizations yet. Start by submitting a job description!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {optimizations.map((opt) => (
        <Card key={opt.id} className="shadow-[var(--shadow-card)]">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2">
                  {opt.job_descriptions?.title || 'Untitled Position'}
                  <Badge variant="secondary" className="ml-2">
                    ATS: {opt.ats_score}%
                  </Badge>
                </CardTitle>
                <CardDescription className="flex items-center gap-4">
                  {opt.job_descriptions?.company && (
                    <span className="flex items-center gap-1">
                      <Briefcase className="w-3 h-3" />
                      {opt.job_descriptions.company}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {format(new Date(opt.created_at), 'MMM d, yyyy')}
                  </span>
                </CardDescription>
              </div>
              <Button
                size="sm"
                onClick={() => handleDownloadPDF(opt.id)}
              >
                <Download className="w-4 h-4 mr-2" />
                PDF
              </Button>
            </div>
          </CardHeader>
          {opt.suggestions && (
            <CardContent>
              <p className="text-sm text-muted-foreground line-clamp-3">
                {opt.suggestions}
              </p>
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  );
}
