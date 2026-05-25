import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage.jsx';
import Dashboard from './pages/Dashboard.jsx';
import LoginPage from './pages/LoginPage.jsx';
import PaymentPage from './pages/PaymentPage.jsx';
import ExpiredPage from './pages/ExpiredPage.jsx';
import { useAuthStore } from './store/authStore';

/**
 * Routes user to the correct page based on their subscription status.
 * - active        → /dashboard
 * - approved      → /payment  (show payment page)
 * - payment_pending → /payment (show waiting state)
 * - expired       → /expired
 * - null (not logged in) → /login
 */
function StatusRouter({ children }) {
  const user = useAuthStore((state) => state.user);

  if (!user) return <Navigate to="/login" replace />;

  const { status } = user;
  if (status === 'active') return children;
  if (status === 'approved' || status === 'payment_pending') return <Navigate to="/payment" replace />;
  if (status === 'expired') return <Navigate to="/expired" replace />;

  // Fallback: any unknown status → login
  return <Navigate to="/login" replace />;
}

function PaymentGuard({ children }) {
  const user = useAuthStore((state) => state.user);
  if (!user) return <Navigate to="/login" replace />;
  if (user.status === 'approved' || user.status === 'payment_pending') return children;
  if (user.status === 'active') return <Navigate to="/dashboard" replace />;
  if (user.status === 'expired') return <Navigate to="/expired" replace />;
  return <Navigate to="/login" replace />;
}

function ExpiredGuard({ children }) {
  const user = useAuthStore((state) => state.user);
  if (!user) return <Navigate to="/login" replace />;
  if (user.status === 'expired') return children;
  if (user.status === 'active') return <Navigate to="/dashboard" replace />;
  return <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/dashboard"
          element={
            <StatusRouter>
              <Dashboard />
            </StatusRouter>
          }
        />
        <Route
          path="/payment"
          element={
            <PaymentGuard>
              <PaymentPage />
            </PaymentGuard>
          }
        />
        <Route
          path="/expired"
          element={
            <ExpiredGuard>
              <ExpiredPage />
            </ExpiredGuard>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
