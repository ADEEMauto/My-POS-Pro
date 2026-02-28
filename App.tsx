
import React from 'react';
import { Routes, Route, Navigate, HashRouter } from 'react-router-dom';
import { AppProvider, useAppContext } from './contexts/AppContext';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import Auth from './pages/Auth';
import Setup from './pages/Setup';
import Dashboard from './pages/Dashboard';
import POS from './pages/POS';
import Inventory from './pages/Inventory';
import Categories from './pages/Categories';
import Users from './pages/Users';
import Reports from './pages/Reports';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import Sales from './pages/Sales';
import Customers from './pages/Customers';
import LoyaltySettings from './pages/LoyaltySettings';
import Expenses from './pages/Expenses';
import Demand from './pages/Demand';
import DuePayments from './pages/DuePayments';


const AppRoutes: React.FC = () => {
    const { shopInfo, currentUser, loading } = useAppContext();

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    if (!shopInfo) {
        return (
            <Routes>
                <Route path="/setup" element={<Setup />} />
                <Route path="*" element={<Navigate to="/setup" />} />
            </Routes>
        );
    }
    
    if (!currentUser) {
        return (
            <Routes>
                <Route path="/auth" element={<Auth />} />
                <Route path="*" element={<Navigate to="/auth" />} />
            </Routes>
        );
    }

    return (
        <Layout>
            <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/pos" element={<POS />} />
                <Route path="/sales" element={<Sales />} />
                <Route path="/inventory" element={<Inventory />} />
                <Route path="/categories" element={<Categories />} />
                <Route path="/customers" element={<Customers />} />
                <Route path="/users" element={<Users />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/demand" element={<Demand />} />
                <Route path="/expenses" element={<Expenses />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/loyalty" element={<LoyaltySettings />} />
                <Route path="/due-payments" element={<DuePayments />} />
                <Route path="*" element={<Navigate to="/" />} />
            </Routes>
        </Layout>
    );
};


const App: React.FC = () => {
    return (
        <AppProvider>
            <HashRouter>
                <AppRoutes />
            </HashRouter>
            <Toaster position="top-right" toastOptions={{
                className: 'bg-white text-gray-900 shadow-lg rounded-lg p-4',
                success: {
                    className: 'bg-green-50 border-green-500 text-green-700',
                    iconTheme: {
                        primary: '#10B981',
                        secondary: 'white',
                    },
                },
                error: {
                    className: 'bg-red-50 border-red-500 text-red-700',
                    iconTheme: {
                        primary: '#EF4444',
                        secondary: 'white',
                    },
                },
            }} />
        </AppProvider>
    );
};

export default App;