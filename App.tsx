import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './firebase';
import PublicLanding from './components/PublicLanding';
import AdminPanel from './components/AdminPanel';
import AdminLogin from './components/AdminLogin';
import SellerPortal from './components/SellerPortal';

enum View {
  LANDING = 'LANDING',
  SELLER = 'SELLER',
  ADMIN_LOGIN = 'ADMIN_LOGIN',
  ADMIN_DASHBOARD = 'ADMIN_DASHBOARD'
}

const SUPER_ADMIN_UID = 'LTNwDZDCH6cZwqhVH7Ol1guYBuJ2';
const ADMIN_EMAIL = 'admin@skyworth.com';

const Loader = () => (
  <div className="h-screen w-full bg-[#0B0F19] flex flex-col items-center justify-center">
    <div className="w-12 h-12 border-4 border-skyworth-blue border-t-transparent rounded-full animate-spin"></div>
  </div>
);

export default function App() {
  const [currentView, setCurrentView] = useState<View>(View.LANDING);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const checkAdminStatus = async (currentUser: User) => {
    try {
      const tokenResult = await currentUser.getIdTokenResult(true);
      const hasAdmin = !!tokenResult.claims.admin || 
                       currentUser.uid === SUPER_ADMIN_UID ||
                       currentUser.email === ADMIN_EMAIL;
      setIsAdmin(hasAdmin);
      return hasAdmin;
    } catch (e) {
      setIsAdmin(false);
      return false;
    }
  };

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash === '#admin') {
        setCurrentView(user ? View.ADMIN_DASHBOARD : View.ADMIN_LOGIN);
      } else if (hash === '#seller') {
        setCurrentView(View.SELLER);
      } else {
        setCurrentView(View.LANDING);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await checkAdminStatus(currentUser);
        // Refresh view based on current hash after auth load
        if (window.location.hash === '#admin') setCurrentView(View.ADMIN_DASHBOARD);
      } else {
        setIsAdmin(false);
      }
      setLoading(false);
    });

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      unsubscribe();
    };
  }, [user]);

  if (loading) return <Loader />;

  return (
    <>
      {currentView === View.LANDING && <PublicLanding />}
      {currentView === View.SELLER && <SellerPortal />}
      {currentView === View.ADMIN_LOGIN && <AdminLogin onLogin={() => setCurrentView(View.ADMIN_DASHBOARD)} />}
      {currentView === View.ADMIN_DASHBOARD && (
        isAdmin ? 
        <AdminPanel /> : 
        <AdminLogin error="No tienes permisos de Administrador." onRetry={() => checkAdminStatus(auth.currentUser!)} />
      )}
    </>
  );
}