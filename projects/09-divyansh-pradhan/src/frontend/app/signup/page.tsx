"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast, ToastContainer } from "react-toastify";
import { motion, AnimatePresence } from "framer-motion";
import { FiUser, FiLock, FiCheckCircle, FiMail, FiSmartphone, FiArrowRight } from "react-icons/fi";
import "react-toastify/dist/ReactToastify.css";

export default function SignupPage() {
  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null); // State for the 2FA QR
  const router = useRouter();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("http://127.0.0.1:5000/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, email, password }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success("Account created securely!");
        setQrCode(data.qr_code); // Show the QR code screen
      } else {
        setError(data.error || "Signup failed");
      }
    } catch (err) {
      setError("Network error: Failed to connect to backend");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-10">
      <motion.div 
        className="max-w-md w-full"
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
      >
        <div className="text-center mb-10">
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 mb-2">
            Join FinSight AI
          </h1>
          <p className="text-gray-600 dark:text-gray-400 font-medium">Create your secure financial workspace.</p>
        </div>

        <div className="bg-white dark:bg-gray-800 shadow-2xl rounded-3xl p-8 border border-gray-100 dark:border-gray-700 relative overflow-hidden">
          <AnimatePresence mode="wait">
            {!qrCode ? (
              /* --- SIGNUP FORM --- */
              <motion.form 
                key="signup-form"
                onSubmit={handleSignup} className="space-y-5"
                initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 50 }}
              >
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">Choose User ID</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><FiUser className="text-gray-400" /></div>
                    <input type="text" value={userId} onChange={(e) => setUserId(e.target.value)} className="block w-full pl-11 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl focus:ring-indigo-500 focus:border-indigo-500 shadow-sm" placeholder="e.g., divyansh_14" required />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">Email Address</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><FiMail className="text-gray-400" /></div>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="block w-full pl-11 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl focus:ring-indigo-500 focus:border-indigo-500 shadow-sm" placeholder="you@example.com" required />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">Create Password</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><FiLock className="text-gray-400" /></div>
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="block w-full pl-11 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl focus:ring-indigo-500 focus:border-indigo-500 shadow-sm" placeholder="••••••••" required />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">Confirm Password</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><FiCheckCircle className="text-gray-400" /></div>
                    <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={`block w-full pl-11 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border ${confirmPassword && password !== confirmPassword ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'} text-gray-900 dark:text-white rounded-xl focus:ring-indigo-500 focus:border-indigo-500 shadow-sm`} placeholder="••••••••" required />
                  </div>
                </div>

                {error && <p className="text-red-500 text-sm font-semibold text-center bg-red-50 dark:bg-red-900/30 py-2 rounded-lg">{error}</p>}

                <div className="pt-4">
                  <button type="submit" disabled={isLoading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-bold shadow-lg transition-all disabled:opacity-70">
                    {isLoading ? "Securing Account..." : "Sign Up"}
                  </button>
                </div>
                <div className="text-center mt-4">
                  <p className="text-gray-600 text-sm">Already have an account? <button type="button" onClick={() => router.push("/login")} className="text-indigo-600 font-bold hover:underline">Log in</button></p>
                </div>
              </motion.form>
            ) : (
              /* --- QR CODE SETUP SCREEN --- */
              <motion.div 
                key="qr-screen" className="text-center space-y-6"
                initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }}
              >
                <div className="mx-auto w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                  <FiSmartphone size={32} />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Secure Your Account</h2>
                <p className="text-gray-600 dark:text-gray-400 text-sm px-4">
                  Scan this QR code with <strong>Google Authenticator</strong> or Apple Passwords to enable 2-Factor Authentication.
                </p>
                
                <div className="bg-white p-4 rounded-2xl inline-block shadow-md border border-gray-100">
                  <img src={qrCode} alt="2FA QR Code" className="w-48 h-48" />
                </div>

                <button onClick={() => router.push("/login")} className="w-full flex items-center justify-center gap-2 bg-gray-900 hover:bg-black text-white py-4 rounded-xl font-bold shadow-lg transition-all mt-6">
                  I've scanned it. Go to Login <FiArrowRight />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
      <ToastContainer position="bottom-right" autoClose={3000} />
    </div>
  );
}