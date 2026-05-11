"use client";

import { useState, useEffect } from "react";
import { Bar, Doughnut, Radar, Line } from "react-chartjs-2";
import { motion } from "framer-motion";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
  RadialLinearScale,
  Filler,
} from "chart.js";
import { FiRefreshCw, FiTrendingUp, FiTrendingDown, FiDollarSign, FiList } from "react-icons/fi";

ChartJS.register(
  CategoryScale, LinearScale, BarElement, ArcElement, PointElement,
  LineElement, RadialLinearScale, Filler, Title, Tooltip, Legend
);

export default function VisualizeData() {
  const [chartData, setChartData] = useState<any>(null);
  const [doughnutData, setDoughnutData] = useState<any>(null);
  const [radarData, setRadarData] = useState<any>(null);
  const [lineData, setLineData] = useState<any>(null);
  const [summary, setSummary] = useState({ income: 0, expenses: 0, net: 0 });
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAndProcessData = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`http://127.0.0.1:5000/get_transactions`, {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) throw new Error("Failed to fetch transactions");

      const data = await response.json();
      const transactions = data.transactions;

      if (!transactions || transactions.length === 0) {
        setLoading(false);
        return;
      }

      // Sort transactions by date descending for the recent ledger
      const sortedAll = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setRecentTransactions(sortedAll.slice(0, 5)); // Grab top 5 most recent

      // --- 1. KPI Summary Math ---
      let totalIncome = 0;
      let totalExpenses = 0;

      transactions.forEach((t: any) => {
        const amt = parseFloat(t.amount);
        if (t.transaction_type === "credit") totalIncome += amt;
        if (t.transaction_type === "debit") totalExpenses += amt;
      });

      setSummary({
        income: totalIncome,
        expenses: totalExpenses,
        net: totalIncome - totalExpenses,
      });

      // --- 2. Filter for Expenses Only ---
      const expenses = transactions.filter((t: any) => t.transaction_type === "debit");
      const categories = [...new Set(expenses.map((item: any) => item.category))];
      
      const categoryAmounts = categories.map((cat) =>
        expenses
          .filter((item: any) => item.category === cat)
          .reduce((sum: number, item: any) => sum + parseFloat(item.amount), 0)
      );

      // --- 3. Build Charts ---
      const colorPalette = ["#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#f97316", "#eab308", "#22c55e", "#0ea5e9"];

      setChartData({
        labels: categories,
        datasets: [{
          label: "Spending by Category ($)",
          data: categoryAmounts,
          backgroundColor: "rgba(99, 102, 241, 0.8)",
          borderRadius: 6,
        }],
      });

      setDoughnutData({
        labels: categories,
        datasets: [{
          data: categoryAmounts,
          backgroundColor: colorPalette,
          borderWidth: 0,
          hoverOffset: 8,
        }],
      });

      setRadarData({
        labels: categories,
        datasets: [{
          label: "Spending Footprint",
          data: categoryAmounts,
          backgroundColor: "rgba(236, 72, 153, 0.2)",
          borderColor: "rgba(236, 72, 153, 1)",
          pointBackgroundColor: "rgba(236, 72, 153, 1)",
          fill: true,
        }],
      });

      // --- 4. FIXED: Chronological Line Chart ---
      const dateMap: Record<string, number> = {};
      expenses.forEach((item: any) => {
        // Use YYYY-MM-DD format as key to ensure accurate sorting
        const dateKey = new Date(item.date).toISOString().split('T')[0];
        dateMap[dateKey] = (dateMap[dateKey] || 0) + parseFloat(item.amount);
      });

      // Sort the keys chronologically
      const sortedDateKeys = Object.keys(dateMap).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
      
      // Convert back to readable labels (e.g., "Mar 12")
      const sortedLabels = sortedDateKeys.map(d => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }));
      const dailyAmounts = sortedDateKeys.map(d => dateMap[d]);

      setLineData({
        labels: sortedLabels,
        datasets: [{
          label: "Daily Expenses",
          data: dailyAmounts,
          borderColor: "#8b5cf6",
          backgroundColor: "rgba(139, 92, 246, 0.15)",
          tension: 0.4, // Smooth curves
          fill: true,
          pointRadius: 4,
          pointBackgroundColor: "#fff",
          pointBorderWidth: 2,
        }],
      });

    } catch (err: any) {
      setError("Unable to load financial data. Please ensure you are logged in.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAndProcessData();
  }, []);

  // --- Chart Configurations ---
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false } },
      y: { grid: { color: "rgba(107, 114, 128, 0.1)" }, beginAtZero: true },
    }
  };

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '75%', // Makes it a sleek thin ring
    plugins: { legend: { position: "right" as const } },
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[70vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-10">
        <div>
          <motion.h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            Financial Dashboard
          </motion.h1>
          <p className="text-gray-500 mt-1">Real-time visualization of your FAISS ledger</p>
        </div>
        <button onClick={fetchAndProcessData} className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-gray-800 text-indigo-600 font-semibold rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-all active:scale-95">
          <FiRefreshCw /> Refresh
        </button>
      </div>

      {error && <p className="text-red-500 bg-red-50 p-4 rounded-xl mb-6 font-medium border border-red-100">{error}</p>}

      {!chartData ? (
        <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="w-20 h-20 bg-gray-50 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400"><FiList size={32} /></div>
          <p className="text-xl font-bold text-gray-800 dark:text-gray-200">No transactions found</p>
          <p className="text-gray-500 mt-2">Log your first expense in the Tracker to unlock your dashboard.</p>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <motion.div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            
            <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-6">
              <div className="p-4 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-2xl shadow-sm">
                <FiTrendingUp size={28} />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1">Income</p>
                <p className="text-3xl font-extrabold text-gray-900 dark:text-white">${summary.income.toFixed(2)}</p>
              </div>
            </div>
            
            <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-6">
              <div className="p-4 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-2xl shadow-sm">
                <FiTrendingDown size={28} />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1">Expenses</p>
                <p className="text-3xl font-extrabold text-gray-900 dark:text-white">${summary.expenses.toFixed(2)}</p>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-6">
              <div className="p-4 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-2xl shadow-sm">
                <FiDollarSign size={28} />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1">Net Balance</p>
                <p className={`text-3xl font-extrabold ${summary.net >= 0 ? 'text-gray-900 dark:text-white' : 'text-red-600'}`}>
                  ${summary.net.toFixed(2)}
                </p>
              </div>
            </div>

          </motion.div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
            <motion.div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 h-[420px]" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}>
              <h2 className="text-lg font-extrabold mb-6 text-gray-800 dark:text-gray-200">Daily Cash Burn</h2>
              <div className="h-[300px]"><Line data={lineData} options={chartOptions as any} /></div>
            </motion.div>

            <motion.div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 h-[420px]" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }}>
              <h2 className="text-lg font-extrabold mb-6 text-gray-800 dark:text-gray-200">Expense Breakdown</h2>
              <div className="h-[300px] flex justify-center"><Doughnut data={doughnutData} options={pieOptions as any} /></div>
            </motion.div>

            <motion.div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 h-[420px]" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 }}>
              <h2 className="text-lg font-extrabold mb-6 text-gray-800 dark:text-gray-200">Category Footprint</h2>
              <div className="h-[300px] flex justify-center"><Radar data={radarData} options={{...chartOptions, plugins: { legend: {display: false} }, scales: { r: { ticks: { display: false } } }} as any} /></div>
            </motion.div>

            <motion.div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 h-[420px]" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 }}>
              <h2 className="text-lg font-extrabold mb-6 text-gray-800 dark:text-gray-200">Spending by Category</h2>
              <div className="h-[300px]"><Bar data={chartData} options={chartOptions as any} /></div>
            </motion.div>
          </div>

          {/* NEW: Recent Transactions Ledger */}
          <motion.div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
            <h2 className="text-lg font-extrabold mb-6 text-gray-800 dark:text-gray-200">Recent Transactions</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700 text-xs uppercase tracking-wider text-gray-400">
                    <th className="pb-4 font-semibold pl-2">Date</th>
                    <th className="pb-4 font-semibold">Description</th>
                    <th className="pb-4 font-semibold">Category</th>
                    <th className="pb-4 font-semibold text-right pr-2">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTransactions.map((t, idx) => (
                    <tr key={idx} className="border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="py-4 pl-2 text-sm text-gray-600 dark:text-gray-400">{new Date(t.date).toLocaleDateString()}</td>
                      <td className="py-4 font-medium text-gray-900 dark:text-gray-200">{t.description}</td>
                      <td className="py-4">
                        <span className="px-3 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full text-xs font-bold">
                          {t.category}
                        </span>
                      </td>
                      <td className={`py-4 text-right font-bold pr-2 ${t.transaction_type === 'credit' ? 'text-green-500' : 'text-gray-900 dark:text-white'}`}>
                        {t.transaction_type === 'credit' ? '+' : '-'}${parseFloat(t.amount).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </>
      )}
    </div>
  );
}