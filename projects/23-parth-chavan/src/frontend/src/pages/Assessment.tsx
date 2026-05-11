import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Heart, ArrowLeft, ArrowRight, Info, AlertTriangle, Loader2,
  ChevronRight, Upload, X, FileText, User, LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { predict, predictStream, getExampleData, extractReport, savePredictionToDb } from "@/lib/heartguard-api";
import { FIELD_TOOLTIPS, MEDICAL_DISCLAIMER } from "@/lib/heartguard-constants";
import type { PatientData, PredictResponse, ExtractedReport } from "@/lib/heartguard-types";
import { Footer } from "@/components/heartguard/Footer";
import { AuthModal } from "@/components/heartguard/AuthModal";
import { useAuth } from "@/contexts/AuthContext";

const DEFAULT_DATA: PatientData = {
  age: 55, sex: 1, cp: 0, trestbps: 120, chol: 200,
  fbs: 0, restecg: 0, thalach: 150, exang: 0,
  oldpeak: 0, slope: 0, ca: 0, thal: 0,
};

const STEPS = ["Personal Info", "Cardiac Symptoms", "Blood Tests", "ECG & Imaging"];

function FieldTooltip({ field }: { field: string }) {
  const tip = FIELD_TOOLTIPS[field];
  if (!tip) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help inline ml-1" />
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-xs">{tip}</TooltipContent>
    </Tooltip>
  );
}

function Warning({ show, text }: { show: boolean; text: string }) {
  if (!show) return null;
  return (
    <div className="flex items-center gap-1.5 mt-1.5">
      <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
      <span className="text-xs text-amber-600">{text}</span>
    </div>
  );
}

export default function Assessment() {
  const navigate = useNavigate();
  const { token, email, isLoggedIn, logout } = useAuth();
  const [data, setData] = useState<PatientData>(DEFAULT_DATA);
  const [extractedFields, setExtractedFields] = useState<Set<string>>(new Set());
  const [includeShap, setIncludeShap] = useState(true);
  const [includeLlm, setIncludeLlm] = useState(true);
  const [useStreaming, setUseStreaming] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [authOpen, setAuthOpen] = useState(false);

  // Report upload state
  const fileRef = useRef<HTMLInputElement>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [extractNotes, setExtractNotes] = useState<string | null>(null);
  const [extractedCount, setExtractedCount] = useState<number | null>(null);

  const set = (field: keyof PatientData, value: number) => {
    setData((d) => ({ ...d, [field]: value }));
    setExtractedFields((s) => { const n = new Set(s); n.delete(field); return n; });
  };

  const handleLoadExample = async () => {
    try {
      const ex = await getExampleData();
      setData(ex.patient_data);
      setExtractedFields(new Set());
    } catch {}
  };

  const handleFileUpload = async (file: File) => {
    setExtracting(true);
    setExtractError(null);
    setExtractNotes(null);
    setExtractedCount(null);
    try {
      const report: ExtractedReport = await extractReport(file);
      const filled = new Set<string>();
      const updates: Partial<PatientData> = {};
      for (const [key, val] of Object.entries(report.extracted)) {
        if (val !== null && val !== undefined && key in DEFAULT_DATA) {
          (updates as any)[key] = val;
          filled.add(key);
        }
      }
      if (Object.keys(updates).length > 0) {
        setData((d) => ({ ...d, ...updates }));
        setExtractedFields(filled);
      }
      setExtractedCount(report.fields_found);
      if (report.notes) setExtractNotes(report.notes);
    } catch (e: any) {
      setExtractError(e.message || "Failed to extract report data.");
    } finally {
      setExtracting(false);
    }
  };

  const storeResult = (result: PredictResponse) => {
    const historyRaw = sessionStorage.getItem("heartguard_history");
    const history = historyRaw ? JSON.parse(historyRaw) : [];
    history.unshift({
      id: result.prediction_id,
      timestamp: result.timestamp,
      age: data.age,
      sex: data.sex,
      risk_level: result.risk_level,
      risk_probability: result.risk_probability,
      result,
      patient_data: data,
    });
    sessionStorage.setItem("heartguard_history", JSON.stringify(history.slice(0, 10)));
    sessionStorage.setItem("heartguard_current", JSON.stringify(result));
    sessionStorage.setItem("heartguard_patient_data", JSON.stringify(data));

    if (isLoggedIn && token) {
      savePredictionToDb(token, {
        prediction_id: result.prediction_id,
        risk_probability: result.risk_probability,
        risk_level: result.risk_level,
        patient_data: data,
        result_data: result,
      }).catch(() => {});
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    setLoadingStep(1);

    const request = {
      patient_data: data,
      options: { include_explanation: includeShap, include_llm_explanation: !useStreaming && includeLlm },
    };

    if (useStreaming && includeLlm) {
      // Streaming mode: navigate immediately, results page handles stream
      sessionStorage.setItem("heartguard_stream_request", JSON.stringify({ request, patient_data: data }));
      sessionStorage.removeItem("heartguard_current");
      navigate("/results");
      return;
    }

    const timer1 = setTimeout(() => setLoadingStep(2), 2000);
    const timer2 = setTimeout(() => setLoadingStep(3), 5000);
    try {
      const result = await predict(request);
      clearTimeout(timer1); clearTimeout(timer2);
      if (!result.success) { setError(result.error || "Prediction failed"); setLoading(false); return; }
      storeResult(result);
      navigate("/results");
    } catch (e: any) {
      setError(e.message || "Something went wrong");
    } finally {
      clearTimeout(timer1); clearTimeout(timer2);
      setLoading(false);
    }
  };

  const isExtracted = (field: string) => extractedFields.has(field);

  const renderNumberField = (field: keyof PatientData, label: string, min: number, max: number, stepVal: number = 1) => (
    <div className="space-y-2">
      <Label className="text-sm font-medium flex items-center gap-1">
        {label}
        <FieldTooltip field={field} />
        {isExtracted(field) && (
          <Badge variant="outline" className="ml-1 text-xs text-blue-600 border-blue-300 bg-blue-50">auto-filled</Badge>
        )}
      </Label>
      <Input
        type="number"
        min={min}
        max={max}
        step={stepVal}
        value={data[field]}
        onChange={(e) => set(field, parseFloat(e.target.value) || 0)}
        className={`h-10 ${isExtracted(field) ? "border-blue-300 bg-blue-50/40" : ""}`}
      />
      <Warning show={field === "trestbps" && data.trestbps >= 140} text="Stage 1+ hypertension range" />
      <Warning show={field === "chol" && data.chol >= 240} text="High cholesterol risk range" />
      <Warning show={field === "chol" && data.chol >= 200 && data.chol < 240} text="Borderline cholesterol" />
      <Warning show={field === "oldpeak" && data.oldpeak >= 2.0} text="Possible ischemia indicator" />
      <Warning show={field === "thalach" && data.thalach < 100} text="Low cardiac fitness indicator" />
    </div>
  );

  const renderSelectField = (field: keyof PatientData, label: string, options: { value: number; label: string }[]) => (
    <div className="space-y-2">
      <Label className="text-sm font-medium flex items-center gap-1">
        {label}
        <FieldTooltip field={field} />
        {isExtracted(field) && (
          <Badge variant="outline" className="ml-1 text-xs text-blue-600 border-blue-300 bg-blue-50">auto-filled</Badge>
        )}
      </Label>
      <Select value={String(data[field])} onValueChange={(v) => set(field, parseInt(v))}>
        <SelectTrigger className={`h-10 ${isExtracted(field) ? "border-blue-300 bg-blue-50/40" : ""}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Warning show={field === "ca" && data.ca >= 2} text="Multiple vessel blockages detected" />
    </div>
  );

  const sections = [
    <div key="0" className="grid grid-cols-1 sm:grid-cols-2 gap-6">
      {renderNumberField("age", "Age (years)", 18, 120)}
      {renderSelectField("sex", "Sex", [{ value: 0, label: "Female" }, { value: 1, label: "Male" }])}
    </div>,
    <div key="1" className="grid grid-cols-1 sm:grid-cols-2 gap-6">
      {renderSelectField("cp", "Chest Pain Type", [
        { value: 0, label: "Typical Angina" }, { value: 1, label: "Atypical Angina" },
        { value: 2, label: "Non-Anginal Pain" }, { value: 3, label: "Asymptomatic" },
      ])}
      {renderSelectField("exang", "Exercise-Induced Angina", [{ value: 0, label: "No" }, { value: 1, label: "Yes" }])}
      {renderNumberField("thalach", "Max Heart Rate Achieved (bpm)", 60, 220)}
    </div>,
    <div key="2" className="grid grid-cols-1 sm:grid-cols-2 gap-6">
      {renderNumberField("trestbps", "Resting Blood Pressure (mm Hg)", 80, 200)}
      {renderNumberField("chol", "Serum Cholesterol (mg/dl)", 100, 600)}
      {renderSelectField("fbs", "Fasting Blood Sugar > 120 mg/dl", [{ value: 0, label: "No" }, { value: 1, label: "Yes" }])}
    </div>,
    <div key="3" className="grid grid-cols-1 sm:grid-cols-2 gap-6">
      {renderSelectField("restecg", "Resting ECG Results", [
        { value: 0, label: "Normal" }, { value: 1, label: "ST-T Wave Abnormality" },
        { value: 2, label: "Left Ventricular Hypertrophy" },
      ])}
      {renderNumberField("oldpeak", "ST Depression", 0, 10, 0.1)}
      {renderSelectField("slope", "Slope of Peak Exercise ST Segment", [
        { value: 0, label: "Upsloping" }, { value: 1, label: "Flat" }, { value: 2, label: "Downsloping" },
      ])}
      {renderSelectField("ca", "Major Vessels Blocked (0–4)", [
        { value: 0, label: "0" }, { value: 1, label: "1" }, { value: 2, label: "2" },
        { value: 3, label: "3" }, { value: 4, label: "4" },
      ])}
      {renderSelectField("thal", "Thalassemia", [
        { value: 0, label: "Normal" }, { value: 1, label: "Fixed Defect" },
        { value: 2, label: "Reversible Defect" }, { value: 3, label: "Not Described" },
      ])}
    </div>,
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container flex items-center justify-between h-14">
          <button onClick={() => navigate("/")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <div className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-red-500" fill="currentColor" />
            <span className="font-semibold">HeartGuard</span>
          </div>
          <div className="flex items-center gap-2">
            {isLoggedIn ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground hidden sm:block">{email}</span>
                <Button variant="ghost" size="sm" onClick={logout}>
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setAuthOpen(true)}>
                <User className="h-4 w-4 mr-1" /> Sign In
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Progress stepper */}
      <div className="border-b bg-muted/30">
        <div className="container py-3">
          <div className="flex items-center justify-center gap-1 text-sm">
            {STEPS.map((s, i) => (
              <button key={s} onClick={() => setStep(i)}
                className={`flex items-center gap-1 px-3 py-1 rounded-full transition-colors ${
                  i === step ? "bg-primary text-primary-foreground font-medium" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="hidden sm:inline">{s}</span>
                <span className="sm:hidden">{i + 1}</span>
                {i < STEPS.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground ml-1" />}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="flex-1 container py-8 max-w-2xl">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }} className="space-y-8">

          {/* Medical Report Upload — always visible */}
          <div className="rounded-lg border border-dashed border-blue-300 bg-blue-50/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-medium text-blue-700">Import from Medical Report</span>
              </div>
              {extractedCount !== null && !extracting && (
                <Badge variant="outline" className="text-blue-600 border-blue-300 text-xs">
                  {extractedCount} field{extractedCount !== 1 ? "s" : ""} extracted
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Upload a blood test PDF, lab report image, or ECG scan. AI will auto-fill matching fields.
            </p>
            <div className="flex items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                className="hidden"
                onChange={(e) => { if (e.target.files?.[0]) handleFileUpload(e.target.files[0]); e.target.value = ""; }}
              />
              <Button
                variant="outline"
                size="sm"
                disabled={extracting}
                onClick={() => fileRef.current?.click()}
                className="border-blue-300 text-blue-700 hover:bg-blue-100"
              >
                {extracting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
                {extracting ? "Analysing report…" : "Upload PDF / Image"}
              </Button>
              {extractedFields.size > 0 && (
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => { setExtractedFields(new Set()); setExtractedCount(null); setExtractNotes(null); }}>
                  <X className="h-3 w-3 mr-1" /> Clear
                </Button>
              )}
            </div>
            {extractError && <p className="text-xs text-red-600">{extractError}</p>}
            {extractNotes && !extractError && <p className="text-xs text-muted-foreground italic">{extractNotes}</p>}
          </div>

          {/* Section title */}
          <div className="space-y-1">
            <h2 className="text-xl font-semibold">{STEPS[step]}</h2>
            <p className="text-sm text-muted-foreground">
              {step === 0 && "Basic demographic information"}
              {step === 1 && "Symptoms related to cardiac function"}
              {step === 2 && "Blood test results and vital signs"}
              {step === 3 && "Electrocardiogram and imaging data"}
            </p>
          </div>

          <motion.div key={step} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}>
            {sections[step]}
          </motion.div>

          {/* Navigation */}
          <div className="flex items-center justify-between pt-4">
            <Button variant="outline" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Previous
            </Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={() => setStep(step + 1)}>
                Next <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            ) : <div />}
          </div>

          {/* Options & submit */}
          {step === STEPS.length - 1 && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }} className="space-y-6 border-t pt-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={includeShap} onCheckedChange={(v) => setIncludeShap(!!v)} />
                  Include SHAP explanation
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={includeLlm} onCheckedChange={(v) => setIncludeLlm(!!v)} />
                  Include AI explanation
                </label>
                {includeLlm && (
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={useStreaming} onCheckedChange={(v) => setUseStreaming(!!v)} />
                    Stream AI response
                  </label>
                )}
              </div>

              <div className="flex items-center gap-3">
                <Button onClick={handleSubmit} disabled={loading}
                  className="h-11 px-6 rounded-xl shadow-lg shadow-primary/20 active:scale-[0.97] transition-transform">
                  {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Analysing…</> : "Analyse Risk"}
                </Button>
                <Button variant="ghost" size="sm" onClick={handleLoadExample} disabled={loading}>Load example</Button>
              </div>

              {loading && !useStreaming && (
                <div className="rounded-lg border bg-card p-4 space-y-3">
                  {[
                    { step: 1, label: "Running ML model…" },
                    { step: 2, label: "Computing SHAP explanations…" },
                    { step: 3, label: "Generating AI explanation (please wait)…" },
                  ].map((s) => (
                    <div key={s.step} className="flex items-center gap-3 text-sm">
                      {loadingStep >= s.step ? (
                        loadingStep > s.step
                          ? <span className="h-5 w-5 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs">✓</span>
                          : <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      ) : <span className="h-5 w-5 rounded-full border-2 border-muted" />}
                      <span className={loadingStep >= s.step ? "text-foreground" : "text-muted-foreground"}>{s.label}</span>
                    </div>
                  ))}
                </div>
              )}

              {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

              <p className="text-xs text-muted-foreground">
                🔒 {isLoggedIn ? "Results will be saved to your account." : "No data stored — info never leaves this session."}
                {!isLoggedIn && " "}
                {!isLoggedIn && <button onClick={() => setAuthOpen(true)} className="underline">Sign in to save history.</button>}
              </p>
            </motion.div>
          )}
        </motion.div>
      </main>

      <div className="border-t bg-muted/30">
        <div className="container py-3">
          <p className="text-xs text-muted-foreground text-center max-w-2xl mx-auto">⚕️ {MEDICAL_DISCLAIMER}</p>
        </div>
      </div>
      <Footer />
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  );
}
