import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

export function Upload() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [video, setVideo] = useState<File | null>(null);
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !video || !thumbnail) return;

    try {
      setUploading(true);

      // Upload video
      const videoFileName = `${Date.now()}-${video.name}`;
      const { error: videoError } = await supabase.storage
        .from('videos')
        .upload(videoFileName, video);

      if (videoError) throw videoError;

      // Upload thumbnail
      const thumbnailFileName = `${Date.now()}-${thumbnail.name}`;
      const { error: thumbnailError } = await supabase.storage
        .from('thumbnails')
        .upload(thumbnailFileName, thumbnail);

      if (thumbnailError) throw thumbnailError;

      // Get public URLs
      const videoUrl = supabase.storage
        .from('videos')
        .getPublicUrl(videoFileName).data.publicUrl;
      
      const thumbnailUrl = supabase.storage
        .from('thumbnails')
        .getPublicUrl(thumbnailFileName).data.publicUrl;

      // Create video record
      const { error: dbError } = await supabase.from('videos').insert({
        title,
        description,
        video_url: videoUrl,
        thumbnail_url: thumbnailUrl,
        user_id: user.id
      });

      if (dbError) throw dbError;

      navigate('/');
    } catch (error) {
      console.error('Error uploading video:', error);
      alert('Error uploading video. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white p-6 rounded-lg shadow-md">
      <h1 className="text-2xl font-bold mb-6">Upload Video</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700">Video</label>
          <input
            type="file"
            accept="video/*"
            onChange={(e) => setVideo(e.target.files?.[0] || null)}
            className="mt-1 block w-full"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Thumbnail</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setThumbnail(e.target.files?.[0] || null)}
            className="mt-1 block w-full"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500"
          />
        </div>

        <button
          type="submit"
          disabled={uploading}
          className="w-full bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 disabled:opacity-50"
        >
          {uploading ? 'Uploading...' : 'Upload Video'}
        </button>
      </form>
    </div>
  );
}