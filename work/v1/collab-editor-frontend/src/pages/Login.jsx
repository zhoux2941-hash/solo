import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authAPI } from '../services/api'
import useAuthStore from '../stores/authStore'
import { toast } from 'react-toastify'

const Login = () => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!username || !password) {
      toast.error('Please enter username and password')
      return
    }

    setLoading(true)
    
    try {
      const response = await authAPI.login(username, password)
      
      if (response.data.success) {
        login(response.data.user)
        toast.success('Login successful!')
        navigate('/dashboard')
      }
    } catch (error) {
      const message = error.response?.data?.error || 'Login failed'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h1 style={styles.title}>Collaborative Code Editor</h1>
          <p style={styles.subtitle}>Real-time JavaScript collaborative editing</p>
        </div>
        
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={styles.input}
              placeholder="Enter your username"
              disabled={loading}
            />
          </div>
          
          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              placeholder="Enter your password"
              disabled={loading}
            />
          </div>
          
          <button 
            type="submit" 
            style={styles.button}
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        
        <div style={styles.hint}>
          <p style={styles.hintTitle}>Demo Users:</p>
          <div style={styles.hintList}>
            <p><strong>alice</strong> / alice123</p>
            <p><strong>bob</strong> / bob123</p>
            <p><strong>charlie</strong> / charlie123</p>
            <p><strong>diana</strong> / diana123</p>
          </div>
        </div>
      </div>
    </div>
  )
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1e1e1e',
    padding: '20px',
  },
  card: {
    width: '100%',
    maxWidth: '450px',
    backgroundColor: '#252526',
    borderRadius: '8px',
    padding: '40px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
  },
  header: {
    textAlign: 'center',
    marginBottom: '40px',
  },
  title: {
    color: '#ffffff',
    fontSize: '28px',
    marginBottom: '8px',
  },
  subtitle: {
    color: '#858585',
    fontSize: '14px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    color: '#d4d4d4',
    fontSize: '14px',
    fontWeight: 500,
  },
  input: {
    padding: '12px 16px',
    backgroundColor: '#3c3c3c',
    border: '1px solid #3c3c3c',
    borderRadius: '4px',
    color: '#d4d4d4',
    fontSize: '14px',
    outline: 'none',
  },
  button: {
    padding: '14px',
    backgroundColor: '#0e639c',
    color: '#ffffff',
    fontSize: '16px',
    fontWeight: 600,
    borderRadius: '4px',
    cursor: 'pointer',
  },
  hint: {
    marginTop: '30px',
    padding: '20px',
    backgroundColor: '#2d2d2d',
    borderRadius: '4px',
  },
  hintTitle: {
    color: '#d7ba7d',
    fontSize: '13px',
    marginBottom: '10px',
    fontWeight: 600,
  },
  hintList: {
    color: '#858585',
    fontSize: '13px',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '8px',
  },
}

export default Login
