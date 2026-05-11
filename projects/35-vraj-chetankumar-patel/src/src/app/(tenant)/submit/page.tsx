"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import PhotoCapture from "@/components/PhotoCapture";
import { AlertCircle, FileText, Send, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

export default function SubmitRequestPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();

  const [units, setUnits] = useState<{ id: string; unit_label: string }[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<string>("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUnits() {
      if (!user?.id) return;

      const response = await fetch("/api/units", { method: "GET" });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error || "Failed to fetch units");
        return;
      }

      const fetchedUnits = payload.units as { id: string; unit_label: string }[];
      if (fetchedUnits && fetchedUnits.length > 0) {
        setUnits(fetchedUnits);
        setSelectedUnit(fetchedUnits[0].id);
      } else {
        setUnits([]);
        setSelectedUnit("");
      }
    }
    if (isLoaded) fetchUnits();
  }, [user?.id, isLoaded]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!photo || !user?.id || !selectedUnit) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Send multipart form to the backend orchestrator route.
      // Backend handles storage upload + DB insert + AI pipeline trigger.
      const formData = new FormData();
      formData.append("photo", photo);
      formData.append("unit_id", selectedUnit);
      formData.append("tenant_id", user.id);
      formData.append("description", description);

      const response = await fetch("/api/requests", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to submit request to API.");
      }

      const result = await response.json();
      
      // Redirect to detail page where realtime updates render diagnosis/contractors.
      router.push(`/requests/${result.requestId}`);

    } catch (err: any) {
      setError(err.message || "An unexpected error occurred during submission.");
      setIsSubmitting(false);
    }
  };

  if (!isLoaded) return <div className="p-8 text-navy font-display font-bold">LOADING...</div>;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-xl mx-auto space-y-8"
    >
      <div>
        <h1 className="text-3xl font-display font-bold uppercase tracking-tight text-navy mb-2">
          New Maintenance Request
        </h1>
        <p className="text-navy/70 border-l-4 border-accent pl-4 py-1 font-bold">
          Submit an issue with a photo to get an instant AI diagnosis and contractor recommendation.
        </p>
      </div>

      {error && (
        <div className="bg-[#FEF9E7] border-2 border-warning p-4 hazard-border">
          <div className="bg-white p-3 border-2 border-navy flex items-start gap-3">
            <AlertCircle className="text-warning shrink-0" />
            <span className="font-bold text-navy text-sm uppercase">{error}</span>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <label className="block text-sm uppercase font-bold text-navy tracking-widest">
            1. Capture Issue <span className="text-accent">*</span>
          </label>
          <PhotoCapture onCapture={(file) => setPhoto(file)} />
        </div>

        <div className="brutal-card p-6 space-y-6">
          <div className="space-y-2">
            <label className="block text-sm uppercase font-bold text-navy tracking-widest">
              2. Select Unit <span className="text-accent">*</span>
            </label>
            <select 
              value={selectedUnit}
              onChange={(e) => setSelectedUnit(e.target.value)}
              className="w-full bg-background border-2 border-navy p-3 font-bold text-navy focus:outline-none focus:border-accent shadow-[2px_2px_0px_0px_var(--navy)]"
              disabled={units.length === 0}
            >
              <option value="" disabled>Select your unit...</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>{u.unit_label}</option>
              ))}
            </select>
            {units.length === 0 && (
              <p className="text-xs text-danger font-bold uppercase tracking-wide">
                No unit linked to your account yet. Ask the admin to seed `units.tenant_id`
                with your Clerk user ID.
              </p>
            )}
          </div>

          <div className="space-y-2 cursor-text">
            <div className="flex justify-between items-end">
              <label className="block text-sm uppercase font-bold text-navy tracking-widest">
                3. Description <span className="text-navy/50 tracking-normal capitalize font-normal">(Optional)</span>
              </label>
              <span className={`text-xs font-bold ${description.length > 500 ? "text-danger" : "text-navy/50"}`}>
                {description.length}/500
              </span>
            </div>
            <div className="relative border-2 border-navy shadow-[2px_2px_0px_0px_var(--navy)] bg-white focus-within:border-accent focus-within:shadow-[2px_2px_0px_0px_var(--accent)] transition-all">
              <div className="absolute top-3 left-3 text-navy/30">
                <FileText size={18} />
              </div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                placeholder="Describe the issue in your own words..."
                className="w-full min-h-[120px] p-3 pl-10 bg-transparent resize-y focus:outline-none text-navy"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={!photo || isSubmitting || !selectedUnit}
          className="w-full brutal-btn-primary py-4 flex items-center justify-center gap-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="animate-spin" />
              PROCESSING...
            </>
          ) : (
            <>
              <Send />
              SUBMIT REPORT
            </>
          )}
        </button>
      </form>
    </motion.div>
  );
}
