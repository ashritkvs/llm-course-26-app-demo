import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Info, Layers, Workflow, CheckCircle2, AlertCircle } from "lucide-react";

export default function About() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold text-foreground mb-4 glow-text">About UniFlow</h1>
        <p className="text-xl text-muted-foreground">AI-Powered Unified Course Assistant</p>
      </div>

      <Card className="border-primary/20 bg-primary/5 glow-card">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <Info className="w-6 h-6 text-primary shrink-0 mt-1" />
            <div>
              <h3 className="font-semibold text-lg text-foreground mb-2">Prototype Notice</h3>
              <p className="text-muted-foreground">
                This is a working prototype with localStorage and manually-added workspace data. Future versions could connect to Brightspace, Discord, Google Drive, and Google Forms APIs directly to create a truly seamless experience.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-destructive" />
              The Problem
            </CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground space-y-2">
            <p>Graduate students, especially in project-heavy courses like AMS 691, juggle information across multiple platforms:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Brightspace for official announcements</li>
              <li>Discord for real-time updates and peer requests</li>
              <li>Google Drive for asset management</li>
              <li>Google Forms for peer feedback</li>
            </ul>
            <p className="mt-2">This fragmentation leads to missed deadlines, cognitive overload, and anxiety.</p>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              The Solution
            </CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground space-y-2">
            <p>UniFlow acts as a centralized mission control. It ingests unstructured text from any source, structures it, and provides actionable insights.</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Extracts tasks and deadlines automatically</li>
              <li>Generates prioritized weekly action plans</li>
              <li>Provides a conversational interface to query course state</li>
              <li>Assists in drafting professional peer feedback</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            Key Features
          </CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-4">
          <div>
            <h4 className="font-semibold text-foreground">Announcement Center</h4>
            <p>Centralize announcements from instructors and TAs. Extract actionable tasks automatically.</p>
          </div>
          <div>
            <h4 className="font-semibold text-foreground">Collaboration Hub</h4>
            <p>A Discord-style interface for organizing class discussions, finding resources, and answering questions.</p>
          </div>
          <div>
            <h4 className="font-semibold text-foreground">Resource Manager</h4>
            <p>Keep track of important course links, slides, and documents in one place.</p>
          </div>
          <div>
            <h4 className="font-semibold text-foreground">Assignment Tracker</h4>
            <p>Track statuses across multiple platforms.</p>
          </div>
          <div>
            <h4 className="font-semibold text-foreground">AI Assistant & Feedback Helper</h4>
            <p>Chat directly with your course data and write professional peer feedback.</p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Workflow className="w-5 h-5 text-secondary" />
            Under the Hood
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 text-muted-foreground">
          <div>
            <h4 className="font-semibold text-foreground mb-2">LLM Components</h4>
            <p>We use advanced language models to perform several distinct tasks:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>Information Extraction:</strong> Parsing announcements to find implicit and explicit tasks, due dates, and priorities.</li>
              <li><strong>Contextual Chat:</strong> RAG (Retrieval-Augmented Generation) using the extracted tasks and source summaries to answer user questions.</li>
              <li><strong>Text Polishing:</strong> Transforming rough notes into constructive, professional peer reviews.</li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold text-foreground mb-2">Tech Stack</h4>
            <div className="flex flex-wrap gap-2">
              {['React', 'TypeScript', 'Tailwind CSS', 'shadcn/ui', 'Vite', 'React Query', 'Wouter'].map(tech => (
                <div key={tech} className="px-3 py-1 bg-muted rounded-full text-xs font-mono border border-border/50">
                  {tech}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
