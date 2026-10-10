// The logged-in user and login / logout, from AuthProvider:
//   const { user, logout } = useAuth();

import { useContext } from 'react';
import { AuthContext, type AuthContextValue } from '../context/auth';

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
