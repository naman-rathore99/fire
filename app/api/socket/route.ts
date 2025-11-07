import { Server } from 'socket.io'
import type { NextApiRequest } from 'next'
import type { NextApiResponse } from 'next'
import type { Server as HTTPServer } from 'http'
import type { Socket as NetSocket } from 'net'

interface SocketServer extends HTTPServer {
  io?: Server
}

interface SocketWithIO extends NetSocket {
  server: SocketServer
}

interface NextApiResponseWithSocket extends NextApiResponse {
  socket: SocketWithIO
}

interface Message {
  id: string
  text: string
  sender: string
  timestamp: number
}

export default function handler(req: NextApiRequest, res: NextApiResponseWithSocket) {
  if (res.socket.server.io) {
    res.end()
    return
  }

  const io = new Server(res.socket.server, {
    path: '/api/socket',
    addTrailingSlash: false,
  })
  res.socket.server.io = io

  const messages: Message[] = []

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id)

    // Send existing messages to new user
    socket.emit('load_messages', messages)

    socket.on('send_message', (data: { text: string; sender: string }) => {
      const message: Message = {
        id: Date.now().toString(),
        text: data.text,
        sender: data.sender,
        timestamp: Date.now(),
      }
      messages.push(message)
      io.emit('receive_message', message)
    })

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id)
    })
  })

  res.end()
}