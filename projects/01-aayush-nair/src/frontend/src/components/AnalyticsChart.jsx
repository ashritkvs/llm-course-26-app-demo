import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
    LineChart, Line, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
    PieChart, Pie, AreaChart, Area, Legend,
} from 'recharts'

const COLORS = {
    primary: '#6366f1',
    secondary: '#8b5cf6',
    accent: '#a78bfa',
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
    info: '#3b82f6',
    grid: 'rgba(255,255,255,0.06)',
    text: '#94a3b8',
    textBright: '#e2e8f0',
}

const GRADIENT_COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c084fc', '#818cf8']

const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
        <div style={{
            background: 'rgba(17, 24, 39, 0.95)',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            borderRadius: '10px',
            padding: '0.75rem 1rem',
            fontSize: '0.85rem',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        }}>
            <p style={{ fontWeight: 700, marginBottom: '0.35rem', color: COLORS.textBright }}>{label}</p>
            {payload.map((p, i) => (
                <p key={i} style={{ color: p.color, margin: '2px 0' }}>
                    {p.name}: {typeof p.value === 'number'
                        ? (p.name.toLowerCase().includes('time') ? `${p.value.toFixed(1)}s` : `${(p.value * 100).toFixed(0)}%`)
                        : p.value}
                </p>
            ))}
        </div>
    )
}

// ============================================================
// 1. Accuracy Summary — Donut showing correct vs wrong
// ============================================================
export const AccuracySummary = ({ correct, wrong }) => {
    const total = correct + wrong
    if (total === 0) return <EmptyState message="No answers recorded yet" />

    const data = [
        { name: 'Correct', value: correct, color: COLORS.success },
        { name: 'Wrong', value: wrong, color: COLORS.error },
    ]

    return (
        <ResponsiveContainer width="100%" height={260}>
            <PieChart>
                <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={95}
                    paddingAngle={4}
                    dataKey="value"
                    stroke="none"
                >
                    {data.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                    ))}
                </Pie>
                <Tooltip
                    formatter={(value, name) => [`${value} (${((value / total) * 100).toFixed(0)}%)`, name]}
                    contentStyle={{
                        background: 'rgba(17,24,39,0.95)',
                        border: '1px solid rgba(99,102,241,0.25)',
                        borderRadius: '10px',
                        fontSize: '0.85rem',
                    }}
                />
                <Legend
                    wrapperStyle={{ fontSize: '0.85rem', color: COLORS.text }}
                    iconType="circle"
                />
            </PieChart>
        </ResponsiveContainer>
    )
}

// ============================================================
// 2. Weak Topics Bar Chart
// ============================================================
export const WeakTopicsChart = ({ data }) => {
    if (!data?.length) return <EmptyState message="No weak topics — great work!" icon="🎉" />

    const chartData = data.map(d => ({
        name: d.concept_tag.length > 18 ? d.concept_tag.slice(0, 17) + '…' : d.concept_tag,
        mastery: d.mastery_score,
        attempts: d.attempts,
    }))

    return (
        <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} horizontal={false} />
                <XAxis
                    type="number"
                    domain={[0, 1]}
                    tickFormatter={v => `${(v * 100).toFixed(0)}%`}
                    tick={{ fill: COLORS.text, fontSize: 12 }}
                    axisLine={{ stroke: COLORS.grid }}
                />
                <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fill: COLORS.text, fontSize: 12 }}
                    axisLine={{ stroke: COLORS.grid }}
                    width={120}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                    dataKey="mastery"
                    name="Mastery"
                    fill={COLORS.error}
                    radius={[0, 6, 6, 0]}
                    maxBarSize={28}
                    fillOpacity={0.8}
                />
            </BarChart>
        </ResponsiveContainer>
    )
}

// ============================================================
// 3. Strong Topics Bar Chart
// ============================================================
export const StrongTopicsChart = ({ data }) => {
    if (!data?.length) return <EmptyState message="Keep studying to build strengths!" icon="💪" />

    const chartData = data.map(d => ({
        name: d.concept_tag.length > 18 ? d.concept_tag.slice(0, 17) + '…' : d.concept_tag,
        mastery: d.mastery_score,
        attempts: d.attempts,
    }))

    return (
        <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} horizontal={false} />
                <XAxis
                    type="number"
                    domain={[0, 1]}
                    tickFormatter={v => `${(v * 100).toFixed(0)}%`}
                    tick={{ fill: COLORS.text, fontSize: 12 }}
                    axisLine={{ stroke: COLORS.grid }}
                />
                <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fill: COLORS.text, fontSize: 12 }}
                    axisLine={{ stroke: COLORS.grid }}
                    width={120}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                    dataKey="mastery"
                    name="Mastery"
                    fill={COLORS.success}
                    radius={[0, 6, 6, 0]}
                    maxBarSize={28}
                    fillOpacity={0.8}
                />
            </BarChart>
        </ResponsiveContainer>
    )
}

// ============================================================
// 4. Concept Mastery Radar Chart
// ============================================================
export const ConceptMasteryRadar = ({ data }) => {
    if (!data?.length) return <EmptyState message="Not enough concepts to visualize" />

    // Take top 8 concepts for readability
    const chartData = data.slice(0, 8).map(d => ({
        subject: d.concept_tag.length > 14 ? d.concept_tag.slice(0, 13) + '…' : d.concept_tag,
        mastery: d.mastery_score,
        fullMark: 1,
    }))

    return (
        <ResponsiveContainer width="100%" height={320}>
            <RadarChart data={chartData} cx="50%" cy="50%" outerRadius="75%">
                <PolarGrid stroke={COLORS.grid} />
                <PolarAngleAxis
                    dataKey="subject"
                    tick={{ fill: COLORS.text, fontSize: 11 }}
                />
                <PolarRadiusAxis
                    domain={[0, 1]}
                    tick={false}
                    axisLine={false}
                />
                <Radar
                    name="Mastery"
                    dataKey="mastery"
                    stroke={COLORS.primary}
                    fill={COLORS.primary}
                    fillOpacity={0.25}
                    strokeWidth={2}
                />
                <Tooltip
                    formatter={(value) => [`${(value * 100).toFixed(0)}%`, 'Mastery']}
                    contentStyle={{
                        background: 'rgba(17,24,39,0.95)',
                        border: '1px solid rgba(99,102,241,0.25)',
                        borderRadius: '10px',
                        fontSize: '0.85rem',
                    }}
                />
            </RadarChart>
        </ResponsiveContainer>
    )
}

// ============================================================
// 5. Difficulty Progression Chart (session accuracy over time)
// ============================================================
export const DifficultyProgressionChart = ({ data }) => {
    if (!data?.length) return <EmptyState message="Complete sessions to see your progression" />

    const chartData = data.map((d, i) => ({
        session: `S${i + 1}`,
        accuracy: d.accuracy,
        reasoning: d.avg_reasoning_score,
    }))

    return (
        <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <defs>
                    <linearGradient id="gradAccuracy" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={COLORS.primary} stopOpacity={0.4} />
                        <stop offset="100%" stopColor={COLORS.primary} stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="gradReasoning" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={COLORS.secondary} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={COLORS.secondary} stopOpacity={0.02} />
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
                <XAxis
                    dataKey="session"
                    tick={{ fill: COLORS.text, fontSize: 12 }}
                    axisLine={{ stroke: COLORS.grid }}
                />
                <YAxis
                    domain={[0, 1]}
                    tickFormatter={v => `${(v * 100).toFixed(0)}%`}
                    tick={{ fill: COLORS.text, fontSize: 12 }}
                    axisLine={{ stroke: COLORS.grid }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '0.85rem', color: COLORS.text }} />
                <Area
                    type="monotone"
                    dataKey="accuracy"
                    name="Accuracy"
                    stroke={COLORS.primary}
                    fill="url(#gradAccuracy)"
                    strokeWidth={2.5}
                    dot={{ fill: COLORS.primary, r: 4 }}
                    activeDot={{ r: 6, stroke: COLORS.primary, strokeWidth: 2 }}
                />
                <Area
                    type="monotone"
                    dataKey="reasoning"
                    name="Reasoning"
                    stroke={COLORS.secondary}
                    fill="url(#gradReasoning)"
                    strokeWidth={2}
                    dot={{ fill: COLORS.secondary, r: 3 }}
                    activeDot={{ r: 5, stroke: COLORS.secondary, strokeWidth: 2 }}
                />
            </AreaChart>
        </ResponsiveContainer>
    )
}

// ============================================================
// 6. Hint Usage Chart — bar showing usage rate per session
// ============================================================
export const HintUsageChart = ({ data }) => {
    if (!data?.length) return <EmptyState message="No hint usage data yet" />

    const chartData = data.map((d, i) => ({
        session: `S${i + 1}`,
        hintRate: d.hint_usage_rate || 0,
    }))

    return (
        <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
                <XAxis
                    dataKey="session"
                    tick={{ fill: COLORS.text, fontSize: 12 }}
                    axisLine={{ stroke: COLORS.grid }}
                />
                <YAxis
                    domain={[0, 1]}
                    tickFormatter={v => `${(v * 100).toFixed(0)}%`}
                    tick={{ fill: COLORS.text, fontSize: 12 }}
                    axisLine={{ stroke: COLORS.grid }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                    dataKey="hintRate"
                    name="Hint Usage"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={40}
                >
                    {chartData.map((_, i) => (
                        <Cell key={i} fill={GRADIENT_COLORS[i % GRADIENT_COLORS.length]} fillOpacity={0.8} />
                    ))}
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    )
}

// ============================================================
// Shared empty state
// ============================================================
const EmptyState = ({ message, icon = '📊' }) => (
    <div style={{
        textAlign: 'center',
        padding: '2.5rem 1rem',
        color: 'var(--text-muted)',
    }}>
        <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{icon}</p>
        <p style={{ fontSize: '0.9rem' }}>{message}</p>
    </div>
)

export default {
    AccuracySummary,
    WeakTopicsChart,
    StrongTopicsChart,
    ConceptMasteryRadar,
    DifficultyProgressionChart,
    HintUsageChart,
}
