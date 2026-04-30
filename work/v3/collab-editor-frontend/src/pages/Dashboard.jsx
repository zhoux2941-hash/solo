import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '../stores/authStore'
import { documentAPI, authAPI } from '../services/api'
import { toast } from 'react-toastify'

const Dashboard = () => {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [documents, setDocuments] = useState([])
  const [invitations, setInvitations] = useState([])
  const [allUsers, setAllUsers] = useState([])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [selectedDocument, setSelectedDocument] = useState(null)
  const [newDocTitle, setNewDocTitle] = useState('')
  const [selectedUser, setSelectedUser] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadDocuments()
    loadAllUsers()
  }, [])

  const loadDocuments = async () => {
    try {
      const response = await documentAPI.getDocuments()
      const docs = response.data
      
      const ownedAndCollab = docs.filter(d => d.isOwner || d.isCollaborator)
      const invites = docs.filter(d => d.isInvited)
      
      setDocuments(ownedAndCollab)
      setInvitations(invites)
    } catch (error) {
      toast.error('Failed to load documents')
    }
  }

  const loadAllUsers = async () => {
    try {
      const response = await authAPI.getAllUsers()
      setAllUsers(response.data.filter(u => u.id !== user.id))
    } catch (error) {
      console.error('Failed to load users')
    }
  }

  const handleCreateDocument = async (e) => {
    e.preventDefault()
    if (!newDocTitle.trim()) {
      toast.error('Please enter a title')
      return
    }
    
    setLoading(true)
    try {
      const response = await documentAPI.createDocument(newDocTitle)
      setShowCreateModal(false)
      setNewDocTitle('')
      toast.success('Document created!')
      loadDocuments()
    } catch (error) {
      toast.error('Failed to create document')
    } finally {
      setLoading(false)
    }
  }

  const handleInviteUser = async (e) => {
    e.preventDefault()
    if (!selectedUser) {
      toast.error('Please select a user')
      return
    }
    
    setLoading(true)
    try {
      await documentAPI.inviteUser(selectedDocument.id, selectedUser)
      setShowInviteModal(false)
      setSelectedUser('')
      setSelectedDocument(null)
      toast.success('Invitation sent!')
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to invite user')
    } finally {
      setLoading(false)
    }
  }

  const handleAcceptInvitation = async (docId) => {
    try {
      await documentAPI.acceptInvitation(docId)
      toast.success('Invitation accepted!')
      loadDocuments()
    } catch (error) {
      toast.error('Failed to accept invitation')
    }
  }

  const handleDeclineInvitation = async (docId) => {
    try {
      await documentAPI.declineInvitation(docId)
      toast.success('Invitation declined')
      loadDocuments()
    } catch (error) {
      toast.error('Failed to decline invitation')
    }
  }

  const handleLogout = async () => {
    try {
      await authAPI.logout()
      logout()
      navigate('/login')
      toast.success('Logged out successfully')
    } catch (error) {
      toast.error('Logout failed')
    }
  }

  const openEditor = (docId) => {
    navigate(`/editor/${docId}`)
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.headerTitle}>Collaborative Editor</h1>
        <div style={styles.headerRight}>
          <div style={styles.userInfo}>
            <div style={{ ...styles.userColor, backgroundColor: user.color }}></div>
            <span>{user.displayName || user.username}</span>
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
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Pending Invitations</h2>
            <div style={styles.documentGrid}>
              {invitations.map(doc => (
                <div key={doc.id} style={styles.invitationCard}>
                  <div style={styles.cardHeader}>
                    <h3 style={styles.cardTitle}>{doc.title}</h3>
                    <span style={styles.inviteTag}>Invited</span>
                  </div>
                  <p style={styles.cardMeta}>Language: {doc.language}</p>
                  <div style={styles.cardActions}>
                    <button 
                      onClick={() => handleAcceptInvitation(doc.id)}
                      style={styles.acceptButton}
                    >
                      Accept
                    </button>
                    <button 
                      onClick={() => handleDeclineInvitation(doc.id)}
                      style={styles.declineButton}
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>My Documents</h2>
          {documents.length === 0 ? (
            <div style={styles.emptyState}>
              <p>No documents yet. Create your first document!</p>
            </div>
          ) : (
            <div style={styles.documentGrid}>
              {documents.map(doc => (
                <div key={doc.id} style={styles.documentCard}>
                  <div 
                    onClick={() => openEditor(doc.id)}
                    style={styles.cardContent}
                  >
                    <h3 style={styles.cardTitle}>{doc.title}</h3>
                    <p style={styles.cardMeta}>Language: {doc.language}</p>
                    <p style={styles.cardMeta}>
                      {doc.isOwner ? 'Owner' : 'Collaborator'}
                    </p>
                  </div>
                  {doc.isOwner && (
                    <div style={styles.cardFooter}>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedDocument(doc)
                          setShowInviteModal(true)
                        }}
                        style={styles.inviteButton}
                      >
                        Invite Users
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {showCreateModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h3 style={styles.modalTitle}>Create New Document</h3>
            <form onSubmit={handleCreateDocument} style={styles.modalForm}>
              <input
                type="text"
                value={newDocTitle}
                onChange={(e) => setNewDocTitle(e.target.value)}
                placeholder="Document title"
                style={styles.modalInput}
                autoFocus
              />
              <div style={styles.modalActions}>
                <button 
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={styles.cancelButton}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  style={styles.primaryButton}
                  disabled={loading}
                >
                  {loading ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showInviteModal && selectedDocument && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h3 style={styles.modalTitle}>Invite to "{selectedDocument.title}"</h3>
            <form onSubmit={handleInviteUser} style={styles.modalForm}>
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                style={styles.modalSelect}
              >
                <option value="">Select a user</option>
                {allUsers.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.displayName || u.username}
                  </option>
                ))}
              </select>
              <div style={styles.modalActions}>
                <button 
                  type="button"
                  onClick={() => {
                    setShowInviteModal(false)
                    setSelectedDocument(null)
                    setSelectedUser('')
                  }}
                  style={styles.cancelButton}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  style={styles.primaryButton}
                  disabled={loading}
                >
                  {loading ? 'Inviting...' : 'Invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
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
    overflow: 'hidden',
    border: '1px solid #3c3c3c',
  },
  cardContent: {
    padding: '20px',
    cursor: 'pointer',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '12px',
  },
  cardTitle: {
    color: '#ffffff',
    fontSize: '16px',
    fontWeight: 600,
  },
  inviteTag: {
    fontSize: '12px',
    padding: '2px 8px',
    backgroundColor: '#d7ba7d',
    color: '#1e1e1e',
    borderRadius: '4px',
    fontWeight: 600,
  },
  cardMeta: {
    color: '#858585',
    fontSize: '13px',
    marginBottom: '4px',
  },
  cardFooter: {
    padding: '12px 20px',
    backgroundColor: '#2d2d2d',
    borderTop: '1px solid #3c3c3c',
  },
  inviteButton: {
    width: '100%',
    padding: '8px',
    backgroundColor: 'transparent',
    color: '#3794ff',
    fontSize: '14px',
    border: '1px solid #3794ff',
    borderRadius: '4px',
  },
  invitationCard: {
    backgroundColor: '#2d3a2d',
    borderRadius: '6px',
    padding: '20px',
    border: '1px solid #3c3c3c',
  },
  cardActions: {
    display: 'flex',
    gap: '10px',
    marginTop: '16px',
  },
  acceptButton: {
    flex: 1,
    padding: '10px',
    backgroundColor: '#4ec9b0',
    color: '#1e1e1e',
    fontSize: '14px',
    fontWeight: 600,
    borderRadius: '4px',
  },
  declineButton: {
    flex: 1,
    padding: '10px',
    backgroundColor: 'transparent',
    color: '#f14c4c',
    fontSize: '14px',
    border: '1px solid #f14c4c',
    borderRadius: '4px',
  },
  emptyState: {
    textAlign: 'center',
    padding: '60px',
    color: '#858585',
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
  modalTitle: {
    color: '#ffffff',
    fontSize: '18px',
    marginBottom: '20px',
  },
  modalForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  modalInput: {
    padding: '12px 16px',
    backgroundColor: '#3c3c3c',
    border: '1px solid #3c3c3c',
    borderRadius: '4px',
    color: '#d4d4d4',
    fontSize: '14px',
    outline: 'none',
  },
  modalSelect: {
    padding: '12px 16px',
    backgroundColor: '#3c3c3c',
    border: '1px solid #3c3c3c',
    borderRadius: '4px',
    color: '#d4d4d4',
    fontSize: '14px',
    outline: 'none',
    cursor: 'pointer',
  },
  modalActions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end',
  },
  cancelButton: {
    padding: '10px 20px',
    backgroundColor: 'transparent',
    color: '#d4d4d4',
    fontSize: '14px',
    border: '1px solid #3c3c3c',
    borderRadius: '4px',
  },
  primaryButton: {
    padding: '10px 20px',
    backgroundColor: '#0e639c',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: 600,
    borderRadius: '4px',
  },
}

export default Dashboard
