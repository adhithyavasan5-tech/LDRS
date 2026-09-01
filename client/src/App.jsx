import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuth } from './hooks/useAuth';
import { PageLoader } from './components/ui/Loader';

// Layouts
import AppLayout from './layouts/AppLayout';
import AuthLayout from './layouts/AuthLayout';

// Pages
import Landing from './pages/Landing';
import Register from './pages/Register';
import Login from './pages/Login';
import Home from './pages/Home';
import CreateRoom from './pages/CreateRoom';
import JoinRoom from './pages/JoinRoom';
import WatchTogether from './pages/WatchTogether';
import WatchHistory from './pages/WatchHistory';
import Watchlist from './pages/Watchlist';
import CoupleProfile from './pages/CoupleProfile';
import Settings from './pages/Settings';
import NotFound from './pages/NotFound';

// Protected Route Wrapper
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) return <PageLoader message="Verifying session..." />;
  if (!isAuthenticated) return <Navigate to="/register" replace />;
  
  return children;
};

// Public Route Wrapper (redirects to home if already logged in)
const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) return <PageLoader message="Loading..." />;
  if (isAuthenticated) return <Navigate to="/home" replace />;
  
  return children;
};

function App() {
  const { initialized } = useAuth();

  if (!initialized) {
    return <PageLoader message="Starting up..." />;
  }

  return (
    <>
      <Toaster
        position="top-center"
        toastOptions={{
          className: 'glass-card-strong !bg-card text-primary text-sm font-medium',
          style: {
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
            backdropFilter: 'blur(20px)',
          },
        }}
      />
      <Routes>
        {/* Public Landing */}
        <Route path="/" element={<PublicRoute><Landing /></PublicRoute>} />
        
        {/* Auth Route */}
        <Route element={<PublicRoute><AuthLayout /></PublicRoute>}>
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />
        </Route>

        {/* Protected App Routes */}
        <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route path="/home" element={<Home />} />
          <Route path="/create-room" element={<CreateRoom />} />
          <Route path="/join-room" element={<JoinRoom />} />
          <Route path="/history" element={<WatchHistory />} />
          <Route path="/watchlist" element={<Watchlist />} />
          <Route path="/couple" element={<CoupleProfile />} />
          <Route path="/settings" element={<Settings />} />
        </Route>

        {/* Watch Together (Full Screen Layout) */}
        <Route 
          path="/watch/:roomCode" 
          element={
            <ProtectedRoute>
              <WatchTogether />
            </ProtectedRoute>
          } 
        />

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}

export default App;
