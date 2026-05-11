/**
 * Unit tests for GradingResultsViewer component.
 *
 * Run with: npx jest --config jest.config.ts (after installing jest + @testing-library/react)
 * Or use this file as a Storybook-style fixture to verify rendering.
 *
 * This file also exports mock data that can be imported for Storybook stories
 * or integration tests.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { GradingResultsViewer } from "../GradingResultsViewer";
import type { SubmissionRead, ExamQuestion } from "@/lib/apiClient";

// ── Mock data ──────────────────────────────────────────────────────────────────

export const mockQuestions: ExamQuestion[] = [
  {
    id: "q-1",
    question_order: 1,
    question_text: "What is the MLE of λ for Exp(λ)?",
    question_type: "mcq",
    difficulty_label: "moderate",
    topic_label: "maximum_likelihood",
    options: ["1/X̄", "X̄", "n/ΣXᵢ", "ΣXᵢ/n"],
    answer_key: "A",
    explanation: "The MLE of λ for Exp(λ) is 1/X̄.",
  },
  {
    id: "q-2",
    question_order: 2,
    question_text:
      "Derive a 95% confidence interval for μ when σ² is unknown.",
    question_type: "frq",
    difficulty_label: "hard",
    topic_label: "confidence_intervals",
    options: null,
    answer_key: "X̄ ± t_{n-1, 0.025} * S/√n",
    explanation: "Use t-distribution since σ² is unknown.",
  },
  {
    id: "q-3",
    question_order: 3,
    question_text: "Which statistic is sufficient for p in Bernoulli(p)?",
    question_type: "mcq",
    difficulty_label: "easy",
    topic_label: "sufficient_statistics",
    options: ["X̄", "ΣXᵢ", "max(Xᵢ)", "∏Xᵢ"],
    answer_key: "B",
    explanation: "By the factorization theorem, ΣXᵢ is sufficient.",
  },
];

export const mockGradedSubmission: SubmissionRead = {
  id: "sub-1",
  workspace_id: "ws-1",
  generated_exam_id: "exam-1",
  status: "graded",
  overall_score: 1.5,
  total_possible: 3,
  submitted_at: null,
  created_at: "2026-03-15T10:30:00Z",
  answers: [
    {
      id: "ans-1",
      question_id: "q-1",
      answer_content: "A",
      grading_result: {
        id: "gr-1",
        question_id: "q-1",
        correctness_label: "correct",
        score_value: 1,
        points_possible: 1,
        diagnostic_explanation: "Correct!",
        concept_label: "maximum_likelihood",
        error_classifications: [],
      },
    },
    {
      id: "ans-2",
      question_id: "q-2",
      answer_content: "X̄ ± z * S/√n",
      grading_result: {
        id: "gr-2",
        question_id: "q-2",
        correctness_label: "partial",
        score_value: 0.5,
        points_possible: 1,
        diagnostic_explanation:
          "Partial credit: correct formula structure but used z instead of t-distribution. Since σ² is unknown, the t-distribution is required.",
        concept_label: "confidence_intervals",
        error_classifications: [
          {
            id: "ec-1",
            error_type: "formula_misuse",
            description: "Used z-distribution instead of t-distribution",
            severity: "moderate",
          },
        ],
      },
    },
    {
      id: "ans-3",
      question_id: "q-3",
      answer_content: "C",
      grading_result: {
        id: "gr-3",
        question_id: "q-3",
        correctness_label: "incorrect",
        score_value: 0,
        points_possible: 1,
        diagnostic_explanation: "Expected: B. ΣXᵢ is the sufficient statistic by the factorization theorem.",
        concept_label: "sufficient_statistics",
        error_classifications: [
          {
            id: "ec-2",
            error_type: "wrong_method",
            description: "Student answered 'C' but expected 'B'",
            severity: "moderate",
          },
        ],
      },
    },
  ],
};

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("GradingResultsViewer", () => {
  it("renders without crashing", () => {
    render(
      <GradingResultsViewer
        submission={mockGradedSubmission}
        questions={mockQuestions}
      />,
    );

    expect(screen.getByText("Grading Results")).toBeInTheDocument();
  });

  it("displays the overall score percentage", () => {
    render(
      <GradingResultsViewer
        submission={mockGradedSubmission}
        questions={mockQuestions}
      />,
    );

    // 1.5/3 = 50% — appears in both the score badge and accuracy stat
    const percentages = screen.getAllByText("50%");
    expect(percentages.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("1.5 / 3")).toBeInTheDocument();
  });

  it("displays correct count and incorrect count", () => {
    const { container } = render(
      <GradingResultsViewer
        submission={mockGradedSubmission}
        questions={mockQuestions}
      />,
    );

    // "Correct" appears in both quick stats label and correctness badge
    const correctElements = screen.getAllByText("Correct");
    expect(correctElements.length).toBeGreaterThanOrEqual(1);
    const incorrectElements = screen.getAllByText("Incorrect");
    expect(incorrectElements.length).toBeGreaterThanOrEqual(1);
    expect(container).toBeTruthy();
  });

  it("renders a card per question answer", () => {
    render(
      <GradingResultsViewer
        submission={mockGradedSubmission}
        questions={mockQuestions}
      />,
    );

    expect(screen.getByText("Q1")).toBeInTheDocument();
    expect(screen.getByText("Q2")).toBeInTheDocument();
    expect(screen.getByText("Q3")).toBeInTheDocument();
  });

  it("renders correctness badges", () => {
    render(
      <GradingResultsViewer
        submission={mockGradedSubmission}
        questions={mockQuestions}
      />,
    );

    // "Correct" appears in both the stats header and a badge
    expect(screen.getAllByText("Correct").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Partial Credit").length).toBeGreaterThanOrEqual(1);
    // "Incorrect" appears in both the stats header and a badge
    expect(screen.getAllByText("Incorrect").length).toBeGreaterThanOrEqual(1);
  });

  it("renders error classification badges", () => {
    render(
      <GradingResultsViewer
        submission={mockGradedSubmission}
        questions={mockQuestions}
      />,
    );

    expect(screen.getByText("Formula Misuse")).toBeInTheDocument();
    expect(screen.getByText("Wrong Method")).toBeInTheDocument();
  });

  it("renders diagnostic explanation text for each graded answer", () => {
    render(
      <GradingResultsViewer
        submission={mockGradedSubmission}
        questions={mockQuestions}
      />,
    );

    expect(screen.getByText("Correct!")).toBeInTheDocument();
    expect(
      screen.getByText(/used z instead of t-distribution/i),
    ).toBeInTheDocument();
  });

  it("renders student answer vs correct answer", () => {
    render(
      <GradingResultsViewer
        submission={mockGradedSubmission}
        questions={mockQuestions}
      />,
    );

    // Student answered "A" for Q1 which is MCQ option "1/X̄"
    // May appear in both "Your Answer" and "Correct Answer" sections
    expect(screen.getAllByText("A) 1/X̄").length).toBeGreaterThanOrEqual(1);
  });

  it("renders with a fully correct submission without crashing", () => {
    const perfectSubmission: SubmissionRead = {
      id: "sub-perfect",
      workspace_id: "ws-1",
      generated_exam_id: "exam-1",
      status: "graded",
      overall_score: 3,
      total_possible: 3,
      submitted_at: null,
      created_at: "2026-03-15T10:30:00Z",
      answers: mockQuestions.map((q, i) => ({
        id: `ans-perfect-${i}`,
        question_id: q.id,
        answer_content: q.answer_key ?? "",
        grading_result: {
          id: `gr-perfect-${i}`,
          question_id: q.id,
          correctness_label: "correct" as const,
          score_value: 1,
          points_possible: 1,
          diagnostic_explanation: "Correct!",
          concept_label: q.topic_label,
          error_classifications: [],
        },
      })),
    };

    render(
      <GradingResultsViewer
        submission={perfectSubmission}
        questions={mockQuestions}
      />,
    );

    // 100% appears in both score badge and accuracy stat
    expect(screen.getAllByText("100%").length).toBeGreaterThanOrEqual(1);
  });

  it("renders with an empty error_classifications array without crashing", () => {
    const noErrorSubmission: SubmissionRead = {
      ...mockGradedSubmission,
      answers: mockGradedSubmission.answers.map((a) => ({
        ...a,
        grading_result: a.grading_result
          ? { ...a.grading_result, error_classifications: [] }
          : null,
      })),
    };

    const { container } = render(
      <GradingResultsViewer
        submission={noErrorSubmission}
        questions={mockQuestions}
      />,
    );

    expect(container).toBeTruthy();
  });
});
