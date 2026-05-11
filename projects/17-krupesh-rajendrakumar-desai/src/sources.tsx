import { useState } from "react";
import { useAppState } from "../hooks/use-app-state";
import { useAnalyzeCourse } from "@workspace/api-client-react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Database, AlertCircle, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Sources() {
  const { sources, saveSources, saveTasks, saveWeeklyPlan, tasks } = useAppState();
  const analyzeCourse = useAnalyzeCourse();
  const { toast } = useToast();

  const handleTextChange = (id: string, text: string) => {
    saveSources(sources.map(s => s.id === id ? { ...s, pastedText: text } : s));
  };

  const handleAnalyze = (id: string) => {
    const source = sources.find(s => s.id === id);
    if (!source || !source.pastedText) return;

    analyzeCourse.mutate(
      { data: { text: source.pastedText, source: source.platform } },
      {
        onSuccess: (result) => {
          saveSources(sources.map(s => 
            s.id === id 
              ? { ...s, status: 'active', lastAnalyzed: new Date().toISOString(), analyzedSummary: result.summary } 
              : s
          ));
          
          // Merge tasks
          const existingOtherTasks = tasks.filter(t => t.source !== source.platform);
          // Assuming result.tasks maps directly
          const newTasks = [...existingOtherTasks, ...(result.tasks as any)];
          saveTasks(newTasks);
          if (result.weeklyPlan) saveWeeklyPlan(result.weeklyPlan);

          toast({ title: "Analysis complete", description: `Extracted ${result.tasks.length} tasks.` });
        },
        onError: () => {
          toast({ title: "Analysis failed", description: "Could not analyze the source.", variant: "destructive" });
        }
      }
    );
  };

  const loadSampleDataForSource = (id: string) => {
    const sampleTexts: Record<string, string> = {
      'brightspace': "Final submission for AMS 691 App Demo is due May 10, 2026 at 11:59 PM. You must submit: (1) a 3-5 minute demo video, (2) a thumbnail image uploaded to Google Drive, (3) a project.md file in your repository, (4) all source code in a src/ folder, (5) a GitHub pull request.",
      'discord': "Hey everyone, don't forget to review your classmates' app demos in the #demo-reviews channel by end of week.",
      'googledrive': "New folder created: App Demo Thumbnails. Please upload your 1920x1080 thumbnail here before the deadline.",
      'quiz': "The final GitHub PR must be linked in Assignment 4. No late submissions accepted.",
      'feedback': "Peer feedback forms must be completed for every classmate's presentation. You will be graded on the quality of your feedback."
    };

    saveSources(sources.map(s => 
      s.id === id 
        ? { ...s, pastedText: sampleTexts[s.platform] || "Sample data...", status: 'demo' } 
        : s
    ));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Data Sources</h1>
        <p className="text-muted-foreground mt-1">Connect your platforms to extract tasks and deadlines.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {sources.map(source => {
          const isAnalyzing = analyzeCourse.isPending && analyzeCourse.variables?.data.source === source.platform;
          return (
            <Card key={source.id} className={`border-border/50 glow-card transition-all ${source.status === 'active' ? 'border-primary/50 bg-primary/5' : ''}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Database className="w-5 h-5 text-primary" />
                    {source.name}
                  </CardTitle>
                  <Badge variant={source.status === 'active' ? 'default' : source.status === 'demo' ? 'secondary' : 'outline'}>
                    {source.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea 
                  placeholder={`Paste ${source.name} announcements or updates here...`}
                  value={source.pastedText}
                  onChange={(e) => handleTextChange(source.id, e.target.value)}
                  className="min-h-[120px] bg-background/50 focus-visible:ring-primary"
                />
                
                {source.analyzedSummary && (
                  <div className="p-3 bg-muted rounded-md text-sm border border-border">
                    <div className="font-semibold text-primary mb-1">Latest Summary:</div>
                    <div className="text-muted-foreground">{source.analyzedSummary}</div>
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex justify-between border-t border-border/50 pt-4">
                <Button variant="ghost" size="sm" onClick={() => loadSampleDataForSource(source.id)}>
                  Load Sample
                </Button>
                <Button 
                  onClick={() => handleAnalyze(source.id)} 
                  disabled={!source.pastedText || isAnalyzing}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {isAnalyzing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Analyze
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
