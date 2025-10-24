import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!openaiApiKey) {
      return new Response(JSON.stringify({ error: 'OpenAI API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { jobDescriptionId } = await req.json();

    if (!jobDescriptionId) {
      return new Response(JSON.stringify({ error: 'Missing jobDescriptionId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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
4. Maintain LaTeX formatting integrity - CRITICAL: Always escape special LaTeX characters:
   - Use \\& instead of & (ampersand)
   - Use \\% instead of % (percent)
   - Use \\$ instead of $ (dollar sign)
   - Use \\# instead of # (hash)
   - Use \\_ instead of _ (underscore)
   - Use \\{ and \\} instead of { and } (braces)
   - Use \\textasciitilde for ~ (tilde)
   - Use \\textasciicircum for ^ (caret)
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

    console.log('Calling OpenAI API...');
    
    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: 'system', content: 'You are an expert ATS resume optimizer. Always respond with valid JSON.' },
          { role: 'user', content: aiPrompt }
        ],
        response_format: { type: 'json_object' }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('OpenAI API error:', aiResponse.status, errorText);
      throw new Error(`OpenAI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    console.log('OpenAI response received');

    if (!aiData.choices || aiData.choices.length === 0 || !aiData.choices[0].message || !aiData.choices[0].message.content) {
      throw new Error('Invalid AI response structure');
    }

    let aiContent;
    try {
      aiContent = JSON.parse(aiData.choices[0].message.content);
    } catch (jsonError) {
      console.error('Failed to parse AI response:', aiData.choices[0].message.content);
      throw new Error(`Failed to parse AI response JSON: ${jsonError.message}`);
    }

    if (!aiContent.optimized_latex || !aiContent.suggestions || typeof aiContent.ats_score === 'undefined') {
      throw new Error('Missing expected fields in AI response');
    }

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

    return new Response(JSON.stringify(optimization), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in optimize-resume:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
