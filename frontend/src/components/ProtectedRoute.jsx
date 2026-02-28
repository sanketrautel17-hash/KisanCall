/**
 * KisanCall — ProtectedRoute
 * Guards nested routes by auth state and role.
 * Works as a layout route with <Outlet>.
 */
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../AuthContext';

export default function ProtectedRoute({ role }) {
    const { isLoggedIn, user } = useAuth();

    if (!isLoggedIn) return <Navigate to="/login" replace />;
    if (role && user?.role !== role) {
        return <Navigate to={user?.role === 'expert' ? '/expert' : '/farmer'} replace />;
    }
    return <Outlet />;
}
