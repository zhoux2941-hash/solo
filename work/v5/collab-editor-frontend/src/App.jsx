import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import useAuthStore from './stores/authStore'
import { authAPI } from './services/api'
import { toast } from 'react-toastify'

function LoginPage() {
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
      
      if (response.data && response.data.success) {
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

function DashboardPage() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [documents, setDocuments] = useState([])
  const [invitations, setInvitations] = useState([])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newDocTitle, setNewDocTitle] = useState('')

  useEffect(() => {
    loadDocuments()
  }, [])

  const loadDocuments = async () => {
    try {
      const response = await authAPI.getAllUsers().catch(() => ({ data: [] }))
      const docResponse = await fetch('/api/documents', {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      })
      
      if (docResponse.ok) {
        const docs = await docResponse.json()
        const ownedAndCollab = docs.filter(d => d.isOwner || d.isCollaborator)
        const invites = docs.filter(d => d.isInvited)
        setDocuments(ownedAndCollab)
        setInvitations(invites)
      }
    } catch (error) {
      console.log('Failed to load:', error)
    }
  }

  const handleCreateDocument = async (e) => {
    e.preventDefault()
    if (!newDocTitle.trim()) {
      toast.error('Please enter a title')
      return
    }
    
    try {
      const response = await fetch('/api/documents', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newDocTitle, language: 'javascript' })
      })
      
      if (response.ok) {
        setShowCreateModal(false)
        setNewDocTitle('')
        toast.success('Document created!')
        loadDocuments()
      }
    } catch (error) {
      toast.error('Failed to create document')
    }
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      })
    } catch (e) {
      console.log(e)
    }
    logout()
    navigate('/login')
    toast.success('Logged out successfully')
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.headerTitle}>Collaborative Editor</h1>
        <div style={styles.headerRight}>
          <div style={styles.userInfo}>
            <div style={{ ...styles.userColor, backgroundColor: user?.color || '#FF5733' }}></div>
            <span>{user?.displayName || user?.username}</span>
          </div>
          <button onClick={handleLogout} style={styles.logoutButton}>
            Logout
          </button>
        </div>
      </header>

      <main style={styles.main}>
        <div style={styles.actionsBar}>
          <button 
            onClick={() => setShowCreateModal(true)} 
            style={styles.createButton}
          >
            + New Document
          </button>
        </div>

        {invitations.length > 0 && (
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Pending Invitations</h2>
            {invitations.map(doc => (
              <div key={doc.id} style={styles.documentCard}>
                <h3>{doc.title}</h3>
                <button 
                  onClick={async () => {
                    try {
                      await fetch(`/api/documents/${doc.id}/accept`, {
                        method: 'POST',
                        credentials: 'include'
                      })
                      toast.success('Invitation accepted!')
                      loadDocuments()
                    } catch (e) {
                      toast.error('Failed')
                    }
                  }}
                  style={{ ...styles.button, marginRight: '10px' }}
                >
                  Accept
                </button>
                <button 
                  onClick={async () => {
                    try {
                      await fetch(`/api/documents/${doc.id}/decline`, {
                        method: 'POST',
                        credentials: 'include'
                      })
                      toast.success('Invitation declined')
                      loadDocuments()
                    } catch (e) {
                      toast.error('Failed')
                    }
                  }}
                  style={{ ...styles.button, backgroundColor: '#f14c4c' }}
                >
                  Decline
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>My Documents</h2>
          {documents.length === 0 ? (
            <p style={{ color: '#858585' }}>No documents yet. Create your first document!</p>
          ) : (
            <div style={styles.documentGrid}>
              {documents.map(doc => (
                <div 
                  key={doc.id} 
                  onClick={() => navigate(`/editor/${doc.id}`)}
                  style={styles.documentCard}
                >
                  <h3>{doc.title}</h3>
                  <p style={{ color: '#858585', fontSize: '13px' }}>
                    {doc.isOwner ? 'Owner' : 'Collaborator'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {showCreateModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h3 style={{ color: '#fff', marginBottom: '20px' }}>Create New Document</h3>
            <form onSubmit={handleCreateDocument}>
              <input
                type="text"
                value={newDocTitle}
                onChange={(e) => setNewDocTitle(e.target.value)}
                placeholder="Document title"
                style={styles.input}
                autoFocus
              />
              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button 
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{ ...styles.button, backgroundColor: 'transparent', border: '1px solid #3c3c3c' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  style={styles.button}
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function EditorPage() {
  return (
    <div style={{ 
      height: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      backgroundColor: '#1e1e1e',
      color: '#d4d4d4'
    }}>
      <h1>Editor Page (Coming Soon)</h1>
    </div>
  )
}

function App() {
  const { isAuthenticated, login, initFromStorage } = useAuthStore()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    initFromStorage()
    
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/me', {
          credentials: 'include'
        })
        
        if (response.ok) {
          const data = await response.json()
          if (data && data.id) {
            login(data)
          }
        }
      } catch (error) {
        console.log('Not logged in:', error.message)
      } finally {
        setChecked(true)
      }
    }
    
    checkAuth()
  }, [login, initFromStorage])

  if (!checked) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: '#1e1e1e',
        color: '#d4d4d4',
        fontSize: '18px'
      }}>
        Loading...
      </div>
    )
  }

  console.log('App render - isAuthenticated:', isAuthenticated)

  return (
    <Router>
      <Routes>
        <Route 
          path="/login" 
          element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />} 
        />
        <Route 
          path="/dashboard" 
          element={isAuthenticated ? <DashboardPage /> : <Navigate to="/login" replace />} 
        />
        <Route 
          path="/editor/:documentId" 
          element={isAuthenticated ? <EditorPage /> : <Navigate to="/login" replace />} 
        />
        <Route 
          path="/" 
          element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />} 
        />
      </Routes>
    </Router>
  )
}

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#1e1e1e',
  },
  header: {
    backgroundColor: '#252526',
    padding: '16px 32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid #3c3c3c',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: '20px',
    fontWeight: 600,
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    color: '#d4d4d4',
  },
  userColor: {
    width: '16px',
    height: '16px',
    borderRadius: '50%',
  },
  logoutButton: {
    padding: '8px 16px',
    backgroundColor: 'transparent',
    color: '#f14c4c',
    border: '1px solid #f14c4c',
    borderRadius: '4px',
    fontSize: '14px',
  },
  main: {
    padding: '32px',
    maxWidth: '1200px',
    margin: '0 auto',
  },
  actionsBar: {
    marginBottom: '32px',
  },
  createButton: {
    padding: '12px 24px',
    backgroundColor: '#0e639c',
    color: '#ffffff',
    fontSize: '15px',
    fontWeight: 600,
    borderRadius: '4px',
    border: 'none',
    cursor: 'pointer',
  },
  section: {
    marginBottom: '40px',
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: '18px',
    marginBottom: '20px',
  },
  documentGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '20px',
  },
  documentCard: {
    backgroundColor: '#252526',
    borderRadius: '6px',
    padding: '20px',
    border: '1px solid #3c3c3c',
    cursor: 'pointer',
  },
  card: {
    width: '100%',
    maxWidth: '450px',
    backgroundColor: '#252526',
    borderRadius: '8px',
    padding: '40px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
    margin: 'auto',
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
    width: '100%',
  },
  button: {
    padding: '14px',
    backgroundColor: '#0e639c',
    color: '#ffffff',
    fontSize: '16px',
    fontWeight: 600,
    borderRadius: '4px',
    border: 'none',
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
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    backgroundColor: '#252526',
    borderRadius: '8px',
    padding: '24px',
    width: '400px',
    border: '1px solid #3c3c3c',
  },
}

export default App
