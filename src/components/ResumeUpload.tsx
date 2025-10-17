import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Upload } from 'lucide-react';

interface ResumeUploadProps {
  onUploadSuccess: () => void;
}

export default function ResumeUpload({ onUploadSuccess }: ResumeUploadProps) {
  const { user } = useAuth();
  const [latexContent, setLatexContent] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    if (!user || !latexContent.trim()) {
      toast.error('Please enter your LaTeX resume content');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.from('resumes').insert({
        user_id: user.id,
        latex_content: latexContent,
        version: 1,
        is_current: true,
      });

      if (error) throw error;

      toast.success('Resume uploaded successfully!');
      onUploadSuccess();
    } catch (error: any) {
      console.error('Error uploading resume:', error);
      toast.error(error.message || 'Failed to upload resume');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="latex-content">LaTeX Resume Content</Label>
        <Textarea
          id="latex-content"
          placeholder="Paste your LaTeX resume here..."
          value={latexContent}
          onChange={(e) => setLatexContent(e.target.value)}
          className="min-h-[300px] font-mono text-sm"
        />
        <p className="text-sm text-muted-foreground">
          Paste your complete LaTeX resume source code here. This will be your master resume that we'll optimize for each job application.
        </p>
      </div>
      <Button onClick={handleUpload} disabled={loading} className="w-full">
        <Upload className="w-4 h-4 mr-2" />
        {loading ? 'Uploading...' : 'Upload Resume'}
      </Button>
    </div>
  );
}
