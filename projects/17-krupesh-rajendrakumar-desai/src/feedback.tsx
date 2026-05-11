import { useState } from "react";
import { useAppState } from "../hooks/use-app-state";
import { usePolishFeedback } from "@workspace/api-client-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Loader2, Copy, Check, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Feedback() {
  const { reviews, saveReviews } = useAppState();
  const polishFeedback = usePolishFeedback();
  const { toast } = useToast();

  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    presenterName: "",
    projectTitle: "",
    bestPart: "",
    improvement: "",
    clarityRating: 5,
    demoQualityRating: 5,
    usefulnessRating: 5,
    notes: ""
  });

  const [currentResult, setCurrentResult] = useState<{bestPart: string, improvement: string, overall: string} | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.presenterName || !formData.projectTitle || !formData.bestPart || !formData.improvement) {
      toast({ title: "Missing fields", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }

    polishFeedback.mutate(
      { data: { ...formData, notes: formData.notes || null } },
      {
        onSuccess: (result) => {
          setCurrentResult({
            bestPart: result.bestPart,
            improvement: result.improvementSuggestion,
            overall: result.overallFeedback
          });

          const newReview = {
            id: Date.now().toString(),
            ...formData,
            polishedBestPart: result.bestPart,
            polishedImprovement: result.improvementSuggestion,
            polishedOverall: result.overallFeedback,
            createdAt: new Date().toISOString()
          };

          saveReviews([newReview, ...reviews]);
          toast({ title: "Feedback polished!", description: "Your feedback has been saved." });
        },
        onError: () => {
          toast({ title: "Error", description: "Could not polish feedback.", variant: "destructive" });
        }
      }
    );
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({ title: "Copied", description: "Feedback copied to clipboard." });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Feedback Helper</h1>
        <p className="text-muted-foreground mt-1">Draft and polish peer reviews for class presentations.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border/50 glow-card h-fit">
          <CardHeader>
            <CardTitle>Draft Feedback</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Presenter Name</Label>
                  <Input 
                    value={formData.presenterName} 
                    onChange={e => setFormData({...formData, presenterName: e.target.value})} 
                    placeholder="e.g. Jane Doe"
                    className="bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Project Title</Label>
                  <Input 
                    value={formData.projectTitle} 
                    onChange={e => setFormData({...formData, projectTitle: e.target.value})} 
                    placeholder="e.g. DataViz Pro"
                    className="bg-background"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>What was best about the project?</Label>
                <Textarea 
                  value={formData.bestPart} 
                  onChange={e => setFormData({...formData, bestPart: e.target.value})} 
                  placeholder="Rough notes are fine..."
                  className="bg-background min-h-[80px]"
                />
              </div>

              <div className="space-y-2">
                <Label>One area for improvement</Label>
                <Textarea 
                  value={formData.improvement} 
                  onChange={e => setFormData({...formData, improvement: e.target.value})} 
                  placeholder="Rough notes are fine..."
                  className="bg-background min-h-[80px]"
                />
              </div>

              <div className="space-y-4 pt-2">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <Label>Clarity ({formData.clarityRating}/5)</Label>
                  </div>
                  <Slider 
                    value={[formData.clarityRating]} 
                    min={1} max={5} step={1} 
                    onValueChange={([val]) => setFormData({...formData, clarityRating: val})} 
                  />
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <Label>Demo Quality ({formData.demoQualityRating}/5)</Label>
                  </div>
                  <Slider 
                    value={[formData.demoQualityRating]} 
                    min={1} max={5} step={1} 
                    onValueChange={([val]) => setFormData({...formData, demoQualityRating: val})} 
                  />
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <Label>Usefulness ({formData.usefulnessRating}/5)</Label>
                  </div>
                  <Slider 
                    value={[formData.usefulnessRating]} 
                    min={1} max={5} step={1} 
                    onValueChange={([val]) => setFormData({...formData, usefulnessRating: val})} 
                  />
                </div>
              </div>

              <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90 glow-card mt-4" disabled={polishFeedback.isPending}>
                {polishFeedback.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                Polish Feedback
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-6">
          {currentResult && (
            <Card className="border-primary/50 bg-primary/5 glow-card">
              <CardHeader className="pb-3 border-b border-primary/20">
                <CardTitle className="text-primary flex items-center justify-between">
                  Polished Result
                  <Button variant="ghost" size="sm" className="h-8 hover:bg-primary/20 hover:text-primary" onClick={() => copyToClipboard(`Best part: ${currentResult.bestPart}\n\nImprovement: ${currentResult.improvement}\n\nOverall: ${currentResult.overall}`, 'current')}>
                    {copiedId === 'current' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div>
                  <h4 className="font-medium text-foreground mb-1 text-sm">Best part:</h4>
                  <p className="text-sm text-muted-foreground bg-background p-3 rounded-md border border-border">{currentResult.bestPart}</p>
                </div>
                <div>
                  <h4 className="font-medium text-foreground mb-1 text-sm">Improvement suggestion:</h4>
                  <p className="text-sm text-muted-foreground bg-background p-3 rounded-md border border-border">{currentResult.improvement}</p>
                </div>
                <div>
                  <h4 className="font-medium text-foreground mb-1 text-sm">Overall feedback:</h4>
                  <p className="text-sm text-muted-foreground bg-background p-3 rounded-md border border-border">{currentResult.overall}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {reviews.length > 0 && (
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle>Previous Reviews</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {reviews.map(review => (
                  <div key={review.id} className="p-4 bg-muted rounded-lg border border-border/50 group">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="font-semibold text-foreground">{review.projectTitle}</div>
                        <div className="text-xs text-muted-foreground">Presenter: {review.presenterName} • {new Date(review.createdAt).toLocaleDateString()}</div>
                      </div>
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => copyToClipboard(`Best part: ${review.polishedBestPart}\n\nImprovement: ${review.polishedImprovement}\n\nOverall: ${review.polishedOverall}`, review.id)}>
                        {copiedId === review.id ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{review.polishedOverall}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
