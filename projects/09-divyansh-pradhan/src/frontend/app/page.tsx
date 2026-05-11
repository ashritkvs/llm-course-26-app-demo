"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { FiLogOut, FiPieChart, FiMessageSquare, FiPlusCircle } from "react-icons/fi"

export default function Home() {
  const [userId, setUserId] = useState<string | null | undefined>(undefined)
  const router = useRouter()

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch("http://127.0.0.1:5000/current_user", {
          credentials: "include",
        })
        const data = await res.json()
        setUserId(data.user_id)
      } catch (err) {
        console.error("Error fetching current user:", err)
        setUserId(null)
      }
    }
    fetchUser()
  }, [])

  useEffect(() => {
    if (userId === null) {
      router.push("/login")
    }
  }, [userId, router])

  // GUARD 1: Still checking backend (Show Spinner)
  if (userId === undefined) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  // GUARD 2: Not logged in (Render nothing while Next.js redirects)
  if (userId === null) {
    return null; 
  }

  // GUARD 3: Successfully authenticated, render the dashboard
  const handleLogout = async () => {
    try {
      const res = await fetch("http://127.0.0.1:5000/logout", {
        method: "POST",
        credentials: "include",
      })
      if (res.ok) {
        setUserId(null)
      }
    } catch {
      alert("Logout failed")
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      {/* Header Section */}
      <div className="text-center mb-16">
        <motion.h1
          className="text-5xl font-extrabold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          Welcome to FinSight AI
        </motion.h1>

        <motion.p
          className="text-xl mb-6 text-gray-600 dark:text-gray-300 max-w-2xl mx-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          Your autonomous, multi-agent financial assistant. Transform unstructured data into actionable intelligence.
        </motion.p>

        <motion.div
          className="inline-flex items-center gap-4 bg-white dark:bg-gray-800 px-6 py-3 rounded-full shadow-sm border border-gray-100 dark:border-gray-700"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
        >
          <span className="text-gray-600 dark:text-gray-300">
            Active Session: <strong className="text-indigo-600 dark:text-indigo-400">{userId}</strong>
          </span>
          <div className="w-px h-4 bg-gray-300 dark:bg-gray-600"></div>
          <button 
            onClick={handleLogout} 
            className="flex items-center gap-2 text-red-500 hover:text-red-700 transition-colors font-medium"
          >
            <FiLogOut /> Log out
          </button>
        </motion.div>
      </div>

      {/* Feature Grid */}
      <motion.div
        className="grid grid-cols-1 md:grid-cols-3 gap-8"
        variants={{
          hidden: { opacity: 0 },
          show: {
            opacity: 1,
            transition: { staggerChildren: 0.15 },
          },
        }}
        initial="hidden"
        animate="show"
      >
        <FeatureCard 
          title="Agentic Expense Tracker" 
          description="Log expenses instantly using natural language. The AI automatically extracts dates, amounts, and categories." 
          link="/update-transaction" 
          icon={<FiPlusCircle className="w-8 h-8" />} 
          buttonText="Launch Tracker"
        />
        <FeatureCard 
          title="AI Financial Advisor" 
          description="Ask complex questions about your spending history. Powered by RAG and semantic vector memory." 
          link="/ask-question" 
          icon={<FiMessageSquare className="w-8 h-8" />} 
          buttonText="Ask the Agent"
        />
        <FeatureCard 
          title="Real-Time Dashboard" 
          description="Visualize your financial footprint with dynamic charts, burn rates, and automated KPI summaries." 
          link="/visualize-data" 
          icon={<FiPieChart className="w-8 h-8" />} 
          buttonText="View Dashboard"
        />
      </motion.div>
    </div>
  )
}

function FeatureCard({ title, description, link, icon, buttonText }: { title: string; description: string; link: string; icon: React.ReactNode; buttonText: string }) {
  return (
    <motion.div
      className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow border border-gray-100 dark:border-gray-700 flex flex-col h-full group"
      variants={{
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0 },
      }}
      whileHover={{ y: -5 }}
    >
      <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <h2 className="text-2xl font-bold mb-3 text-gray-900 dark:text-white">{title}</h2>
      <p className="text-gray-600 dark:text-gray-400 mb-8 flex-grow leading-relaxed">{description}</p>
      <Link 
        href={link} 
        className="block w-full text-center bg-gray-50 dark:bg-gray-700 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-500 text-indigo-600 dark:text-indigo-300 font-semibold py-3 px-6 rounded-xl transition-colors duration-300"
      >
        {buttonText}
      </Link>
    </motion.div>
  )
}