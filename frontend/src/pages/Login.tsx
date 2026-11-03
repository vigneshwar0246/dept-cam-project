import { Activity, BarChart3, Eye, EyeOff, LogIn, ScanLine, ShieldCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'

export function Login({ onSuccess }: { onSuccess: (remember: boolean) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})
  const [notice, setNotice] = useState('')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const next: typeof errors = {}
    if (!/^\S+@\S+\.\S+$/.test(email)) next.email = 'Enter a valid email address.'
    if (password.length < 6) next.password = 'Password must contain at least 6 characters.'
    setErrors(next)
    setNotice('')
    if (Object.keys(next).length) return
    setLoading(true)
    window.setTimeout(() => onSuccess(remember), 650)
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
        <p>Sign in to access your department monitoring dashboard.</p>
        <form onSubmit={submit} noValidate>
          <label>Email Address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="administrator@college.edu" autoComplete="email" aria-invalid={Boolean(errors.email)} />{errors.email && <small className="login-error">{errors.email}</small>}</label>
          <label>Password<div className="password-input"><input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" autoComplete="current-password" aria-invalid={Boolean(errors.password)} /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div>{errors.password && <small className="login-error">{errors.password}</small>}</label>
          <div className="login-options"><label className="remember"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)}/>Remember Me</label><button type="button" onClick={() => setNotice('Password recovery requires backend integration. Contact your administrator.')}>Forgot Password?</button></div>
          {notice && <div className="login-notice" role="status">{notice}</div>}
          <button className="login-submit" disabled={loading}>{loading ? <><span className="button-loader"/>Signing in…</> : <><LogIn size={18}/>Sign In</>}</button>
        </form>
        <div className="login-authorized"><ShieldCheck size={15}/><span><strong>Authorized Personnel Only</strong><small>Department Occupancy Tracking System</small></span></div>
        <p className="demo-auth-note">Demo authentication — use any valid email and a password of 6+ characters.</p>
      </div>
    </section>
  </main>
}
