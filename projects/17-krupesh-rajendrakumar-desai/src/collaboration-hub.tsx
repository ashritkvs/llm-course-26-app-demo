import { useState } from "react";
import { useAppState } from "../hooks/use-app-state";
import { useAnalyzeCourse } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Users, Send, Zap, Loader2, Hash } from "lucide-react";
import { CollabMessage } from "../lib/types";

const CHANNELS = [
  { id: 'general', name: 'General' },
  { id: 'assignment-help', name: 'Assignment Help' },
  { id: 'project-discussion', name: 'Project Discussion' },
  { id: 'presentation-feedback', name: 'Presentation Feedback' },
  { id: 'resources', name: 'Resources' }
] as const;

export default function CollaborationHub() {
  const { mode, collabMessages, saveCollabMessages, tasks, saveTasks, saveWeeklyPlan } = useAppState();
  const analyzeCourse = useAnalyzeCourse();
  const { toast } = useToast();

  const [activeChannel, setActiveChannel] = useState<string>('general');
  const [formData, setFormData] = useState<{ author: string; content: string; tag: any }>({
    author: "",
    content: "",
    tag: "none"
  });

  const activeMessages = collabMessages.filter(m => m.channel === activeChannel);

  const handlePost = () => {
    if (!formData.author || !formData.content) {
      toast({ title: "Error", description: "Author and Content are required.", variant: "destructive" });
      return;
    }
    const newMsg: CollabMessage = {
      id: Date.now().toString(),
      author: formData.author,
      channel: activeChannel as any,
      content: formData.content,
      timestamp: new Date().toISOString(),
      tag: formData.tag === 'none' ? null : formData.tag
    };
    saveCollabMessages([...collabMessages, newMsg]);
    setFormData({ ...formData, content: "", tag: "none" });
  };

  const handleAnalyze = () => {
    const allText = collabMessages.map(m => `[${m.channel}] ${m.author}: ${m.content}`).join('\n');
    if (!allText) {
      toast({ title: "Nothing to analyze", description: "There are no messages." });
      return;
    }
    
    analyzeCourse.mutate({
      data: { text: allText, source: "collab", courseContext: JSON.stringify({ mode }) }
    }, {
      onSuccess: (result) => {
        const existingOtherTasks = tasks.filter(t => t.source !== 'collab');
        saveTasks([...existingOtherTasks, ...result.tasks]);
        if (result.weeklyPlan) saveWeeklyPlan(result.weeklyPlan);
        toast({ title: "Analysis Complete", description: `Found ${result.tasks.length} tasks from discussions.` });
      }
    });
  };

  const getTagColor = (tag: string | null) => {
    if (!tag) return '';
    const map: Record<string, string> = {
      question: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      resource: 'bg-green-500/10 text-green-500 border-green-500/20',
      reminder: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
      experience: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
      'help-needed': 'bg-destructive/10 text-destructive border-destructive/20',
      feedback: 'bg-teal-500/10 text-teal-500 border-teal-500/20'
    };
    return map[tag] || 'bg-muted text-muted-foreground';
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Users className="w-8 h-8 text-purple-500" />
            Collaboration Hub
          </h1>
          <p className="text-muted-foreground mt-1">Internal discussion board for your course workspace.</p>
        </div>
        <Button onClick={handleAnalyze} disabled={analyzeCourse.isPending} className="bg-purple-500 hover:bg-purple-600 text-white glow-card">
          {analyzeCourse.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2 text-yellow-300" />}
          Analyze Discussion
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden border border-border/50 rounded-xl bg-card glow-card">
        {/* Left Sidebar */}
        <div className="w-64 border-r border-border/50 bg-muted/20 flex flex-col">
          <div className="p-4 border-b border-border/50 font-semibold text-sm">Channels</div>
          <div className="p-2 space-y-1 overflow-y-auto flex-1">
            {CHANNELS.map(ch => (
              <button
                key={ch.id}
                onClick={() => setActiveChannel(ch.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${activeChannel === ch.id ? 'bg-purple-500/10 text-purple-500 font-medium' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
              >
                <Hash className="w-4 h-4 opacity-50" />
                {ch.name}
              </button>
            ))}
          </div>
        </div>

        {/* Right Area */}
        <div className="flex-1 flex flex-col relative">
          <div className="p-4 border-b border-border/50 font-semibold flex items-center gap-2">
            <Hash className="w-5 h-5 text-muted-foreground" />
            {CHANNELS.find(c => c.id === activeChannel)?.name}
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {activeMessages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                No messages in this channel yet.
              </div>
            ) : (
              activeMessages.map(msg => (
                <div key={msg.id} className="flex gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-500/20 text-purple-500 flex items-center justify-center shrink-0 font-bold uppercase">
                    {msg.author.substring(0, 2)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-foreground">{msg.author}</span>
                      <span className="text-xs text-muted-foreground">{new Date(msg.timestamp).toLocaleString()}</span>
                      {msg.tag && <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${getTagColor(msg.tag)}`}>{msg.tag}</Badge>}
                    </div>
                    <div className="text-sm text-foreground bg-muted/30 p-3 rounded-md border border-border/30">
                      {msg.content}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-4 border-t border-border/50 bg-background/50 backdrop-blur-sm">
            <div className="flex gap-3 mb-3">
              <Input 
                placeholder="Your name" 
                value={formData.author} 
                onChange={e => setFormData({...formData, author: e.target.value})} 
                className="w-48 bg-background"
              />
              <Select value={formData.tag} onValueChange={(val: any) => setFormData({...formData, tag: val})}>
                <SelectTrigger className="w-40 bg-background"><SelectValue placeholder="Tag (optional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Tag</SelectItem>
                  <SelectItem value="question">Question</SelectItem>
                  <SelectItem value="resource">Resource</SelectItem>
                  <SelectItem value="reminder">Reminder</SelectItem>
                  <SelectItem value="experience">Experience</SelectItem>
                  <SelectItem value="help-needed">Help Needed</SelectItem>
                  <SelectItem value="feedback">Feedback</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Textarea 
                placeholder={`Message #${CHANNELS.find(c => c.id === activeChannel)?.name}`}
                value={formData.content}
                onChange={e => setFormData({...formData, content: e.target.value})}
                className="min-h-[60px] resize-none bg-background"
              />
              <Button onClick={handlePost} className="h-auto bg-purple-500 hover:bg-purple-600 text-white shrink-0">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
