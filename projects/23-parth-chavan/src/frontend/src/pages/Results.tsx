import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart, ArrowLeft, Download, Clock, Trash2, ChevronRight,
  Stethoscope, Lightbulb, HelpCircle, Info, Activity, X,
  Sliders, User, LogOut, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from "recharts";
import { getFeatureLabel, getFeatureUnit, getRiskColor, MEDICAL_DISCLAIMER } from "@/lib/heartguard-constants";
import { getModelInfo, predictStream, savePredictionToDb } from "@/lib/heartguard-api";
import type { PredictResponse, HistoryEntry, ModelInfoResponse, PatientData } from "@/lib/heartguard-types";
import { Footer } from "@/components/heartguard/Footer";
import { AuthModal } from "@/components/heartguard/AuthModal";
import { useAuth } from "@/contexts/AuthContext";

// ---- Risk Gauge ----
function RiskGauge({ probability, riskLevel }: { probability: number; riskLevel: string }) {
  const pct = Math.round(probability * 100);
  const colors = getRiskColor(riskLevel);
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (probability * circumference);
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-40 h-40">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="54" stroke="hsl(var(--muted))" strokeWidth="10" fill="none" />
          <motion.circle
            cx="60" cy="60" r="54" stroke={colors.fill} strokeWidth="10" fill="none"
            strokeLinecap="round" strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span className={`text-3xl font-bold ${colors.text}`}
            initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6, duration: 0.4 }}
          >{pct}%</motion.span>
          <span className="text-xs text-muted-foreground">Risk</span>
        </div>
      </div>
      <Badge className={`${colors.bg} ${colors.text} ${colors.border} border text-sm px-4 py-1`}>
        {riskLevel.toUpperCase()} RISK
      </Badge>
    </div>
  );
}

// ---- Streaming text display ----
function StreamingText({ text, done }: { text: string; done: boolean }) {
  return (
    <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
      {text}
      {!done && <span className="inline-block w-1.5 h-4 bg-muted-foreground/60 ml-0.5 animate-pulse rounded-sm" />}
    </p>
  );
}

// Modifiable feature ranges for What-If simulator
const WHATIF_FEATURES: { key: keyof PatientData; label: string; min: number; max: number; step: number; unit: string }[] = [
  { key: "chol", label: "Cholesterol", min: 100, max: 600, step: 5, unit: "mg/dl" },
  { key: "trestbps", label: "Blood Pressure", min: 80, max: 200, step: 1, unit: "mm Hg" },
  { key: "thalach", label: "Max Heart Rate", min: 60, max: 220, step: 1, unit: "bpm" },
  { key: "oldpeak", label: "ST Depression", min: 0, max: 10, step: 0.1, unit: "" },
];

export default function Results() {
  const navigate = useNavigate();
  const { token, email, isLoggedIn, logout } = useAuth();
  const [result, setResult] = useState<PredictResponse | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [modelInfo, setModelInfo] = useState<ModelInfoResponse | null>(null);
  const [authOpen, setAuthOpen] = useState(false);

  // Streaming state
  const [streamText, setStreamText] = useState("");
  const [streamDone, setStreamDone] = useState(false);
  const [streamRecs, setStreamRecs] = useState<string[]>([]);
  const [streamQuestions, setStreamQuestions] = useState<string[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const streamCleanupRef = useRef<(() => void) | null>(null);

  // What-If state
  const [patientData, setPatientData] = useState<PatientData | null>(null);
  const [whatIfData, setWhatIfData] = useState<PatientData | null>(null);
  const [whatIfResult, setWhatIfResult] = useState<{ risk_probability: number; risk_level: string } | null>(null);
  const [whatIfLoading, setWhatIfLoading] = useState(false);
  const whatIfTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [showWhatIf, setShowWhatIf] = useState(false);

  useEffect(() => {
    // Check if we have a stream request (streaming mode from Assessment)
    const streamReqRaw = sessionStorage.getItem("heartguard_stream_request");
    if (streamReqRaw) {
      sessionStorage.removeItem("heartguard_stream_request");
      const { request, patient_data } = JSON.parse(streamReqRaw);
      setPatientData(patient_data);
      setWhatIfData({ ...patient_data });
      setIsStreaming(true);
      setStreamText("");
      setStreamDone(false);

      const cleanup = predictStream(request, {
        onPrediction: (event) => {
          const r = { ...event.data, llm_explanation: undefined } as PredictResponse;
          setResult(r);
          // Save to session + DB
          const historyRaw = sessionStorage.getItem("heartguard_history");
          const hist = historyRaw ? JSON.parse(historyRaw) : [];
          hist.unshift({
            id: r.prediction_id, timestamp: r.timestamp,
            age: patient_data.age, sex: patient_data.sex,
            risk_level: r.risk_level, risk_probability: r.risk_probability,
            result: r, patient_data,
          });
          sessionStorage.setItem("heartguard_history", JSON.stringify(hist.slice(0, 10)));
          sessionStorage.setItem("heartguard_current", JSON.stringify(r));
          sessionStorage.setItem("heartguard_patient_data", JSON.stringify(patient_data));
          if (isLoggedIn && token) {
            savePredictionToDb(token, {
              prediction_id: r.prediction_id, risk_probability: r.risk_probability,
              risk_level: r.risk_level, patient_data, result_data: r,
            }).catch(() => {});
          }
        },
        onMeta: (event) => { setStreamRecs(event.recommendations); setStreamQuestions(event.doctor_questions); },
        onChunk: (chunk) => setStreamText((t) => t + chunk),
        onDone: () => { setStreamDone(true); setIsStreaming(false); },
        onError: () => { setStreamDone(true); setIsStreaming(false); },
      });
      streamCleanupRef.current = cleanup;
      return () => cleanup();
    }

    // Normal mode — load from session
    const raw = sessionStorage.getItem("heartguard_current");
    if (!raw) { navigate("/"); return; }
    const r: PredictResponse = JSON.parse(raw);
    setResult(r);
    setStreamDone(true);
    if (r.llm_explanation) {
      setStreamText(r.llm_explanation.risk_explanation);
      setStreamRecs(r.llm_explanation.lifestyle_recommendations);
      setStreamQuestions(r.llm_explanation.doctor_consultation_questions);
    }

    const pdRaw = sessionStorage.getItem("heartguard_patient_data");
    if (pdRaw) { const pd = JSON.parse(pdRaw); setPatientData(pd); setWhatIfData({ ...pd }); }

    const histRaw = sessionStorage.getItem("heartguard_history");
    if (histRaw) setHistory(JSON.parse(histRaw));
    getModelInfo().then(setModelInfo).catch(() => {});
  }, [navigate, isLoggedIn, token]);

  const loadHistoryEntry = (entry: HistoryEntry) => {
    setResult(entry.result);
    setStreamDone(true);
    if (entry.result.llm_explanation) {
      setStreamText(entry.result.llm_explanation.risk_explanation);
      setStreamRecs(entry.result.llm_explanation.lifestyle_recommendations);
      setStreamQuestions(entry.result.llm_explanation.doctor_consultation_questions);
    } else { setStreamText(""); setStreamRecs([]); setStreamQuestions([]); }
    if (entry.patient_data) { setPatientData(entry.patient_data); setWhatIfData({ ...entry.patient_data }); }
    setWhatIfResult(null);
    sessionStorage.setItem("heartguard_current", JSON.stringify(entry.result));
    setShowHistory(false);
  };

  const clearHistory = () => { sessionStorage.removeItem("heartguard_history"); setHistory([]); };

  // What-If: debounced re-prediction on slider change
  const runWhatIf = useCallback((newData: PatientData) => {
    if (whatIfTimer.current) clearTimeout(whatIfTimer.current);
    whatIfTimer.current = setTimeout(async () => {
      if (!result) return;
      setWhatIfLoading(true);
      const cleanup = predictStream(
        { patient_data: newData, options: { include_explanation: false, include_llm_explanation: false } },
        {
          onPrediction: (event) => {
            setWhatIfResult({ risk_probability: event.data.risk_probability, risk_level: event.data.risk_level });
            setWhatIfLoading(false);
          },
          onError: () => setWhatIfLoading(false),
        }
      );
      setTimeout(cleanup, 30000);
    }, 400);
  }, [result]);

  const handleWhatIfChange = (key: keyof PatientData, value: number) => {
    if (!whatIfData) return;
    const next = { ...whatIfData, [key]: value };
    setWhatIfData(next);
    runWhatIf(next);
  };

  // PDF download
  const handleDownloadPdf = async () => {
    if (!result) return;
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    const lineH = 7;
    let y = 20;

    const addLine = (text: string, size = 11, bold = false) => {
      doc.setFontSize(size);
      doc.setFont("helvetica", bold ? "bold" : "normal");
      const lines = doc.splitTextToSize(text, 170);
      lines.forEach((l: string) => { doc.text(l, 20, y); y += lineH; });
      y += 2;
    };

    addLine("HeartGuard — Cardiac Risk Assessment Report", 16, true);
    addLine(`Date: ${new Date(result.timestamp).toLocaleString()}`, 10);
    addLine(`Prediction ID: ${result.prediction_id}`, 9);
    y += 4;
    addLine(`Risk Level: ${result.risk_level}`, 14, true);
    addLine(`Risk Probability: ${Math.round(result.risk_probability * 100)}%`, 12);
    if (result.confidence_interval) {
      addLine(`Confidence Interval: ${Math.round(result.confidence_interval[0] * 100)}% – ${Math.round(result.confidence_interval[1] * 100)}%`, 10);
    }
    y += 4;

    if (streamText) {
      addLine("AI Explanation", 13, true);
      addLine(streamText, 10);
      y += 2;
    }

    if (streamRecs.length > 0) {
      addLine("Lifestyle Recommendations", 13, true);
      streamRecs.forEach((r, i) => addLine(`${i + 1}. ${r}`, 10));
      y += 2;
    }

    if (streamQuestions.length > 0) {
      addLine("Questions for Your Doctor", 13, true);
      streamQuestions.forEach((q) => addLine(`• ${q}`, 10));
      y += 2;
    }

    y += 4;
    addLine("Medical Disclaimer", 11, true);
    addLine(MEDICAL_DISCLAIMER, 9);

    doc.save(`heartguard-report-${result.prediction_id.slice(0, 8)}.pdf`);
  };

  if (!result && !isStreaming) return null;

  const displayResult = whatIfResult && result
    ? { ...result, risk_probability: whatIfResult.risk_probability, risk_level: whatIfResult.risk_level }
    : result;

  const riskColors = getRiskColor(displayResult?.risk_level || "Low");
  const ci = result?.confidence_interval;

  const riskFactors = result?.explanation?.top_risk_factors?.map((f) => ({
    name: getFeatureLabel(f.feature), value: Math.abs(f.contribution),
    rawValue: f.feature_value, unit: getFeatureUnit(f.feature), explanation: f.explanation,
  })) || [];

  const protectiveFactors = result?.explanation?.top_protective_factors?.map((f) => ({
    name: getFeatureLabel(f.feature), value: Math.abs(f.contribution),
    rawValue: f.feature_value, unit: getFeatureUnit(f.feature), explanation: f.explanation,
  })) || [];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container flex items-center justify-between h-14">
          <button onClick={() => navigate("/assess")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" /> New Assessment
          </button>
          <div className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-red-500" fill="currentColor" />
            <span className="font-semibold">HeartGuard</span>
          </div>
          <div className="flex items-center gap-2">
            {isLoggedIn ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground hidden sm:block">{email}</span>
                <Button variant="ghost" size="sm" onClick={logout}><LogOut className="h-4 w-4" /></Button>
              </div>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setAuthOpen(true)}>
                <User className="h-4 w-4 mr-1" /> Sign In
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setShowHistory(!showHistory)}>
              <Clock className="h-4 w-4 mr-1" /> History
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex relative">
        {/* History sidebar */}
        <AnimatePresence>
          {showHistory && (
            <motion.aside
              initial={{ x: -300, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
              exit={{ x: -300, opacity: 0 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="w-72 border-r bg-card p-4 space-y-3 overflow-y-auto absolute md:relative z-40 h-full"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">Session History</h3>
                <Button variant="ghost" size="sm" className="md:hidden" onClick={() => setShowHistory(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {history.length === 0 && <p className="text-xs text-muted-foreground">No history yet</p>}
              {history.map((entry) => {
                const ec = getRiskColor(entry.risk_level);
                return (
                  <button key={entry.id} onClick={() => loadHistoryEntry(entry)}
                    className={`w-full text-left rounded-lg border p-3 space-y-1 hover:shadow-sm transition-shadow ${entry.id === result?.prediction_id ? "ring-2 ring-primary" : ""}`}
                  >
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className={`${ec.text} ${ec.border} text-xs`}>{entry.risk_level}</Badge>
                      <span className="text-xs text-muted-foreground">{Math.round(entry.risk_probability * 100)}%</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Age {entry.age}, {entry.sex === 0 ? "F" : "M"}</p>
                    <p className="text-xs text-muted-foreground">{new Date(entry.timestamp).toLocaleTimeString()}</p>
                  </button>
                );
              })}
              {history.length > 0 && (
                <Button variant="ghost" size="sm" onClick={clearHistory} className="w-full text-xs">
                  <Trash2 className="h-3 w-3 mr-1" /> Clear History
                </Button>
              )}
            </motion.aside>
          )}
        </AnimatePresence>

        <main className="flex-1 container py-8 space-y-8 max-w-5xl">
          {/* Risk Gauge */}
          {displayResult && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} className="text-center space-y-3">
              <RiskGauge probability={displayResult.risk_probability} riskLevel={displayResult.risk_level} />
              {whatIfResult && result && (
                <div className={`inline-flex items-center gap-2 text-xs font-medium px-3 py-1 rounded-full border ${
                  whatIfResult.risk_probability < result.risk_probability ? "text-green-700 bg-green-50 border-green-200" : "text-red-700 bg-red-50 border-red-200"
                }`}>
                  {whatIfResult.risk_probability < result.risk_probability ? "▼" : "▲"}{" "}
                  {Math.abs(Math.round((whatIfResult.risk_probability - result.risk_probability) * 100))}% vs original
                </div>
              )}
              {ci && !whatIfResult && (
                <p className="text-xs text-muted-foreground">Confidence interval: {Math.round(ci[0] * 100)}% – {Math.round(ci[1] * 100)}%</p>
              )}
              {isStreaming && !result && (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Running model…
                </div>
              )}
            </motion.div>
          )}

          {/* Model info chip */}
          {modelInfo && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="flex justify-center">
              <div className="inline-flex items-center gap-3 rounded-full border bg-card px-4 py-2 text-xs text-muted-foreground">
                <span>Model: {modelInfo.model_name}</span>
                <span className="w-px h-3 bg-border" />
                <span>AUC: {modelInfo.metrics?.roc_auc?.toFixed(4) || "0.9407"}</span>
                <span className="w-px h-3 bg-border" />
                <span>v{modelInfo.model_version}</span>
              </div>
            </motion.div>
          )}

          {/* What-If Simulator */}
          {result && patientData && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
              <button
                onClick={() => setShowWhatIf(!showWhatIf)}
                className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-3"
              >
                <Sliders className="h-4 w-4" />
                What-If Simulator
                <ChevronRight className={`h-4 w-4 transition-transform ${showWhatIf ? "rotate-90" : ""}`} />
                {whatIfLoading && <Loader2 className="h-3.5 w-3.5 animate-spin ml-1" />}
              </button>
              <AnimatePresence>
                {showWhatIf && whatIfData && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3 }}
                  >
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                          Adjust values to see how they affect your risk score
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        {WHATIF_FEATURES.map((f) => (
                          <div key={f.key} className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-medium">{f.label}</span>
                              <span className="text-muted-foreground tabular-nums">
                                {f.step < 1 ? (whatIfData[f.key] as number).toFixed(1) : whatIfData[f.key]}{f.unit ? ` ${f.unit}` : ""}
                                {(whatIfData[f.key] as number) !== (patientData[f.key] as number) && (
                                  <span className="ml-2 text-xs text-blue-500">
                                    (was {patientData[f.key]})
                                  </span>
                                )}
                              </span>
                            </div>
                            <Slider
                              min={f.min} max={f.max} step={f.step}
                              value={[whatIfData[f.key] as number]}
                              onValueChange={([v]) => handleWhatIfChange(f.key, v)}
                              className="w-full"
                            />
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>{f.min}{f.unit ? ` ${f.unit}` : ""}</span>
                              <span>{f.max}{f.unit ? ` ${f.unit}` : ""}</span>
                            </div>
                          </div>
                        ))}
                        <Button variant="ghost" size="sm" onClick={() => { setWhatIfData({ ...patientData }); setWhatIfResult(null); }}>
                          Reset to original values
                        </Button>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* Two-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Risk & Protective Factors */}
            <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.2, ease: [0.16, 1, 0.3, 1] }} className="space-y-6">
              {result?.explanation ? (
                <>
                  {riskFactors.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Activity className="h-4 w-4 text-red-500" /> Top Risk Factors
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={riskFactors.length * 44 + 16}>
                          <BarChart data={riskFactors} layout="vertical" margin={{ left: 0, right: 16 }}>
                            <XAxis type="number" hide />
                            <YAxis dataKey="name" type="category" width={140} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                              {riskFactors.map((_, i) => <Cell key={i} fill="#ef4444" fillOpacity={0.8} />)}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                        <div className="space-y-2 mt-4">
                          {riskFactors.map((f) => (
                            <div key={f.name} className="text-xs text-muted-foreground flex items-start gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 shrink-0" />
                              <span><strong>{f.name}</strong> ({f.rawValue}{f.unit ? ` ${f.unit}` : ""}): {f.explanation}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  {protectiveFactors.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Activity className="h-4 w-4 text-green-500" /> Protective Factors
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={protectiveFactors.length * 44 + 16}>
                          <BarChart data={protectiveFactors} layout="vertical" margin={{ left: 0, right: 16 }}>
                            <XAxis type="number" hide />
                            <YAxis dataKey="name" type="category" width={140} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                              {protectiveFactors.map((_, i) => <Cell key={i} fill="#22c55e" fillOpacity={0.8} />)}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                        <div className="space-y-2 mt-4">
                          {protectiveFactors.map((f) => (
                            <div key={f.name} className="text-xs text-muted-foreground flex items-start gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-400 mt-1.5 shrink-0" />
                              <span><strong>{f.name}</strong> ({f.rawValue}{f.unit ? ` ${f.unit}` : ""}): {f.explanation}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </>
              ) : (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    {isStreaming ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="h-6 w-6 animate-spin" />
                        <p className="text-sm">Loading SHAP analysis…</p>
                      </div>
                    ) : (
                      <><Info className="h-8 w-8 mx-auto mb-2 opacity-40" />SHAP explanation not requested</>
                    )}
                  </CardContent>
                </Card>
              )}
            </motion.div>

            {/* AI Explanation */}
            <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.3, ease: [0.16, 1, 0.3, 1] }} className="space-y-6">
              {(streamText || isStreaming || streamRecs.length > 0) ? (
                <>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Stethoscope className="h-4 w-4" /> What This Means For You
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {streamText || isStreaming ? (
                        <StreamingText text={streamText} done={streamDone} />
                      ) : (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" /> Generating explanation…
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {streamRecs.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Lightbulb className="h-4 w-4 text-amber-500" /> Lifestyle Recommendations
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {streamRecs.map((rec, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                              <span className="w-5 h-5 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs shrink-0 mt-0.5">{i + 1}</span>
                              {rec}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}

                  {streamQuestions.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <HelpCircle className="h-4 w-4 text-blue-500" /> Questions to Ask Your Doctor
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {streamQuestions.map((q, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                              <ChevronRight className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                              {q}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}
                </>
              ) : (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <Info className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    AI explanation not requested
                  </CardContent>
                </Card>
              )}
            </motion.div>
          </div>

          {/* Bottom bar */}
          <div className="border-t pt-6 space-y-4">
            <p className="text-xs text-muted-foreground text-center max-w-2xl mx-auto">⚕️ {MEDICAL_DISCLAIMER}</p>
            <div className="flex justify-center gap-3">
              <Button variant="outline" onClick={() => navigate("/assess")}>
                <ArrowLeft className="h-4 w-4 mr-1" /> New Assessment
              </Button>
              <Button variant="outline" onClick={handleDownloadPdf} disabled={!streamDone}>
                <Download className="h-4 w-4 mr-1" /> Download PDF Report
              </Button>
            </div>
          </div>
        </main>
      </div>

      <Footer />
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  );
}
