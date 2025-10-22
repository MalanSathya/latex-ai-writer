import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Sparkles, Download } from 'lucide-react';

export default function JobDescriptionForm() {
  const { user, session } = useAuth();
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [optimization, setOptimization] = useState<any>(null);

  const handleOptimize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !description.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    setLoading(true);
    setOptimization(null);

    try {
      // Save job description
      const { data: jdData, error: jdError } = await supabase
        .from('job_descriptions')
        .insert({
          user_id: user.id,
          title,
          company,
          description,
        })
        .select()
        .single();

      if (jdError) throw jdError;

      // Call AI optimization function
      if (!session) {
        throw new Error('Not authenticated');
      }
      const response = await fetch('/api/optimize-resume', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ jobDescriptionId: jdData.id }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to optimize resume');
      }

      const optimizationData = await response.json();
      setOptimization(optimizationData);
      toast.success('Resume optimized successfully!');
      
      // Reset form
      setTitle('');
      setCompany('');
      setDescription('');
    } catch (error: any) {
      console.error('Error optimizing resume:', error);
      toast.error(error.message || 'Failed to optimize resume');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!optimization || !user) return;

    try {
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
          latex: optimization.optimized_latex,
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
      
      // Download the file
      const a = document.createElement('a');
      a.href = url;
      a.download = `resume_${optimization.id.slice(0, 8)}.pdf`;
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

  return (
    <div className="space-y-6">
      <form onSubmit={handleOptimize} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="job-title">Job Title *</Label>
            <Input
              id="job-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Senior Software Engineer"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="company">Company</Label>
            <Input
              id="company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="e.g., Google"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">Job Description *</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Paste the complete job description here..."
            className="min-h-[200px]"
            required
          />
        </div>
        <Button type="submit" disabled={loading} className="w-full">
          <Sparkles className="w-4 h-4 mr-2" />
          {loading ? 'Optimizing...' : 'Optimize Resume'}
        </Button>
      </form>

      {optimization && (
        <Card className="shadow-[var(--shadow-elegant)] border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Optimization Results
            </CardTitle>
            <CardDescription>
              ATS Score: <span className="font-bold text-accent">{optimization.ats_score}%</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">AI Suggestions:</h4>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {optimization.suggestions}
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Optimized LaTeX:</h4>
              <Textarea
                value={optimization.optimized_latex}
                readOnly
                className="min-h-[300px] font-mono text-sm"
              />
            </div>
            <Button onClick={handleDownloadPDF} className="w-full">
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
