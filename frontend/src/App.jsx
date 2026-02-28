/**
 * KisanCall — Main App with React Router v6
 */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './AuthContext';
import { ToastProvider } from './components/ToastProvider';
import { LanguageProvider } from './components/LanguageContext';
import ProtectedRoute from './components/ProtectedRoute';

import Landing from './pages/Landing';
import Login from './pages/Login';
import Signup from './pages/Signup';
import VerifyEmail from './pages/VerifyEmail';
import FarmerDashboard from './pages/FarmerDashboard';
import CallScreen from './pages/CallScreen';
import CallSummary from './pages/CallSummary';
import ExpertDashboard from './pages/ExpertDashboard';
import ExpertCallScreen from './pages/ExpertCallScreen';
import ExpertCallHistory from './pages/ExpertCallHistory';

export default function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              {/* Public */}
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/verify-email" element={<VerifyEmail />} />

              {/* Farmer only */}
              <Route element={<ProtectedRoute role="farmer" />}>
                <Route path="/farmer" element={<FarmerDashboard />} />
                <Route path="/call/:callId" element={<CallScreen />} />
                <Route path="/summary/:callId" element={<CallSummary />} />
              </Route>

              {/* Expert only */}
              <Route element={<ProtectedRoute role="expert" />}>
                <Route path="/expert" element={<ExpertDashboard />} />
                <Route path="/expert/call/:callId" element={<ExpertCallScreen />} />
                <Route path="/expert/history" element={<ExpertCallHistory />} />
              </Route>

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </LanguageProvider>
    </AuthProvider>
  );
}
