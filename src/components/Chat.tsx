import React, { useState, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Send, Video, VideoOff, Mic, MicOff, RefreshCw, Reply, X } from 'lucide-react';
import { socket } from '../socket';
import type { Message, ChatMode } from '../types';

interface ChatProps {
  mode: ChatMode;
  onDisconnect: () => void;
  roomId: string;
}

export default function Chat({ mode, onDisconnect, roomId }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isConnected, setIsConnected] = useState(true);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [videoStatus, setVideoStatus] = useState<'connecting' | 'connected' | 'failed'>('connecting');
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [showChat, setShowChat] = useState(mode === 'text');
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const connectionTimeout = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5; // Increased from 3 to 5
  const connectionTimeoutMs = 10000; // Reduced from 15000 to 10000 for faster feedback

  useEffect(() => {
    // Listen for incoming messages
    socket.on('receive-message', (message: Message) => {
      setMessages(prev => [...prev, { ...message, sender: 'stranger' }]);
    });

    // Listen for disconnection
    socket.on('partner-disconnected', () => {
      setIsConnected(false);
      cleanupVideoConnection();
      setMessages(prev => [
        ...prev,
        {
          id: uuidv4(),
          text: 'Stranger has disconnected.',
          sender: 'stranger',
          timestamp: Date.now(),
        },
      ]);
    });

    if (mode === 'video') {
      setupVideoChat();
    }

    return () => {
      socket.off('receive-message');
      socket.off('partner-disconnected');
      socket.off('offer');
      socket.off('answer');
      socket.off('ice-candidate');
      socket.off('initiate-call');
      
      cleanupVideoConnection();
    };
  }, [mode, roomId]);

  const cleanupVideoConnection = () => {
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }
    
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    
    if (connectionTimeout.current) {
      clearTimeout(connectionTimeout.current);
      connectionTimeout.current = null;
    }
    
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
  };

  const setupVideoChat = async () => {
    try {
      // Reset reconnect attempts
      reconnectAttempts.current = 0;
      
      // Set a timeout to detect if connection fails
      connectionTimeout.current = setTimeout(() => {
        if (videoStatus === 'connecting') {
          console.log('Connection timeout reached, attempting auto-reconnect');
          setVideoStatus('failed');
          reconnectVideo();
        }
      }, connectionTimeoutMs);

      // Request media with optimized constraints for better performance and reliability
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: {
          width: { ideal: 320, max: 640 },
          height: { ideal: 240, max: 480 },
          frameRate: { ideal: 15, max: 24 }
        }, 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      setLocalStream(stream);
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Initialize WebRTC peer connection with more STUN/TURN servers
      const configuration = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' },
          // Free TURN servers
          {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          },
          {
            urls: 'turn:openrelay.metered.ca:443',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          },
          {
            urls: 'turn:openrelay.metered.ca:443?transport=tcp',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          }
        ],
        iceCandidatePoolSize: 10
      };
      
      // Create new RTCPeerConnection with optimized configuration
      peerConnection.current = new RTCPeerConnection(configuration);

      // Add local stream
      stream.getTracks().forEach(track => {
        if (peerConnection.current && stream) {
          peerConnection.current.addTrack(track, stream);
        }
      });

      // Handle incoming stream
      peerConnection.current.ontrack = (event) => {
        console.log('Received remote stream');
        if (remoteVideoRef.current && event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0];
          setVideoStatus('connected');
          setShowChat(true); // Show chat once video is connected
          
          // Clear the connection timeout
          if (connectionTimeout.current) {
            clearTimeout(connectionTimeout.current);
            connectionTimeout.current = null;
          }
        }
      };

      // Handle ICE candidates
      peerConnection.current.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('Sending ICE candidate');
          socket.emit('ice-candidate', {
            roomId,
            candidate: event.candidate
          });
        }
      };

      // Log ICE gathering state changes
      peerConnection.current.onicegatheringstatechange = () => {
        console.log('ICE gathering state:', peerConnection.current?.iceGatheringState);
      };

      // Handle connection state changes
      peerConnection.current.onconnectionstatechange = () => {
        console.log('Connection state:', peerConnection.current?.connectionState);
        if (peerConnection.current?.connectionState === 'connected') {
          setVideoStatus('connected');
          setShowChat(true); // Show chat once video is connected
          
          // Reset reconnect attempts on successful connection
          reconnectAttempts.current = 0;
        } else if (peerConnection.current?.connectionState === 'failed' || 
                  peerConnection.current?.connectionState === 'disconnected' ||
                  peerConnection.current?.connectionState === 'closed') {
          setVideoStatus('failed');
          // Auto-reconnect if we haven't exceeded max attempts
          if (reconnectAttempts.current < maxReconnectAttempts) {
            console.log(`Auto-reconnecting (attempt ${reconnectAttempts.current + 1}/${maxReconnectAttempts})`);
            reconnectVideo();
          }
        }
      };

      // Handle ICE connection state changes
      peerConnection.current.oniceconnectionstatechange = () => {
        console.log('ICE connection state:', peerConnection.current?.iceConnectionState);
        if (peerConnection.current?.iceConnectionState === 'connected' || 
            peerConnection.current?.iceConnectionState === 'completed') {
          setVideoStatus('connected');
          setShowChat(true);
          
          // Clear the connection timeout
          if (connectionTimeout.current) {
            clearTimeout(connectionTimeout.current);
            connectionTimeout.current = null;
          }
        } else if (peerConnection.current?.iceConnectionState === 'failed' || 
                  peerConnection.current?.iceConnectionState === 'disconnected') {
          setVideoStatus('failed');
          // Auto-reconnect if we haven't exceeded max attempts
          if (reconnectAttempts.current < maxReconnectAttempts) {
            console.log(`Auto-reconnecting (attempt ${reconnectAttempts.current + 1}/${maxReconnectAttempts})`);
            reconnectVideo();
          }
        }
      };

      // Listen for signaling messages
      socket.on('offer', async ({ offer }) => {
        console.log('Received offer');
        if (peerConnection.current) {
          try {
            await peerConnection.current.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await peerConnection.current.createAnswer();
            await peerConnection.current.setLocalDescription(answer);
            socket.emit('answer', { roomId, answer });
          } catch (error) {
            console.error('Error handling offer:', error);
            setVideoStatus('failed');
            reconnectVideo();
          }
        }
      });

      socket.on('answer', async ({ answer }) => {
        console.log('Received answer');
        if (peerConnection.current) {
          try {
            await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));
          } catch (error) {
            console.error('Error handling answer:', error);
            setVideoStatus('failed');
            reconnectVideo();
          }
        }
      });

      socket.on('ice-candidate', async ({ candidate }) => {
        console.log('Received ICE candidate');
        if (peerConnection.current) {
          try {
            await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (error) {
            console.error('Error adding ICE candidate:', error);
            // Don't fail immediately on ICE candidate errors as some may be expected
          }
        }
      });

      // Create and send offer if we're the initiator
      socket.emit('ready-for-video', { roomId });
      socket.on('initiate-call', async () => {
        console.log('Initiating call');
        if (peerConnection.current) {
          try {
            const offer = await peerConnection.current.createOffer({
              offerToReceiveAudio: true,
              offerToReceiveVideo: true,
              iceRestart: true // Enable ICE restart for better connection recovery
            });
            await peerConnection.current.setLocalDescription(offer);
            socket.emit('offer', { roomId, offer });
          } catch (error) {
            console.error('Error creating offer:', error);
            setVideoStatus('failed');
            reconnectVideo();
          }
        }
      });
    } catch (err) {
      console.error('Error accessing media devices:', err);
      setVideoStatus('failed');
      
      // Try to reconnect with audio only if video fails
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        // User denied permission, don't auto-retry
        console.log('User denied media permissions');
      } else {
        reconnectVideo();
      }
    }
  };

  const reconnectVideo = async () => {
    reconnectAttempts.current += 1;
    setIsReconnecting(true);
    setVideoStatus('connecting');
    
    // Clean up existing connection
    cleanupVideoConnection();
    
    // Exponential backoff for reconnection attempts (300ms, 600ms, 1200ms, etc.)
    const backoffTime = Math.min(300 * Math.pow(2, reconnectAttempts.current - 1), 2000);
    
    console.log(`Reconnecting in ${backoffTime}ms (attempt ${reconnectAttempts.current}/${maxReconnectAttempts})`);
    
    // Wait a moment before reconnecting with exponential backoff
    setTimeout(async () => {
      await setupVideoChat();
      setIsReconnecting(false);
    }, backoffTime);
  };

  const handleReply = (message: Message) => {
    setReplyingTo(message);
    inputRef.current?.focus();
  };

  const cancelReply = () => {
    setReplyingTo(null);
  };

  const sendMessage = () => {
    if (!inputText.trim() || !isConnected) return;

    const newMessage: Message = {
      id: uuidv4(),
      text: inputText,
      sender: 'me',
      timestamp: Date.now(),
      ...(replyingTo && {
        replyTo: {
          id: replyingTo.id,
          text: replyingTo.text,
          sender: replyingTo.sender
        }
      })
    };

    socket.emit('send-message', {
      roomId,
      message: newMessage
    });

    setMessages(prev => [...prev, newMessage]);
    setInputText('');
    setReplyingTo(null);
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !isVideoEnabled;
        setIsVideoEnabled(!isVideoEnabled);
      }
    }
  };

  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !isAudioEnabled;
        setIsAudioEnabled(!isAudioEnabled);
      }
    }
  };

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {mode === 'video' && (
        <div className="flex flex-row h-1/2 bg-gray-900">
          {/* Stranger's video */}
          <div className="relative w-1/2 border-r border-gray-700">
            <div className="absolute top-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 text-xs rounded">
              Stranger's View
            </div>
            {videoStatus === 'connecting' && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-800 bg-opacity-75 z-10">
                <div className="text-center text-white">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                  <p>Connecting video...</p>
                  <p className="text-xs mt-2 text-gray-300">This may take a moment</p>
                </div>
              </div>
            )}
            
            {videoStatus === 'failed' && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-800 bg-opacity-75 z-10">
                <div className="text-center text-white">
                  <p className="mb-4">Video connection failed</p>
                  <button 
                    onClick={reconnectVideo}
                    disabled={isReconnecting}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center justify-center mx-auto"
                  >
                    {isReconnecting ? (
                      <>
                        <RefreshCw className="animate-spin mr-2" size={16} />
                        Reconnecting...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="mr-2" size={16} />
                        Retry Connection
                      </>
                    )}
                  </button>
                  <p className="text-xs mt-4 text-gray-300">
                    Attempt {reconnectAttempts.current} of {maxReconnectAttempts}
                  </p>
                </div>
              </div>
            )}
            
            <video
              ref={remoteVideoRef}
              className="w-full h-full object-cover"
              autoPlay
              playsInline
            />
          </div>
          
          {/* Your video */}
          <div className="relative w-1/2">
            <div className="absolute top-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 text-xs rounded">
              Your View
            </div>
            <video
              ref={localVideoRef}
              className="w-full h-full object-cover"
              autoPlay
              playsInline
              muted
            />
            <div className="absolute bottom-4 left-4 flex gap-2">
              <button
                onClick={toggleVideo}
                className={`p-2 rounded-full ${isVideoEnabled ? 'bg-gray-800' : 'bg-red-600'} text-white hover:opacity-90`}
              >
                {isVideoEnabled ? <Video size={20} /> : <VideoOff size={20} />}
              </button>
              <button
                onClick={toggleAudio}
                className={`p-2 rounded-full ${isAudioEnabled ? 'bg-gray-800' : 'bg-red-600'} text-white hover:opacity-90`}
              >
                {isAudioEnabled ? <Mic size={20} /> : <MicOff size={20} />}
              </button>
            </div>
          </div>
        </div>
      )}

      {showChat && (
        <>
          <div 
            ref={chatContainerRef}
            className={`flex-1 overflow-y-auto p-4 space-y-4 ${mode === 'text' ? 'h-full' : 'h-1/2'}`}
          >
            <div className="text-center text-gray-500 text-sm mb-4">
              Chat Area
            </div>
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender === 'me' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] rounded-lg p-3 relative group ${
                    message.sender === 'me'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-800'
                  }`}
                >
                  {message.replyTo && (
                    <div 
                      className={`text-xs p-2 mb-2 rounded ${
                        message.sender === 'me' 
                          ? 'bg-blue-600 text-blue-100' 
                          : 'bg-gray-300 text-gray-700'
                      }`}
                    >
                      <div className="font-semibold">
                        {message.replyTo.sender === 'me' ? 'You' : 'Stranger'}
                      </div>
                      <div className="truncate">{message.replyTo.text}</div>
                    </div>
                  )}
                  <div>{message.text}</div>
                  <button 
                    onClick={() => handleReply(message)}
                    className={`absolute ${message.sender === 'me' ? '-left-8' : '-right-8'} top-1/2 transform -translate-y-1/2
                      bg-white p-1.5 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-100`}
                    aria-label="Reply to message"
                  >
                    <Reply size={16} className="text-gray-600" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-gray-200 p-4 bg-white">
            {replyingTo && (
              <div className="mb-2 p-2 bg-gray-100 rounded-lg flex justify-between items-start">
                <div>
                  <div className="text-xs font-semibold text-gray-600">
                    Replying to {replyingTo.sender === 'me' ? 'yourself' : 'stranger'}
                  </div>
                  <div className="text-sm text-gray-800 truncate">{replyingTo.text}</div>
                </div>
                <button 
                  onClick={cancelReply}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={16} />
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                placeholder={isConnected ? "Type a message..." : "Chat ended"}
                className="flex-1 p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={!isConnected}
              />
              <button
                onClick={sendMessage}
                className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!isConnected}
              >
                <Send size={20} />
              </button>
              <button
                onClick={onDisconnect}
                className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}