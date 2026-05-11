import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Heart, Shield, Activity, Brain, ArrowRight, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { checkHealth } from "@/lib/heartguard-api";
import { MEDICAL_DISCLAIMER } from "@/lib/heartguard-constants";
import { Footer } from "@/components/heartguard/Footer";

export default function Landing() {
  const navigate = useNavigate();
  const [health, setHealth] = useState<"loading" | "healthy" | "offline">("loading");

  useEffect(() => {
    checkHealth()
      .then((res) => setHealth(res.service_status === "healthy" ? "healthy" : "offline"))
      .catch(() => setHealth("offline"));
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <Heart className="h-6 w-6 text-red-500" fill="currentColor" />
            <span className="font-bold text-lg tracking-tight">HeartGuard</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            {health === "loading" && (
              <span className="text-muted-foreground">Checking API…</span>
            )}
            {health === "healthy" && (
              <span className="flex items-center gap-1.5 text-green-600">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
                </span>
                API Online
              </span>
            )}
            {health === "offline" && (
              <span className="flex items-center gap-1.5 text-red-500">
                <XCircle className="h-4 w-4" />
                API Offline
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex items-center">
        <div className="container py-20 md:py-32">
          <div className="max-w-3xl mx-auto text-center space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-4"
            >
              <div className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm text-muted-foreground">
                <Shield className="h-3.5 w-3.5" />
                AI-Powered Preventive Health
              </div>
              <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.1]">
                Know Your Heart Risk
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto">
                Get an AI-powered heart disease risk assessment with personalized explanations and lifestyle recommendations — in under 30 seconds.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              <Button
                size="lg"
                onClick={() => navigate("/assess")}
                className="h-12 px-8 text-base rounded-xl shadow-lg shadow-primary/20 active:scale-[0.97] transition-transform"
                disabled={health === "offline"}
              >
                Start Assessment
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              {health === "offline" && (
                <p className="text-sm text-red-500 mt-3">
                  API is offline — please start the backend server at localhost:8002
                </p>
              )}
            </motion.div>

            {/* Features */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-12"
            >
              {[
                { icon: Activity, title: "ML Risk Scoring", desc: "Stacking ensemble model trained on 2,400+ cardiac records with 94% AUC." },
                { icon: Brain, title: "AI Explanations", desc: "Gemini-powered plain-English explanations of your risk factors and next steps." },
                { icon: Shield, title: "Privacy First", desc: "No data stored. Your health information never leaves your browser session." },
              ].map((f, i) => (
                <div
                  key={f.title}
                  className="rounded-xl border bg-card p-6 text-left space-y-3 hover:shadow-md transition-shadow"
                >
                  <f.icon className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </main>

      {/* Disclaimer */}
      <div className="border-t bg-muted/30">
        <div className="container py-4">
          <p className="text-xs text-muted-foreground text-center max-w-2xl mx-auto leading-relaxed">
            ⚕️ {MEDICAL_DISCLAIMER}
          </p>
        </div>
      </div>

      <Footer />
    </div>
  );
}
