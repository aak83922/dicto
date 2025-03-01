/*
  # Initial Schema for YouTube Clone

  1. New Tables
    - profiles
      - id (references auth.users)
      - username
      - avatar_url
      - created_at
    
    - videos
      - id
      - user_id (references profiles)
      - title
      - description
      - video_url
      - thumbnail_url
      - created_at
      - views_count
      - likes_count

  2. Storage
    - videos bucket for video files
    - thumbnails bucket for video thumbnails

  3. Security
    - RLS policies for all tables
    - Storage policies for videos and thumbnails
*/

-- Create profiles table
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  avatar_url text,
  created_at timestamptz DEFAULT now()
);

-- Create videos table
CREATE TABLE videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  video_url text NOT NULL,
  thumbnail_url text NOT NULL,
  created_at timestamptz DEFAULT now(),
  views_count integer DEFAULT 0,
  likes_count integer DEFAULT 0
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles
  FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- Videos policies
CREATE POLICY "Videos are viewable by everyone"
  ON videos
  FOR SELECT
  USING (true);

CREATE POLICY "Users can insert own videos"
  ON videos
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own videos"
  ON videos
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own videos"
  ON videos
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create storage buckets
INSERT INTO storage.buckets (id, name)
VALUES ('videos', 'videos')
ON CONFLICT DO NOTHING;

INSERT INTO storage.buckets (id, name)
VALUES ('thumbnails', 'thumbnails')
ON CONFLICT DO NOTHING;

-- Storage policies
CREATE POLICY "Videos are publicly accessible"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'videos');

CREATE POLICY "Authenticated users can upload videos"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'videos'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Thumbnails are publicly accessible"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'thumbnails');

CREATE POLICY "Authenticated users can upload thumbnails"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'thumbnails'
    AND auth.role() = 'authenticated'
  );

-- Function to handle new user profiles
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username, avatar_url)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'username',
    new.raw_user_meta_data->>'avatar_url'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user profiles
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();