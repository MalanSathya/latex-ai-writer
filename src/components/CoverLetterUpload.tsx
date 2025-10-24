import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { FileText, Upload } from 'lucide-react';

interface CoverLetterUploadProps {
  onUploadSuccess: () => void;
}

export default function CoverLetterUpload({ onUploadSuccess }: CoverLetterUploadProps) {
  const { user } = useAuth();
  const [coverLetterContent, setCoverLetterContent] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    if (!user || !coverLetterContent.trim()) {
      toast.error('Please enter your cover letter content');
      return;
    }

    setLoading(true);

    try {
      // Set all previous cover letters to not current
      await supabase
        .from('cover_letters')
        .update({ is_current: false })
        .eq('user_id', user.id)
        .eq('is_current', true);

      // Insert new cover letter
      const { error } = await supabase
        .from('cover_letters')
        .insert({
          user_id: user.id,
          original_content: coverLetterContent,
          is_current: true,
        });

      if (error) throw error;

      toast.success('Cover letter uploaded successfully!');
      setCoverLetterContent('');
      onUploadSuccess();
    } catch (error: any) {
      console.error('Error uploading cover letter:', error);
      toast.error(error.message || 'Failed to upload cover letter');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="shadow-[var(--shadow-card)]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          Upload Your Cover Letter
        </CardTitle>
        <CardDescription>
          Paste your original cover letter content here. It will be used as a template for job-specific optimizations.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="cover-letter">Cover Letter Content</Label>
          <Textarea
            id="cover-letter"
            value={coverLetterContent}
            onChange={(e) => setCoverLetterContent(e.target.value)}
            placeholder="Enter your cover letter content here..."
            className="min-h-[300px]"
          />
        </div>
        <Button onClick={handleUpload} disabled={loading} className="w-full">
          <Upload className="w-4 h-4 mr-2" />
          {loading ? 'Uploading...' : 'Upload Cover Letter'}
        </Button>
      </CardContent>
    </Card>
  );
}
