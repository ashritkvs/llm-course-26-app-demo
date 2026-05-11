// Mock data for ExamProfile AI

export const courses = [
  {
    id: "ams-570",
    name: "AMS 570",
    title: "Statistical Inference",
    professor: "Dr. Sarah Chen",
    semester: "Spring 2026",
    materialsCount: 24,
    profileConfidence: 87,
    topicsExtracted: 18,
    practiceSetsGenerated: 12,
    lastExamScore: 82,
    color: "primary"
  },
  {
    id: "bio-365",
    name: "BIO 365",
    title: "Molecular Biology",
    professor: "Dr. James Wilson",
    semester: "Spring 2026",
    materialsCount: 18,
    profileConfidence: 72,
    topicsExtracted: 22,
    practiceSetsGenerated: 8,
    lastExamScore: 78,
    color: "accent"
  },
  {
    id: "phy-201",
    name: "PHY 201",
    title: "Intro to Physics",
    professor: "Dr. Michael Roberts",
    semester: "Spring 2026",
    materialsCount: 31,
    profileConfidence: 91,
    topicsExtracted: 15,
    practiceSetsGenerated: 15,
    lastExamScore: 88,
    color: "chart-3"
  },
  {
    id: "cse-214",
    name: "CSE 214",
    title: "Data Structures",
    professor: "Dr. Emily Zhang",
    semester: "Spring 2026",
    materialsCount: 28,
    profileConfidence: 85,
    topicsExtracted: 20,
    practiceSetsGenerated: 10,
    lastExamScore: 91,
    color: "chart-4"
  }
];

export const uploadedFiles = [
  { id: 1, name: "Lecture_01_Introduction.pdf", type: "slides", status: "indexed", size: "2.4 MB", uploadedAt: "2026-02-15" },
  { id: 2, name: "Lecture_02_Probability.pdf", type: "slides", status: "indexed", size: "3.1 MB", uploadedAt: "2026-02-16" },
  { id: 3, name: "Lecture_03_Distributions.pdf", type: "slides", status: "indexed", size: "4.2 MB", uploadedAt: "2026-02-18" },
  { id: 4, name: "Homework_01_Solutions.pdf", type: "homework", status: "indexed", size: "1.8 MB", uploadedAt: "2026-02-20" },
  { id: 5, name: "Homework_02_Solutions.pdf", type: "homework", status: "indexed", size: "2.1 MB", uploadedAt: "2026-02-25" },
  { id: 6, name: "Midterm_2025_Exam.pdf", type: "exam", status: "indexed", size: "980 KB", uploadedAt: "2026-02-28" },
  { id: 7, name: "Midterm_2024_Exam.pdf", type: "exam", status: "indexed", size: "1.1 MB", uploadedAt: "2026-02-28" },
  { id: 8, name: "Lecture_04_Estimation.pdf", type: "slides", status: "parsing", size: "3.5 MB", uploadedAt: "2026-03-01" },
  { id: 9, name: "Practice_Problems_Ch3.pdf", type: "practice", status: "uploaded", size: "1.2 MB", uploadedAt: "2026-03-02" },
];

export const professorProfile = {
  name: "Dr. Sarah Chen",
  course: "AMS 570 - Statistical Inference",
  confidence: 87,
  summary: "Strong emphasis on derivations and proofs. Favors multi-step problems requiring integration of concepts. High frequency of hypothesis testing questions.",
  topicWeights: [
    { topic: "Hypothesis Testing", weight: 28, trend: "up" },
    { topic: "Point Estimation", weight: 22, trend: "stable" },
    { topic: "Confidence Intervals", weight: 18, trend: "up" },
    { topic: "Maximum Likelihood", weight: 15, trend: "stable" },
    { topic: "Bayesian Methods", weight: 10, trend: "down" },
    { topic: "Sufficient Statistics", weight: 7, trend: "stable" },
  ],
  questionFormats: {
    mcq: 25,
    shortAnswer: 35,
    longForm: 40
  },
  examStructure: {
    totalQuestions: "8-10",
    mcqCount: "2-3",
    frqCount: "5-7",
    difficultyRamp: "Moderate to Hard",
    timeAllocation: "90 minutes"
  },
  commonPatterns: [
    "Prove that the estimator is unbiased",
    "Derive the MLE for the given distribution",
    "Construct a 95% confidence interval",
    "Perform a hypothesis test at α = 0.05",
    "Show that the statistic is sufficient"
  ],
  evidenceSources: {
    priorExams: 4,
    lectureSlides: 12,
    homework: 6,
    practiceTests: 2
  }
};

export const conceptMastery = [
  { concept: "Hypothesis Testing", mastery: 72, attempts: 45, trend: "up" },
  { concept: "Confidence Intervals", mastery: 85, attempts: 38, trend: "stable" },
  { concept: "MLE Derivation", mastery: 58, attempts: 28, trend: "up" },
  { concept: "Bayesian Estimation", mastery: 45, attempts: 15, trend: "down" },
  { concept: "Sufficient Statistics", mastery: 62, attempts: 22, trend: "up" },
  { concept: "Method of Moments", mastery: 78, attempts: 30, trend: "stable" },
  { concept: "Likelihood Ratio Tests", mastery: 51, attempts: 18, trend: "stable" },
  { concept: "Fisher Information", mastery: 68, attempts: 25, trend: "up" },
];

export const performanceHistory = [
  { date: "Week 1", score: 65, average: 70 },
  { date: "Week 2", score: 68, average: 71 },
  { date: "Week 3", score: 72, average: 72 },
  { date: "Week 4", score: 70, average: 73 },
  { date: "Week 5", score: 78, average: 74 },
  { date: "Week 6", score: 82, average: 75 },
  { date: "Week 7", score: 79, average: 76 },
  { date: "Week 8", score: 85, average: 77 },
];

export const errorBreakdown = [
  { type: "Computational Errors", count: 28, percentage: 35 },
  { type: "Formula Misuse", count: 20, percentage: 25 },
  { type: "Concept Misunderstanding", count: 16, percentage: 20 },
  { type: "Interpretation Errors", count: 12, percentage: 15 },
  { type: "Time Management", count: 4, percentage: 5 },
];

export const recentActivity = [
  { action: "Completed practice set", subject: "Hypothesis Testing #3", time: "2 hours ago", score: 85 },
  { action: "Uploaded material", subject: "Lecture_04_Estimation.pdf", time: "5 hours ago" },
  { action: "Generated exam", subject: "Midterm Simulation #2", time: "1 day ago" },
  { action: "Reviewed results", subject: "Practice Set #12", time: "1 day ago", score: 78 },
  { action: "Updated scope", subject: "Focus on Ch. 5-7", time: "2 days ago" },
];

export const practiceSets = [
  {
    id: 1,
    title: "Hypothesis Testing Fundamentals",
    course: "AMS 570",
    questions: 12,
    difficulty: "Medium",
    topics: ["Type I/II Errors", "P-values", "Power Analysis"],
    completed: true,
    score: 85,
    generatedAt: "2026-02-28"
  },
  {
    id: 2,
    title: "MLE and Point Estimation",
    course: "AMS 570",
    questions: 10,
    difficulty: "Hard",
    topics: ["MLE Derivation", "CRLB", "Efficiency"],
    completed: true,
    score: 72,
    generatedAt: "2026-03-01"
  },
  {
    id: 3,
    title: "Confidence Interval Construction",
    course: "AMS 570",
    questions: 8,
    difficulty: "Medium",
    topics: ["Normal CI", "t-intervals", "Bootstrap"],
    completed: false,
    generatedAt: "2026-03-02"
  },
];

export const simulatedExams = [
  {
    id: 1,
    title: "Midterm Simulation #1",
    course: "AMS 570",
    type: "Midterm",
    questions: 8,
    duration: 90,
    completed: true,
    score: 82,
    takenAt: "2026-02-25"
  },
  {
    id: 2,
    title: "Midterm Simulation #2",
    course: "AMS 570",
    type: "Midterm",
    questions: 10,
    duration: 90,
    completed: true,
    score: 78,
    takenAt: "2026-03-01"
  },
  {
    id: 3,
    title: "Final Prep #1",
    course: "AMS 570",
    type: "Final",
    questions: 15,
    duration: 150,
    completed: false,
    takenAt: null
  },
];

export const examQuestions = [
  {
    id: 1,
    type: "mcq",
    topic: "Hypothesis Testing",
    difficulty: "Medium",
    question: "A researcher wants to test H₀: μ = 50 against H₁: μ ≠ 50. With a sample of n = 25 and σ = 10, the sample mean is 54. What is the p-value?",
    options: ["0.0228", "0.0456", "0.0114", "0.0912"],
    correctAnswer: 1,
    explanation: "Using z = (54-50)/(10/√25) = 2, p-value = 2P(Z > 2) = 2(0.0228) = 0.0456"
  },
  {
    id: 2,
    type: "mcq",
    topic: "Point Estimation",
    difficulty: "Medium",
    question: "Which of the following is NOT a property of the Maximum Likelihood Estimator?",
    options: ["Consistency", "Asymptotic Efficiency", "Always Unbiased", "Invariance"],
    correctAnswer: 2,
    explanation: "MLE is not always unbiased. For example, the MLE of σ² is biased in the normal distribution case."
  },
  {
    id: 3,
    type: "frq",
    topic: "Confidence Intervals",
    difficulty: "Hard",
    question: "Let X₁, X₂, ..., Xₙ be a random sample from N(μ, σ²) where both μ and σ² are unknown. Derive a 95% confidence interval for μ and explain why the t-distribution is used instead of the standard normal.",
    rubric: [
      "Correctly identifies sample mean and sample variance (2 pts)",
      "Shows t-statistic derivation (3 pts)",
      "Constructs proper CI formula (3 pts)",
      "Explains degrees of freedom concept (2 pts)"
    ]
  },
  {
    id: 4,
    type: "frq",
    topic: "Maximum Likelihood",
    difficulty: "Hard",
    question: "Let X₁, X₂, ..., Xₙ be iid from Exp(λ). (a) Derive the MLE of λ. (b) Show whether the MLE is unbiased. (c) Find the Fisher Information for λ.",
    rubric: [
      "Writes correct likelihood function (2 pts)",
      "Takes log and differentiates correctly (3 pts)",
      "Solves for λ̂ = 1/X̄ (2 pts)",
      "Shows bias calculation (2 pts)",
      "Derives Fisher Information (3 pts)"
    ]
  },
  {
    id: 5,
    type: "mcq",
    topic: "Sufficient Statistics",
    difficulty: "Easy",
    question: "For a sample from Bernoulli(p), which statistic is sufficient for p?",
    options: ["X̄", "∑Xᵢ", "max(Xᵢ)", "∏Xᵢ"],
    correctAnswer: 1,
    explanation: "By the factorization theorem, ∑Xᵢ is sufficient for p in Bernoulli distribution."
  }
];

export const submissionResults = {
  examId: 1,
  title: "Midterm Simulation #1",
  totalScore: 82,
  maxScore: 100,
  questionsCorrect: 7,
  totalQuestions: 10,
  timeTaken: 78,
  timeAllowed: 90,
  topicBreakdown: [
    { topic: "Hypothesis Testing", correct: 2, total: 3, percentage: 67 },
    { topic: "Point Estimation", correct: 2, total: 2, percentage: 100 },
    { topic: "Confidence Intervals", correct: 2, total: 3, percentage: 67 },
    { topic: "Sufficient Statistics", correct: 1, total: 2, percentage: 50 },
  ],
  errorAnalysis: [
    { type: "Computational", count: 2 },
    { type: "Conceptual", count: 1 },
    { type: "Formula Application", count: 0 },
  ],
  questionResults: [
    { id: 1, correct: true, yourAnswer: 1, points: 10, maxPoints: 10 },
    { id: 2, correct: true, yourAnswer: 2, points: 10, maxPoints: 10 },
    { id: 3, correct: false, yourAnswer: null, points: 7, maxPoints: 12, feedback: "Partial credit: Correct setup but computational error in final step." },
    { id: 4, correct: true, yourAnswer: null, points: 12, maxPoints: 12 },
    { id: 5, correct: true, yourAnswer: 1, points: 10, maxPoints: 10 },
  ],
  recommendations: [
    "Review sufficient statistics and factorization theorem",
    "Practice more hypothesis testing computational problems",
    "Focus on confidence interval construction for unknown variance cases"
  ]
};

export const weaknessAnalytics = {
  overallMastery: 72,
  totalAttempts: 245,
  studyStreak: 12,
  weakestConcepts: [
    { concept: "Bayesian Estimation", mastery: 45, risk: "high" },
    { concept: "Likelihood Ratio Tests", mastery: 51, risk: "high" },
    { concept: "MLE Derivation", mastery: 58, risk: "medium" },
  ],
  strongestConcepts: [
    { concept: "Confidence Intervals", mastery: 85, risk: "low" },
    { concept: "Method of Moments", mastery: 78, risk: "low" },
    { concept: "Hypothesis Testing", mastery: 72, risk: "low" },
  ],
  riskAreas: [
    { topic: "Bayesian Methods", probability: 78, impact: "High exam weight historically" },
    { topic: "LRT Construction", probability: 65, impact: "Appears in most finals" },
    { topic: "Fisher Information", probability: 55, impact: "Required for CRLB problems" },
  ],
  recommendedPractice: [
    { topic: "Bayesian Estimation", priority: 1, estimatedTime: "2 hours" },
    { topic: "Likelihood Ratio Tests", priority: 2, estimatedTime: "1.5 hours" },
    { topic: "MLE Edge Cases", priority: 3, estimatedTime: "1 hour" },
  ]
};
