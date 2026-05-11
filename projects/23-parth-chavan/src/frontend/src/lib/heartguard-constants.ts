export const FEATURE_DISPLAY: Record<string, { label: string; unit?: string }> = {
  age: { label: "Age", unit: "years" },
  sex: { label: "Sex" },
  cp: { label: "Chest Pain Type" },
  trestbps: { label: "Resting Blood Pressure", unit: "mm Hg" },
  chol: { label: "Cholesterol", unit: "mg/dl" },
  fbs: { label: "Fasting Blood Sugar" },
  restecg: { label: "Resting ECG" },
  thalach: { label: "Max Heart Rate", unit: "bpm" },
  exang: { label: "Exercise Angina" },
  oldpeak: { label: "ST Depression" },
  slope: { label: "ST Slope" },
  ca: { label: "Major Vessels Blocked" },
  thal: { label: "Thalassemia" },
  age_group: { label: "Age Group" },
  bp_chol_ratio: { label: "BP-Cholesterol Load" },
  hr_reserve: { label: "Heart Rate Reserve" },
  multiple_risk_factors: { label: "Multiple Risk Factors" },
  age_chol: { label: "Age × Cholesterol" },
  bp_hr_ratio: { label: "BP-Heart Rate Ratio" },
  oldpeak_exang: { label: "ST Depression + Angina" },
  ca_thal_risk: { label: "Vessel + Thalassemia Risk" },
  cp_exang_combo: { label: "Chest Pain + Exercise Angina" },
};

export function getFeatureLabel(key: string): string {
  return FEATURE_DISPLAY[key]?.label || key;
}

export function getFeatureUnit(key: string): string | undefined {
  return FEATURE_DISPLAY[key]?.unit;
}

export function getRiskColor(level: string) {
  switch (level) {
    case "Low": return { text: "text-green-600", bg: "bg-green-50", border: "border-green-200", fill: "#16a34a" };
    case "Moderate": return { text: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200", fill: "#d97706" };
    case "High": return { text: "text-red-600", bg: "bg-red-50", border: "border-red-200", fill: "#dc2626" };
    default: return { text: "text-muted-foreground", bg: "bg-muted", border: "border-border", fill: "#6b7280" };
  }
}

export function getRiskColorFromProb(prob: number) {
  if (prob < 0.35) return getRiskColor("Low");
  if (prob < 0.65) return getRiskColor("Moderate");
  return getRiskColor("High");
}

export const MEDICAL_DISCLAIMER = "This tool is for educational and preventive awareness purposes only. It is NOT a substitute for professional medical advice, diagnosis, or treatment. Always consult with a qualified healthcare provider for medical decisions.";

export const FIELD_TOOLTIPS: Record<string, string> = {
  age: "Patient age in years (18–120)",
  sex: "Biological sex: 0 = Female, 1 = Male",
  cp: "Type of chest pain experienced. Asymptomatic (3) can paradoxically indicate higher risk.",
  trestbps: "Blood pressure measured at rest in mm Hg (80–200)",
  chol: "Total serum cholesterol level in mg/dl (100–600)",
  fbs: "Whether fasting blood sugar exceeds 120 mg/dl",
  restecg: "Results from a resting electrocardiogram",
  thalach: "Maximum heart rate achieved during exercise testing (60–220 bpm)",
  exang: "Whether exercise triggers chest pain (angina)",
  oldpeak: "ST segment depression induced by exercise relative to rest (0.0–10.0)",
  slope: "The slope of the ST segment during peak exercise",
  ca: "Number of major blood vessels colored by fluoroscopy (0–4)",
  thal: "Thalassemia blood disorder classification",
};
