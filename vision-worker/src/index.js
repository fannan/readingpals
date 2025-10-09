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
        text: prompt || "Transcribe EXACTLY word-for-word all text visible in these images. Include:\n\n1. All printed text - copy it exactly as written\n2. All handwritten text - transcribe it exactly, including any spelling errors or unclear words (mark unclear words with [unclear])\n3. All questions, answers, and instructions on worksheets\n4. All labels, captions, and annotations\n5. The layout and structure (indicate which text is a title, question number, answer, etc.)\n\nDo NOT summarize or paraphrase. Copy the text exactly as it appears. For worksheets, preserve the question-answer structure. For diagrams, transcribe any labels or text within them.",
      });

      // Call Anthropic API
      console.log('Calling Anthropic API with', images.length, 'images');

      const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 4096,
          messages: [
            {
              role: 'user',
              content: content,
            },
          ],
        }),
      });

      if (!anthropicResponse.ok) {
        const errorText = await anthropicResponse.text();
        console.error('Anthropic API error:', errorText);
        return new Response(JSON.stringify({
          error: 'Anthropic API error',
          details: errorText
        }), {
          status: anthropicResponse.status,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      const result = await anthropicResponse.json();
      const transcription = result.content?.[0]?.text || 'No transcription available';

      console.log('Transcription successful');

      return new Response(JSON.stringify({
        transcription,
        success: true
      }), {
        status: 200,
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
