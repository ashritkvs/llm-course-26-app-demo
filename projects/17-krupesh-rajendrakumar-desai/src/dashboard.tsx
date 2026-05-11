import { useAppState } from "../hooks/use-app-state";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { AlertCircle, Clock, Megaphone, Users, FolderOpen, ClipboardList, Database, Trash2, MessageSquare } from "lucide-react";

export default function Dashboard() {
  const { mode, tasks, weeklyPlan, announcements, collabMessages, resources, assignments, loadDemoData, clearWorkspace } = useAppState();

  const pendingTasks = tasks.filter(t => t.status === 'pending');
  const urgentTasks = tasks.filter(t => t.priority === 'high' && t.status === 'pending');
  const missingLinkResources = resources.filter(r => !r.link);
  const notStartedAssignments = assignments.filter(a => a.status === 'not-started');

  const handleClearWorkspace = () => {
    if (window.confirm("Are you sure you want to clear your entire workspace? This cannot be undone.")) {
      clearWorkspace();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-foreground">Mission Control</h1>
            {mode === 'demo' ? (
              <Badge className="bg-orange-500/20 text-orange-500 hover:bg-orange-500/20 border-0">Demo Mode: AMS 691</Badge>
            ) : (
              <Badge className="bg-green-500/20 text-green-500 hover:bg-green-500/20 border-0">Custom Workspace</Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-1">Overview of your courses and deadlines.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={loadDemoData} className="border-primary/50 text-primary hover:bg-primary/10">
            <Database className="w-4 h-4 mr-2" />
            Load Demo Data
          </Button>
          <Button variant="outline" onClick={handleClearWorkspace} className="border-destructive/50 text-destructive hover:bg-destructive/10">
            <Trash2 className="w-4 h-4 mr-2" />
            Clear Workspace
          </Button>
          <Link href="/assistant" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 glow-card">
            <MessageSquare className="w-4 h-4 mr-2" />
            What should I complete this week?
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium flex items-center gap-2 text-primary">
              <Clock className="w-4 h-4" /> Pending Tasks
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4 px-4">
            <div className="text-2xl font-bold text-primary">{pendingTasks.length}</div>
          </CardContent>
        </Card>

        <Card className="border-destructive/20 bg-destructive/5">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium flex items-center gap-2 text-destructive">
              <AlertCircle className="w-4 h-4" /> High Priority
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4 px-4">
            <div className="text-2xl font-bold text-destructive">{urgentTasks.length}</div>
          </CardContent>
        </Card>

        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium flex items-center gap-2 text-blue-500">
              <Megaphone className="w-4 h-4" /> Announcements
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4 px-4">
            <div className="text-2xl font-bold text-blue-500">{announcements.length}</div>
          </CardContent>
        </Card>

        <Card className="border-purple-500/20 bg-purple-500/5">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium flex items-center gap-2 text-purple-500">
              <Users className="w-4 h-4" /> Collab Messages
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4 px-4">
            <div className="text-2xl font-bold text-purple-500">{collabMessages.length}</div>
          </CardContent>
        </Card>

        <Card className="border-orange-500/20 bg-orange-500/5">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium flex items-center gap-2 text-orange-500">
              <FolderOpen className="w-4 h-4" /> Resources
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4 px-4">
            <div className="text-2xl font-bold text-orange-500">{resources.length}</div>
            {missingLinkResources.length > 0 && <p className="text-[10px] text-orange-500/70 mt-1">{missingLinkResources.length} missing link{missingLinkResources.length !== 1 ? 's' : ''}</p>}
          </CardContent>
        </Card>

        <Card className="border-teal-500/20 bg-teal-500/5">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium flex items-center gap-2 text-teal-500">
              <ClipboardList className="w-4 h-4" /> Assignments
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4 px-4">
            <div className="text-2xl font-bold text-teal-500">{assignments.length}</div>
            {notStartedAssignments.length > 0 && <p className="text-[10px] text-teal-500/70 mt-1">{notStartedAssignments.length} not started</p>}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border/50 glow-card">
          <CardHeader>
            <CardTitle>Weekly Action Plan</CardTitle>
          </CardHeader>
          <CardContent>
            {weeklyPlan ? (
              <div className="space-y-2">
                {weeklyPlan.split('. ').filter(Boolean).map((line, i) => (
                  <div key={i} className="p-3 bg-muted rounded-md text-sm text-foreground flex items-start gap-3">
                    <span className="text-primary font-mono shrink-0">{(i + 1).toString().padStart(2, '0')}</span>
                    {line}.
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground text-sm border border-dashed border-border rounded-md">
                No action plan generated yet. Load demo data or ask the assistant.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 glow-card">
          <CardHeader>
            <CardTitle>Urgent Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            {urgentTasks.length > 0 ? (
              <div className="space-y-3">
                {urgentTasks.slice(0, 5).map(task => (
                  <div key={task.id} className="flex items-center justify-between p-3 bg-muted rounded-md border border-border/50">
                    <div>
                      <div className="font-medium text-sm text-foreground">{task.title}</div>
                      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5 capitalize">{task.source}</Badge>
                        {task.dueDate && <span>Due: {new Date(task.dueDate).toLocaleDateString()}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground text-sm border border-dashed border-border rounded-md">
                No urgent tasks. You're all caught up!
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle>Recent Announcements</CardTitle>
          </CardHeader>
          <CardContent>
            {announcements.length > 0 ? (
              <div className="space-y-3">
                {announcements.slice(-3).reverse().map(ann => (
                  <div key={ann.id} className="p-3 bg-muted/50 rounded-md border border-border/50">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">{ann.courseName}</Badge>
                        <span className="font-medium text-sm text-foreground">{ann.title}</span>
                      </div>
                      {ann.dueDate && <span className="text-xs text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded-full">Due: {new Date(ann.dueDate).toLocaleDateString()}</span>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-muted-foreground text-sm">No announcements</div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader>
            <CardTitle>Assignments Overview</CardTitle>
          </CardHeader>
          <CardContent>
            {assignments.length > 0 ? (
              <div className="space-y-3">
                {assignments.slice(0, 4).map(assign => (
                  <div key={assign.id} className="flex justify-between items-center p-3 bg-muted/50 rounded-md border border-border/50">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-teal-500/10 text-teal-500 border-teal-500/20">{assign.course}</Badge>
                      <span className="text-sm font-medium">{assign.title}</span>
                    </div>
                    <Badge variant="outline" className={
                      assign.status === 'not-started' ? "bg-muted text-muted-foreground" :
                      assign.status === 'in-progress' ? "bg-orange-500/10 text-orange-500 border-orange-500/20" :
                      "bg-green-500/10 text-green-500 border-green-500/20"
                    }>
                      {assign.status.replace('-', ' ')}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-muted-foreground text-sm">No assignments</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
