import { useState } from "react";
import { useAppState } from "../hooks/use-app-state";
import { useAnalyzeCourse } from "@workspace/api-client-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Megaphone, Plus, Trash2, Zap, Loader2, ClipboardPaste } from "lucide-react";
import { Announcement } from "../lib/types";

export default function AnnouncementCenter() {
  const { mode, announcements, saveAnnouncements, tasks, saveTasks, saveWeeklyPlan } = useAppState();
  const analyzeCourse = useAnalyzeCourse();
  const { toast } = useToast();

  const [showAddForm, setShowAddForm] = useState(false);
  const [showPasteForm, setShowPasteForm] = useState(false);

  const [formData, setFormData] = useState<Partial<Announcement>>({
    courseName: "",
    title: "",
    body: "",
    source: "brightspace",
    date: new Date().toISOString().split('T')[0],
    dueDate: "",
    priority: "medium"
  });

  const [pasteData, setPasteData] = useState({
    text: "",
    source: "brightspace" as const
  });

  const handleSave = () => {
    if (!formData.title || !formData.body) {
      toast({ title: "Error", description: "Title and Body are required.", variant: "destructive" });
      return;
    }
    const newAnnouncement: Announcement = {
      id: Date.now().toString(),
      courseName: formData.courseName || "General",
      title: formData.title,
      body: formData.body,
      source: formData.source as any,
      date: formData.date || new Date().toISOString().split('T')[0],
      dueDate: formData.dueDate || null,
      priority: formData.priority as any,
      analyzed: false
    };
    saveAnnouncements([...announcements, newAnnouncement]);
    setShowAddForm(false);
    setFormData({
      courseName: "", title: "", body: "", source: "brightspace", date: new Date().toISOString().split('T')[0], dueDate: "", priority: "medium"
    });
    toast({ title: "Saved", description: "Announcement added successfully." });
  };

  const handlePasteSave = () => {
    if (!pasteData.text) return;
    const lines = pasteData.text.split('\n');
    const title = lines[0].substring(0, 100);
    const body = pasteData.text;
    const newAnnouncement: Announcement = {
      id: Date.now().toString(),
      courseName: "General",
      title: title,
      body: body,
      source: pasteData.source,
      date: new Date().toISOString().split('T')[0],
      dueDate: null,
      priority: "medium",
      analyzed: false
    };
    saveAnnouncements([...announcements, newAnnouncement]);
    setShowPasteForm(false);
    setPasteData({ text: "", source: "brightspace" });
    toast({ title: "Saved", description: "Pasted announcement added." });
  };

  const handleDelete = (id: string) => {
    saveAnnouncements(announcements.filter(a => a.id !== id));
  };

  const handleAnalyzeSingle = (announcement: Announcement) => {
    analyzeCourse.mutate({
      data: { text: announcement.body, source: "announcement", courseContext: JSON.stringify({ mode }) }
    }, {
      onSuccess: (result) => {
        const existingOtherTasks = tasks.filter(t => t.source !== 'announcement');
        saveTasks([...existingOtherTasks, ...result.tasks]);
        if (result.weeklyPlan) saveWeeklyPlan(result.weeklyPlan);
        
        saveAnnouncements(announcements.map(a => a.id === announcement.id ? { ...a, analyzed: true } : a));
        toast({ title: "Analysis Complete", description: `Found ${result.tasks.length} tasks.` });
      }
    });
  };

  const handleAnalyzeAll = () => {
    const allText = announcements.map(a => `Title: ${a.title}\nBody: ${a.body}`).join('\n\n---\n\n');
    analyzeCourse.mutate({
      data: { text: allText, source: "announcement", courseContext: JSON.stringify({ mode }) }
    }, {
      onSuccess: (result) => {
        const existingOtherTasks = tasks.filter(t => t.source !== 'announcement');
        saveTasks([...existingOtherTasks, ...result.tasks]);
        if (result.weeklyPlan) saveWeeklyPlan(result.weeklyPlan);
        
        saveAnnouncements(announcements.map(a => ({ ...a, analyzed: true })));
        toast({ title: "Analysis Complete", description: `Found ${result.tasks.length} tasks from all announcements.` });
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Megaphone className="w-8 h-8 text-blue-500" />
            Announcement Center
          </h1>
          <p className="text-muted-foreground mt-1">Centralize announcements from instructors and TAs.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowPasteForm(!showPasteForm)}>
            <ClipboardPaste className="w-4 h-4 mr-2" />
            Quick Paste
          </Button>
          <Button onClick={() => setShowAddForm(!showAddForm)} className="bg-blue-500 hover:bg-blue-600 text-white">
            <Plus className="w-4 h-4 mr-2" />
            Add Announcement
          </Button>
        </div>
      </div>

      {showPasteForm && (
        <Card className="border-blue-500/20 bg-blue-500/5 glow-card">
          <CardHeader>
            <CardTitle className="text-lg">Quick Paste Import</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea 
              placeholder="Paste announcement text here..." 
              value={pasteData.text}
              onChange={e => setPasteData({...pasteData, text: e.target.value})}
              className="min-h-[120px] bg-background"
            />
            <div className="flex items-center gap-4">
              <div className="w-[200px]">
                <Select value={pasteData.source} onValueChange={(val: any) => setPasteData({...pasteData, source: val})}>
                  <SelectTrigger className="bg-background"><SelectValue placeholder="Source" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="brightspace">Brightspace</SelectItem>
                    <SelectItem value="instructor">Instructor</SelectItem>
                    <SelectItem value="ta">TA</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handlePasteSave} className="bg-blue-500 hover:bg-blue-600 text-white">Save as Announcement</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {showAddForm && (
        <Card className="border-blue-500/20 glow-card">
          <CardHeader>
            <CardTitle className="text-lg">New Announcement</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Course Name</Label>
                <Input placeholder="e.g. AMS 597" value={formData.courseName} onChange={e => setFormData({...formData, courseName: e.target.value})} className="bg-background" />
              </div>
              <div className="space-y-2">
                <Label>Title *</Label>
                <Input placeholder="Announcement Title" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="bg-background" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Body *</Label>
              <Textarea placeholder="Full announcement text..." value={formData.body} onChange={e => setFormData({...formData, body: e.target.value})} className="min-h-[120px] bg-background" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Source</Label>
                <Select value={formData.source} onValueChange={(val: any) => setFormData({...formData, source: val})}>
                  <SelectTrigger className="bg-background"><SelectValue placeholder="Source" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="brightspace">Brightspace</SelectItem>
                    <SelectItem value="instructor">Instructor</SelectItem>
                    <SelectItem value="ta">TA</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="bg-background" />
              </div>
              <div className="space-y-2">
                <Label>Due Date (Optional)</Label>
                <Input type="date" value={formData.dueDate} onChange={e => setFormData({...formData, dueDate: e.target.value})} className="bg-background" />
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={formData.priority} onValueChange={(val: any) => setFormData({...formData, priority: val})}>
                  <SelectTrigger className="bg-background"><SelectValue placeholder="Priority" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={handleSave} className="w-full bg-blue-500 hover:bg-blue-600 text-white">Save Announcement</Button>
          </CardContent>
        </Card>
      )}

      {announcements.length > 0 && (
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Saved Announcements</h2>
          <Button variant="secondary" onClick={handleAnalyzeAll} disabled={analyzeCourse.isPending} className="glow-card">
            {analyzeCourse.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2 text-yellow-500" />}
            Analyze All Announcements
          </Button>
        </div>
      )}

      {announcements.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground border border-dashed border-border rounded-lg">
          No announcements yet. Add one above or load demo data.
        </div>
      ) : (
        <div className="space-y-4">
          {announcements.map(ann => (
            <Card key={ann.id} className="border-border/50 hover:border-blue-500/30 transition-all">
              <CardContent className="p-5">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={
                      ann.priority === 'high' ? 'bg-destructive/10 text-destructive border-destructive/20' :
                      ann.priority === 'medium' ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' :
                      'bg-green-500/10 text-green-500 border-green-500/20'
                    }>{ann.priority}</Badge>
                    
                    <Badge variant="outline" className={
                      ann.source === 'brightspace' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                      ann.source === 'instructor' ? 'bg-teal-500/10 text-teal-500 border-teal-500/20' :
                      ann.source === 'ta' ? 'bg-purple-500/10 text-purple-500 border-purple-500/20' :
                      'bg-gray-500/10 text-gray-400 border-gray-500/20'
                    }>{ann.source}</Badge>

                    <span className="text-sm font-medium text-muted-foreground px-2">{ann.courseName}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => handleAnalyzeSingle(ann)} disabled={analyzeCourse.isPending}>
                      <Zap className="w-4 h-4 mr-1 text-yellow-500" /> Analyze
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(ann.id)} className="text-destructive hover:bg-destructive/10 hover:text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                
                <h3 className="text-lg font-bold text-foreground mb-2">{ann.title}</h3>
                <p className="text-sm text-muted-foreground line-clamp-3 mb-3">{ann.body}</p>
                
                <div className="flex gap-3 text-xs text-muted-foreground border-t border-border/50 pt-3">
                  <span>Posted: {new Date(ann.date).toLocaleDateString()}</span>
                  {ann.dueDate && <span className="text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded-full">Due: {new Date(ann.dueDate).toLocaleDateString()}</span>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
