"use client"
import { useState, useEffect } from 'react';
import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, push, set, onDisconnect, off } from 'firebase/database';

// Your Firebase config (replace with your actual config from Step 1)
const firebaseConfig = {
  apiKey: "AIzaSyCelUVeDVb3ni-HTtj1Db8ahYFf0fHuU60",
  authDomain: "chat-ab57c.firebaseapp.com",
  databaseURL: "https://chat-ab57c-default-rtdb.firebaseio.com",
  projectId: "chat-ab57c",
  storageBucket: "chat-ab57c.firebasestorage.app",
  messagingSenderId: "37087074189",
  appId: "1:37087074189:web:3f665419bacacce4980fc4"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

interface Message {
  id: string;
  text: string;
  timestamp: string;
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState('Connecting...');
  const [userId, setUserId] = useState<string | null>(null);

  const room = 'chatroom'; // Shared room for 1-to-1

  useEffect(() => {
    const usersRef = ref(database, `${room}/users`);
    const messagesRef = ref(database, `${room}/messages`);

    // Generate a unique user ID
    const newUserId = `user-${Date.now()}`;
    setUserId(newUserId);

    // Track users in the room (for 1-to-1 enforcement)
    const userRef = ref(database, `${room}/users/${newUserId}`);
    set(userRef, true); // Mark user as online
    onDisconnect(userRef).remove(); // Remove on disconnect

    // Listen for user count
    onValue(usersRef, (snapshot) => {
      const users = snapshot.val();
      const userCount = users ? Object.keys(users).length : 0;
      if (userCount > 2) {
        setStatus('Room full (only 2 users allowed).');
        return;
      }
      setStatus(`Joined chat room. Users online: ${userCount}`);
    });

    // Listen for messages
    onValue(messagesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const msgList: Message[] = Object.values(data);
        setMessages(msgList);
      }
    });

    return () => {
      off(messagesRef);
      off(usersRef);
    };
  }, []);

  const sendMessage = () => {
    if (input.trim() && userId) {
      const messagesRef = ref(database, `${room}/messages`);
      push(messagesRef, {
        id: Date.now().toString(),
        text: `User ${userId.slice(-4)}: ${input}`, // Simple user identifier
        timestamp: new Date().toLocaleTimeString()
      });
      setInput('');
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100 p-4">
      <h1 className="text-2xl font-bold mb-4">1-to-1 Chat App (Firebase)</h1>
      <div className="text-sm text-gray-600 mb-2">{status}</div>
      <div className="flex-1 overflow-y-auto bg-white p-4 rounded shadow">
        {messages.map((msg) => (
          <div key={msg.id} className="mb-2">
            <span className="text-xs text-gray-500">{msg.timestamp}</span> {msg.text}
          </div>
        ))}
      </div>
      <div className="flex mt-4">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          className="flex-1 p-2 border rounded"
          placeholder="Type a message..."
        />
        <button onClick={sendMessage} className="ml-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
          Send
        </button>
      </div>
    </div>
  );
}