import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, X, Send, Bot, User, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input'; // Assuming you have an input component or use standard input
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

interface Message {
  role: 'user' | 'model';
  content: string;
}

export function AiChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', content: "Hello! I'm CivicFix AI. I can help you report issues or check your complaint status. How can I assist you today?" }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { userProfile } = useAuth();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      // Convert to API format
      const conversation = [...messages, userMsg].map(m => ({ 
          role: m.role as string, 
          content: m.content 
      }));

      const res = await api.startCitizenChat({
        conversation,
        citizenId: userProfile?.uid,
        citizenName: userProfile?.displayName || 'Citizen'
      });

      if (res.success) {
        setMessages(prev => [...prev, { role: 'model', content: res.response }]);
        // Could handle suggested actions here
      }
    } catch (error) {
       console.error(error);
       setMessages(prev => [...prev, { role: 'model', content: "I'm having trouble connecting to the network. Please try again later." }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 text-foreground">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="mb-4 w-[350px] md:w-[400px] h-[500px] glass-panel flex flex-col overflow-hidden shadow-2xl border border-primary/20 bg-black/80 backdrop-blur-xl rounded-2xl"
          >
            {/* Header */}
            <div className="p-4 border-b border-white/10 bg-gradient-to-r from-primary/20 to-transparent flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                    <Bot className="w-5 h-5 text-primary" />
                </div>
                <div>
                    <h3 className="font-semibold text-sm">CivicFix Assistant</h3>
                    <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-[10px] text-muted-foreground">Online</span>
                    </div>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/10 rounded-full" onClick={() => setIsOpen(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar" ref={scrollRef}>
                {messages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`
                            max-w-[85%] p-3 text-sm rounded-2xl
                            ${msg.role === 'user' 
                                ? 'bg-primary text-primary-foreground rounded-br-none' 
                                : 'bg-white/10 text-foreground rounded-bl-none border border-white/5'}
                        `}>
                            {msg.content}
                        </div>
                    </div>
                ))}
                {isTyping && (
                    <div className="flex justify-start">
                        <div className="bg-white/5 border border-white/5 rounded-2xl rounded-bl-none p-3 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                            <span className="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                            <span className="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                        </div>
                    </div>
                )}
            </div>

            {/* Input Area */}
            <div className="p-3 border-t border-white/10 bg-white/5">
                <form 
                  onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                  className="flex items-center gap-2"
                >
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Type a message..."
                        className="flex-1 bg-black/20 border border-white/10 rounded-full px-4 py-2 text-sm focus:outline-none focus:border-primary/50 transition-colors"
                    />
                    <Button 
                        type="submit" 
                        size="icon" 
                        disabled={!input.trim() || isTyping}
                        className="rounded-full bg-primary hover:bg-primary/90"
                    >
                        <Send className="w-4 h-4" />
                    </Button>
                </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className={`
            w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300
            bg-gradient-to-tr from-primary to-violet-400
            ${isOpen ? 'rotate-90 opacity-0 pointer-events-none absolute' : 'opacity-100'}
        `}
      >
        <MessageSquare className="w-7 h-7 text-white" />
      </motion.button>
      
      {/* Ghost button to handle closing state transition cleanly if needed, but the main button handles open */}
       <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className={`
            w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300
            bg-destructive
            ${!isOpen ? 'rotate-90 opacity-0 pointer-events-none absolute' : 'opacity-100'}
        `}
      >
        <X className="w-7 h-7 text-white" />
      </motion.button>
    </div>
  );
}
