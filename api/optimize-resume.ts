
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

export default async function handler(req, res) {
  // Set CORS headers for preflight requests
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type');
    return res.status(200).json({ message: 'ok' });
  }

  // Set CORS headers for the main request
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type');

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const openaiApiKey = process.env.OPENAI_API_KEY;

    if (!supabaseUrl || !supabaseKey || !openaiApiKey) {
      return res.status(500).json({ error: 'Missing environment variables' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { jobDescriptionId } = req.body;

    if (!jobDescriptionId) {
      return res.status(400).json({ error: 'Missing jobDescriptionId' });
    }

    const { data: settings } = await supabase
      .from('user_settings')
      .select('ai_prompt')
      .eq('user_id', user.id)
      .maybeSingle();

    const customPrompt = settings?.ai_prompt || `You are an expert ATS (Applicant Tracking System) resume optimizer. 

Given the following LaTeX resume and job description, optimize the resume to maximize ATS compatibility while maintaining authenticity.

INSTRUCTIONS:
1. Identify key keywords and phrases from the job description
2. Modify the LaTeX resume to incorporate these keywords naturally
3. Adjust bullet points to align with job requirements
4. Maintain LaTeX formatting integrity
5. Keep the changes truthful - don't fabricate experience
6. Provide an ATS compatibility score (0-100)
7. Include specific suggestions for improvement`;

    const { data: jd, error: jdError } = await supabase
      .from('job_descriptions')
      .select('*')
      .eq('id', jobDescriptionId)
      .single();

    if (jdError) throw jdError;

    const { data: resume, error: resumeError } = await supabase
      .from('resumes')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_current', true)
      .single();

    if (resumeError) throw resumeError;

    const aiPrompt = `${customPrompt}\n\nRESUME:\n${resume.latex_content}\n\nJOB DESCRIPTION:\nTitle: ${jd.title}\nCompany: ${jd.company || 'Not specified'}\nDescription: ${jd.description}\n\nOUTPUT FORMAT:\nReturn a JSON object with these fields:\n- optimized_latex: The complete optimized LaTeX resume\n- suggestions: A detailed explanation of changes made\n- ats_score: A number between 0-100 representing ATS compatibility`;

    const openai = new OpenAI({ apiKey: openaiApiKey });

    const aiResponse = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: 'system', content: 'You are an expert ATS resume optimizer. Always respond with valid JSON.' },
        { role: 'user', content: aiPrompt }
      ],
      response_format: { type: 'json_object' }
    });

    const aiContent = JSON.parse(aiResponse.choices[0].message.content);

    const { data: optimization, error: optError } = await supabase
      .from('optimizations')
      .insert({
        user_id: user.id,
        job_description_id: jobDescriptionId,
        resume_id: resume.id,
        optimized_latex: aiContent.optimized_latex,
        suggestions: aiContent.suggestions,
        ats_score: aiContent.ats_score,
      })
      .select()
      .single();

    if (optError) throw optError;

    return res.status(200).json(optimization);

  } catch (error) {
    console.error('Error in optimize-resume:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return res.status(500).json({ error: errorMessage });
  }
}
