import { Activity, BarChart3, Eye, EyeOff, LogIn, ScanLine, ShieldCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'

export function Login({ onSuccess }: { onSuccess: (apiKey: string) => Promise<void> }) {
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<{ password?: string }>({})
  const [notice, setNotice] = useState('')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const next: typeof errors = {}
    if (!password.trim()) next.password = 'Enter the administrator API key.'
    setErrors(next)
    setNotice('')
    if (Object.keys(next).length) return
    setLoading(true)
    void onSuccess(password).catch(() => { setLoading(false); setErrors({ password: 'The API key was rejected or the backend is unavailable.' }) })
  }

  return <main className="login-page">
    <video className="login-video" autoPlay muted loop playsInline preload="auto" aria-hidden="true"><source src="/videos/login-background.mp4" type="video/mp4" /></video>
    <div className="login-video-overlay" />
    <section className="login-story" aria-label="Campus monitoring introduction">
      <div className="login-brand"><span><ShieldCheck size={20}/></span><strong>CAMPUS INTELLIGENCE</strong></div>
      <div className="login-message"><p>SECURE CAMPUS OPERATIONS</p><h1>Smarter Campus.<br/>Safer Spaces.</h1><h2>AI-powered department occupancy monitoring and real-time campus insights.</h2><ul><li><ScanLine size={18}/>Real-Time Person Detection</li><li><Activity size={18}/>Anonymous Entry &amp; Exit Tracking</li><li><BarChart3 size={18}/>Intelligent Occupancy Analytics</li></ul></div>
      <footer>DEPARTMENT OCCUPANCY TRACKING SYSTEM</footer>
    </section>
    <section className="login-panel">
      <div className="login-form-wrap">
        <div className="login-system-icon"><ShieldCheck size={24}/></div>
        <h2>Welcome Back</h2>
        <p>Enter the administrator API key to access protected camera and occupancy controls.</p>
        <form onSubmit={submit} noValidate>
          <label>Administrator API Key<div className="password-input"><input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter X-API-Key value" autoComplete="off" aria-invalid={Boolean(errors.password)} /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide API key' : 'Show API key'}>{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div>{errors.password && <small className="login-error">{errors.password}</small>}</label>
          <div className="login-options"><span className="remember">Kept in memory for this session only</span><button type="button" onClick={() => setNotice('Use the API_AUTH_SECRET configured on the FastAPI backend.')}>Where is my key?</button></div>
          {notice && <div className="login-notice" role="status">{notice}</div>}
          <button className="login-submit" disabled={loading}>{loading ? <><span className="button-loader"/>Signing in…</> : <><LogIn size={18}/>Sign In</>}</button>
        </form>
        <div className="login-authorized"><ShieldCheck size={15}/><span><strong>Authorized Personnel Only</strong><small>Department Occupancy Tracking System</small></span></div>
        <p className="demo-auth-note">This is API-key authorization, not a user-account login. The key is cleared on logout or refresh.</p>
      </div>
    </section>
  </main>
}
