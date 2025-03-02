import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Allow connections from any origin
    methods: ["GET", "POST"]
  },
  pingTimeout: 60000, // Increase ping timeout to 60 seconds
  pingInterval: 25000, // Ping clients every 25 seconds
  transports: ['websocket', 'polling'], // Support both WebSocket and polling
  maxHttpBufferSize: 1e8, // Increase buffer size for larger media streams
  connectTimeout: 45000 // Increase connection timeout
});

// Serve static files from the dist directory
app.use(express.static(join(__dirname, 'dist')));

// Serve index.html for all routes
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

// Queue for users waiting to be matched
const waitingUsers = {
  text: [],
  video: []
};

// Active rooms for tracking connections
const activeRooms = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('find-match', ({ mode }) => {
    console.log('User searching for match:', socket.id, 'Mode:', mode);
    
    // Check if there's someone waiting
    if (waitingUsers[mode].length > 0) {
      const partner = waitingUsers[mode].shift();
      const roomId = `room_${socket.id}_${partner.id}`;
      
      // Join both users to the room
      socket.join(roomId);
      partner.socket.join(roomId);
      
      // Track the room
      activeRooms.set(roomId, {
        users: [socket.id, partner.id],
        mode: mode,
        createdAt: Date.now()
      });
      
      // Notify both users of the match
      io.to(roomId).emit('matched', { roomId });
      
      console.log('Matched users in room:', roomId);
    } else {
      // Add user to waiting queue
      waitingUsers[mode].push({ id: socket.id, socket });
      console.log('User added to queue:', socket.id);
    }
  });

  socket.on('send-message', ({ roomId, message }) => {
    socket.to(roomId).emit('receive-message', message);
  });

  socket.on('ready-for-video', ({ roomId }) => {
    console.log('User ready for video in room:', roomId);
    socket.to(roomId).emit('initiate-call');
  });

  socket.on('offer', ({ roomId, offer }) => {
    console.log('Offer sent in room:', roomId);
    socket.to(roomId).emit('offer', { offer });
  });

  socket.on('answer', ({ roomId, answer }) => {
    console.log('Answer sent in room:', roomId);
    socket.to(roomId).emit('answer', { answer });
  });

  socket.on('ice-candidate', ({ roomId, candidate }) => {
    socket.to(roomId).emit('ice-candidate', { candidate });
  });

  socket.on('leave-room', ({ roomId }) => {
    console.log('User leaving room:', socket.id, 'Room:', roomId);
    socket.to(roomId).emit('partner-disconnected');
    socket.leave(roomId);
    
    // Remove room from tracking
    activeRooms.delete(roomId);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    // Remove user from waiting queue if they disconnect
    for (const mode in waitingUsers) {
      waitingUsers[mode] = waitingUsers[mode].filter(user => user.id !== socket.id);
    }
    
    // Find all rooms the user was in
    for (const [roomId, roomData] of activeRooms.entries()) {
      if (roomData.users.includes(socket.id)) {
        // Notify the other user in the room
        socket.to(roomId).emit('partner-disconnected');
        // Remove the room from tracking
        activeRooms.delete(roomId);
      }
    }
  });
});

// Clean up stale rooms every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [roomId, roomData] of activeRooms.entries()) {
    // If room is older than 2 hours, consider it stale
    if (now - roomData.createdAt > 2 * 60 * 60 * 1000) {
      console.log('Cleaning up stale room:', roomId);
      io.in(roomId).emit('partner-disconnected');
      activeRooms.delete(roomId);
    }
  }
}, 5 * 60 * 1000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`
  ╔════════════════════════════════════════════════════════════╗
  ║                                                            ║
  ║  🌐 Server running on port ${PORT}                           ║
  ║  Open the preview URL to use the app                       ║
  ║                                                            ║
  ╚════════════════════════════════════════════════════════════╝
  `);
});