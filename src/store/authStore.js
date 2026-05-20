import { create } from 'zustand';

const getInitialUser = () => {
  try {
    const saved = localStorage.getItem('qc_user');
    return saved ? JSON.parse(saved) : null;
  } catch (err) {
    console.error('[AuthStore] Failed to load user from localStorage:', err);
    return null;
  }
};

export const useAuthStore = create((set) => ({
  user: getInitialUser(),
  login: (userData) => {
    try {
      localStorage.setItem('qc_user', JSON.stringify(userData));
    } catch (err) {
      console.error('[AuthStore] Failed to persist user in localStorage:', err);
    }
    set({ user: userData });
  },
  logout: () => {
    try {
      localStorage.removeItem('qc_user');
    } catch (err) {
      console.error('[AuthStore] Failed to remove user from localStorage:', err);
    }
    set({ user: null });
  }
}));
