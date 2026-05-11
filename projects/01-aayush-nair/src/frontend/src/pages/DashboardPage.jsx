import { useState, useEffect } from 'react'
import { createApiClient } from '../lib/api'
import {
    AccuracySummary,
    WeakTopicsChart,
    StrongTopicsChart,
    ConceptMasteryRadar,
    DifficultyProgressionChart,
    HintUsageChart,
} from '../components/AnalyticsChart'

const StatCard = ({ label, value, suffix = '', gradient = false }) => (
    <div className="card animate-fade-in-up" style={{ textAlign: 'center', padding: '1.5rem 1rem' }}>
        <p style={{
            color: 'var(--text-muted)',
            fontSize: '0.75rem',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: '0.5rem',
            fontWeight: 600,
        }}>
            {label}
        </p>
        <p style={{
            fontSize: '2.2rem',
            fontWeight: 800,
            lineHeight: 1,
            ...(gradient ? {
                background: 'var(--accent-gradient)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
            } : { color: 'var(--text-primary)' }),
        }}>
            {value}{suffix}
        </p>
    </div>
)

const ChartCard = ({ title, icon, children, span = false }) => (
    <div
        className="card animate-fade-in-up"
        style={{
            ...(span ? { gridColumn: '1 / -1' } : {}),
        }}
    >
        <h3 style={{
            marginBottom: '1rem',
            fontSize: '1rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
        }}>
            <span>{icon}</span> {title}
        </h3>
        {children}
    </div>
)

const DashboardPage = ({ user, apiBase, onUnauthorized }) => {
    const [analytics, setAnalytics] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchAnalytics()
    }, [])

    const fetchAnalytics = async () => {
        const api = createApiClient(user.session_token, onUnauthorized)
        try {
            const data = await api.get(`/analytics/${user.user_id}`)
            setAnalytics(data)
        } catch (err) {
            console.error('[Dashboard]', err)
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div className="container" style={{ textAlign: 'center', paddingTop: '4rem' }}>
                <div className="loading-spinner" />
                <p style={{ color: 'var(--text-secondary)', marginTop: '1rem' }}>Loading analytics...</p>
            </div>
        )
    }

    if (!analytics || analytics.message) {
        return (
            <div className="container" style={{ textAlign: 'center', paddingTop: '4rem' }}>
                <div className="card animate-fade-in-up" style={{ maxWidth: '500px', margin: '0 auto' }}>
                    <h2 style={{ marginBottom: '1rem' }}>📊 No Data Yet</h2>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        {analytics?.message || "Take your first quiz to see analytics."}
                    </p>
                </div>
            </div>
        )
    }

    const totalQuestions = analytics.correct_answers + analytics.wrong_answers

    return (
        <div className="container animate-fade-in">
            <h1 style={{ marginBottom: '0.4rem' }}>Your Dashboard</h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.95rem' }}>
                Track your learning progress, identify weaknesses, and celebrate strengths.
            </p>

            {/* ---- Summary Stats Row ---- */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: '1rem',
                marginBottom: '2rem',
            }}>
                <StatCard label="Accuracy" value={(analytics.accuracy * 100).toFixed(0)} suffix="%" gradient />
                <StatCard label="Correct" value={analytics.correct_answers} />
                <StatCard label="Wrong" value={analytics.wrong_answers} />
                <StatCard label="Reasoning" value={(analytics.avg_reasoning_score * 100).toFixed(0)} suffix="%" />
                <StatCard label="Hint Usage" value={(analytics.hint_usage_rate * 100).toFixed(0)} suffix="%" />
                {analytics.avg_response_time && (
                    <StatCard label="Avg Time" value={analytics.avg_response_time.toFixed(1)} suffix="s" />
                )}
            </div>

            {/* ---- Charts Grid ---- */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
                gap: '1.5rem',
                marginBottom: '2rem',
            }}>
                {/* 1. Accuracy Summary Donut */}
                <ChartCard title="Accuracy Breakdown" icon="🎯">
                    <AccuracySummary
                        correct={analytics.correct_answers}
                        wrong={analytics.wrong_answers}
                    />
                </ChartCard>

                {/* 4. Concept Mastery Radar */}
                <ChartCard title="Concept Mastery" icon="🧠">
                    <ConceptMasteryRadar data={analytics.concept_breakdown} />
                </ChartCard>

                {/* 2. Weak Topics */}
                <ChartCard title="Weak Topics" icon="🔴">
                    <WeakTopicsChart data={analytics.weak_topics} />
                </ChartCard>

                {/* 3. Strong Topics */}
                <ChartCard title="Strong Topics" icon="🟢">
                    <StrongTopicsChart data={analytics.strong_topics} />
                </ChartCard>

                {/* 5. Difficulty Progression */}
                <ChartCard title="Session Progression" icon="📈">
                    <DifficultyProgressionChart data={analytics.session_trend} />
                </ChartCard>

                {/* 6. Hint Usage */}
                <ChartCard title="Hint Usage by Session" icon="💡">
                    <HintUsageChart data={analytics.session_trend} />
                </ChartCard>
            </div>
        </div>
    )
}

export default DashboardPage
