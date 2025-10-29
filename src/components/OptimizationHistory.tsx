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

  const handleDownloadPDF = async (optimizationId: string, type: 'resume' | 'cover_letter' = 'resume') => {
    if (!user) return;

    try {
      // Fetch optimization data
      const { data: optimization, error: optError } = await supabase
        .from('optimizations')
        .select('optimized_latex, optimized_cover_letter')
        .eq('id', optimizationId)
        .single();

      if (optError) throw optError;

      const latexContent = type === 'resume' ? optimization.optimized_latex : optimization.optimized_cover_letter;

      if (!latexContent) {
        toast.error(`No optimized ${type === 'resume' ? 'resume' : 'cover letter'} found`);
        return;
      }

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

      const { data: proxyData, error: proxyError } = await supabase.functions.invoke('latex-to-pdf-proxy', {
        body: {
          latex: latexContent,
          apiKey: settings.latex_api_key,
        },
      });

      if (proxyError) throw proxyError;

      const data = proxyData;

      if (!data.success || !data.pdfUrl) {
        throw new Error('Invalid response from PDF service');
      }

      // Create a blob from the data URL
      const pdfBlob = await fetch(data.pdfUrl).then(r => r.blob());
      const url = URL.createObjectURL(pdfBlob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}_${optimizationId.slice(0, 8)}.pdf`;
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
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => handleDownloadPDF(opt.id, 'resume')}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Resume PDF
                </Button>
                {opt.optimized_cover_letter && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDownloadPDF(opt.id, 'cover_letter')}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Cover Letter PDF
                  </Button>
                )}
              </div>
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
