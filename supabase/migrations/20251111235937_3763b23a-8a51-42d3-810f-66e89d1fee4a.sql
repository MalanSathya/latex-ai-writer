-- Add Mistral API key column to user_settings
ALTER TABLE public.user_settings
ADD COLUMN mistral_api_key TEXT;