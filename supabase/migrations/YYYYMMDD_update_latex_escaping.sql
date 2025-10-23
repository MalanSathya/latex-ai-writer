-- Create settings table for user preferences
CREATE TABLE public.user_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  ai_prompt text NOT NULL DEFAULT 'You are an expert ATS (Applicant Tracking System) resume optimizer. 

Given the following LaTeX resume and job description, optimize the resume to maximize ATS compatibility while maintaining authenticity.

INSTRUCTIONS:
1. Identify key keywords and phrases from the job description
2. Modify the LaTeX resume to incorporate these keywords naturally
3. Adjust bullet points to align with job requirements
4. Maintain LaTeX formatting integrity
5. Keep the changes truthful - don''t fabricate experience
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
   - Use \textbackslash{} instead of \ (backslash in text)',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own settings" 
ON public.user_settings 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings" 
ON public.user_settings 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings" 
ON public.user_settings 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Add trigger for timestamps
CREATE TRIGGER update_user_settings_updated_at
BEFORE UPDATE ON public.user_settings
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();