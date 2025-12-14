-- Drop the problematic unique constraint
ALTER TABLE public.resumes DROP CONSTRAINT IF EXISTS resumes_user_id_is_current_key;

-- Create a partial unique index that only enforces uniqueness when is_current = true
CREATE UNIQUE INDEX resumes_user_id_current_unique ON public.resumes (user_id) WHERE is_current = true;