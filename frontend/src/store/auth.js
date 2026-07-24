import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { mockApi } from '../api/mock'

export const useAuthStore = create(
  persist(
    (set) => ({
      token: null,
      user: null,
      mock: false,
      setAuth: (token, user) => set({ token, user }),
      setMock: (mock) => set({ mock, token: null, user: null }),
      logout: () => set({ token: null, user: null }),
    }),
    {
      name: 'natcon-auth',
      onRehydrateStorage: () => (state) => {
        // Mock sessions live in-memory inside mockApi; restore the persona
        // after a page reload so mock calls keep working.
        if (state?.mock && state.user) {
          mockApi.restore(state.user)
        }
      },
    }
  )
)
