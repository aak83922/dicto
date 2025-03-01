import React, { useState, useEffect } from 'react';
import { MessageSquare, Video } from 'lucide-react';
import Chat from './components/Chat';
import { socket } from './socket';
import type { ChatMode } from './types';

function App() {
  const [isSearching, setIsSearching] = useState(false);
  const [selectedMode, setSelectedMode] = useState<ChatMode | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected'>('disconnected');

  useEffect(() => {
    // Listen for successful match
    socket.on('matched', ({ roomId }) => {
      setIsSearching(false);
      setRoomId(roomId);
    });

    // Listen for when partner disconnects
    socket.on('partner-disconnected', () => {
      // Don't reset the mode when partner disconnects, just set roomId to null
      // This allows us to stay in the same mode and find a new partner
      setRoomId(null);
    });

    // Track connection status
    socket.on('connect', () => {
      setConnectionStatus('connected');
    });

    socket.on('disconnect', () => {
      setConnectionStatus('disconnected');
    });

    return () => {
      socket.off('matched');
      socket.off('partner-disconnected');
      socket.off('connect');
      socket.off('disconnect');
    };
  }, []);

  const startChat = (mode: ChatMode) => {
    setSelectedMode(mode);
    setIsSearching(true);
    // Join the queue for matching
    socket.emit('find-match', { mode });
  };

  const handleDisconnect = () => {
    if (roomId) {
      socket.emit('leave-room', { roomId });
    }
    // Only reset the room ID, keep the selected mode
    setRoomId(null);
  };

  const findNextStranger = () => {
    if (roomId) {
      socket.emit('leave-room', { roomId });
    }
    
    // Keep the same mode, but start searching again
    setIsSearching(true);
    
    // Find a new match with the same mode
    if (selectedMode) {
      socket.emit('find-match', { mode: selectedMode });
    }
  };

  // Return to home screen (completely reset the state)
  const returnToHome = () => {
    if (roomId) {
      socket.emit('leave-room', { roomId });
    }
    setSelectedMode(null);
    setRoomId(null);
    setIsSearching(false);
  };

  // If we have a selected mode and a room ID, show the chat
  if (selectedMode && !isSearching && roomId) {
    return (
      <Chat 
        mode={selectedMode} 
        onDisconnect={findNextStranger} 
        roomId={roomId}
      />
    );
  }

  // If we have a selected mode but no room ID and we're searching, show the searching screen
  if (selectedMode && isSearching) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full">
          <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">Dicto</h1>
          
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Looking for a stranger...</p>
            <button
              onClick={returnToHome}
              className="mt-4 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Otherwise, show the home screen
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">Dicto</h1>
        
        {connectionStatus === 'disconnected' && (
          <div className="mb-4 p-3 bg-yellow-100 text-yellow-800 rounded-lg">
            Connecting to server...
          </div>
        )}
        
        <div className="space-y-4">
          <button
            onClick={() => startChat('text')}
            className="w-full p-4 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition flex items-center justify-center gap-2"
            disabled={connectionStatus === 'disconnected'}
          >
            <MessageSquare />
            Chat with Stranger
          </button>
          
          <button
            onClick={() => startChat('video')}
            className="w-full p-4 bg-green-500 text-white rounded-xl hover:bg-green-600 transition flex items-center justify-center gap-2"
            disabled={connectionStatus === 'disconnected'}
          >
            <Video />
            Video Chat with Stranger
          </button>
        </div>
        
        <p className="mt-6 text-center text-sm text-gray-500">
          By using Dicto, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}

export default App;