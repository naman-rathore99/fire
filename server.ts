import { createServer, IncomingMessage, ServerResponse } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';
import { Socket } from 'socket.io';

const dev: boolean = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const io = new SocketIOServer(server, {
    cors: {
      origin: "*", // Allow all origins for dev; restrict in production
      methods: ["GET", "POST"]
    }
  });

  const room: string = 'chatroom'; // Hardcoded room for 1-to-1 chat
  let userCount: number = 0;

  io.on('connection', (socket: Socket) => {
    console.log('User connected:', socket.id);

    if (userCount >= 2) {
      socket.emit('room-full', 'Chat room is full (only 2 users allowed).');
      socket.disconnect();
      return;
    }

    userCount++;
    socket.join(room);
    socket.emit('joined', `Joined chat room. Users online: ${userCount}`);

    socket.on('send-message', (message: string) => {
      socket.to(room).emit('receive-message', message); // Broadcast to others in room
    });

    socket.on('disconnect', () => {
      userCount--;
      console.log('User disconnected:', socket.id);
    });
  });

  server.listen(3000, (err?: Error) => {
    if (err) throw err;
    console.log('> Ready on http://localhost:3000');
  });
});