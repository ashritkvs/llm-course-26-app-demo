export type Category = "positive" | "negative" | "neutral";

export interface AnalysisResult {
  emotion: string;
  intensity: number;
  category: Category;
  trigger: string;
  coreThought: string;
  thinkingPatterns: string[];
  distortion: string;
  coreInsight: string;
  reframes: string[];
  actions: string[];
  reflectionQuestion: string;
  actionPlan: string;
  weeklyHint: string;
  keyConcerns?: string[];
  positiveSignals?: string[];
  personalizedSuggestions?: string[];
}

export interface JournalEntry {
  id: string;
  userId?: number | null;
  text: string;
  createdAt: string;
  result: AnalysisResult;
}

export interface DashboardPoint {
  date: string;
  moodScore: number;
  signedScore: number;
  category: Category;
  emotion: string;
  trigger: string;
}

export interface DashboardSummary {
  averageMood: number;
  bestMood: number;
  lowestMood: number;
  positiveStreak: number;
  negativeStreak: number;
  topTrigger: string;
  bestDay: string;
  toughestDay: string;
  points: DashboardPoint[];
}

export interface UserProfile {
  user_id: number;
  name: string;
  age: number | null;
  mental_health_status: string;
  stress_level: number | null;
  exercise_routine: string;
  eating_habits: string;
  sleep_hours: number | null;
  mood_trends: string;
  social_interaction: string;
  work_pressure: string;
  hobbies: string;
  additional_notes: string;
}

export interface AuthUser {
  id: number;
  email: string;
  created_at?: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}
