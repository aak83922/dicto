import { io } from 'socket.io-client';

// Determine the Socket.IO server URL based on environment
const getSocketUrl = () => {
  // Check if we're in production (deployed) or development
  const isProduction = window.location.hostname !== 'localhost' && 
                       window.location.hostname !== '127.0.0.1';
  
  if (isProduction) {
    // Use the same domain as the deployed site for WebSocket connection
    return window.location.origin;
  } else {
    // Use localhost for development
    return 'http://localhost:3000';
  }
};

// Connect to our Socket.IO server
export const socket = io(getSocketUrl(), {
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  timeout: 20000
});

// Listen for connection status
socket.on('connect', () => {
  console.log('Connected to server with ID:', socket.id);
});

socket.on('disconnect', () => {
  console.log('Disconnected from server');
});

socket.on('connect_error', (error) => {
  console.error('Connection error:', error);
});