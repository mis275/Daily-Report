import { create } from 'zustand';

const getStoredUser = () => {
  try {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  } catch (err) {
    return null;
  }
};

const initialUser = getStoredUser();

const useAuthStore = create((set) => ({
  user: initialUser,
  isAuthenticated: !!initialUser,
  
  login: (userData) => {
    set({
      user: userData,
      isAuthenticated: true
    });
    localStorage.setItem('user', JSON.stringify(userData));
  },
  
  logout: () => {
    set({
      user: null,
      isAuthenticated: false
    });
    localStorage.removeItem('user');
  },
  
  initializeAuth: () => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      set({
        user: JSON.parse(storedUser),
        isAuthenticated: true
      });
    }
  }
}));

export { useAuthStore };
