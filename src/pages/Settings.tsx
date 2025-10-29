import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Settings as SettingsIcon, Save, ChevronLeft } from 'lucide-react';

export default function Settings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [aiPrompt, setAiPrompt] = useState('');
  const [latexApiKey, setLatexApiKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, [user]);

  const loadSettings = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('user_settings')
      .select('ai_prompt, latex_api_key')
      .eq('user_id', user.id)
      .maybeSingle();
    
    if (error) {
      console.error('Error loading settings:', error);
      toast.error('Failed to load settings');
    } else if (data) {
      setAiPrompt(data.ai_prompt);
      setLatexApiKey(data.latex_api_key || '');
    } else {
      // Use default prompt
      setAiPrompt(`You are an expert ATS (Applicant Tracking System) resume optimizer. 

Given the following LaTeX resume and job description, optimize the resume to maximize ATS compatibility while maintaining authenticity.

INSTRUCTIONS:
1. Identify key keywords and phrases from the job description
2. Modify the LaTeX resume to incorporate these keywords naturally
3. Adjust bullet points to align with job requirements
4. Maintain LaTeX formatting integrity
5. Keep the changes truthful - don't fabricate experience
6. Provide an ATS compatibility score (0-100)
7. Include specific suggestions for improvement
8. CRITICAL: Properly escape all special LaTeX characters in the output:
   - Use \& instead of & (ampersand)
   - Use \$ instead of $ (dollar sign)
   - Use \% instead of % (percent)
   - Use \# instead of # (hash)
   - Use \_ instead of _ (underscore)
   - Use \{ and \} instead of { } (braces)
   - Use \textasciitilde{} instead of ~ (tilde)
   - Use \textasciicircum{} instead of ^ (caret)
   - Use \textbackslash{} instead of \ (backslash in text)`);
    }
    
    setLoading(false);
  };

  const handleSave = async () => {
    if (!user) return;
    
    setSaving(true);
    
    const { error } = await supabase
      .from('user_settings')
      .upsert({
        user_id: user.id,
        ai_prompt: aiPrompt,
        latex_api_key: latexApiKey,
      }, {
        onConflict: 'user_id'
      });
    
    if (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } else {
      toast.success('Settings saved successfully!');
    }
    
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
        <ChevronLeft className="w-4 h-4 mr-2" />
        Back
      </Button>
      <Card className="shadow-[var(--shadow-card)]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-primary" />
            AI Optimization Settings
          </CardTitle>
          <CardDescription>
            Customize the AI prompt used for ATS resume optimization. This prompt guides how the AI analyzes job descriptions and optimizes your resume.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ai-prompt">AI System Prompt</Label>
            <Textarea
              id="ai-prompt"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              rows={15}
              className="font-mono text-sm"
              placeholder="Enter your custom AI prompt here..."
            />
            <p className="text-xs text-muted-foreground">
              The prompt should include placeholders for the resume and job description. The AI will use this to optimize your LaTeX resume.
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="latex-api-key">LaTeX to PDF API Key</Label>
            <Input
              id="latex-api-key"
              type="password"
              value={latexApiKey}
              onChange={(e) => setLatexApiKey(e.target.value)}
              placeholder="Enter your LaTeX to PDF API key"
            />
            <p className="text-xs text-muted-foreground">
              Get your API key from{' '}
              <a 
                href="https://latex-to-pdf.lovable.app" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                latex-to-pdf.lovable.app
              </a>
            </p>
          </div>
          
          <Button onClick={handleSave} disabled={saving} className="w-full">
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </CardContent>
      </Card>

    </div>
  );
}
