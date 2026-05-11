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
import { FolderOpen, Plus, Trash2, ExternalLink, Copy, AlertTriangle, Zap, Loader2, FileText, Presentation, Video, Image as ImageIcon, Database, Code, File } from "lucide-react";
import { Resource } from "../lib/types";

export default function ResourceManager() {
  const { mode, resources, saveResources, tasks, saveTasks, saveWeeklyPlan } = useAppState();
  const analyzeCourse = useAnalyzeCourse();
  const { toast } = useToast();

  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState<Partial<Resource>>({
    title: "",
    resourceType: "document",
    link: "",
    description: "",
    relatedCourse: "",
    relatedDeadline: ""
  });

  const handleSave = () => {
    if (!formData.title) {
      toast({ title: "Error", description: "Title is required.", variant: "destructive" });
      return;
    }
    const newResource: Resource = {
      id: Date.now().toString(),
      title: formData.title,
      resourceType: formData.resourceType as any,
      link: formData.link || "",
      description: formData.description || "",
      relatedCourse: formData.relatedCourse || "General",
      relatedDeadline: formData.relatedDeadline || null
    };
    saveResources([...resources, newResource]);
    setShowAddForm(false);
    setFormData({
      title: "", resourceType: "document", link: "", description: "", relatedCourse: "", relatedDeadline: ""
    });
    toast({ title: "Saved", description: "Resource added successfully." });
  };

  const handleDelete = (id: string) => {
    saveResources(resources.filter(r => r.id !== id));
  };

  const handleAnalyze = () => {
    const allText = resources.map(r => `Resource: ${r.title}\nType: ${r.resourceType}\nDescription: ${r.description}`).join('\n\n');
    analyzeCourse.mutate({
      data: { text: allText, source: "resource", courseContext: JSON.stringify({ mode }) }
    }, {
      onSuccess: (result) => {
        const existingOtherTasks = tasks.filter(t => t.source !== 'resource');
        saveTasks([...existingOtherTasks, ...result.tasks]);
        if (result.weeklyPlan) saveWeeklyPlan(result.weeklyPlan);
        toast({ title: "Analysis Complete", description: `Found ${result.tasks.length} tasks from resources.` });
      }
    });
  };

  const copyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    toast({ title: "Copied", description: "Link copied to clipboard." });
  };

  const getResourceIcon = (type: string) => {
    switch (type) {
      case 'document': return <FileText className="w-5 h-5 text-blue-500" />;
      case 'slides': return <Presentation className="w-5 h-5 text-orange-500" />;
      case 'video': return <Video className="w-5 h-5 text-red-500" />;
      case 'image': return <ImageIcon className="w-5 h-5 text-purple-500" />;
      case 'dataset': return <Database className="w-5 h-5 text-teal-500" />;
      case 'code': return <Code className="w-5 h-5 text-zinc-500" />;
      default: return <File className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const missingLinks = resources.filter(r => !r.link);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <FolderOpen className="w-8 h-8 text-orange-500" />
            Resource Manager
          </h1>
          <p className="text-muted-foreground mt-1">Keep track of important course links, slides, and documents.</p>
        </div>
        <div className="flex gap-2">
          {resources.length > 0 && (
            <Button variant="outline" onClick={handleAnalyze} disabled={analyzeCourse.isPending}>
              {analyzeCourse.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2 text-yellow-500" />}
              Analyze Resources
            </Button>
          )}
          <Button onClick={() => setShowAddForm(!showAddForm)} className="bg-orange-500 hover:bg-orange-600 text-white glow-card">
            <Plus className="w-4 h-4 mr-2" />
            Add Resource
          </Button>
        </div>
      </div>

      {missingLinks.length > 0 && (
        <div className="bg-orange-500/10 border border-orange-500/30 text-orange-500 p-3 rounded-lg flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">{missingLinks.length} resource(s) are missing links. Update them to complete your workspace.</p>
        </div>
      )}

      {showAddForm && (
        <Card className="border-orange-500/30 glow-card">
          <CardHeader>
            <CardTitle className="text-lg">New Resource</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Title *</Label>
                <Input value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="bg-background" />
              </div>
              <div className="space-y-2">
                <Label>Resource Type</Label>
                <Select value={formData.resourceType} onValueChange={(val: any) => setFormData({...formData, resourceType: val})}>
                  <SelectTrigger className="bg-background"><SelectValue placeholder="Type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="document">Document</SelectItem>
                    <SelectItem value="slides">Slides</SelectItem>
                    <SelectItem value="video">Video</SelectItem>
                    <SelectItem value="image">Image</SelectItem>
                    <SelectItem value="dataset">Dataset</SelectItem>
                    <SelectItem value="code">Code</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Link / URL</Label>
              <Input placeholder="https://..." value={formData.link} onChange={e => setFormData({...formData, link: e.target.value})} className="bg-background" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="min-h-[80px] bg-background" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Related Course</Label>
                <Input value={formData.relatedCourse} onChange={e => setFormData({...formData, relatedCourse: e.target.value})} className="bg-background" />
              </div>
              <div className="space-y-2">
                <Label>Related Deadline (Optional)</Label>
                <Input type="date" value={formData.relatedDeadline} onChange={e => setFormData({...formData, relatedDeadline: e.target.value})} className="bg-background" />
              </div>
            </div>
            <Button onClick={handleSave} className="w-full bg-orange-500 hover:bg-orange-600 text-white">Save Resource</Button>
          </CardContent>
        </Card>
      )}

      {resources.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground border border-dashed border-border rounded-lg">
          No resources yet. Add your first link above.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {resources.map(resource => (
            <Card key={resource.id} className="border-border/50 hover:border-orange-500/30 transition-all flex flex-col">
              <CardContent className="p-4 flex flex-col flex-1">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                      {getResourceIcon(resource.resourceType)}
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground line-clamp-1">{resource.title}</h3>
                      <div className="flex gap-2 mt-1">
                        <Badge variant="outline" className="text-[10px] py-0">{resource.resourceType}</Badge>
                        {resource.relatedCourse && <Badge variant="outline" className="text-[10px] py-0 bg-muted/50">{resource.relatedCourse}</Badge>}
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(resource.id)} className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                
                {resource.description && (
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{resource.description}</p>
                )}

                <div className="mt-auto space-y-3">
                  {resource.relatedDeadline && (
                    <div className="text-xs text-orange-500 bg-orange-500/10 inline-flex px-2 py-1 rounded-md">
                      Deadline: {new Date(resource.relatedDeadline).toLocaleDateString()}
                    </div>
                  )}

                  <div className="flex items-center gap-2 border-t border-border/50 pt-3">
                    {resource.link ? (
                      <>
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => window.open(resource.link, '_blank')}>
                          <ExternalLink className="w-4 h-4 mr-2" /> Open Link
                        </Button>
                        <Button variant="outline" size="icon" className="shrink-0" onClick={() => copyLink(resource.link)}>
                          <Copy className="w-4 h-4" />
                        </Button>
                      </>
                    ) : (
                      <div className="flex-1 bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium py-1.5 px-3 rounded-md flex items-center justify-center gap-2">
                        <AlertTriangle className="w-4 h-4" /> Missing Link
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <p className="text-xs text-center text-muted-foreground pt-8">
        This prototype uses manually added resource links. Future versions can connect to Google Drive API.
      </p>
    </div>
  );
}
