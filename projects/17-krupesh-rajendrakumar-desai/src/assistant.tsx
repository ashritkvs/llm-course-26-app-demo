import { useState, useRef, useEffect } from "react";
import { useAppState } from "../hooks/use-app-state";
import { useChatAssistant } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Loader2, Bot, User, AlertCircle } from "lucide-react";

const SUGGESTED_QUESTIONS = [
  "What should I complete this week?",
  "What deadlines am I missing?",
  "What announcements were posted?",
  "What did classmates discuss?",
  "Which resource links are missing?",
  "What assignments do I have?",
  "Help me write peer feedback.",
  "Give me a workspace summary."
];

export default function Assistant() {
  const { mode, chatHistory, saveChatHistory, buildContext } = useAppState();
  const [inputValue, setInputValue] = useState("");
  const chatAssistant = useChatAssistant();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatHistory, chatAssistant.isPending]);

  const handleSend = (text: string) => {
    if (!text.trim()) return;
    
    const newUserMessage = { id: Date.now().toString(), role: 'user' as const, content: text, timestamp: new Date().toISOString() };
    const newHistory = [...chatHistory, newUserMessage];
    saveChatHistory(newHistory);
    setInputValue("");

    const context = buildContext();

    chatAssistant.mutate(
      { data: { message: text, courseContext: context } },
      {
        onSuccess: (result) => {
          saveChatHistory([
            ...newHistory,
            { id: (Date.now() + 1).toString(), role: 'assistant', content: result.reply, timestamp: new Date().toISOString() }
          ]);
        },
        onError: () => {
          saveChatHistory([
            ...newHistory,
            { id: (Date.now() + 1).toString(), role: 'assistant', content: "Sorry, I encountered an error connecting to the AI.", timestamp: new Date().toISOString() }
          ]);
        }
      }
    );
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="mb-4">
        <h1 className="text-3xl font-bold text-foreground">AI Assistant</h1>
        <p className="text-muted-foreground mt-1">Ask questions about your courses, deadlines, and tasks.</p>
      </div>

      {mode === 'demo' && (
        <div className="bg-orange-500/10 border border-orange-500/20 text-orange-500 p-2 mb-4 rounded-md text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          Demo Mode active. Answers reflect AMS 691 sample data.
        </div>
      )}

      <Card className="flex-1 border-border/50 glow-card flex flex-col overflow-hidden bg-card/50">
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          {chatHistory.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center pt-10">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6 glow-blue">
                <Bot className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold mb-6">How can I help you today?</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl w-full">
                {SUGGESTED_QUESTIONS.map((q, i) => (
                  <Button 
                    key={i} 
                    variant="outline" 
                    className="justify-start h-auto py-3 px-4 text-left border-border/50 hover:bg-primary/5 hover:border-primary/30"
                    onClick={() => handleSend(q)}
                  >
                    {q}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6 pb-4">
              {chatHistory.map((msg) => (
                <div key={msg.id} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center ${msg.role === 'user' ? 'bg-secondary/20 text-secondary' : 'bg-primary/20 text-primary'}`}>
                    {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>
                  <div className={`max-w-[80%] rounded-lg p-4 ${msg.role === 'user' ? 'bg-secondary/10 text-foreground border border-secondary/20' : 'bg-muted border border-border/50 text-foreground'}`}>
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  </div>
                </div>
              ))}
              {chatAssistant.isPending && (
                <div className="flex gap-4">
                  <div className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center bg-primary/20 text-primary">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="max-w-[80%] rounded-lg p-4 bg-muted border border-border/50 text-foreground">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
        
        <div className="p-4 border-t border-border/50 bg-card">
          <form 
            onSubmit={(e) => { e.preventDefault(); handleSend(inputValue); }}
            className="flex gap-3 relative"
          >
            <Input 
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask anything about your courses..." 
              className="flex-1 bg-background border-border/50 pr-12 focus-visible:ring-primary h-12"
              disabled={chatAssistant.isPending}
            />
            <Button 
              type="submit" 
              size="icon"
              className="absolute right-1.5 top-1.5 h-9 w-9 bg-primary hover:bg-primary/90"
              disabled={!inputValue.trim() || chatAssistant.isPending}
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
