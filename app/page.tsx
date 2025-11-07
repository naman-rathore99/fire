"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { initializeApp } from "firebase/app";
import {
  getDatabase,
  ref,
  onValue,
  push,
  set,
  onDisconnect,
  off,
  remove,
} from "firebase/database";

// ✅ Firebase Config from .env
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

interface Message {
  id: string;
  userId: string;
  name: string;
  text: string;
  timestamp: string;
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("Connecting...");
  const [userId, setUserId] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [showNameModal, setShowNameModal] = useState(true);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const room = "chatroom";

  // ✅ Load saved name
  useEffect(() => {
    const saved = localStorage.getItem("chatName");
    if (saved) {
      setName(saved);
      setShowNameModal(false);
    }
  }, []);

  // ✅ Setup Firebase listeners
  useEffect(() => {
    if (!name) return;

    const usersRef = ref(database, `${room}/users`);
    const messagesRef = ref(database, `${room}/messages`);
    const typingRef = ref(database, `${room}/typing`);

    const newUserId = `user-${Date.now()}`;
    setUserId(newUserId);

    const userRef = ref(database, `${room}/users/${newUserId}`);
    set(userRef, { online: true, name });
    onDisconnect(userRef).remove();
    onDisconnect(ref(database, `${room}/typing/${newUserId}`)).remove();

    // User presence
    onValue(usersRef, (snapshot) => {
      const users = snapshot.val();
      const count = users ? Object.keys(users).length : 0;
      setStatus(`Joined as ${name} • Users online: ${count}`);
    });

    // Messages
    onValue(messagesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list: Message[] = Object.values(data);
        setMessages(list);
        scrollRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    });

    // Typing listener
    onValue(typingRef, (snapshot) => {
      const data = snapshot.val();
      if (!data || !newUserId) {
        setIsOtherTyping(false);
        return;
      }
      const someoneElseTyping = Object.entries(data).some(
        ([uid, val]) => uid !== newUserId && val === true
      );
      setIsOtherTyping(someoneElseTyping);
    });

    return () => {
      off(usersRef);
      off(messagesRef);
      off(typingRef);
    };
  }, [name]);

  // ✅ Handle typing with debounce and cleanup
  const handleTyping = useCallback(
    (value: string) => {
      setInput(value);
      if (!userId) return;

      const typingRef = ref(database, `${room}/typing/${userId}`);
      set(typingRef, true);

      // Clear any existing timeout
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

      // Set to false if user stops typing for 0.5s
      typingTimeoutRef.current = setTimeout(() => {
        set(typingRef, false);
      }, 500);
    },
    [userId]
  );

  // ✅ Send message
  const sendMessage = useCallback(() => {
    if (!input.trim() || !userId || !name) return;

    const messagesRef = ref(database, `${room}/messages`);
    push(messagesRef, {
      id: Date.now().toString(),
      userId,
      name,
      text: input,
      timestamp: new Date().toLocaleTimeString(),
    });

    // stop typing immediately after sending
    const typingRef = ref(database, `${room}/typing/${userId}`);
    set(typingRef, false);

    setInput("");
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [input, userId, name]);

  // ✅ Save name
  const handleNameSubmit = () => {
    if (name && name.trim().length > 0) {
      localStorage.setItem("chatName", name);
      setShowNameModal(false);
    }
  };

  // ✅ Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (userId) remove(ref(database, `${room}/typing/${userId}`));
    };
  }, [userId]);

  return (
    <motion.div
      className="flex flex-col h-screen bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-900 dark:to-gray-800 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
    >
      {/* 🧍 Name Modal */}
      <AnimatePresence>
        {showNameModal && (
          <motion.div
            key="modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center bg-black/60 z-50"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-lg max-w-sm w-full text-center"
            >
              <h2 className="text-xl font-semibold mb-3 text-gray-900 dark:text-gray-100">
                Enter your name
              </h2>
              <input
                type="text"
                value={name || ""}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleNameSubmit()}
                className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. Naman"
              />
              <button
                onClick={handleNameSubmit}
                className="mt-4 w-full py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition"
              >
                Join Chat
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 💬 Chat */}
      {!showNameModal && (
        <motion.div
          className="max-w-2xl mx-auto flex flex-col w-full h-full rounded-2xl bg-white dark:bg-gray-900 shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4 }}
        >
          <header className="p-4 bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-semibold text-lg text-center shadow">
            Chat Room 💬
          </header>

          <div className="text-center text-sm text-gray-500 dark:text-gray-400 py-2 border-b border-gray-200 dark:border-gray-700">
            {status}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700">
            <AnimatePresence>
              {messages.map((msg) => {
                const isOwn = msg.userId === userId;
                return (
                  <motion.div
                    key={msg.id}
                    className={`flex ${
                      isOwn ? "justify-end" : "justify-start"
                    }`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div
                      className={`px-4 py-2 max-w-[70%] rounded-2xl shadow-sm ${
                        isOwn
                          ? "bg-blue-500 text-white rounded-br-none"
                          : "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-bl-none"
                      }`}
                    >
                      <div className="text-xs opacity-70 mb-1">
                        {msg.name} • {msg.timestamp}
                      </div>
                      <div>{msg.text}</div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {/* Typing indicator (fixed) */}
            {/* <AnimatePresence>
              {isOtherTyping && (
                <motion.div
                  key="typing"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex items-center text-gray-500 dark:text-gray-400 space-x-2 pl-2 mt-2"
                >
                  <div className="flex space-x-1">
                    <motion.span
                      className="w-2 h-2 bg-gray-500 dark:bg-gray-300 rounded-full"
                      animate={{ opacity: [0.2, 1, 0.2] }}
                      transition={{ repeat: Infinity, duration: 1, delay: 0 }}
                    />
                    <motion.span
                      className="w-2 h-2 bg-gray-500 dark:bg-gray-300 rounded-full"
                      animate={{ opacity: [0.2, 1, 0.2] }}
                      transition={{ repeat: Infinity, duration: 1, delay: 0.2 }}
                    />
                    <motion.span
                      className="w-2 h-2 bg-gray-500 dark:bg-gray-300 rounded-full"
                      animate={{ opacity: [0.2, 1, 0.2] }}
                      transition={{ repeat: Infinity, duration: 1, delay: 0.4 }}
                    />
                  </div>
                  <span>Someone is typing...</span>
                </motion.div>
              )}
            </AnimatePresence> */}

            <div ref={scrollRef} />
          </div>

          {/* Input */}
          <footer className="p-4 flex items-center border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <input
              type="text"
              value={input}
              onChange={(e) => handleTyping(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              className="flex-1 p-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Type your message..."
            />
            <button
              onClick={sendMessage}
              className="ml-3 px-5 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium transition"
            >
              Send
            </button>
          </footer>
        </motion.div>
      )}
    </motion.div>
  );
}
