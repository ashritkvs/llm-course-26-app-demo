"use client";

import { useState, useRef, ChangeEvent } from "react";
import { Camera, RefreshCw, AlertTriangle, UploadCloud } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface PhotoCaptureProps {
  onCapture: (file: File) => void;
}

export default function PhotoCapture({ onCapture }: PhotoCaptureProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setIsProcessing(true);

    try {
      // 1. Validate File Size & Type
      if (file.size > 10 * 1024 * 1024) {
        throw new Error("File exceeds 10MB limit. Please upload a smaller photo.");
      }
      
      const validTypes = ["image/jpeg", "image/png", "image/webp"];
      if (!validTypes.includes(file.type)) {
        throw new Error("Only JPEG, PNG, or WebP formats are supported.");
      }

      // 2. Validate Resolution & Render Preview
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error("Failed to read image."));
        img.src = objectUrl;
      });

      if (img.width < 200 || img.height < 200) {
        URL.revokeObjectURL(objectUrl);
        throw new Error("Image resolution must be at least 200x200px.");
      }

      // 3. Compress if > 5MB
      let finalFile = file;
      if (file.size > 5 * 1024 * 1024) {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Could not create canvas context");

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const blob = await new Promise<Blob | null>((resolve) => 
          canvas.toBlob(resolve, "image/jpeg", 0.8)
        );

        if (blob) {
          finalFile = new File([blob], file.name.replace(/\.[^/.]+$/, ".jpg"), {
            type: "image/jpeg",
          });
        }
      }

      setPreview(URL.createObjectURL(finalFile));
      onCapture(finalFile);

    } catch (err: any) {
      setError(err.message || "An unknown error occurred.");
    } finally {
      setIsProcessing(false);
      // Reset input so the same file could be selected again if needed
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRetake = () => {
    setPreview(null);
    setError(null);
  };

  return (
    <div className="w-full flex-shrink-0">
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
      />

      {error && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 bg-[#FEF9E7] border-2 border-warning p-3 flex items-start gap-3 shadow-[4px_4px_0px_0px_var(--warning)]"
        >
          <AlertTriangle className="text-warning shrink-0" size={20} />
          <p className="text-sm font-bold text-navy">{error}</p>
        </motion.div>
      )}

      <AnimatePresence mode="wait">
        {!preview ? (
          <motion.button
            key="empty-state"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
            className="w-full h-64 md:h-80 flex flex-col items-center justify-center gap-4 bg-white border-4 border-dashed border-navy border-opacity-50 hover:border-accent hover:border-solid hover:bg-[#FFF5F0] transition-all duration-200 group relative"
          >
            {isProcessing ? (
              <RefreshCw className="animate-spin text-navy" size={48} />
            ) : (
              <>
                <div className="p-4 bg-navy text-white rounded-full group-hover:bg-accent group-hover:scale-110 transition-transform">
                  <Camera size={32} />
                </div>
                <div className="text-center font-bold text-navy space-y-1">
                  <span className="block text-lg font-display uppercase tracking-wider">Tap to Capture Issue</span>
                  <span className="block text-sm opacity-60">or click to upload file (Max 10MB)</span>
                </div>
              </>
            )}
          </motion.button>
        ) : (
          <motion.div
            key="preview-state"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="brutal-card p-2 relative overflow-hidden group"
          >
            <div className="relative w-full aspect-[4/3] bg-gray-100 border border-navy">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src={preview} 
                alt="Maintenance Issue Preview" 
                className="w-full h-full object-cover"
              />
              
              <div className="absolute inset-0 bg-navy/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                <button
                  onClick={handleRetake}
                  className="brutal-btn-secondary px-6 py-3 flex items-center gap-2 text-sm"
                >
                  <RefreshCw size={16} />
                  Retake Photo
                </button>
              </div>
            </div>
            
            <div className="absolute top-4 left-4 right-4 flex justify-between items-center pointer-events-none">
              <span className="bg-success text-white px-3 py-1 font-bold text-xs border-2 border-navy uppercase tracking-widest shadow-[2px_2px_0px_0px_var(--navy)]">
                Photo Captured
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
