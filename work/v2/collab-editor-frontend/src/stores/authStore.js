import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      
      setLoading: (isLoading) => set({ isLoading }),
      
      login: (userData) => {
        set({ user: userData, isAuthenticated: true })
      },
      
      logout: () => {
        set({ user: null, isAuthenticated: false })
      },
      
      checkAuth: async () => {
        try {
          const response = await fetch('/api/auth/me', {
            credentials: 'include',
          })
          
          if (response.ok) {
            const data = await response.json()
            set({ user: data, isAuthenticated: true })
            return true
          } else {
            set({ user: null, isAuthenticated: false })
            return false
          }
        } catch (error) {
          set({ user: null, isAuthenticated: false })
          return false
        }
      }
    }),
    {
      name: 'auth-storage',
    }
  )
)

export default useAuthStore
