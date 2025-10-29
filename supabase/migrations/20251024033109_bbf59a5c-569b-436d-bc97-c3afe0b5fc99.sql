-- Create function to update timestamps (if it doesn't exist)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create cover_letters table
CREATE TABLE IF NOT EXISTS public.cover_letters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  original_content TEXT NOT NULL,
  is_current BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.cover_letters ENABLE ROW LEVEL SECURITY;

-- Create policies for cover_letters
CREATE POLICY "Users can view their own cover letters"
ON public.cover_letters
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own cover letters"
ON public.cover_letters
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own cover letters"
ON public.cover_letters
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own cover letters"
ON public.cover_letters
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_cover_letters_updated_at
BEFORE UPDATE ON public.cover_letters
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add cover_letter_id to optimizations table
ALTER TABLE public.optimizations
ADD COLUMN IF NOT EXISTS cover_letter_id UUID REFERENCES public.cover_letters(id),
ADD COLUMN IF NOT EXISTS optimized_cover_letter TEXT;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_cover_letters_user_id ON public.cover_letters(user_id);
CREATE INDEX IF NOT EXISTS idx_cover_letters_current ON public.cover_letters(user_id, is_current) WHERE is_current = true;