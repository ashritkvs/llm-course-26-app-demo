import { useState } from "react";
import { useAppState } from "../hooks/use-app-state";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ClipboardList, Plus, Trash2, Calendar } from "lucide-react";
import { Assignment } from "../lib/types";

export default function AssignmentTracker() {
  const { assignments, saveAssignments } = useAppState();
  const { toast } = useToast();

  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState<Partial<Assignment>>({
    course: "",
    title: "",
    dueDate: "",
    platform: "",
    status: "not-started",
    notes: ""
  });

  const handleSave = () => {
    if (!formData.title) {
      toast({ title: "Error", description: "Title is required.", variant: "destructive" });
      return;
    }
    const newAssignment: Assignment = {
      id: Date.now().toString(),
      course: formData.course || "General",
      title: formData.title,
      dueDate: formData.dueDate || null,
      platform: formData.platform || "Unknown",
      status: formData.status as any,
      notes: formData.notes || ""
    };
    saveAssignments([...assignments, newAssignment]);
    setShowAddForm(false);
    setFormData({
      course: "", title: "", dueDate: "", platform: "", status: "not-started", notes: ""
    });
    toast({ title: "Saved", description: "Assignment added successfully." });
  };

  const handleDelete = (id: string) => {
    saveAssignments(assignments.filter(a => a.id !== id));
  };

  const toggleStatus = (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'not-started' ? 'in-progress' : currentStatus === 'in-progress' ? 'submitted' : 'not-started';
    saveAssignments(assignments.map(a => a.id === id ? { ...a, status: nextStatus as any } : a));
  };

  const totalCount = assignments.length;
  const inProgressCount = assignments.filter(a => a.status === 'in-progress').length;
  const submittedCount = assignments.filter(a => a.status === 'submitted').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <ClipboardList className="w-8 h-8 text-teal-500" />
            Assignment Tracker
          </h1>
          <p className="text-muted-foreground mt-1">Track submission statuses across platforms.</p>
        </div>
        <Button onClick={() => setShowAddForm(!showAddForm)} className="bg-teal-500 hover:bg-teal-600 text-white glow-card">
          <Plus className="w-4 h-4 mr-2" />
          Add Assignment
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-muted/50 border-border/50">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-foreground">{totalCount}</div>
            <div className="text-sm text-muted-foreground">Total</div>
          </CardContent>
        </Card>
        <Card className="bg-orange-500/5 border-orange-500/20">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-orange-500">{inProgressCount}</div>
            <div className="text-sm text-orange-500/80">In Progress</div>
          </CardContent>
        </Card>
        <Card className="bg-green-500/5 border-green-500/20">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-500">{submittedCount}</div>
            <div className="text-sm text-green-500/80">Submitted</div>
          </CardContent>
        </Card>
      </div>

      {showAddForm && (
        <Card className="border-teal-500/30 glow-card">
          <CardHeader>
            <CardTitle className="text-lg">New Assignment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Course</Label>
                <Input placeholder="e.g. AMS 597" value={formData.course} onChange={e => setFormData({...formData, course: e.target.value})} className="bg-background" />
              </div>
              <div className="space-y-2">
                <Label>Assignment Title *</Label>
                <Input value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="bg-background" />
              </div>
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input type="date" value={formData.dueDate} onChange={e => setFormData({...formData, dueDate: e.target.value})} className="bg-background" />
              </div>
              <div className="space-y-2">
                <Label>Platform</Label>
                <Input placeholder="e.g. Brightspace, GitHub" value={formData.platform} onChange={e => setFormData({...formData, platform: e.target.value})} className="bg-background" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(val: any) => setFormData({...formData, status: val})}>
                  <SelectTrigger className="bg-background"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not-started">Not Started</SelectItem>
                    <SelectItem value="in-progress">In Progress</SelectItem>
                    <SelectItem value="submitted">Submitted</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Notes (Optional)</Label>
                <Textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="min-h-[60px] bg-background" />
              </div>
            </div>
            <Button onClick={handleSave} className="w-full bg-teal-500 hover:bg-teal-600 text-white">Save Assignment</Button>
          </CardContent>
        </Card>
      )}

      {assignments.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground border border-dashed border-border rounded-lg">
          No assignments tracked yet. Add your first one above.
        </div>
      ) : (
        <div className="space-y-3">
          {assignments.map(assign => (
            <Card key={assign.id} className={`border-border/50 transition-all ${assign.status === 'submitted' ? 'opacity-60 grayscale-[30%]' : 'hover:border-teal-500/30'}`}>
              <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-start md:items-center">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-teal-500/10 text-teal-500 border-teal-500/20">{assign.course}</Badge>
                    <h3 className={`font-semibold text-lg ${assign.status === 'submitted' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{assign.title}</h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    {assign.dueDate && (
                      <span className="flex items-center gap-1 text-orange-500">
                        <Calendar className="w-3.5 h-3.5" />
                        Due: {new Date(assign.dueDate).toLocaleDateString()}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <span className="font-medium">Platform:</span> {assign.platform}
                    </span>
                  </div>
                  {assign.notes && <p className="text-xs text-muted-foreground italic mt-2 line-clamp-2">{assign.notes}</p>}
                </div>
                
                <div className="flex items-center gap-3 w-full md:w-auto">
                  <Button 
                    variant="outline" 
                    className={`flex-1 md:flex-none justify-center ${
                      assign.status === 'not-started' ? 'bg-muted/50 border-border text-muted-foreground' :
                      assign.status === 'in-progress' ? 'bg-orange-500/10 border-orange-500/30 text-orange-500' :
                      'bg-green-500/10 border-green-500/30 text-green-500'
                    }`}
                    onClick={() => toggleStatus(assign.id, assign.status)}
                  >
                    {assign.status.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(assign.id)} className="text-destructive hover:bg-destructive/10 hover:text-destructive shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
