import { useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import QuizPage from './pages/QuizPage'
import DashboardPage from './pages/DashboardPage'

const API_BASE = 'http://localhost:8000'

function App() {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('socratic_user')
    return stored ? JSON.parse(stored) : null
  })

  const handleLogin = (userData) => {
    setUser(userData)
    localStorage.setItem('socratic_user', JSON.stringify(userData))
  }

  const handleLogout = () => {
    setUser(null)
    localStorage.removeItem('socratic_user')
  }

  /**
   * Called by any API client that receives a 401.
   * Clears session and redirects to login.
   */
  const handleUnauthorized = () => {
    console.warn('[App] Session expired — logging out')
    handleLogout()
    // Replace to prevent going "back" to a protected page
    window.location.replace('/')
  }

  if (!user) {
    return <LoginPage onLogin={handleLogin} apiBase={API_BASE} />
  }

  return (
    <Router>
      {/* Navigation Bar */}
      <nav className="navbar">
        <span className="navbar-brand">✦ Socratic Tutor</span>
        <div className="navbar-links">
          <Link to="/quiz" className="btn btn-ghost">Quiz</Link>
          <Link to="/dashboard" className="btn btn-ghost">Dashboard</Link>
          {user.avatar_url && (
            <img src={user.avatar_url} alt="" className="navbar-avatar" />
          )}
          <button className="btn btn-ghost" onClick={handleLogout}>Logout</button>
        </div>
      </nav>

      {/* Routes */}
      <Routes>
        <Route path="/quiz" element={
          <QuizPage
            user={user}
            apiBase={API_BASE}
            onUnauthorized={handleUnauthorized}
          />
        } />
        <Route path="/dashboard" element={
          <DashboardPage
            user={user}
            apiBase={API_BASE}
            onUnauthorized={handleUnauthorized}
          />
        } />
        <Route path="*" element={<Navigate to="/quiz" replace />} />
      </Routes>
    </Router>
  )
}

export default App
