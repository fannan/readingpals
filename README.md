# Reading Pals Session Feedback Tracker

A simple, serverless web application for collecting voice feedback from volunteers in the Reading Pals program.

## Overview

This system enables volunteers to easily record and submit feedback after reading sessions with children. The interface is designed for non-technical users and works on mobile devices.

## Key Features

- **Beautiful Bootstrap UI** - Professional, polished appearance
- **Mobile-friendly design** - Works perfectly on phones/tablets
- **No server required** - Direct upload to Google Cloud Storage
- **Simple one-click recording** - Just select volunteer and record
- **Personalized links** - Each volunteer gets their own URL
- **Offline capable** - Records locally, uploads when connected

## Technology Stack

- **Frontend**: HTML/CSS/JavaScript with Bootstrap 5
- **Voice Recording**: Web Audio API
- **Storage**: Google Cloud Storage (direct upload)
- **Deployment**: Static files (can host anywhere)

## Setup

1. Create Google Cloud project
2. Set up Cloud Storage bucket with CORS enabled
3. Configure authentication
4. Deploy static files to web hosting

See `docs/system-plan.md` for detailed implementation plan.

## Project Status

🚧 **In Development** - Currently in planning and initial setup phase.