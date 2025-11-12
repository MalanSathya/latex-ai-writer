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
    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const { latex } = await req.json();

    if (!latex) {
      return new Response(
        JSON.stringify({ error: 'Missing latex content' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Fetch API key from user settings server-side
    const { data: settings, error: settingsError } = await supabaseClient
      .from('user_settings')
      .select('latex_api_key')
      .eq('user_id', user.id)
      .maybeSingle();

    if (settingsError) {
      console.error('Error fetching settings:', settingsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch user settings' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const apiKey = settings?.latex_api_key;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'LaTeX API key not configured. Please add it in Settings.' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Calling external API with latex length:', latex.length);
    
    // Call the external LaTeX to PDF API with binary format support
    const response = await fetch('https://mynsuwuznnjqwhaurcmk.supabase.co/functions/v1/latex-convert?format=binary', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/pdf',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({ latex }),
    });

    console.log('External API response status:', response.status);
    console.log('External API response content-type:', response.headers.get('content-type'));

    const contentType = response.headers.get('content-type');

    if (!response.ok) {
      // Try to parse error response as JSON or text
      const responseText = await response.text();
      let errorMessage = 'Failed to generate PDF';
      
      if (contentType?.includes('application/json')) {
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.error || errorData.details || errorMessage;
        } catch (e) {
          errorMessage = `API returned error: ${responseText.substring(0, 200)}`;
        }
      } else {
        errorMessage = `API returned error (status ${response.status}). Check your API key or the external service status.`;
      }
      
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { 
          status: response.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Handle binary PDF response
    if (contentType?.includes('application/pdf')) {
      console.log('Received binary PDF response');
      
      // Get the PDF as array buffer and convert to base64
      const pdfBuffer = await response.arrayBuffer();
      const pdfBase64 = btoa(String.fromCharCode(...new Uint8Array(pdfBuffer)));
      const pdfDataUrl = `data:application/pdf;base64,${pdfBase64}`;
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          pdfUrl: pdfDataUrl 
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Fallback: try to parse as JSON (for backwards compatibility)
    const responseText = await response.text();
    console.log('Response body (first 500 chars):', responseText.substring(0, 500));
    
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error('Failed to parse response as JSON:', e);
      return new Response(
        JSON.stringify({ error: 'Invalid response format from PDF service' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    return new Response(
      JSON.stringify(data),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Error in latex-to-pdf-proxy:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});





// import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// const corsHeaders = {
//   'Access-Control-Allow-Origin': '*',
//   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
// };

// serve(async (req) => {
//   if (req.method === 'OPTIONS') {
//     return new Response(null, { headers: corsHeaders });
//   }

//   try {
//     const { latex, apiKey } = await req.json();

//     if (!latex || !apiKey) {
//       return new Response(
//         JSON.stringify({ error: 'Missing latex content or API key' }),
//         { 
//           status: 400, 
//           headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
//         }
//       );
//     }

//     console.log('Calling external API with latex length:', latex.length);
    
//     // Call the external LaTeX to PDF API
//     const response = await fetch('https://mynsuwuznnjqwhaurcmk.supabase.co/functions/v1/latex-convert', {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//         'x-api-key': apiKey,
//       },
//       body: JSON.stringify({ latex }),
//     });

//     console.log('External API response status:', response.status);
//     console.log('External API response content-type:', response.headers.get('content-type'));

//     const contentType = response.headers.get('content-type');
//     const responseText = await response.text();
    
//     console.log('Response body (first 500 chars):', responseText.substring(0, 500));

//     if (!response.ok) {
//       // Try to parse as JSON, but handle HTML responses
//       let errorMessage = 'Failed to generate PDF';
//       if (contentType?.includes('application/json')) {
//         try {
//           const errorData = JSON.parse(responseText);
//           errorMessage = errorData.error || errorData.details || errorMessage;
//         } catch (e) {
//           errorMessage = `API returned error: ${responseText.substring(0, 200)}`;
//         }
//       } else {
//         errorMessage = `API returned HTML error (status ${response.status}). Check your API key or the external service status.`;
//       }
      
//       return new Response(
//         JSON.stringify({ error: errorMessage }),
//         { 
//           status: response.status, 
//           headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
//         }
//       );
//     }

//     // Parse successful response
//     let data;
//     try {
//       data = JSON.parse(responseText);
//     } catch (e) {
//       console.error('Failed to parse response as JSON:', e);
//       return new Response(
//         JSON.stringify({ error: 'Invalid response format from PDF service' }),
//         { 
//           status: 500, 
//           headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
//         }
//       );
//     }

//     return new Response(
//       JSON.stringify(data),
//       { 
//         status: 200, 
//         headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
//       }
//     );
//   } catch (error) {
//     console.error('Error in latex-to-pdf-proxy:', error);
//     const errorMessage = error instanceof Error ? error.message : 'Internal server error';
//     return new Response(
//       JSON.stringify({ error: errorMessage }),
//       { 
//         status: 500, 
//         headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
//       }
//     );
//   }
// });
