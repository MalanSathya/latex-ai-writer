import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Sparkles, Download } from 'lucide-react';

export default function JobDescriptionForm() {
  const { user, session } = useAuth();
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [optimization, setOptimization] = useState<any>(null);
  const [showAppliedDialog, setShowAppliedDialog] = useState(false);
  const [pendingOptimizationId, setPendingOptimizationId] = useState<string | null>(null);
  const [resumePdfUrl, setResumePdfUrl] = useState<string | null>(null);
  const [coverPdfUrl, setCoverPdfUrl] = useState<string | null>(null);
  const [compiling, setCompiling] = useState(false);

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
      const { data: optimizationData, error: optimizationError } = await supabase.functions.invoke('optimize-resume', {
        body: { jobDescriptionId: jdData.id },
      });

      if (optimizationError) {
        throw new Error(optimizationError.message || 'Failed to optimize resume');
      }
      setOptimization(optimizationData);
      toast.success(optimizationData.optimized_cover_letter 
        ? 'Resume and cover letter optimized successfully!' 
        : 'Resume optimized successfully!');

      // Compile previews
      setCompiling(true);
      const resumeUrl = await compileLatexToPdf(optimizationData.optimized_latex);
      setResumePdfUrl(resumeUrl);
      if (optimizationData.optimized_cover_letter) {
        const coverUrl = await compileLatexToPdf(optimizationData.optimized_cover_letter);
        setCoverPdfUrl(coverUrl);
      }
      setCompiling(false);
      
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

  const compileLatexToPdf = async (latex: string): Promise<string | null> => {
    if (!user) return null;
    try {
      const { data: settings, error: settingsError } = await supabase
        .from('user_settings')
        .select('latex_api_key')
        .eq('user_id', user.id)
        .maybeSingle();
      if (settingsError) throw settingsError;
      const apiKey = (settings?.latex_api_key as string) || '';
      if (!apiKey) {
        toast.error('Please set your LaTeX to PDF API key in Settings.');
        return null;
      }
      const { data: proxyData, error: proxyError } = await supabase.functions.invoke('latex-to-pdf-proxy', {
        body: { latex, apiKey },
      });
      if (proxyError) throw proxyError;
      const data = proxyData as any;
      if (!data.success || !data.pdfUrl) {
        throw new Error(data.error || 'Invalid response from PDF service');
      }
      return data.pdfUrl as string;
    } catch (err: any) {
      console.error('Error compiling LaTeX:', err);
      toast.error(err.message || 'Failed to compile PDF');
      return null;
    }
  };

  const handleDownloadPDF = async (type: 'resume' | 'cover_letter' = 'resume') => {
    if (!optimization || !user) return;

    try {
      const latexContent = type === 'cover_letter' 
        ? optimization.optimized_cover_letter 
        : optimization.optimized_latex;

      if (!latexContent) {
        toast.error(`No ${type === 'cover_letter' ? 'cover letter' : 'resume'} content available`);
        return;
      }

      // Fetch user's LaTeX API key
      const { data: settings, error: settingsError } = await supabase
        .from('user_settings')
        .select('latex_api_key')
        .eq('user_id', user.id)
        .maybeSingle();

      if (settingsError) throw settingsError;

      const apiKey = settings?.latex_api_key as string | null;
      if (!apiKey) {
        toast.error('Please set your LaTeX to PDF API key in Settings.');
        return;
      }

      const { data: proxyData, error: proxyError } = await supabase.functions.invoke('latex-to-pdf-proxy', {
        body: {
          latex: latexContent,
          apiKey,
        },
      });

      if (proxyError) throw proxyError;

      const data = proxyData as any;

      if (!data.success || !data.pdfUrl) {
        throw new Error(data.error || 'Invalid response from PDF service');
      }

      // Create a blob from the data URL
      const pdfBlob = await fetch(data.pdfUrl).then(r => r.blob());
      const url = URL.createObjectURL(pdfBlob);
      
      // Download the file
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}_${optimization.id.slice(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`${type === 'cover_letter' ? 'Cover letter' : 'Resume'} PDF downloaded successfully!`);
      
      // Show dialog to mark as applied
      setPendingOptimizationId(optimization.id);
      setShowAppliedDialog(true);
    } catch (error: any) {
      console.error('Error downloading PDF:', error);
      toast.error(error.message || 'Failed to generate PDF');
    }
  };

  const handleMarkAsApplied = async () => {
    if (!user || !pendingOptimizationId) return;

    try {
      const { error } = await supabase
        .from('applications')
        .insert({
          user_id: user.id,
          optimization_id: pendingOptimizationId,
          applied_at: new Date().toISOString(),
        });

      if (error) throw error;

      toast.success('Application tracked successfully!');
      setShowAppliedDialog(false);
      setPendingOptimizationId(null);
    } catch (error: any) {
      console.error('Error tracking application:', error);
      toast.error('Failed to track application');
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
          {loading ? 'Optimizing...' : 'Optimize Resume & Cover Letter'}
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
            <div className="space-y-4">
              <h4 className="font-semibold">Resume</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>LaTeX Code</Label>
                  <Textarea
                    value={optimization.optimized_latex}
                    readOnly
                    className="min-h-[400px] font-mono text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label>PDF Preview</Label>
                  {compiling && !resumePdfUrl ? (
                    <div className="flex items-center justify-center min-h-[400px] border rounded">
                      <div className="text-sm text-muted-foreground">Compiling resume...</div>
                    </div>
                  ) : resumePdfUrl ? (
                    <iframe src={resumePdfUrl} className="w-full min-h-[400px] rounded border" title="Resume Preview" />
                  ) : (
                    <div className="flex items-center justify-center min-h-[400px] border rounded">
                      <Button variant="outline" onClick={async () => {
                        if (optimization?.optimized_latex) {
                          setCompiling(true);
                          const url = await compileLatexToPdf(optimization.optimized_latex);
                          setResumePdfUrl(url);
                          setCompiling(false);
                        }
                      }}>Compile Resume</Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {optimization.optimized_cover_letter && (
              <div className="space-y-4">
                <h4 className="font-semibold">Cover Letter</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>LaTeX Code</Label>
                    <Textarea
                      value={optimization.optimized_cover_letter}
                      readOnly
                      className="min-h-[400px] font-mono text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>PDF Preview</Label>
                    {compiling && !coverPdfUrl ? (
                      <div className="flex items-center justify-center min-h-[400px] border rounded">
                        <div className="text-sm text-muted-foreground">Compiling cover letter...</div>
                      </div>
                    ) : coverPdfUrl ? (
                      <iframe src={coverPdfUrl} className="w-full min-h-[400px] rounded border" title="Cover Letter Preview" />
                    ) : (
                      <div className="flex items-center justify-center min-h-[400px] border rounded">
                        <Button variant="outline" onClick={async () => {
                          if (optimization?.optimized_cover_letter) {
                            setCompiling(true);
                            const url = await compileLatexToPdf(optimization.optimized_cover_letter);
                            setCoverPdfUrl(url);
                            setCompiling(false);
                          }
                        }}>Compile Cover Letter</Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button onClick={() => handleDownloadPDF('resume')} className="w-full">
                <Download className="w-4 h-4 mr-2" />
                Download Resume PDF
              </Button>
              {optimization.optimized_cover_letter && (
                <Button onClick={() => handleDownloadPDF('cover_letter')} className="w-full" variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  Download Cover Letter PDF
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={showAppliedDialog} onOpenChange={setShowAppliedDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Did you apply for this job?</AlertDialogTitle>
            <AlertDialogDescription>
              Mark this application as applied to track it in your dashboard.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingOptimizationId(null)}>
              Not Yet
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleMarkAsApplied}>
              Yes, I Applied
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
