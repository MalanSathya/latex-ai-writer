import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, LogOut, Upload, Sparkles, Download } from 'lucide-react';
import ResumeUpload from '@/components/ResumeUpload';
import JobDescriptionForm from '@/components/JobDescriptionForm';
import OptimizationHistory from '@/components/OptimizationHistory';
import { toast } from 'sonner';

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const [hasResume, setHasResume] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkResume();
  }, [user]);

  const checkResume = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('resumes')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_current', true)
      .maybeSingle();
    
    if (error) {
      console.error('Error checking resume:', error);
    } else {
      setHasResume(!!data);
    }
    
    setLoading(false);
  };

  const handleResumeUploaded = () => {
    setHasResume(true);
    toast.success('Resume uploaded successfully!');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-xl">Resume ATS Optimizer</h1>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <Button variant="outline" onClick={signOut} size="sm">
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {!hasResume ? (
          <Card className="max-w-2xl mx-auto shadow-[var(--shadow-card)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-primary" />
                Upload Your Master Resume
              </CardTitle>
              <CardDescription>
                Start by uploading your LaTeX resume. We'll use this as the base for all optimizations.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResumeUpload onUploadSuccess={handleResumeUploaded} />
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="optimize" className="space-y-6">
            <TabsList className="grid w-full max-w-md mx-auto grid-cols-2">
              <TabsTrigger value="optimize">
                <Sparkles className="w-4 h-4 mr-2" />
                Optimize
              </TabsTrigger>
              <TabsTrigger value="history">
                <Download className="w-4 h-4 mr-2" />
                History
              </TabsTrigger>
            </TabsList>

            <TabsContent value="optimize" className="space-y-6">
              <Card className="shadow-[var(--shadow-card)]">
                <CardHeader>
                  <CardTitle>Submit Job Description</CardTitle>
                  <CardDescription>
                    Paste the job description you're applying for, and our AI will optimize your resume for maximum ATS compatibility.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <JobDescriptionForm />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history">
              <OptimizationHistory />
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}
