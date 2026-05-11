import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Card from '../components/Card.jsx';
import Button from '../components/Button.jsx';
import AnimatedSection from '../components/AnimatedSection.jsx';
import useLocalStorage from '../hooks/useLocalStorage.js';

const Onboarding = () => {
  const emptyProfile = {
    name: '',
    fitnessLevel: '',
    weeklyGoal: '',
    equipment: ''
  };
  const navigate = useNavigate();
  const [profile, setProfile, storageError] = useLocalStorage('saf_onboarding', emptyProfile);
  const [formValues, setFormValues] = useState(profile && typeof profile === 'object' ? profile : emptyProfile);
  const [errors, setErrors] = useState({});
  const [toastVisible, setToastVisible] = useState(false);

  useEffect(() => {
    setFormValues(profile && typeof profile === 'object' ? profile : emptyProfile);
  }, [profile]);

  const handleScrollToForm = () => {
    if (typeof document === 'undefined') return;
    const formSection = document.getElementById('onboarding-form');
    if (formSection) {
      formSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleChange = (field) => (event) => {
    setFormValues((prev) => ({ ...prev, [field]: event.target.value }));
    setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const validate = (values) => {
    const nextErrors = {};
    if (!values.name.trim()) nextErrors.name = 'Please enter your name.';
    if (!values.fitnessLevel)
      nextErrors.fitnessLevel = 'Select a fitness level to continue.';
    if (!values.weeklyGoal)
      nextErrors.weeklyGoal = 'Set a weekly workout goal.';
    if (!values.equipment.trim())
      nextErrors.equipment = 'Tell us what equipment you have access to.';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const nextValues = {
      name: String(data.get('name') || '').trim(),
      fitnessLevel: String(data.get('fitnessLevel') || ''),
      weeklyGoal: String(data.get('weeklyGoal') || ''),
      equipment: String(data.get('equipment') || '').trim()
    };
    setFormValues(nextValues);
    if (!validate(nextValues)) return;
    setProfile(nextValues);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('saf_onboarding', JSON.stringify(nextValues));
      }
    } catch {
      // If storage fails, rely on useLocalStorage error messaging.
    }
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 1800);
    setTimeout(() => navigate('/burnout'), 1400);
  };

  return (
    <>
      {storageError && (
        <div className="mb-4 rounded-2xl border border-amber-200/70 bg-amber-50/70 px-4 py-3 text-sm text-amber-700">
          {storageError}
        </div>
      )}
      <div className="space-y-6">
      <AnimatedSection threshold={0.2}>
      <Card title="Welcome">
        <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-semibold text-indigo-700">
          <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
          2-minute, burnout-aware setup
        </div>
        <p className="mt-3 text-slate-600">
          State-Aware Adaptive Fitness helps you align workouts with your
          current energy and stress levels.
        </p>
        <p className="mt-3 text-sm text-slate-500">
          Complete a quick profile so your plan can adapt to your needs.
        </p>
        <button
          type="button"
          onClick={handleScrollToForm}
          className="mt-4 inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1"
        >
          <span>Get started</span>
          <span aria-hidden="true">↓</span>
        </button>
      </Card>
      </AnimatedSection>
      <AnimatedSection threshold={0.25}>
      <div id="onboarding-form">
      <Card title="Your basics">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-slate-700">
            Name
            <input
              name="name"
              type="text"
              value={formValues.name}
              onChange={handleChange('name')}
              placeholder="Your name"
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
            <span className="mt-1 block text-xs text-slate-500">
              We use your name to personalize your check-ins.
            </span>
            {errors.name && (
              <span className="mt-1 block text-xs text-rose-500">
                {errors.name}
              </span>
            )}
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Fitness level
            <select
              name="fitnessLevel"
              value={formValues.fitnessLevel}
              onChange={handleChange('fitnessLevel')}
              className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            >
              <option value="">Select level</option>
              <option value="Beginner">Beginner</option>
              <option value="Intermediate">Intermediate</option>
              <option value="Advanced">Advanced</option>
            </select>
            <span className="mt-1 block text-xs text-slate-500">
              This guides workout intensity and progression.
            </span>
            {errors.fitnessLevel && (
              <span className="mt-1 block text-xs text-rose-500">
                {errors.fitnessLevel}
              </span>
            )}
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Weekly workout goal (sessions per week)
            <input
              name="weeklyGoal"
              type="number"
              min="1"
              value={formValues.weeklyGoal}
              onChange={handleChange('weeklyGoal')}
              placeholder="e.g., 3"
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
            <span className="mt-1 block text-xs text-slate-500">
              How many full workout sessions per week feel realistic for you? For example, "3" means three separate workout days.
            </span>
            {errors.weeklyGoal && (
              <span className="mt-1 block text-xs text-rose-500">
                {errors.weeklyGoal}
              </span>
            )}
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Available equipment
            <input
              name="equipment"
              type="text"
              value={formValues.equipment}
              onChange={handleChange('equipment')}
              placeholder="Bodyweight, dumbbells, resistance bands"
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
            <span className="mt-1 block text-xs text-slate-500">
              We’ll tailor workouts based on what you have.
            </span>
            {errors.equipment && (
              <span className="mt-1 block text-xs text-rose-500">
                {errors.equipment}
              </span>
            )}
          </label>

          <div className="flex flex-wrap gap-3 pt-2">
            <Button type="submit">Continue to burnout check-in</Button>
            <Button type="button" variant="secondary" onClick={() => navigate('/workout')}>
              Preview workout planner
            </Button>
          </div>
        </form>
      </Card>
      </div>
      </AnimatedSection>
      <AnimatedSection threshold={0.3}>
      <div className="mt-3 rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 via-purple-50 to-indigo-50 px-3 py-2 text-[11px] text-slate-600 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-1 font-semibold tracking-wide text-indigo-700">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
            What this app does
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <div className="flex items-baseline gap-1">
              <span className="rounded-full bg-gradient-to-r from-indigo-500 to-indigo-600 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">
                Check-in
              </span>
              <span className="font-medium text-slate-800">2-minute weekly burnout snapshot</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="rounded-full bg-gradient-to-r from-violet-500 to-indigo-600 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">
                Workouts
              </span>
              <span className="font-medium text-slate-800">Plans adapt to your recent burnout trend</span>
            </div>
          </div>
        </div>
      </div>
      </AnimatedSection>
    </div>
      {toastVisible && (
        <div
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-lg"
          role="status"
          aria-live="polite"
        >
          Profile saved. Redirecting to burnout check-in…
        </div>
      )}
    </>
  );
};

export default Onboarding;
