-- Add latex_api_key column to user_settings
ALTER TABLE public.user_settings
ADD COLUMN latex_api_key TEXT;