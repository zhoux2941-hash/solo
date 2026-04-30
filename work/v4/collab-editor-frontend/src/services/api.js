import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

export const authAPI = {
  login: (username, password) => 
    api.post('/auth/login', { username, password }),
  
  logout: () => 
    api.post('/auth/logout'),
  
  getMe: () => 
    api.get('/auth/me'),
  
  getAllUsers: () => 
    api.get('/auth/users'),
}

export const documentAPI = {
  createDocument: (title, language = 'javascript') => 
    api.post('/documents', { title, language }),
  
  getDocuments: () => 
    api.get('/documents'),
  
  getDocument: (id) => 
    api.get(`/documents/${id}`),
  
  inviteUser: (documentId, userId) => 
    api.post(`/documents/${documentId}/invite`, { userId }),
  
  acceptInvitation: (documentId) => 
    api.post(`/documents/${documentId}/accept`),
  
  declineInvitation: (documentId) => 
    api.post(`/documents/${documentId}/decline`),
  
  getCollaborators: (documentId) => 
    api.get(`/documents/${documentId}/collaborators`),
}

export default api
