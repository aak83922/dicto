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

// Connect to our Socket.IO server with improved connection settings
export const socket = io(getSocketUrl(), {
  reconnectionAttempts: 10,     // Increased from 5 to 10
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,   // Cap the reconnection delay
  timeout: 30000,               // Increased from 20000 to 30000
  transports: ['websocket', 'polling'],  // Try WebSocket first, fall back to polling
  upgrade: true,                // Allow transport upgrade
  forceNew: true                // Force a new connection
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

socket.on('reconnect_attempt', (attemptNumber) => {
  console.log(`Attempting to reconnect (${attemptNumber})`);
});

socket.on('reconnect', () => {
  console.log('Reconnected to server');
});

socket.on('reconnect_error', (error) => {
  console.error('Reconnection error:', error);
});

socket.on('reconnect_failed', () => {
  console.error('Failed to reconnect');
});