# Cloudflare Worker Deployment Instructions

## Overview
This Cloudflare Worker receives photos from the browser and uses Claude (Anthropic) to describe them.

## Prerequisites
- Cloudflare account
- Wrangler CLI installed (`npm install -g wrangler`)
- Your Anthropic API key already stored as `claude_key` in Cloudflare secrets

## Deployment Steps

### 1. Create a new Cloudflare Worker project

```bash
cd /Users/sean/Documents/MarcellaFoundation/ReadingPals/tracker
mkdir vision-worker
cd vision-worker
wrangler init
```

When prompted:
- Choose "Fetch handler" (not Module Worker)
- Say "no" to TypeScript (unless you prefer it)
- Say "no" to Git repository (optional)

### 2. Copy the worker code

Replace the contents of `src/index.js` (or `index.js`) with the code from `cloudflare-worker-vision.js`:

```bash
cp ../cloudflare-worker-vision.js src/index.js
```

Or manually copy the contents from `cloudflare-worker-vision.js` into your worker file.

### 3. Update wrangler.toml

Edit `wrangler.toml` to add your secret binding:

```toml
name = "reading-pals-vision"
main = "src/index.js"
compatibility_date = "2024-01-01"

[env.production.vars]
# Environment variables go here if needed

# Bind the claude_key secret
[[env.production.secrets]]
name = "claude_key"
```

### 4. Verify the secret exists

Check if your `claude_key` secret is already configured:

```bash
wrangler secret list
```

If it's not listed, add it:

```bash
wrangler secret put claude_key
```

Then paste your Anthropic API key when prompted.

### 5. Deploy the worker

```bash
wrangler deploy
```

This will deploy your worker and give you a URL like:
`https://reading-pals-vision.YOUR-SUBDOMAIN.workers.dev`

### 6. Update the frontend code

Once deployed, copy the worker URL and update `simple-supabase.js`:

```javascript
// Replace this line (around line 10):
this.claudeVisionWorkerUrl = 'https://YOUR-WORKER-NAME.YOUR-SUBDOMAIN.workers.dev';

// With your actual worker URL:
this.claudeVisionWorkerUrl = 'https://reading-pals-vision.YOUR-SUBDOMAIN.workers.dev';
```

### 7. Test the worker

You can test the worker directly with curl:

```bash
curl -X POST https://reading-pals-vision.YOUR-SUBDOMAIN.workers.dev \
  -H "Content-Type: application/json" \
  -d '{
    "images": [{
      "data": "data:image/jpeg;base64,/9j/4AAQ...",
      "type": "image/jpeg"
    }],
    "prompt": "Describe this image"
  }'
```

## Troubleshooting

### Worker returns "API key not configured"
- Make sure the secret is named exactly `claude_key`
- Verify with: `wrangler secret list`

### CORS errors
- The worker already includes CORS headers
- If still seeing errors, check browser console for details

### Worker not found
- Make sure you deployed: `wrangler deploy`
- Check the URL is correct
- Try accessing the URL directly in a browser (should return "Method not allowed")

## Monitoring

View worker logs in real-time:
```bash
wrangler tail
```

Or check logs in the Cloudflare dashboard:
1. Go to Workers & Pages
2. Click on your worker
3. Click "Logs" tab

## Cost Notes
- Cloudflare Workers Free tier: 100,000 requests/day
- Each photo upload counts as 1 request
- Anthropic API charges separately per image analyzed
