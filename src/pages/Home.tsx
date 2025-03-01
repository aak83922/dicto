import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { formatDistanceToNow } from 'date-fns';

interface Video {
  id: string;
  title: string;
  description: string;
  thumbnail_url: string;
  created_at: string;
  user: {
    username: string;
  };
}

export function Home() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchVideos() {
      const { data, error } = await supabase
        .from('videos')
        .select(`
          *,
          user:profiles(username)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching videos:', error);
        return;
      }

      setVideos(data);
      setLoading(false);
    }

    fetchVideos();
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {videos.map((video) => (
        <Link key={video.id} to={`/watch/${video.id}`}>
          <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
            <img
              src={video.thumbnail_url}
              alt={video.title}
              className="w-full h-48 object-cover"
            />
            <div className="p-4">
              <h3 className="text-lg font-semibold line-clamp-2">{video.title}</h3>
              <p className="text-gray-600 text-sm mt-1">{video.user.username}</p>
              <p className="text-gray-500 text-sm">
                {formatDistanceToNow(new Date(video.created_at), { addSuffix: true })}
              </p>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}