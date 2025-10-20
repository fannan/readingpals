# Reading Pals - Feedback Audit Admin Page

## Overview

The admin page provides a visual audit tool to track which volunteers have submitted feedback for each session date. It shows a grid of all expected volunteer-student pairings with green/red highlighting to indicate completion status.

## Access

The admin page is accessible at:
```
/admin/index.html
```

This URL is not linked from the main application but can be accessed directly by anyone who knows the URL.

## Features

1. **Date Selector** - Choose any session date to view feedback status
2. **Statistics Dashboard** - Shows total expected, completed, and missing feedback
3. **Volunteer Sections** - Each volunteer has their own section listing all their students
4. **Visual Status** - Green = feedback submitted, Red = feedback missing
5. **Refresh Button** - Manually refresh the audit data

## Required API Endpoint

For the admin page to work, you need to create a **GET endpoint** that returns feedback data for a specific date:

### Endpoint
```
GET https://tasks.sklabs.app/webhook/2f7e4694-d6a9-4adc-bf3d-3cc68da6c79c?date=YYYY-MM-DD
```

### Parameters
- `date` (required): The session date in YYYY-MM-DD format (e.g., "2025-10-09")

### Response Format

The endpoint should return an array of feedback submissions for that date:

```json
[
  {
    "volunteer": {
      "id": "volunteer_123",
      "name": "John Doe"
    },
    "student": {
      "id": "student_456",
      "name": "Jane Smith"
    },
    "feedback": {
      "urls": ["https://..."],
      "transcript": "...",
      "fileSize": 12345,
      "type": "audio"
    },
    "input_type": "Audio",
    "date": "2025-10-09"
  },
  {
    "volunteer": {
      "id": "volunteer_789",
      "name": "Alice Johnson"
    },
    "student": {
      "id": "student_012",
      "name": "Bob Williams"
    },
    "feedback": {
      "urls": ["https://...", "https://..."],
      "transcript": "...",
      "fileSize": 54321,
      "type": "photos"
    },
    "input_type": "Photo",
    "date": "2025-10-09"
  }
]
```

### Important Notes

1. The response should only include feedback submissions for the specified date
2. Each feedback object must include `volunteer.id` and `student.id` for the audit to work
3. If no feedback exists for a date, return an empty array `[]`
4. The admin page will gracefully handle API errors by showing all pairings as "Missing"

## How It Works

1. **Load Dates**: Fetches available session dates from the same API as the main app
2. **Select Date**: When a date is selected, fetches feedback data for that date
3. **Match Pairings**: Compares expected volunteer-student pairs (from schedule) with submitted feedback
4. **Display Results**: Shows green for completed, red for missing
5. **Calculate Stats**: Displays total count, completion count, and percentage

## Database Query Example

If you're using a SQL database, your query might look like:

```sql
SELECT
  volunteer_id,
  volunteer_name,
  student_id,
  student_name,
  feedback_url,
  transcript,
  input_type,
  created_at
FROM feedback_submissions
WHERE DATE(created_at) = ?
  OR session_date = ?
```

## Troubleshooting

### All feedback shows as "Missing"
- Check that the feedback API endpoint is accessible
- Verify the response format matches the expected structure
- Check browser console for API errors

### No volunteers showing
- Verify the date has volunteers scheduled in the main API
- Check that volunteers have students assigned

### Stats not updating
- Click the "Refresh" button to reload data
- Check that the feedback data includes correct volunteer and student IDs
