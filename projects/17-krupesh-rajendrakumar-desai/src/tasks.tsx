import { useState } from "react";
import { useAppState } from "../hooks/use-app-state";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Circle, AlertCircle } from "lucide-react";

export default function Tasks() {
  const { mode, tasks, saveTasks } = useAppState();
  const [filterSource, setFilterSource] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const toggleTaskStatus = (id: string) => {
    saveTasks(tasks.map(t => 
      t.id === id 
        ? { ...t, status: t.status === 'completed' ? 'pending' : 'completed' } 
        : t
    ));
  };

  const filteredTasks = tasks.filter(t => {
    if (filterSource !== "all" && t.source !== filterSource) return false;
    if (filterPriority !== "all" && t.priority !== filterPriority) return false;
    if (filterStatus !== "all" && t.status !== filterStatus) return false;
    return true;
  });

  const getPriorityColor = (priority: string) => {
    if (priority === 'high') return 'text-destructive border-destructive/30 bg-destructive/10';
    if (priority === 'medium') return 'text-orange-500 border-orange-500/30 bg-orange-500/10';
    return 'text-green-500 border-green-500/30 bg-green-500/10';
  };

  return (
    <div className="space-y-6">
      {mode === 'demo' && (
        <div className="bg-orange-500/10 border border-orange-500/20 text-orange-500 p-3 rounded-md text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          Showing AMS 691 demo tasks. Clear workspace to use custom data.
        </div>
      )}
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Tasks</h1>
          <p className="text-muted-foreground mt-1">Manage your extracted course tasks.</p>
        </div>
        
        <div className="flex flex-wrap gap-3">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[140px] bg-card border-border">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={filterPriority} onValueChange={setFilterPriority}>
            <SelectTrigger className="w-[140px] bg-card border-border">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterSource} onValueChange={setFilterSource}>
            <SelectTrigger className="w-[140px] bg-card border-border">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              <SelectItem value="announcement">Announcement</SelectItem>
              <SelectItem value="collab">Collab</SelectItem>
              <SelectItem value="resource">Resource</SelectItem>
              <SelectItem value="assignment">Assignment</SelectItem>
              <SelectItem value="feedback">Feedback</SelectItem>
              <SelectItem value="brightspace">Brightspace</SelectItem>
              <SelectItem value="discord">Discord</SelectItem>
              <SelectItem value="googledrive">Google Drive</SelectItem>
              <SelectItem value="quiz">Quiz</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card className="bg-muted/50 border-border/50">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="text-sm text-muted-foreground">Total Tasks</div>
            <div className="text-2xl font-bold text-foreground">{tasks.length}</div>
          </CardContent>
        </Card>
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="text-sm text-primary">Pending</div>
            <div className="text-2xl font-bold text-primary">{tasks.filter(t => t.status === 'pending').length}</div>
          </CardContent>
        </Card>
        <Card className="bg-destructive/5 border-destructive/20">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="text-sm text-destructive">High Priority</div>
            <div className="text-2xl font-bold text-destructive">{tasks.filter(t => t.priority === 'high' && t.status !== 'completed').length}</div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        {filteredTasks.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground border border-dashed border-border rounded-lg">
            No tasks found matching your filters.
          </div>
        ) : (
          filteredTasks.map(task => (
            <Card key={task.id} className={`border-border/50 transition-all ${task.status === 'completed' ? 'opacity-50 grayscale-[50%]' : 'hover:border-primary/50 glow-card'}`}>
              <CardContent className="p-4 flex items-start gap-4">
                <div className="pt-1">
                  <Checkbox 
                    checked={task.status === 'completed'} 
                    onCheckedChange={() => toggleTaskStatus(task.id)}
                    className="w-5 h-5 border-muted-foreground data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-start justify-between">
                    <h3 className={`font-semibold text-lg ${task.status === 'completed' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                      {task.title}
                    </h3>
                    <div className="flex gap-2 shrink-0">
                      <Badge variant="outline" className="capitalize text-xs">{task.source}</Badge>
                      <Badge variant="outline" className={`capitalize text-xs ${getPriorityColor(task.priority)}`}>
                        {task.priority}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{task.explanation}</p>
                  
                  <div className="flex items-center gap-4 mt-2 pt-2 border-t border-border/50 text-xs text-muted-foreground">
                    {task.dueDate && (
                      <div className="flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Due: {new Date(task.dueDate).toLocaleString()}
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <Circle className="w-3.5 h-3.5" />
                      Confidence: {Math.round(task.confidenceScore * 100)}%
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
