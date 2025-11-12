import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, LogOut, Upload, Sparkles, Download, Settings as SettingsIcon, Target } from 'lucide-react';
import ResumeUpload from '@/components/ResumeUpload';
import CoverLetterUpload from '@/components/CoverLetterUpload';
import JobDescriptionForm from '@/components/JobDescriptionForm';
import OptimizationHistory from '@/components/OptimizationHistory';
import ApplicationTracking from '@/components/ApplicationTracking';
import { ThemeToggle } from '@/components/ThemeToggle';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [hasResume, setHasResume] = useState(false);
  const [hasCoverLetter, setHasCoverLetter] = useState(false);
  const [loading, setLoading] = useState(true);
  const [resendLoading, setResendLoading] = useState(false);

  useEffect(() => {
    checkResume();
    checkCoverLetter();
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

  const checkCoverLetter = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('cover_letters')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_current', true)
      .maybeSingle();
    
    if (error) {
      console.error('Error checking cover letter:', error);
    } else {
      setHasCoverLetter(!!data);
    }
  };

  const handleResumeUploaded = () => {
    setHasResume(true);
    toast.success('Resume uploaded successfully!');
  };

  const handleCoverLetterUploaded = () => {
    setHasCoverLetter(true);
    toast.success('Cover letter uploaded successfully!');
  };

  const handleResendVerification = async () => {
    if (!user?.email) return;
    
    setResendLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: user.email,
        options: {
          emailRedirectTo: window.location.origin
        }
      });
      
      if (error) {
        toast.error(error.message);
      } else {
        toast.success('Verification email sent! Please check your inbox.');
      }
    } finally {
      setResendLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  if (!user?.email_confirmed_at) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle>Please Verify Your Email</CardTitle>
            <CardDescription>
              Your account is not verified. Click the button to send a new verification link.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={handleResendVerification} 
              disabled={resendLoading}
              className="w-full"
            >
              {resendLoading ? 'Sending...' : 'Resend Verification Email'}
            </Button>
          </CardContent>
        </Card>
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
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate('/settings')} size="sm">
            <SettingsIcon className="w-4 h-4 mr-2" />
            Settings
          </Button>
          <ThemeToggle />
          <Button variant="outline" onClick={signOut} size="sm">
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
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
        ) : !hasCoverLetter ? (
          <Card className="max-w-2xl mx-auto shadow-[var(--shadow-card)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Upload Your Master Cover Letter
              </CardTitle>
              <CardDescription>
                Upload your LaTeX cover letter. We'll optimize it for each job application.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CoverLetterUpload onUploadSuccess={handleCoverLetterUploaded} />
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="optimize" className="space-y-6">
            <TabsList className="grid w-full max-w-3xl mx-auto grid-cols-3">
              <TabsTrigger value="optimize">
                <Sparkles className="w-4 h-4 mr-2" />
                Optimize
              </TabsTrigger>
              <TabsTrigger value="history">
                <Download className="w-4 h-4 mr-2" />
                History
              </TabsTrigger>
              <TabsTrigger value="tracking">
                <Target className="w-4 h-4 mr-2" />
                Tracking
              </TabsTrigger>
            </TabsList>

            <TabsContent value="optimize" className="space-y-6">
              <Card className="shadow-[var(--shadow-card)]">
                <CardHeader>
                  <CardTitle>Submit Job Description</CardTitle>
                  <CardDescription>
                    Paste the job description you're applying for, and our AI will optimize your resume and cover letter for maximum ATS compatibility.
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

            <TabsContent value="tracking">
              <ApplicationTracking />
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}
