# Reading Pals Feedback Tracker - Setup Guide

This guide will walk you through setting up the Reading Pals feedback tracker with Google Cloud Storage.

## Prerequisites

1. Google Cloud Platform account
2. Basic understanding of web hosting
3. Domain or hosting service for the web application

## Step 1: Google Cloud Project Setup

### 1.1 Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Enter project name: `reading-pals-feedback`
4. Click "Create"

### 1.2 Enable Required APIs

1. In the Google Cloud Console, go to "APIs & Services" → "Library"
2. Search for and enable:
   - **Cloud Storage API**
   - **Identity and Access Management (IAM) API**

## Step 2: Create Cloud Storage Bucket

### 2.1 Create the Bucket

1. Go to "Cloud Storage" → "Buckets"
2. Click "Create Bucket"
3. Configure:
   - **Name**: `reading-pals-feedback` (must be globally unique)
   - **Location**: Choose region closest to your volunteers
   - **Storage class**: Standard
   - **Access control**: Uniform (bucket-level)
4. Click "Create"

### 2.2 Configure CORS for Browser Uploads

1. Click on your bucket name
2. Go to "Permissions" tab
3. Click "Cross-origin resource sharing (CORS)"
4. Add this CORS configuration:

```json
[
  {
    "origin": ["*"],
    "method": ["GET", "POST", "PUT", "OPTIONS"],
    "responseHeader": ["Content-Type", "Authorization"],
    "maxAgeSeconds": 3600
  }
]
```

**Note**: For production, replace `"*"` with your specific domain.

## Step 3: Authentication Setup

You have two options for authentication:

### Option A: OAuth 2.0 (Recommended)

#### 3.1 Create OAuth Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth 2.0 Client IDs"
3. Choose "Web application"
4. Configure:
   - **Name**: `Reading Pals Feedback App`
   - **Authorized JavaScript origins**: Add your domain(s)
     - `http://localhost:8080` (for testing)
     - `https://yourdomain.com` (for production)
   - **Authorized redirect URIs**: Same as origins
5. Click "Create"
6. Copy the **Client ID** (you'll need this for configuration)

#### 3.2 Set Bucket Permissions

1. Go to your Cloud Storage bucket
2. Click "Permissions" tab
3. Click "Grant Access"
4. Add these roles for your OAuth client:
   - **Principal**: Use the email of users who will authenticate
   - **Role**: `Storage Object Creator`

### Option B: Service Account (Alternative)

#### 3.1 Create Service Account

1. Go to "IAM & Admin" → "Service Accounts"
2. Click "Create Service Account"
3. Configure:
   - **Name**: `feedback-uploader`
   - **Description**: `Service account for feedback uploads`
4. Click "Create and Continue"
5. Add role: `Storage Object Creator`
6. Click "Done"

#### 3.2 Generate Key

1. Click on the created service account
2. Go to "Keys" tab
3. Click "Add Key" → "Create new key"
4. Choose "JSON" format
5. Download the key file

**⚠️ Security Warning**: Never commit service account keys to version control!

## Step 4: Configure the Application

### 4.1 Update Configuration

Edit `config.js` and update these values:

```javascript
const CONFIG = {
    googleCloud: {
        // Your project ID
        projectId: 'reading-pals-feedback',

        // Your bucket name
        bucketName: 'reading-pals-feedback',

        // For OAuth setup
        oauth: {
            clientId: 'YOUR_OAUTH_CLIENT_ID_HERE'
        }
    }
};
```

### 4.2 Update Volunteer List

In `index.html`, update the volunteer dropdown with your actual volunteer names:

```html
<select class="form-select volunteer-select" id="volunteerSelect" required>
    <option value="">Choose your name...</option>
    <option value="john-doe">John Doe</option>
    <option value="jane-smith">Jane Smith</option>
    <!-- Add your volunteers here -->
</select>
```

## Step 5: Deploy the Application

### 5.1 Simple Hosting Options

The app is a static web application that can be hosted anywhere:

- **GitHub Pages**: Free hosting for public repositories
- **Netlify**: Free tier with easy deployment
- **Vercel**: Free hosting with automatic deployments
- **Firebase Hosting**: Google's hosting service
- **Any web server**: Upload files to your web hosting

### 5.2 GitHub Pages Deployment

1. Push your code to a GitHub repository
2. Go to repository "Settings" → "Pages"
3. Choose source: "Deploy from a branch"
4. Select branch: `main` or `v1`
5. Your app will be available at: `https://yourusername.github.io/readingpals`

## Step 6: Testing

### 6.1 Local Testing

1. Start a local web server:
   ```bash
   # Python 3
   python -m http.server 8080

   # Node.js (if you have http-server installed)
   npx http-server -p 8080
   ```

2. Open `http://localhost:8080` in your browser
3. Test the recording functionality

### 6.2 Production Testing

1. Deploy to your hosting service
2. Test with different devices (phones, tablets)
3. Verify uploads are working by checking your Cloud Storage bucket

## Step 7: Create Personalized Links

Generate personalized links for each volunteer:

```
https://yourdomain.com/?volunteer=john-doe
https://yourdomain.com/?volunteer=jane-smith
```

The app will automatically pre-select the volunteer name from the URL parameter.

## Troubleshooting

### Common Issues

1. **"Microphone access denied"**
   - Ensure you're using HTTPS (required for microphone access)
   - Check browser permissions

2. **"Upload failed"**
   - Verify your Google Cloud configuration
   - Check browser console for error details
   - Ensure CORS is properly configured

3. **OAuth errors**
   - Verify your OAuth client ID is correct
   - Check that your domain is in the authorized origins

### Getting Help

- Check the browser console for error messages
- Verify your Google Cloud Storage bucket permissions
- Test with a simple audio file first

## Security Considerations

1. **Domain Restrictions**: Update CORS settings to only allow your domain
2. **Authentication**: Consider implementing user authentication for production
3. **File Validation**: The app validates file types and sizes
4. **Regular Backups**: Set up automated backups of your storage bucket

## Cost Estimation

- **Cloud Storage**: ~$0.02 per GB per month
- **API Calls**: Minimal cost for uploads
- **Bandwidth**: ~$0.12 per GB of data transferred

For typical usage (100 volunteers, 5-minute recordings, twice per week), expect costs under $5/month.

---

## Next Steps

After setup is complete:

1. Train volunteers on how to use the system
2. Set up monitoring and alerts
3. Create a process for reviewing uploaded feedback
4. Consider adding features like transcription or categorization