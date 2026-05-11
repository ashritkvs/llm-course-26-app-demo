"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles } from "lucide-react";

import {
  apiClient,
  type GenerationRequestType,
  type GenerationFormatType,
  type GenerationDifficulty,
  type GenerationQuestionType,
} from "@/lib/apiClient";
import { toast } from "@/hooks/use-toast";
import {
  getErrorMessage,
  getValidationErrors,
  isUnauthorizedError,
} from "@/lib/errorMessages";

type GenerationFormProps = {
  workspaceId: string;
  onCreated: (requestId: string) => void;
};

const QUESTION_TYPE_OPTIONS: { value: GenerationQuestionType; label: string }[] = [
  { value: "mcq", label: "Multiple Choice" },
  { value: "frq", label: "Free Response" },
  { value: "calculation", label: "Calculation" },
  { value: "proof", label: "Proof" },
];

const MIN_QUESTIONS = 3;
const MAX_QUESTIONS = 30;
const DEFAULT_QUESTIONS = 10;

export function GenerationForm({ workspaceId, onCreated }: GenerationFormProps) {
  const [requestType, setRequestType] = useState<GenerationRequestType>("practice_set");
  const [formatType, setFormatType] = useState<GenerationFormatType>("mixed");
  const [questionCount, setQuestionCount] = useState<number>(DEFAULT_QUESTIONS);
  const [difficulty, setDifficulty] = useState<GenerationDifficulty>("moderate");
  const [questionTypes, setQuestionTypes] = useState<GenerationQuestionType[]>(["mcq", "frq"]);
  const [topics, setTopics] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countError, setCountError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function handleQuestionTypeToggle(qt: GenerationQuestionType, checked: boolean) {
    setQuestionTypes((prev) =>
      checked ? [...prev, qt] : prev.filter((t) => t !== qt),
    );
  }

  function handleCountChange(value: string) {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      setQuestionCount(0);
      setCountError("Please enter a valid number.");
      return;
    }
    setQuestionCount(num);
    if (num < MIN_QUESTIONS || num > MAX_QUESTIONS) {
      setCountError(`Must be between ${MIN_QUESTIONS} and ${MAX_QUESTIONS}.`);
    } else {
      setCountError(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (questionCount < MIN_QUESTIONS || questionCount > MAX_QUESTIONS) {
      setCountError(`Must be between ${MIN_QUESTIONS} and ${MAX_QUESTIONS}.`);
      return;
    }
    if (questionTypes.length === 0) {
      setError("Select at least one question type.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setFieldErrors({});

    try {
      const topicList = topics
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      const result = await apiClient.postGenerationRequest(workspaceId, {
        request_type: requestType,
        generation_config: {
          question_count: questionCount,
          format_type: formatType,
          difficulty,
          question_types: questionTypes,
        },
        scope_constraints:
          topicList.length > 0 || customPrompt.trim().length > 0
            ? {
                topics: topicList.length > 0 ? topicList : undefined,
                custom_prompt: customPrompt.trim() || undefined,
              }
            : undefined,
      });
      onCreated(result.id);
    } catch (err) {
      const validationErrors = getValidationErrors(err);
      if (Object.keys(validationErrors).length > 0) {
        setFieldErrors(validationErrors);
      }

      const message = getErrorMessage(err);
      setError(message);
      toast({
        variant: "destructive",
        title: "Unable to start generation",
        description: message,
      });
      if (isUnauthorizedError(err)) {
        window.setTimeout(() => window.location.assign("/login"), 800);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="border-border/70">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-primary" />
          Generate Practice or Exam
        </CardTitle>
        <CardDescription>
          Configure your generation parameters. The backend will use your professor profile
          and indexed materials to create questions.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Request Type */}
          <div className="space-y-2">
            <Label htmlFor="generation-request-type">Request Type</Label>
            <Select
              value={requestType}
              onValueChange={(v) => setRequestType(v as GenerationRequestType)}
            >
              <SelectTrigger id="generation-request-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="practice_set">Practice Set</SelectItem>
                <SelectItem value="simulated_exam">Simulated Exam</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Format Type */}
          <div className="space-y-3">
            <Label>Format Type</Label>
            <RadioGroup
              id="generation-format-type"
              value={formatType}
              onValueChange={(v) => setFormatType(v as GenerationFormatType)}
              className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-6"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="mcq" id="format-mcq" />
                <Label htmlFor="format-mcq" className="font-normal">MCQ</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="frq" id="format-frq" />
                <Label htmlFor="format-frq" className="font-normal">FRQ</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="mixed" id="format-mixed" />
                <Label htmlFor="format-mixed" className="font-normal">Mixed</Label>
              </div>
            </RadioGroup>
            {fieldErrors["generation_config.format_type"] ? (
              <p className="text-sm text-destructive">
                {fieldErrors["generation_config.format_type"]}
              </p>
            ) : null}
          </div>

          {/* Question Count + Difficulty (side by side) */}
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="generation-question-count">Question Count</Label>
              <Input
                id="generation-question-count"
                type="number"
                min={MIN_QUESTIONS}
                max={MAX_QUESTIONS}
                value={questionCount}
                onChange={(e) => handleCountChange(e.target.value)}
              />
              {countError && (
                <p id="generation-question-count-error" className="text-sm text-destructive">
                  {countError}
                </p>
              )}
              {fieldErrors["generation_config.question_count"] ? (
                <p className="text-sm text-destructive">
                  {fieldErrors["generation_config.question_count"]}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="generation-difficulty">Difficulty</Label>
              <Select
                value={difficulty}
                onValueChange={(v) => setDifficulty(v as GenerationDifficulty)}
              >
                <SelectTrigger id="generation-difficulty" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="moderate">Moderate</SelectItem>
                  <SelectItem value="moderate-hard">Moderate-Hard</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
              {fieldErrors["generation_config.difficulty"] ? (
                <p className="text-sm text-destructive">
                  {fieldErrors["generation_config.difficulty"]}
                </p>
              ) : null}
            </div>
          </div>

          {/* Question Types */}
          <div className="space-y-3">
            <Label>Question Types</Label>
            <div className="flex flex-wrap gap-4">
              {QUESTION_TYPE_OPTIONS.map((qt) => (
                <div key={qt.value} className="flex items-center gap-2">
                  <Checkbox
                    id={`generation-qt-${qt.value}`}
                    checked={questionTypes.includes(qt.value)}
                    onCheckedChange={(checked) =>
                      handleQuestionTypeToggle(qt.value, checked === true)
                    }
                  />
                  <Label htmlFor={`generation-qt-${qt.value}`} className="font-normal">
                    {qt.label}
                  </Label>
                </div>
              ))}
            </div>
            {fieldErrors["generation_config.question_types"] ? (
              <p className="text-sm text-destructive">
                {fieldErrors["generation_config.question_types"]}
              </p>
            ) : null}
          </div>

          {/* Topics (optional) */}
          <div className="space-y-2">
            <Label htmlFor="generation-topics">Topics (optional, comma-separated)</Label>
            <Input
              id="generation-topics"
              value={topics}
              onChange={(e) => setTopics(e.target.value)}
              placeholder="e.g. hypothesis_testing, confidence_intervals"
            />
            {fieldErrors["scope_constraints.topics"] ? (
              <p className="text-sm text-destructive">
                {fieldErrors["scope_constraints.topics"]}
              </p>
            ) : null}
          </div>

          {/* Custom Prompt (optional) */}
          <div className="space-y-2">
            <Label htmlFor="generation-custom-prompt">Custom Prompt (optional)</Label>
            <Textarea
              id="generation-custom-prompt"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="e.g. Focus on two-sample tests"
              rows={3}
            />
            {fieldErrors["scope_constraints.custom_prompt"] ? (
              <p className="text-sm text-destructive">
                {fieldErrors["scope_constraints.custom_prompt"]}
              </p>
            ) : null}
          </div>

          {/* Submit */}
          {error && <p id="generation-form-error" className="text-sm text-destructive">{error}</p>}

          <Button
            id="generation-submit-button"
            type="submit"
            disabled={submitting || !!countError}
            className="w-full sm:min-w-[200px] sm:w-auto"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
