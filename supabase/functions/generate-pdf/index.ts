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

    const { optimizationId, latex } = await req.json();

    let latexContent = latex;

    // If optimizationId provided, fetch from database
    if (optimizationId && !latex) {
      // Fetch optimization
      const { data: optimization, error: optError } = await supabase
        .from('optimizations')
        .select('*')
        .eq('id', optimizationId)
        .eq('user_id', user.id)
        .single();

      if (optError) throw optError;
      latexContent = optimization.optimized_latex;
    }

    if (!latexContent) {
      return new Response(JSON.stringify({ error: 'No LaTeX content provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }


    // Sanitize LaTeX (fix unsupported options like 6pt)
    const sanitizeLatex = (input: string) => {
      let out = input;
      // Replace invalid 6pt option with 10pt for article class
      out = out.replace(/\\documentclass\[(.*?)\]\{article\}/s, (m: string, opts: string) => {
        const newOpts = opts
          .split(',')
          .map((o: string) => (o.trim() === '6pt' ? '10pt' : o.trim()))
          .filter(Boolean)
          .join(',');
        return `\\documentclass[${newOpts}]{article}`;
      });
      return out;
    };

    const safeLatex = sanitizeLatex(latexContent);
    console.log('Sanitized LaTeX:', safeLatex.substring(0, 200));

    // Try LaTeX.Online API first
    const latexApiUrl = 'https://latexonline.cc/compile';
    
    // Create FormData with the LaTeX content
    const formData = new FormData();
    const latexBlob = new Blob([safeLatex], { type: 'text/plain' });
    formData.append('file', latexBlob, 'document.tex');
    formData.append('command', 'pdflatex');

    let pdfBuffer: ArrayBuffer | null = null;
    let firstError: string | null = null;

    const pdfResponse = await fetch(latexApiUrl, {
      method: 'POST',
      body: formData,
    });

    console.log('latexonline.cc response status:', pdfResponse.status);

    if (pdfResponse.ok) {
      // Get PDF as buffer
      pdfBuffer = await pdfResponse.arrayBuffer();
      console.log('PDF buffer size:', pdfBuffer.byteLength);
    } else {
      try {
        firstError = await pdfResponse.text();
        console.log('latexonline.cc error:', firstError.substring(0, 500));
      } catch (_) {
        firstError = 'Unknown compile error from latexonline.cc';
      }
    }

    // Fallback to rtex if first attempt failed
    if (!pdfBuffer) {
      console.log('Trying fallback rtex service...');
      const rtexResp = await fetch('https://rtex.probablyaweb.site/api/v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: safeLatex, format: 'pdf' }),
      });

      console.log('rtex response status:', rtexResp.status);

      if (rtexResp.ok) {
        const rtexData = await rtexResp.json();
        console.log('rtex data status:', rtexData.status);
        if (rtexData.status === 'success' && rtexData.result) {
          // rtex returns base64 PDF
          const pdfBase64 = rtexData.result as string;
          const pdfDataUrl = `data:application/pdf;base64,${pdfBase64}`;

          return new Response(JSON.stringify({ 
            success: true, 
            pdfUrl: pdfDataUrl 
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } else {
          console.log('rtex error:', rtexData.log?.substring(0, 500));
        }
      }

      const details = firstError ? `: ${firstError.slice(0, 500)}` : '';
      throw new Error(`Failed to compile LaTeX to PDF${details}`);
    }

    const pdfBase64 = btoa(String.fromCharCode(...new Uint8Array(pdfBuffer)));
    const pdfDataUrl = `data:application/pdf;base64,${pdfBase64}`;

    return new Response(JSON.stringify({ 
      success: true, 
      pdfUrl: pdfDataUrl 
    }), {
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
