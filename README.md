# YouTube Clone

A full-featured YouTube clone built with React, Supabase, and TypeScript.

## Setup Instructions

1. Click the "Connect to Supabase" button in the top right corner
2. After connecting, copy your Supabase project URL and anon key
3. Create a new `.env` file in the root directory:
   ```
   VITE_SUPABASE_URL=your-project-url
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```
4. The application will automatically restart and be ready to use

## Features

- User authentication (signup/login)
- Video upload with thumbnails
- Video playback
- Home feed with video grid
- Protected routes for authenticated users
- Responsive design