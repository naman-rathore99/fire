import { Server } from 'socket.io';
import type { NextApiResponse } from 'next';
import type { Server as HTTPServer } from 'http';
import type { Socket as NetSocket } from 'net';
import type { NextRequest } from 'next/server';

interface SocketServer extends HTTPServer {
  io?: Server;
}

interface SocketWithIO extends NetSocket {
  server: SocketServer;
}

interface NextApiResponseWithSocket extends NextApiResponse {
  socket: SocketWithIO;
}

interface Message {
  id: string;
  text: string;
  sender: string;
  timestamp: number;
}

// Force Node.js runtime (Socket.IO can't run on Edge)
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  return new Response('Socket.IO server is running ✅', { status: 200 });
}

// For the Next.js type validator, we still need a named export
// But Socket.IO will be initialized lazily in your dev server entry
export const setupSocket = (res: NextApiResponseWithSocket) => {
  if (res.socket.server.io) {
    console.log('🔁 Socket.IO already initialized');
    return;
  }

  console.log('🚀 Initializing new Socket.IO server...');
  const io = new Server(res.socket.server, {
    path: '/api/socket',
    addTrailingSlash: false,
  });
  res.socket.server.io = io;

  const messages: Message[] = [];

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.emit('load_messages', messages);

    socket.on('send_message', (data: { text: string; sender: string }) => {
      const message: Message = {
        id: Date.now().toString(),
        text: data.text,
        sender: data.sender,
        timestamp: Date.now(),
      };
      messages.push(message);
      io.emit('receive_message', message);
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
    });
  });
};
