"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast, ToastContainer } from "react-toastify";
import ReactMarkdown from "react-markdown";
import "react-toastify/dist/ReactToastify.css";
import { 
  FiSend, FiUser, FiMic, FiMicOff, FiImage, FiX, FiPlus, 
  FiMessageSquare, FiMoreVertical, FiEdit2, FiStar, FiArchive, FiTrash2, FiShare2
} from "react-icons/fi";

type Message = {
  role: "user" | "bot";
  content: string;
  image?: string; 
};

type ChatSession = {
  id: string;
  title: string;
  is_pinned: boolean;
  is_archived: boolean;
};

export default function AskQuestion() {
  const [sessionActive, setSessionActive] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  
  // --- UI States for the new dropdowns ---
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const welcomeMessage: Message = {
    role: "bot",
    content: "👋 **Hello! I'm your FinSight AI Advisor.**\n\nI have semantic access to your FAISS transaction history. How can I help you today?",
  };

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  useEffect(() => {
    fetch("http://127.0.0.1:5000/current_user", { method: "GET", credentials: "include" })
      .then(async (res) => {
        if (res.ok) {
          setSessionActive(true);
          setMessages([welcomeMessage]);
          await fetchChatSessions();
        } else setSessionActive(false);
      })
      .catch(() => setSessionActive(false));
  }, []);

  // --- Voice API ---
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = false;
        recognitionRef.current.onresult = (event: any) => {
          setInputMessage((prev) => prev + (prev ? " " : "") + event.results[0][0].transcript);
          setIsListening(false);
        };
        recognitionRef.current.onerror = () => setIsListening(false);
        recognitionRef.current.onend = () => setIsListening(false);
      }
    }
  }, []);

  // --- Data Fetching ---
  const fetchChatSessions = async () => {
    try {
      const res = await fetch("http://127.0.0.1:5000/get_chat_sessions", { credentials: "include" });
      if (res.ok) setChatSessions(await res.json());
    } catch (e) { console.error("Failed to load chat sessions"); }
  };

  const loadChatHistory = async (sessionId: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`http://127.0.0.1:5000/get_chat_history/${sessionId}`, { credentials: "include" });
      if (res.ok) {
        setMessages(await res.json());
        setActiveSessionId(sessionId);
      }
    } finally { setIsLoading(false); }
  };

  const startNewChat = () => {
    setActiveSessionId(null);
    setMessages([welcomeMessage]);
    setInputMessage("");
    setSelectedImage(null);
  };

  const toggleListening = () => {
    if (!recognitionRef.current) {
      toast.info("Voice input is not supported in this browser.");
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setSelectedImage(reader.result as string);
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => setSelectedImage(null);

  // --- NEW: Chat Management Functions ---
  const updateChatState = async (id: string, payload: Partial<ChatSession>) => {
    try {
      const res = await fetch(`http://127.0.0.1:5000/update_chat/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setChatSessions(prev => prev.map(s => s.id === id ? { ...s, ...payload } : s));
      }
    } catch (e) { toast.error("Failed to update chat."); }
  };

  const deleteChat = async (id: string) => {
    try {
      const res = await fetch(`http://127.0.0.1:5000/delete_chat/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        setChatSessions(prev => prev.filter(s => s.id !== id));
        if (activeSessionId === id) startNewChat();
        toast.success("Chat deleted");
      }
    } catch (e) { toast.error("Failed to delete chat"); }
  };

  const shareChat = async (id: string) => {
    toast.info("Generating shareable link...");
    try {
      const res = await fetch(`http://127.0.0.1:5000/get_chat_history/${id}`, { credentials: "include" });
      if (res.ok) {
        const history = await res.json();
        const formatted = history.map((m: Message) => `${m.role === 'user' ? 'Me' : 'FinSight AI'}: ${m.content}`).join('\n\n');
        await navigator.clipboard.writeText(`Check out my chat with FinSight AI:\n\n${formatted}`);
        toast.success("Chat copied to clipboard!");
      }
    } catch (e) { toast.error("Failed to share."); }
  };

  const saveRename = (id: string) => {
    if (editTitle.trim()) updateChatState(id, { title: editTitle.trim() });
    setEditingSessionId(null);
  };

  // --- Message Handling ---
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() && !selectedImage) return;

    const newMessage: Message = { role: "user", content: inputMessage.trim(), image: selectedImage || undefined };
    setMessages((prev) => [...prev, newMessage]);
    const currentQuestion = inputMessage.trim();
    const currentImage = selectedImage;
    
    setInputMessage("");
    setSelectedImage(null);
    setIsLoading(true);

    try {
      const response = await fetch("http://127.0.0.1:5000/agentic_query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ question: currentQuestion, image: currentImage, session_id: activeSessionId }),
      });
      const data = await response.json();

      if (response.ok) {
        setMessages((prev) => [...prev, { role: "bot", content: data.response || "No response." }]);
        if (!activeSessionId && data.session_id) {
          setActiveSessionId(data.session_id);
          await fetchChatSessions(); 
        }
      } else toast.error(data.error);
    } finally { setIsLoading(false); }
  };

  // --- Sorting the Sidebar ---
  const pinnedChats = chatSessions.filter(s => s.is_pinned && !s.is_archived);
  const recentChats = chatSessions.filter(s => !s.is_pinned && !s.is_archived);
  const archivedChats = chatSessions.filter(s => s.is_archived);

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-8" onClick={() => setOpenMenuId(null)}>
      {!sessionActive ? (
        <div className="max-w-md mx-auto pt-20 text-center">
           <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 mb-2">FinSight AI Advisor</h1>
           <button onClick={() => window.location.reload()} className="btn bg-indigo-600 text-white mt-4">Please Log In First</button>
        </div>
      ) : (
        <motion.div className="flex flex-col md:flex-row gap-6 h-[80vh] min-h-[600px]" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
          
          {/* --- SIDEBAR --- */}
          <div className="w-full md:w-80 flex-shrink-0 flex flex-col gap-4">
            <button onClick={startNewChat} className="flex items-center justify-center gap-2 w-full bg-white dark:bg-gray-800 border-2 border-dashed border-indigo-200 dark:border-gray-700 hover:border-indigo-500 text-indigo-600 py-4 rounded-2xl font-bold shadow-sm transition-all">
              <FiPlus size={20} /> New Chat
            </button>

            <div className="flex-grow overflow-y-auto bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 space-y-6">
              
              {/* PINNED CHATS */}
              {pinnedChats.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 px-2 flex items-center gap-1"><FiStar /> Pinned</h3>
                  <div className="space-y-1">
                    {pinnedChats.map(session => renderSidebarItem(session))}
                  </div>
                </div>
              )}

              {/* RECENT CHATS */}
              <div>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 px-2">Recent Chats</h3>
                <div className="space-y-1">
                  {recentChats.length === 0 && <p className="text-sm text-gray-500 px-2 italic">No recent chats.</p>}
                  {recentChats.map(session => renderSidebarItem(session))}
                </div>
              </div>

              {/* ARCHIVED CHATS TOGGLE */}
              {archivedChats.length > 0 && (
                <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                  <button onClick={(e) => { e.stopPropagation(); setShowArchived(!showArchived); }} className="text-xs font-bold text-gray-400 uppercase flex items-center gap-2 px-2 hover:text-indigo-500">
                    <FiArchive /> {showArchived ? "Hide Archived" : `View Archived (${archivedChats.length})`}
                  </button>
                  {showArchived && (
                    <div className="mt-3 space-y-1 opacity-70">
                      {archivedChats.map(session => renderSidebarItem(session))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* --- MAIN CHAT AREA --- */}
          <div className="flex-grow flex flex-col bg-white dark:bg-gray-800 shadow-2xl rounded-3xl border border-gray-100 dark:border-gray-700 overflow-hidden">
            {/* Header */}
            <div className="bg-indigo-50/50 dark:bg-gray-900/50 border-b border-indigo-100 dark:border-gray-700 p-5 flex items-center justify-between shadow-sm z-10">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.6)]"></div>
                <div>
                  <h2 className="font-bold text-indigo-900 dark:text-indigo-200 text-lg leading-tight">FinSight Advisor</h2>
                  <p className="text-xs text-indigo-600 dark:text-indigo-400">FAISS Memory Active</p>
                </div>
              </div>
            </div>

            {/* Chat History */}
            <div ref={chatContainerRef} className="flex-grow overflow-y-auto p-6 bg-gray-50/30 dark:bg-gray-800/30 space-y-6">
              <AnimatePresence>
                {messages.map((msg, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] px-6 py-4 rounded-3xl shadow-sm ${msg.role === "user" ? "bg-gradient-to-br from-indigo-500 to-indigo-600 text-white rounded-tr-sm" : "bg-white dark:bg-gray-700 border border-gray-100 dark:border-gray-600 text-gray-800 dark:text-gray-200 rounded-tl-sm"}`}>
                      {msg.image && <img src={msg.image} alt="Upload" className="max-w-xs w-full object-cover rounded-xl mb-3 border border-white/20" />}
                      {msg.role === "user" ? <p className="whitespace-pre-wrap">{msg.content}</p> : <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none"><ReactMarkdown>{msg.content}</ReactMarkdown></div>}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {isLoading && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                  <div className="bg-white dark:bg-gray-700 border border-gray-100 dark:border-gray-600 px-6 py-5 rounded-3xl rounded-tl-sm shadow-sm flex items-center gap-2">
                    <div className="w-2.5 h-2.5 bg-indigo-400 rounded-full animate-bounce"></div>
                    <div className="w-2.5 h-2.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                    <div className="w-2.5 h-2.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }}></div>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Input Area */}
            <div className="p-5 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 relative">
              <AnimatePresence>
                {selectedImage && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute bottom-[90px] left-6 bg-white dark:bg-gray-700 p-2 rounded-xl shadow-lg border border-gray-200 dark:border-gray-600 flex items-start gap-2">
                    <img src={selectedImage} alt="Preview" className="h-16 w-16 object-cover rounded-lg border border-gray-200 dark:border-gray-600" />
                    <button onClick={removeImage} className="bg-gray-100 dark:bg-gray-600 p-1 rounded-full text-gray-500 hover:text-red-500 transition-colors"><FiX size={14} /></button>
                  </motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={handleSendMessage} className="flex gap-3 items-center">
                <button type="button" onClick={toggleListening} className={`p-4 rounded-xl flex-shrink-0 transition-all shadow-sm ${isListening ? "bg-red-100 text-red-600 animate-pulse border border-red-200" : "bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-indigo-600"}`} title="Speak Question">
                  {isListening ? <FiMic size={20} /> : <FiMicOff size={20} />}
                </button>
                <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} className="hidden" />
                <button type="button" onClick={() => fileInputRef.current?.click()} className="p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-indigo-600 rounded-xl transition-all shadow-sm flex-shrink-0" title="Attach Image" disabled={isLoading}>
                  <FiImage size={20} />
                </button>
                <input type="text" value={inputMessage} onChange={(e) => setInputMessage(e.target.value)} className="flex-grow bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 p-4 shadow-sm" placeholder={isListening ? "Listening..." : "Message your advisor..."} disabled={isLoading} />
                <motion.button type="submit" disabled={isLoading || (!inputMessage.trim() && !selectedImage)} className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white p-4 rounded-xl shadow-lg transition-colors flex-shrink-0" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <FiSend size={20} />
                </motion.button>
              </form>
            </div>
          </div>
        </motion.div>
      )}
      <ToastContainer position="bottom-right" autoClose={3000} />
    </div>
  );

  // --- Helper function to render each sidebar item cleanly ---
  function renderSidebarItem(session: ChatSession) {
    return (
      <div key={session.id} className={`group relative w-full flex items-center justify-between px-3 py-3 rounded-xl cursor-pointer transition-colors ${activeSessionId === session.id ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300" : "hover:bg-gray-50 dark:hover:bg-gray-700/50 text-gray-600 dark:text-gray-400"}`} onClick={() => loadChatHistory(session.id)}>
        
        {/* Title / Rename Input */}
        <div className="flex items-center gap-3 overflow-hidden flex-grow pr-6">
          <FiMessageSquare className="flex-shrink-0" />
          {editingSessionId === session.id ? (
            <input 
              type="text" autoFocus value={editTitle} onChange={e => setEditTitle(e.target.value)} 
              onKeyDown={e => e.key === 'Enter' && saveRename(session.id)}
              onBlur={() => saveRename(session.id)}
              className="bg-white border border-indigo-300 rounded px-2 py-1 text-sm w-full text-black"
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <span className="truncate text-sm font-medium">{session.title}</span>
          )}
        </div>

        {/* 3-Dots Button */}
        <button 
          onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === session.id ? null : session.id); }}
          className={`absolute right-2 p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 ${openMenuId === session.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
        >
          <FiMoreVertical />
        </button>

        {/* Dropdown Menu */}
        <AnimatePresence>
          {openMenuId === session.id && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="absolute top-10 right-0 w-44 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden z-50 flex flex-col py-1"
            >
              <button onClick={(e) => { e.stopPropagation(); setEditingSessionId(session.id); setEditTitle(session.title); setOpenMenuId(null); }} className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"><FiEdit2 /> Rename</button>
              <button onClick={(e) => { e.stopPropagation(); shareChat(session.id); setOpenMenuId(null); }} className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"><FiShare2 /> Share Chat</button>
              <button onClick={(e) => { e.stopPropagation(); updateChatState(session.id, { is_pinned: !session.is_pinned }); setOpenMenuId(null); }} className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">{session.is_pinned ? <FiStar className="fill-indigo-500 text-indigo-500"/> : <FiStar />} {session.is_pinned ? "Unpin Chat" : "Pin Chat"}</button>
              <button onClick={(e) => { e.stopPropagation(); updateChatState(session.id, { is_archived: !session.is_archived }); setOpenMenuId(null); }} className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"><FiArchive /> {session.is_archived ? "Unarchive" : "Archive Chat"}</button>
              <div className="border-t border-gray-100 dark:border-gray-700 my-1"></div>
              <button onClick={(e) => { e.stopPropagation(); deleteChat(session.id); setOpenMenuId(null); }} className="flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 font-semibold"><FiTrash2 /> Delete Chat</button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }
}