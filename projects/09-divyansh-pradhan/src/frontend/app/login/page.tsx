"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast, ToastContainer } from "react-toastify";
import { motion, AnimatePresence } from "framer-motion";
import { FiUser, FiLock, FiArrowRight, FiShield, FiMail, FiArrowLeft } from "react-icons/fi";
import "react-toastify/dist/ReactToastify.css";

type LoginStep = "CREDENTIALS" | "TOTP" | "EMAIL_FALLBACK" | "FORGOT_PASSWORD" | "RESET_PASSWORD";

export default function LoginPage() {
  const [step, setStep] = useState<LoginStep>("CREDENTIALS");
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [authCode, setAuthCode] = useState(""); // Used for both TOTP and Email Code
  const [newPassword, setNewPassword] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  // --- 1. Validate Password ---
  const handleStep1 = async (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setIsLoading(true);
    try {
      const res = await fetch("http://127.0.0.1:5000/login_step1", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, password }),
      });
      const data = await res.json();
      if (res.ok) {
        setAuthCode(""); // 🟡 FIX: Wipe any old code
        setStep("TOTP");
      }
      else setError(data.error || "Invalid credentials");
    } catch { setError("Network error"); } 
    finally { setIsLoading(false); }
  };

  // --- 2. Verify Authenticator Code ---
  const handleVerifyTOTP = async (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setIsLoading(true);
    try {
      const res = await fetch("http://127.0.0.1:5000/verify_2fa", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ user_id: userId, code: authCode }),
      });
      if (res.ok) {
        toast.success("Login successful!");
        setTimeout(() => router.push("/"), 1000);
      } else setError("Invalid Authenticator code.");
    } finally { setIsLoading(false); }
  };

  // --- 3. Request Email Code (For Fallback OR Forgot Password) ---
  const handleRequestEmailCode = async (targetStep: "EMAIL_FALLBACK" | "RESET_PASSWORD", idToUse: string = userId) => {
    setError(""); setIsLoading(true);
    try {
      const res = await fetch("http://127.0.0.1:5000/request_email_fallback", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: idToUse }),
      });
      const data = await res.json();
      if (res.ok) {
        setAuthCode(""); // 🟡 FIX: Wipe any old code before switching to email verification
        setMaskedEmail(data.email);
        setUserId(data.user_id); // Ensure we have the exact ID if they typed an email
        setStep(targetStep);
        toast.info(`Security code sent to ${data.email}`);
      } else setError(data.error || "User not found.");
    } finally { setIsLoading(false); }
  };

  // --- 4. Login with Email Fallback Code ---
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setIsLoading(true);
    try {
      const res = await fetch("http://127.0.0.1:5000/verify_email_login", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ user_id: userId, code: authCode }),
      });
      if (res.ok) {
        toast.success("Verified! Logging you in...");
        setTimeout(() => router.push("/"), 1000);
      } else setError("Invalid or expired code.");
    } finally { setIsLoading(false); }
  };

  // --- 5. Reset Password Final Step ---
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setIsLoading(true);
    try {
      const res = await fetch("http://127.0.0.1:5000/reset_password_with_otp", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, code: authCode, new_password: newPassword }),
      });
      if (res.ok) {
        toast.success("Password reset! Please log in.");
        setStep("CREDENTIALS"); setPassword(""); setAuthCode(""); setNewPassword("");
      } else setError("Invalid or expired reset code.");
    } finally { setIsLoading(false); }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-10">
      <motion.div className="max-w-md w-full" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        
        <div className="text-center mb-10">
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 mb-2">FinSight AI</h1>
          <p className="text-gray-600 dark:text-gray-400 font-medium">
            {step === "CREDENTIALS" && "Welcome back to your financial copilot."}
            {step === "TOTP" && "Two-Factor Authentication."}
            {(step === "EMAIL_FALLBACK" || step === "RESET_PASSWORD") && `Secure Verification`}
            {step === "FORGOT_PASSWORD" && "Account Recovery."}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 shadow-2xl rounded-3xl p-8 border border-gray-100 dark:border-gray-700 relative overflow-hidden">
          <AnimatePresence mode="wait">
            
            {/* STEP 1: CREDENTIALS */}
            {step === "CREDENTIALS" && (
              <motion.form key="step1" onSubmit={handleStep1} className="space-y-6" initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 50 }}>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase">User ID</label>
                  <div className="relative"><FiUser className="absolute left-4 top-4 text-gray-400" />
                    <input type="text" value={userId} onChange={(e) => setUserId(e.target.value)} className="w-full pl-11 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl" required />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-bold text-gray-500 uppercase">Password</label>
                    <button type="button" onClick={() => { setStep("FORGOT_PASSWORD"); setError(""); setUserId(""); }} className="text-xs font-bold text-indigo-600 hover:underline">Forgot password?</button>
                  </div>
                  <div className="relative"><FiLock className="absolute left-4 top-4 text-gray-400" />
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-11 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl" required />
                  </div>
                </div>
                {error && <p className="text-red-500 text-sm text-center">{error}</p>}
                <button type="submit" disabled={isLoading} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold">{isLoading ? "Checking..." : "Continue"}</button>
                <div className="text-center mt-4"><p className="text-sm text-gray-500">Don't have an account? <button type="button" onClick={() => router.push("/signup")} className="text-indigo-600 font-bold hover:underline">Sign up</button></p></div>
              </motion.form>
            )}

            {/* STEP 2: AUTHENTICATOR APP */}
            {step === "TOTP" && (
              <motion.form key="step2" onSubmit={handleVerifyTOTP} className="space-y-6 text-center" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}>
                <div className="mx-auto w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-4"><FiShield size={24} /></div>
                <h3 className="font-bold text-lg text-gray-900 dark:text-white">Enter Authenticator Code</h3>
                <p className="text-sm text-gray-500">Open Google Authenticator and enter the 6-digit code for {userId}.</p>
                <input type="text" maxLength={6} value={authCode} onChange={(e) => setAuthCode(e.target.value)} autoComplete="one-time-code" className="w-full py-4 text-center text-2xl tracking-[0.5em] font-bold bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl" placeholder="000000" required autoFocus />
                {error && <p className="text-red-500 text-sm">{error}</p>}
                <button type="submit" disabled={isLoading || authCode.length !== 6} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold">Verify & Login</button>
                <button type="button" onClick={() => handleRequestEmailCode("EMAIL_FALLBACK")} className="text-sm text-indigo-600 font-bold mt-4 hover:underline">Try another way (Send Email)</button>
              </motion.form>
            )}

            {/* FORGOT PASSWORD REQUEST */}
            {step === "FORGOT_PASSWORD" && (
              <motion.form key="forgot" onSubmit={(e) => { e.preventDefault(); handleRequestEmailCode("RESET_PASSWORD"); }} className="space-y-6" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}>
                <p className="text-sm text-gray-500">Enter your User ID or Email Address to receive a recovery code.</p>
                <div className="relative"><FiUser className="absolute left-4 top-4 text-gray-400" />
                  <input type="text" value={userId} onChange={(e) => setUserId(e.target.value)} className="w-full pl-11 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl" placeholder="User ID or Email" required />
                </div>
                {error && <p className="text-red-500 text-sm text-center">{error}</p>}
                <button type="submit" disabled={isLoading} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold">{isLoading ? "Sending..." : "Send Recovery Code"}</button>
                <button type="button" onClick={() => setStep("CREDENTIALS")} className="w-full text-sm text-gray-500 font-bold mt-4 hover:underline flex justify-center items-center gap-2"><FiArrowLeft/> Back to Login</button>
              </motion.form>
            )}

            {/* EMAIL FALLBACK & RESET PASSWORD VERIFICATION */}
            {(step === "EMAIL_FALLBACK" || step === "RESET_PASSWORD") && (
              <motion.form key="email_verify" onSubmit={step === "EMAIL_FALLBACK" ? handleEmailLogin : handleResetPassword} className="space-y-6 text-center" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}>
                <div className="mx-auto w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4"><FiMail size={24} /></div>
                <h3 className="font-bold text-lg text-gray-900 dark:text-white">Check Your Email</h3>
                <p className="text-sm text-gray-500">We sent a 6-digit code to <strong>{maskedEmail}</strong>.</p>
                <input type="text" maxLength={6} value={authCode} onChange={(e) => setAuthCode(e.target.value)} autoComplete="one-time-code" className="w-full py-4 text-center text-2xl tracking-[0.5em] font-bold bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl" placeholder="000000" required autoFocus />
                
                {/* Only show New Password input if they are doing a full reset */}
                {step === "RESET_PASSWORD" && (
                  <div className="text-left mt-4">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">New Password</label>
                    <div className="relative"><FiLock className="absolute left-4 top-4 text-gray-400" />
                      <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full pl-11 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl" placeholder="••••••••" required />
                    </div>
                  </div>
                )}

                {error && <p className="text-red-500 text-sm">{error}</p>}
                <button type="submit" disabled={isLoading || authCode.length !== 6 || (step === "RESET_PASSWORD" && !newPassword)} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold mt-4">
                  {isLoading ? "Verifying..." : (step === "EMAIL_FALLBACK" ? "Verify & Login" : "Reset Password")}
                </button>
                <button type="button" onClick={() => setStep("CREDENTIALS")} className="text-sm text-gray-500 font-bold mt-4 hover:underline">Cancel</button>
              </motion.form>
            )}

          </AnimatePresence>
        </div>
      </motion.div>
      <ToastContainer position="bottom-right" autoClose={3000} />
    </div>
  );
}