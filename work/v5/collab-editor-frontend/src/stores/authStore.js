import { create } from 'zustand'

const useAuthStore = create((set, get) => ({
  user: null,
  isAuthenticated: false,
  
  login: (userData) => {
    set({ user: userData, isAuthenticated: true })
    try {
      localStorage.setItem('auth-user', JSON.stringify(userData))
    } catch (e) {
      console.log('Failed to save to localStorage:', e)
    }
  },
  
  logout: () => {
    set({ user: null, isAuthenticated: false })
    try {
      localStorage.removeItem('auth-user')
    } catch (e) {
      console.log('Failed to remove from localStorage:', e)
    }
  },
  
  initFromStorage: () => {
    try {
      const stored = localStorage.getItem('auth-user')
      if (stored) {
        const userData = JSON.parse(stored)
        set({ user: userData, isAuthenticated: true })
      }
    } catch (e) {
      console.log('Failed to load from localStorage:', e)
    }
  }
}))

export default useAuthStore
