import { useEffect, useState } from "react";
import type { UserProfile } from "../types";

interface UserProfileFormProps {
  profile: UserProfile | null;
  userEmail: string;
  onSave: (profile: UserProfile) => Promise<void>;
  isSaving: boolean;
}

function emptyProfile(userId: number): UserProfile {
  return {
    user_id: userId,
    name: "",
    age: null,
    mental_health_status: "",
    stress_level: null,
    exercise_routine: "",
    eating_habits: "",
    sleep_hours: null,
    mood_trends: "",
    social_interaction: "",
    work_pressure: "",
    hobbies: "",
    additional_notes: "",
  };
}

const MENTAL_HEALTH_OPTIONS = [
  "Not specified",
  "Generally well",
  "Managing stress",
  "Managing anxiety",
  "Managing depression",
  "Burnout recovery",
  "In therapy",
];

const STRESS_OPTIONS = [
  { label: "Not specified", value: "" },
  { label: "1 - Very low", value: "1" },
  { label: "2", value: "2" },
  { label: "3", value: "3" },
  { label: "4", value: "4" },
  { label: "5 - Moderate", value: "5" },
  { label: "6", value: "6" },
  { label: "7 - High", value: "7" },
  { label: "8", value: "8" },
  { label: "9", value: "9" },
  { label: "10 - Very high", value: "10" },
];

const EXERCISE_OPTIONS = [
  "Not specified",
  "Rarely exercises",
  "Light activity a few times a week",
  "Walks regularly",
  "Works out 3-5 times a week",
  "Daily exercise",
];

const EATING_OPTIONS = [
  "Not specified",
  "Balanced meals",
  "Irregular meals",
  "Often skips meals",
  "Stress eating",
  "Low appetite",
];

const SLEEP_OPTIONS = [
  { label: "Not specified", value: "" },
  { label: "Less than 5", value: "4.5" },
  { label: "5-6 hours", value: "5.5" },
  { label: "6-7 hours", value: "6.5" },
  { label: "7-8 hours", value: "7.5" },
  { label: "8+ hours", value: "8.5" },
];

const MOOD_TREND_OPTIONS = [
  "Not specified",
  "Mostly stable",
  "Up and down throughout the week",
  "Lower in the evenings",
  "Lower in the mornings",
  "Improving recently",
  "Feeling more overwhelmed recently",
];

const SOCIAL_OPTIONS = [
  "Not specified",
  "Good support system",
  "Moderate social interaction",
  "Limited social interaction",
  "Feeling isolated",
  "Social interaction feels draining",
];

const PRESSURE_OPTIONS = [
  "Not specified",
  "Low pressure",
  "Moderate pressure",
  "High work pressure",
  "High study pressure",
  "Unclear expectations",
  "Burnout risk",
];

export function UserProfileForm({
  profile,
  userEmail,
  onSave,
  isSaving,
}: UserProfileFormProps) {
  const [form, setForm] = useState<UserProfile>(emptyProfile(profile?.user_id ?? 1));
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setForm(profile ?? emptyProfile(1));
    setMessage(null);
  }, [profile]);

  function update<K extends keyof UserProfile>(key: K, value: UserProfile[K]) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSave(form);
    setMessage("Profile saved. New journal analysis will use this context.");
  }

  return (
    <section className="panel">
      <div className="section-heading">
        <p className="eyebrow">Profile Context</p>
        <h2>Personalize your journal analysis</h2>
        <p className="profile-caption">Signed in as {userEmail}</p>
      </div>

      <form className="profile-form" onSubmit={handleSubmit}>
        <div className="profile-grid">
          <label className="field">
            <span>Name</span>
            <input value={form.name} onChange={(event) => update("name", event.target.value)} />
          </label>

          <label className="field">
            <span>Age</span>
            <input
              type="number"
              value={form.age ?? ""}
              onChange={(event) => update("age", event.target.value ? Number(event.target.value) : null)}
            />
          </label>

          <label className="field">
            <span>Mental health status</span>
            <select
              value={form.mental_health_status}
              onChange={(event) => update("mental_health_status", event.target.value)}
            >
              {MENTAL_HEALTH_OPTIONS.map((option) => (
                <option key={option} value={option === "Not specified" ? "" : option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Stress level (1-10)</span>
            <select
              value={form.stress_level?.toString() ?? ""}
              onChange={(event) =>
                update("stress_level", event.target.value ? Number(event.target.value) : null)
              }
            >
              {STRESS_OPTIONS.map((option) => (
                <option key={option.label} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Exercise routine</span>
            <select
              value={form.exercise_routine}
              onChange={(event) => update("exercise_routine", event.target.value)}
            >
              {EXERCISE_OPTIONS.map((option) => (
                <option key={option} value={option === "Not specified" ? "" : option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Eating habits</span>
            <select
              value={form.eating_habits}
              onChange={(event) => update("eating_habits", event.target.value)}
            >
              {EATING_OPTIONS.map((option) => (
                <option key={option} value={option === "Not specified" ? "" : option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Sleep hours</span>
            <select
              value={form.sleep_hours?.toString() ?? ""}
              onChange={(event) =>
                update("sleep_hours", event.target.value ? Number(event.target.value) : null)
              }
            >
              {SLEEP_OPTIONS.map((option) => (
                <option key={option.label} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Mood trends</span>
            <select
              value={form.mood_trends}
              onChange={(event) => update("mood_trends", event.target.value)}
            >
              {MOOD_TREND_OPTIONS.map((option) => (
                <option key={option} value={option === "Not specified" ? "" : option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Social interaction</span>
            <select
              value={form.social_interaction}
              onChange={(event) => update("social_interaction", event.target.value)}
            >
              {SOCIAL_OPTIONS.map((option) => (
                <option key={option} value={option === "Not specified" ? "" : option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Work / study pressure</span>
            <select
              value={form.work_pressure}
              onChange={(event) => update("work_pressure", event.target.value)}
            >
              {PRESSURE_OPTIONS.map((option) => (
                <option key={option} value={option === "Not specified" ? "" : option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Hobbies / relaxation</span>
            <input value={form.hobbies} onChange={(event) => update("hobbies", event.target.value)} />
          </label>

          <label className="field field-full">
            <span>Additional notes</span>
            <textarea
              rows={4}
              value={form.additional_notes}
              onChange={(event) => update("additional_notes", event.target.value)}
            />
          </label>
        </div>

        {message ? <p className="inline-message success">{message}</p> : null}

        <button className="primary-button" type="submit" disabled={isSaving}>
          {isSaving ? "Saving..." : "Save Profile"}
        </button>
      </form>
    </section>
  );
}
