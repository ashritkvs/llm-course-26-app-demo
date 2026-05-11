import { GoogleLogin } from '@react-oauth/google'

const LoginPage = ({ onLogin, apiBase }) => {
    const handleGoogleSuccess = async (credentialResponse) => {
        try {
            const res = await fetch(`${apiBase}/auth/google`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: credentialResponse.credential }),
            })

            if (!res.ok) throw new Error('Auth failed')

            const data = await res.json()
            onLogin(data)
        } catch (err) {
            console.error('Login error:', err)
            alert('Login failed. Please try again.')
        }
    }

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
        }}>
            <div className="card animate-fade-in-up" style={{
                textAlign: 'center',
                maxWidth: '440px',
                width: '100%',
                padding: '3rem 2.5rem',
            }}>
                {/* Logo / Title */}
                <div style={{ marginBottom: '0.5rem', fontSize: '3rem' }}>✦</div>
                <h1 style={{
                    background: 'var(--accent-gradient)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    marginBottom: '0.5rem',
                    fontSize: '2rem',
                }}>
                    Socratic Tutor
                </h1>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '2.5rem', lineHeight: 1.7 }}>
                    Adaptive quizzes with Socratic hints.<br />
                    Learn smarter, not harder.
                </p>

                {/* Divider */}
                <div style={{
                    height: '1px',
                    background: 'var(--border-glass)',
                    margin: '0 auto 2rem',
                    width: '60%',
                }} />

                {/* Google Login Button */}
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <GoogleLogin
                        onSuccess={handleGoogleSuccess}
                        onError={() => alert('Login failed')}
                        theme="filled_black"
                        size="large"
                        shape="pill"
                    />
                </div>

                {/* Footer note */}
                <p style={{
                    color: 'var(--text-muted)',
                    fontSize: '0.8rem',
                    marginTop: '2rem',
                }}>
                    Sign in with Google to get started
                </p>
            </div>
        </div>
    )
}

export default LoginPage
