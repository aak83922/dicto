import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { formatDistanceToNow } from 'date-fns';

interface Video {
  id: string;
  title: string;
  description: string;
  video_url: string;
  created_at: string;
  user: {
    username: string;
  };
}

export function Watch() {
  const { id } = useParams<{ id: string }>();
  const [video, setVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchVideo() {
      if (!id) return;

      const { data, error } = await supabase
        .from('videos')
        .select(`
          *,
          user:profiles(username)
        `)
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error fetching video:', error);
        return;
      }

      setVideo(data);
      setLoading(false);
    }

    fetchVideo();
  }, [id]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!video) {
    return <div>Video not found</div>;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <video
        src={video.video_url}
        controls
        className="w-full aspect-video bg-black rounded-lg"
      />
      <div className="mt-4">
        <h1 className="text-2xl font-bold">{video.title}</h1>
        <div className="flex items-center mt-2 text-gray-600">
          <span>{video.user.username}</span>
          <span className="mx-2">•</span>
          <span>{formatDistanceToNow(new Date(video.created_at), { addSuffix: true })}</span>
        </div>
        <p className="mt-4 text-gray-700 whitespace-pre-wrap">{video.description}</p>
      </div>
    </div>
  );
}