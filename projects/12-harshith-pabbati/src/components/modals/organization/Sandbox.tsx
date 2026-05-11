'use client';

import { useState } from 'react';
import { useTestSandbox } from '@/states/organization';
import { toast } from 'sonner';

import { useIsMobile } from '@/hooks/useIsMobile';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';

function SandboxContent({ orgId }: { orgId: string }) {
  const [subject, setSubject] = useState('');
  const [question, setQuestion] = useState('');
  const [previewHtml, setPreviewHtml] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!question.trim()) return;
    setLoading(true);
    setPreviewHtml('');
    try {
      const res = await fetch('/api/sandbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, question, subject }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        toast.error('Failed to generate preview', {
          description: data.error ?? 'Unknown error',
        });
      } else {
        setPreviewHtml(data.html);
      }
    } catch {
      toast.error('Failed to generate preview');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 p-4">
      <div className="space-y-2">
        <label className="font-mono text-sm font-semibold text-foreground">
          Subject (optional)
        </label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="e.g. How do I reset my password?"
          className="w-full border border-input bg-background px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#FF4500]"
        />
      </div>
      <div className="space-y-2">
        <label className="font-mono text-sm font-semibold text-foreground">
          Customer question <span className="text-[#FF4500]">*</span>
        </label>
        <textarea
          rows={5}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Paste or type a sample customer email body here…"
          className="w-full border border-input bg-background px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#FF4500] resize-y"
        />
      </div>
      <Button
        onClick={handleGenerate}
        disabled={loading || !question.trim()}
        className="w-full"
      >
        {loading ? 'Generating preview…' : 'Generate Preview Reply'}
      </Button>

      {previewHtml && (
        <div className="space-y-2">
          <p className="font-mono text-xs font-semibold uppercase tracking-widest text-[#FF4500]">
            {`// Preview`}
          </p>
          <div
            className="prose prose-sm max-w-none border border-[#FF4500]/20 bg-muted p-4 text-sm font-mono text-foreground"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        </div>
      )}
    </div>
  );
}

export function TestSandbox() {
  const isMobile = useIsMobile();
  const [open, setOpen] = useTestSandbox();
  const orgId = typeof open === 'string' ? open : '';

  if (isMobile) {
    return (
      <Drawer open={Boolean(open)} onOpenChange={setOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>🧪 Test Sandbox</DrawerTitle>
            <DrawerDescription>
              Preview how the AI would reply to a sample customer question.
            </DrawerDescription>
          </DrawerHeader>
          <SandboxContent orgId={orgId} />
          <DrawerFooter>
            <DrawerClose />
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={Boolean(open)} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>🧪 Test Sandbox</DialogTitle>
          <DialogDescription>
            Preview how the AI would reply to a sample customer question using
            your knowledge base and tone settings.
          </DialogDescription>
        </DialogHeader>
        <SandboxContent orgId={orgId} />
      </DialogContent>
    </Dialog>
  );
}
