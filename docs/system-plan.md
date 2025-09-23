# Reading Pals Feedback Tracker System Plan

## System Overview
Build a simple, single-page web application for volunteers to submit voice feedback after reading sessions.

## Technology Stack
- **Frontend**: HTML/CSS/JavaScript with Bootstrap 5 for polished UI
- **Voice Recording**: Web Audio API (browser-based recording)
- **Storage**: Google Cloud Storage (direct upload, no server needed)
- **Server**: None required - fully client-side solution

## Implementation Steps

1. **Create Bootstrap-Styled Web Page**
   - Beautiful, responsive interface with:
     - Bootstrap card layout
     - Styled volunteer name dropdown
     - Large, prominent "Record Feedback" button
     - Visual recording indicator with progress
     - Clean submit button

2. **Voice Recording Feature**
   - Use MediaRecorder API for browser-based recording
   - Save as .webm or .mp3 format
   - Bootstrap progress bar for recording timer
   - Visual feedback with icons and animations

3. **Google Cloud Storage Integration**
   - Use Google Cloud Storage JSON API for direct file uploads
   - CORS-enabled bucket for browser uploads
   - Save recordings with timestamp and volunteer name
   - Organized bucket structure: `reading-pals-feedback/YYYY-MM-DD/volunteer-name-timestamp.webm`
   - Client-side authentication with Google OAuth or service account

4. **URL Parameter Support**
   - Parse URL params to pre-select volunteer
   - Example: `feedback.html?volunteer=JohnDoe`

5. **Setup Requirements**
   - Create Google Cloud project
   - Create Cloud Storage bucket with CORS enabled
   - Enable Cloud Storage API
   - Configure authentication (OAuth or service account key)

## Key Features
- **Beautiful Bootstrap UI** - Professional, polished appearance
- **Mobile-friendly design** - Works perfectly on phones/tablets
- **No server required** - Direct upload to Google Cloud Storage
- **Simple one-click recording** - Just select volunteer and record
- **Auto-save with metadata** - Timestamp and volunteer name included
- **Personalized links** - Each volunteer gets their own URL
- **Offline capable** - Records locally, uploads when connected

## Benefits of This Approach
- **Zero server costs** - Just host static files anywhere
- **Easy deployment** - Upload HTML file to any web hosting
- **Scalable & Reliable** - Google Cloud Storage handles all file storage
- **Cost-effective** - Storage pricing lower than Google Drive
- **Secure** - Google authentication with fine-grained permissions
- **Maintainable** - Simple client-side code only
- **Better for automation** - Purpose-built for programmatic uploads

This creates a beautiful, serverless system perfect for non-technical volunteers to quickly record feedback after each reading session.