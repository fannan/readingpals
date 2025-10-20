// Cloudflare Worker to call Anthropic Vision API
// This worker receives photos and uses Claude to describe them

export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    // Only allow POST requests
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      const { images, prompt } = await request.json();

      if (!images || !Array.isArray(images) || images.length === 0) {
        return new Response(JSON.stringify({ error: 'No images provided' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Get the Anthropic API key from Cloudflare secrets
      const apiKey = env.claude_key;
      if (!apiKey) {
        return new Response(JSON.stringify({ error: 'API key not configured' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Build the content array for Anthropic API
      const content = [];

      // Add all images to the content
      for (const image of images) {
        // Extract base64 data (remove data:image/jpeg;base64, prefix if present)
        const base64Data = image.data.includes('base64,')
          ? image.data.split('base64,')[1]
          : image.data;

        // Determine media type
        const mediaType = image.type || 'image/jpeg';

        content.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: mediaType,
            data: base64Data,
          },
        });
      }

      // Add the text prompt
      content.push({
        type: 'text',
        text: prompt || "Please transcribe and describe everything you see in these images. Include all visible text, handwriting, drawings, diagrams, and any other relevant content. Be thorough and detailed.",
      });

      // Call Anthropic API with retry logic for overloaded errors
      console.log('Calling Anthropic API with', images.length, 'images');

      const maxRetries = 3;
      const baseDelay = 1000; // 1 second
      let lastError = null;

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          if (attempt > 0) {
            // Exponential backoff: 1s, 2s, 4s
            const delay = baseDelay * Math.pow(2, attempt - 1);
            console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms delay`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }

          // Prepare request body
          const requestBody = {
            model: 'claude-3-5-haiku-20241022',  // Using Haiku for faster, cheaper image transcription
            max_tokens: 4096,
            messages: [
              {
                role: 'user',
                content: content,
              },
            ],
          };

          // Log the request details (without base64 image data to keep logs clean)
          const contentSummary = content.map(item => {
            if (item.type === 'image') {
              return {
                type: 'image',
                media_type: item.source.media_type,
                data_size: item.source.data?.length || 0
              };
            }
            return item;
          });

          console.log('=====================================');
          console.log(`ANTHROPIC REQUEST (Attempt ${attempt + 1}/${maxRetries})`);
          console.log('Model:', requestBody.model);
          console.log('Max Tokens:', requestBody.max_tokens);
          console.log('Content Items:', JSON.stringify(contentSummary, null, 2));
          console.log('=====================================');

          const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify(requestBody),
          });

          if (!anthropicResponse.ok) {
            const errorText = await anthropicResponse.text();
            let errorData;
            try {
              errorData = JSON.parse(errorText);
            } catch {
              errorData = { error: { message: errorText } };
            }

            const errorCode = errorData.error?.type;

            console.log('=====================================');
            console.log(`ANTHROPIC ERROR RESPONSE (Attempt ${attempt + 1}/${maxRetries})`);
            console.log('Status:', anthropicResponse.status);
            console.log('Error Type:', errorCode);
            console.log('Error Details:', JSON.stringify(errorData, null, 2));
            console.log('=====================================');

            // Check if this is a retryable error (overloaded_error or rate_limit_error)
            if (errorCode === 'overloaded_error' || anthropicResponse.status === 529) {
              lastError = { errorText, status: anthropicResponse.status };
              // Continue to next retry attempt
              continue;
            }

            // For non-retryable errors, return immediately
            return new Response(JSON.stringify({
              error: 'Anthropic API error',
              details: errorText,
              code: errorCode
            }), {
              status: anthropicResponse.status,
              headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
              },
            });
          }

          // Success! Parse and return result
          const result = await anthropicResponse.json();
          const transcription = result.content?.[0]?.text || 'No transcription available';

          console.log('=====================================');
          console.log(`ANTHROPIC SUCCESS RESPONSE (Attempt ${attempt + 1}/${maxRetries})`);
          console.log('Model:', result.model);
          console.log('Stop Reason:', result.stop_reason);
          console.log('Input Tokens:', result.usage?.input_tokens);
          console.log('Output Tokens:', result.usage?.output_tokens);
          console.log('Transcription Length:', transcription.length, 'characters');
          console.log('Transcription Preview:', transcription.substring(0, 200) + '...');
          console.log('=====================================');

          return new Response(JSON.stringify({
            transcription,
            success: true,
            attempts: attempt + 1
          }), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          });

        } catch (fetchError) {
          console.error(`Fetch error (attempt ${attempt + 1}):`, fetchError);
          lastError = { error: fetchError.message };
          // Continue to next retry attempt
        }
      }

      // All retries exhausted
      console.error('All retry attempts exhausted');
      return new Response(JSON.stringify({
        error: 'Anthropic API overloaded',
        details: 'The API is currently overloaded. Please try again in a moment.',
        lastError: lastError
      }), {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });

    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({
        error: 'Internal server error',
        details: error.message
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  },
};
