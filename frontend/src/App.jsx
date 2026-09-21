import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';

// Pages
import Login from './pages/Login.jsx';
import ChangePassword from './pages/ChangePassword.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Upload from './pages/Upload.jsx';
import AdminHome from './pages/AdminHome.jsx';
import AdminInfluencer from './pages/AdminInfluencer.jsx';
import AdminAllPosts from './pages/AdminAllPosts.jsx';
import AdminUsers from './pages/AdminUsers.jsx';
import AdminReports from './pages/AdminReports.jsx';
import AdminFreelancers from './pages/AdminFreelancers.jsx';
import AdminCouponPartners from './pages/AdminCouponPartners.jsx';
import Profile from './pages/Profile.jsx';
import Coupons from './pages/Coupons.jsx';

// Layout wrapper with Navbar
import Navbar from './components/Navbar.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';

// Where each role lands after login / when denied a route it can't see.
// 'operacao' is a narrow role that can only ever see Registro de Cupons.
function homeForRole(role) {
  if (role === 'admin') return '/admin';
  if (role === 'operacao') return '/admin/coupon-partners';
  return '/dashboard';
}

// Protected route: requires auth; redirects to /change-password if must_change_password.
// `adminOnly` restricts to the 'admin' role (kept for existing routes).
// `roles` restricts to an explicit list (e.g. ['admin', 'operacao']) when a
// route — like Registro de Cupons — is shared by more than just admins.
function ProtectedRoute({ children, adminOnly = false, roles }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.must_change_password) {
    return <Navigate to="/change-password" replace />;
  }

  const allowedRoles = roles || (adminOnly ? ['admin'] : null);
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={homeForRole(user.role)} replace />;
  }

  return (
    <div className="layout">
      <Navbar />
      <main className="main-content">
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </main>
    </div>
  );
}

// Root redirect based on role
function RootRedirect() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (user.must_change_password) return <Navigate to="/change-password" replace />;
  return <Navigate to={homeForRole(user.role)} replace />;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/change-password" element={<ChangePasswordRoute />} />

      {/* Influencer routes — the narrow "operacao" role has no access here */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute roles={['admin', 'influencer']}>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/upload"
        element={
          <ProtectedRoute roles={['admin', 'influencer']}>
            <Upload />
          </ProtectedRoute>
        }
      />

      {/* Shared routes (admin + influencer) */}
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        }
      />
      <Route
        path="/coupons"
        element={
          <ProtectedRoute roles={['admin', 'influencer']}>
            <Coupons />
          </ProtectedRoute>
        }
      />

      {/* Admin routes */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute adminOnly>
            <AdminHome />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/influencers/:id"
        element={
          <ProtectedRoute adminOnly>
            <AdminInfluencer />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/posts"
        element={
          <ProtectedRoute adminOnly>
            <AdminAllPosts />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/users"
        element={
          <ProtectedRoute adminOnly>
            <AdminUsers />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/reports"
        element={
          <ProtectedRoute adminOnly>
            <AdminReports />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/freelancers"
        element={
          <ProtectedRoute adminOnly>
            <AdminFreelancers />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/coupon-partners"
        element={
          <ProtectedRoute roles={['admin', 'operacao']}>
            <AdminCouponPartners />
          </ProtectedRoute>
        }
      />

      {/* Root redirect */}
      <Route path="/" element={<RootRedirect />} />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

// Change password route: only accessible when authenticated
function ChangePasswordRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!user.must_change_password) {
    return <Navigate to={homeForRole(user.role)} replace />;
  }

  return <ChangePassword />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
