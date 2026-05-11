"use client"

import { useState, useEffect, useRef } from "react"
import { motion } from "framer-motion"
import { useForm, type SubmitHandler } from "react-hook-form"
import DatePicker from "react-datepicker"
import "react-datepicker/dist/react-datepicker.css"
import { toast, ToastContainer } from "react-toastify"
import "react-toastify/dist/ReactToastify.css"
import { FiMic, FiMicOff, FiCamera, FiDollarSign, FiTag, FiAlignLeft, FiCalendar } from "react-icons/fi"

type FormInputs = {
  amount: number | ""
  type: "credit" | "debit" | ""
  category: string
  description: string
  date: Date | null
}

const categories = [
  "Food & Dining",
  "Transportation",
  "Entertainment",
  "Shopping",
  "Utilities",
  "Healthcare",
  "Education",
  "Travel",
  "Other",
]

export default function UpdateTransaction() {
  const [isLoading, setIsLoading] = useState(false)
  const [smartText, setSmartText] = useState("")
  const [isExtracting, setIsExtracting] = useState(false)
  
  // Voice & Image States
  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef<any>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<FormInputs>({
    // 🟡 FIX: Initialize everything as completely blank so nothing is selected by default
    defaultValues: { 
      type: "", 
      category: "",
      amount: "",
      description: "",
      date: null
    } 
  })

  const watchType = watch("type")
  const watchCategory = watch("category")

  // --- Initialize Web Speech API ---
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = false;
        recognitionRef.current.lang = 'en-US';

        recognitionRef.current.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setSmartText((prev) => prev + (prev ? " " : "") + transcript);
          setIsListening(false);
        };

        recognitionRef.current.onerror = () => setIsListening(false);
        recognitionRef.current.onend = () => setIsListening(false);
      }
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      toast.info("Voice input is not supported in this browser.");
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  // --- Handle Image Upload (OCR) ---
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      await processExtraction({ image: base64String });
      if (fileInputRef.current) fileInputRef.current.value = ""; // reset input
    };
    reader.readAsDataURL(file);
  };

  // --- Smart Extraction Engine (Handles both Text & Image) ---
  const processExtraction = async (payload: { text?: string, image?: string }) => {
    setIsExtracting(true)
    try {
      const todayString = new Date().toISOString()
      
      const response = await fetch("http://127.0.0.1:5000/extract_transaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ 
          ...payload,
          current_date: todayString 
        }),
      })

      const result = await response.json()

      if (response.ok) {
        // 🟡 FIX: Sanitize the AI output. If it says "income", "Credit", etc., force it to "credit". Otherwise "debit".
        const rawType = String(result.transaction_type || "debit").toLowerCase()
        const cleanType = (rawType.includes("credit") || rawType.includes("income") || rawType.includes("+")) ? "credit" : "debit"
        
        setValue("amount", result.amount, { shouldValidate: true })
        setValue("type", cleanType, { shouldValidate: true }) // Pass the cleaned type to the UI
        
        const matchedCategory = categories.includes(result.category) ? result.category : "Other"
        setValue("category", matchedCategory, { shouldValidate: true })
        setValue("description", result.description, { shouldValidate: true })
        
        if (result.date) {
          setValue("date", new Date(result.date), { shouldValidate: true })
        }
        
        toast.success(payload.image ? "📸 Receipt scanned successfully!" : "✨ Magic extraction complete!")
      } else {
        toast.error(result.error || "Failed to extract details.")
      }
    } catch (error) {
      toast.error("Network error while connecting to the AI agent.")
    } finally {
      setIsExtracting(false)
    }
  }

  const handleSmartExtractText = () => {
    if (!smartText.trim()) {
      toast.warning("Please enter a sentence to extract from.")
      return
    }
    processExtraction({ text: smartText })
  }

  // --- Form Submission ---
  const onSubmit: SubmitHandler<FormInputs> = async (data) => {
    setIsLoading(true)
    try {
      const response = await fetch("http://127.0.0.1:5000/update_user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          amount: data.amount,
          transaction_type: data.type,
          category: data.category,
          description: data.description,
          date: data.date?.toISOString(),
        }),
      })

      const result = await response.json()

      if (response.ok) {
        toast.success(result.message || "Transaction logged successfully!")
        reset({ type: "", category: "", amount: "", description: "", date: null }) // Reset to full blank
        setSmartText("") 
      } else {
        toast.error(result.error || "An error occurred. Please try again.")
      }
    } catch (error) {
      toast.error("Failed to connect to the server.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto py-12 px-4">
      <motion.div 
        className="text-center mb-10"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 mb-2">
          Agentic Expense Tracker
        </h1>
        <p className="text-gray-600 dark:text-gray-400">Log transactions instantly with AI, or enter them manually below.</p>
      </motion.div>

      <motion.div
        className="bg-white dark:bg-gray-800 shadow-2xl rounded-3xl overflow-hidden border border-gray-100 dark:border-gray-700"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.5 }}
      >
        {/* --- MULTIMODAL SMART INPUT SECTION --- */}
        <div className="p-8 bg-indigo-50/50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
          <label className="block text-indigo-900 dark:text-indigo-300 text-sm font-bold mb-4 uppercase tracking-wider">
            ✨ AI Multimodal Logger
          </label>
          
          <div className="flex flex-col sm:flex-row gap-3 relative items-center">
            {/* Voice Mic Button */}
            <button
              type="button"
              onClick={toggleListening}
              className={`p-4 rounded-xl transition-all shadow-sm ${
                isListening 
                  ? "bg-red-100 text-red-600 animate-pulse border border-red-200" 
                  : "bg-white dark:bg-gray-800 text-gray-500 hover:text-indigo-600 hover:border-indigo-300 border border-gray-200 dark:border-gray-600"
              }`}
              title="Speak Expense"
            >
              {isListening ? <FiMic size={20} /> : <FiMicOff size={20} />}
            </button>

            {/* Hidden File Input for Image Upload */}
            <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} className="hidden" />

            {/* OCR Camera/Upload Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-4 bg-white dark:bg-gray-800 text-gray-500 hover:text-indigo-600 hover:border-indigo-300 rounded-xl transition-all shadow-sm border border-gray-200 dark:border-gray-600"
              title="Upload Receipt Image"
              disabled={isExtracting}
            >
              <FiCamera size={20} />
            </button>

            {/* Text Input */}
            <input
              type="text"
              className="flex-grow bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl focus:ring-indigo-500 focus:border-indigo-500 block w-full p-4 shadow-sm"
              placeholder={isListening ? "Listening..." : 'e.g., "Spent $15 at Chipotle today"'}
              value={smartText}
              onChange={(e) => setSmartText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  handleSmartExtractText()
                }
              }}
            />
            
            {/* Extract Button */}
            <button
              type="button"
              onClick={handleSmartExtractText}
              disabled={isExtracting || (!smartText.trim() && !isExtracting)}
              className="px-6 py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold rounded-xl transition-colors shadow-md whitespace-nowrap"
            >
              {isExtracting ? "Parsing..." : "Auto-Fill"}
            </button>
          </div>
        </div>

        {/* --- MANUAL FORM SECTION --- */}
        <div className="p-8">
          <div className="flex items-center mb-8">
            <div className="flex-grow border-t border-gray-200 dark:border-gray-700"></div>
            <span className="flex-shrink-0 mx-4 text-gray-400 text-xs font-bold uppercase tracking-widest">Or review details manually</span>
            <div className="flex-grow border-t border-gray-200 dark:border-gray-700"></div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            
            {/* 🟡 FIX: Type Selection (No default selected) */}
            <div>
              <label className="block text-gray-500 dark:text-gray-400 text-xs font-bold mb-3 uppercase tracking-wider">Transaction Type</label>
              <div className="flex space-x-4">
                <label className={`flex-1 text-center py-4 rounded-xl border-2 cursor-pointer transition-all ${
                  watchType === "credit" 
                    ? "bg-green-50 border-green-500 text-green-700 dark:bg-green-900/20 dark:border-green-500 dark:text-green-400 shadow-sm" 
                    : "bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400"
                }`}>
                  <input type="radio" value="credit" className="hidden" {...register("type", { required: "Transaction type is required" })} />
                  <span className="font-semibold">Income (Credit)</span>
                </label>
                
                <label className={`flex-1 text-center py-4 rounded-xl border-2 cursor-pointer transition-all ${
                  watchType === "debit" 
                    ? "bg-red-50 border-red-500 text-red-700 dark:bg-red-900/20 dark:border-red-500 dark:text-red-400 shadow-sm" 
                    : "bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400"
                }`}>
                  <input type="radio" value="debit" className="hidden" {...register("type", { required: "Transaction type is required" })} />
                  <span className="font-semibold">Expense (Debit)</span>
                </label>
              </div>
              {errors.type && <p className="text-red-500 text-xs italic mt-2">{errors.type.message}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Amount */}
              <div>
                <label className="block text-gray-500 dark:text-gray-400 text-xs font-bold mb-2 uppercase tracking-wider">Amount</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <FiDollarSign className="text-gray-400" />
                  </div>
                  <input
                    className={`block w-full pl-11 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border ${errors.amount ? "border-red-500 focus:ring-red-500" : "border-gray-200 dark:border-gray-700 focus:ring-indigo-500 focus:border-indigo-500"} rounded-xl text-gray-900 dark:text-white shadow-sm`}
                    type="number"
                    step="0.01"
                    {...register("amount", {
                      required: "Amount is required",
                      min: { value: 0.01, message: "Amount must be positive" },
                    })}
                    placeholder="0.00"
                  />
                </div>
                {errors.amount && <p className="text-red-500 text-xs italic mt-1">{errors.amount.message}</p>}
              </div>

              {/* Date */}
              <div>
                <label className="block text-gray-500 dark:text-gray-400 text-xs font-bold mb-2 uppercase tracking-wider">Date</label>
                <div className="relative flex items-center w-full">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                    <FiCalendar className="text-gray-400" />
                  </div>
                  <DatePicker
                    selected={watch("date")}
                    onChange={(date: Date | null) => {
                      if (date) setValue("date", date, { shouldValidate: true })
                    }}
                    className={`block w-full pl-11 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border ${errors.date ? "border-red-500 focus:ring-red-500" : "border-gray-200 dark:border-gray-700 focus:ring-indigo-500 focus:border-indigo-500"} rounded-xl text-gray-900 dark:text-white shadow-sm`}
                    placeholderText="Select date"
                  />
                </div>
                {errors.date && <p className="text-red-500 text-xs italic mt-1">{errors.date.message}</p>}
              </div>
            </div>

            {/* 🟡 FIX: Category Dropdown (Defaults to disabled placeholder) */}
            <div>
              <label className="block text-gray-500 dark:text-gray-400 text-xs font-bold mb-2 uppercase tracking-wider">Category</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <FiTag className="text-gray-400" />
                </div>
                <select
                  className={`block w-full pl-11 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border ${errors.category ? "border-red-500 focus:ring-red-500" : "border-gray-200 dark:border-gray-700 focus:ring-indigo-500 focus:border-indigo-500"} rounded-xl shadow-sm appearance-none ${watchCategory === "" ? "text-gray-400" : "text-gray-900 dark:text-white"}`}
                  {...register("category", { required: "Category is required" })}
                  defaultValue=""
                >
                  <option value="" disabled hidden>Select a category...</option>
                  {categories.map((category) => (
                    <option key={category} value={category} className="text-gray-900 dark:text-white">{category}</option>
                  ))}
                </select>
              </div>
              {errors.category && <p className="text-red-500 text-xs italic mt-1">{errors.category.message}</p>}
            </div>

            {/* Description */}
            <div>
              <label className="block text-gray-500 dark:text-gray-400 text-xs font-bold mb-2 uppercase tracking-wider">Description</label>
              <div className="relative">
                <div className="absolute top-4 left-0 pl-4 pointer-events-none">
                  <FiAlignLeft className="text-gray-400" />
                </div>
                <textarea
                  className={`block w-full pl-11 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border ${errors.description ? "border-red-500 focus:ring-red-500" : "border-gray-200 dark:border-gray-700 focus:ring-indigo-500 focus:border-indigo-500"} rounded-xl text-gray-900 dark:text-white shadow-sm`}
                  rows={3}
                  {...register("description", { required: "Description is required" })}
                  placeholder="e.g., Lunch at Chipotle"
                ></textarea>
              </div>
              {errors.description && <p className="text-red-500 text-xs italic mt-1">{errors.description.message}</p>}
            </div>

            {/* 🟡 FIX: Dynamic Submit Button (Disabled until type is selected) */}
            <div className="pt-6">
              <motion.button
                className={`w-full py-4 text-lg font-bold text-white rounded-xl shadow-lg transition-colors ${
                  watchType === "credit" ? "bg-green-600 hover:bg-green-700 shadow-green-600/20" : 
                  watchType === "debit" ? "bg-red-600 hover:bg-red-700 shadow-red-600/20" :
                  "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20 opacity-50 cursor-not-allowed"
                }`}
                type="submit"
                disabled={isLoading || !watchType} // Disables if type isn't chosen
                whileTap={!isLoading && watchType ? { scale: 0.98 } : {}}
              >
                {isLoading ? "Saving to Database..." : watchType === "credit" ? "Save Income" : watchType === "debit" ? "Save Expense" : "Save Transaction"}
              </motion.button>
            </div>
          </form>
        </div>
      </motion.div>
      <ToastContainer position="bottom-right" autoClose={3000} />
    </div>
  )
}