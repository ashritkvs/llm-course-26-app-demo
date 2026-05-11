"use client";

import { useState } from "react";
import { CheckCircle, XCircle, MessageSquareQuote, Loader2, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface ContractorQuoteProps {
  requestId: string;
  quoteText: string | null;
  quoteConfidence: number | null;
  quoteReceivedAt: string | null;
  quoteStatus: string | null;
  status: string;
  landlordApproved: boolean | null;
}

export default function ContractorQuote({
  requestId,
  quoteText,
  quoteConfidence,
  quoteReceivedAt,
  quoteStatus,
  status,
  landlordApproved,
}: ContractorQuoteProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localStatus, setLocalStatus] = useState<"idle" | "accepted" | "declined">("idle");
  const supabase = createClient();

  const isAlreadyApproved =
    landlordApproved === true || status === "dispatched" || localStatus === "accepted";
  const isDeclined = localStatus === "declined";

  const handleAccept = async () => {
    setIsSubmitting(true);
    const { error } = await supabase
      .from("maintenance_requests")
      .update({
        landlord_approved: true,
        status: "dispatched",
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestId);

    setIsSubmitting(false);
    if (!error) setLocalStatus("accepted");
  };

  const handleDecline = async () => {
    setIsSubmitting(true);
    const existing = await supabase
      .from("maintenance_requests")
      .select("diagnosis")
      .eq("id", requestId)
      .single();

    const oldDiag =
      existing.data?.diagnosis &&
      typeof existing.data.diagnosis === "object" &&
      !Array.isArray(existing.data.diagnosis)
        ? (existing.data.diagnosis as Record<string, unknown>)
        : {};

    await supabase
      .from("maintenance_requests")
      .update({
        diagnosis: { ...oldDiag, quote_status: "declined" },
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestId);

    setIsSubmitting(false);
    setLocalStatus("declined");
  };

  if (!quoteText && quoteStatus !== "received") {
    if (quoteStatus === "requested" || quoteStatus === "mock_requested") {
      return (
        <div className="brutal-card p-6 bg-gray-50 border-gray-300 border-l-8 border-l-accent">
          <div className="flex items-center gap-3 mb-2">
            <Clock size={20} className="text-accent animate-pulse" />
            <h3 className="text-sm font-bold uppercase tracking-widest text-navy">
              Waiting for Contractor Response...
            </h3>
          </div>
          <p className="text-sm text-navy/70 font-medium">
            We&apos;ve reached out to the contractor (call or email). Their quote will show here as soon as we capture it.
          </p>
        </div>
      );
    }

    if (quoteStatus === "requested_no_capture") {
      return (
        <div className="brutal-card p-6 bg-warningbg border-warningborder border-l-8 border-l-warningborder">
          <div className="flex items-center gap-3 mb-2">
            <Clock size={20} className="text-warningborder" />
            <h3 className="text-sm font-bold uppercase tracking-widest text-warningborder">
              Call Worked, Speech Capture Is Off
            </h3>
          </div>
          <p className="text-sm text-navy/80 font-medium">
            Twilio reached the contractor, but this environment cannot receive the speech callback yet.
            Set APP_URL to a public HTTPS URL (ngrok or deployment) so spoken quotes can appear here.
          </p>
        </div>
      );
    }

    return null;
  }

  if (isAlreadyApproved) {
    return (
      <div className="brutal-card p-6 bg-successbg border-successborder border-l-8 border-l-successborder">
        <div className="flex items-center gap-3 mb-3">
          <CheckCircle className="text-successborder" size={24} />
          <h3 className="text-xl font-display font-bold text-success">QUOTE ACCEPTED</h3>
        </div>
        <div className="bg-white p-4 border-2 border-navy/10 mb-2">
          <p className="text-sm font-bold uppercase tracking-widest text-navy/50 mb-1">Contractor said:</p>
          <p className="text-navy font-bold text-lg italic">&quot;{quoteText}&quot;</p>
        </div>
        <p className="text-sm text-navy/70 font-medium">Work has been dispatched.</p>
      </div>
    );
  }

  if (isDeclined) {
    return (
      <div className="brutal-card p-6 bg-red-50 border-danger border-l-8 border-l-danger">
        <div className="flex items-center gap-3 mb-3">
          <XCircle className="text-danger" size={24} />
          <h3 className="text-xl font-display font-bold text-danger">QUOTE DECLINED</h3>
        </div>
        <div className="bg-white p-4 border-2 border-navy/10 mb-2">
          <p className="text-sm font-bold uppercase tracking-widest text-navy/50 mb-1">Contractor said:</p>
          <p className="text-navy font-bold text-lg italic">&quot;{quoteText}&quot;</p>
        </div>
      </div>
    );
  }

  const receivedTime = quoteReceivedAt
    ? new Date(quoteReceivedAt).toLocaleString()
    : null;

  return (
    <div className="brutal-card p-6 bg-warningbg border-warningborder border-l-8 border-l-accent">
      <h3 className="text-sm font-bold uppercase tracking-widest text-navy mb-4 flex items-center gap-2">
        <MessageSquareQuote size={16} className="text-accent" /> Contractor Quote Received
      </h3>

      <div className="bg-white p-4 border-2 border-navy/10 mb-4">
        <p className="text-sm font-bold uppercase tracking-widest text-navy/50 mb-1">Contractor said:</p>
        <p className="text-navy font-bold text-lg italic">&quot;{quoteText}&quot;</p>
        {quoteConfidence != null && (
          <p className="text-xs text-navy/40 mt-2">
            Speech confidence: {Math.round(quoteConfidence * 100)}%
          </p>
        )}
        {receivedTime && (
          <p className="text-xs text-navy/40 mt-1">Received: {receivedTime}</p>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <button
          onClick={handleAccept}
          disabled={isSubmitting}
          className="brutal-btn-primary w-full py-4 bg-success border-success flex items-center justify-center gap-2 hover:bg-success/90 text-white font-bold uppercase tracking-widest"
        >
          {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle size={18} />}
          ACCEPT QUOTE & DISPATCH
        </button>

        <button
          onClick={handleDecline}
          disabled={isSubmitting}
          className="brutal-btn-secondary w-full py-3 bg-white border-2 border-danger text-danger flex items-center justify-center gap-2 hover:bg-dangerbg shadow-[2px_2px_0_0_var(--danger)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none font-bold uppercase tracking-widest"
        >
          <XCircle size={18} />
          DECLINE QUOTE
        </button>
      </div>
    </div>
  );
}
