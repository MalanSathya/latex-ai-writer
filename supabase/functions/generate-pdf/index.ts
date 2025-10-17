import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Get auth user
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { optimizationId } = await req.json();

    // Fetch optimization
    const { data: optimization, error: optError } = await supabase
      .from('optimizations')
      .select('*')
      .eq('id', optimizationId)
      .eq('user_id', user.id)
      .single();

    if (optError) throw optError;

    // Use LaTeX.Online API to compile LaTeX to PDF
    const latexApiUrl = 'https://latexonline.cc/compile';
    
    // Create FormData with the LaTeX content
    const formData = new FormData();
    const latexBlob = new Blob([optimization.optimized_latex], { type: 'text/plain' });
    formData.append('file', latexBlob, 'resume.tex');
    formData.append('command', 'pdflatex');

    const pdfResponse = await fetch(latexApiUrl, {
      method: 'POST',
      body: formData,
    });

    if (!pdfResponse.ok) {
      throw new Error('Failed to compile LaTeX to PDF');
    }

    // Get PDF as buffer
    const pdfBuffer = await pdfResponse.arrayBuffer();
    const pdfBase64 = btoa(String.fromCharCode(...new Uint8Array(pdfBuffer)));

    return new Response(JSON.stringify({ pdf: pdfBase64 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in generate-pdf:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
