
import React from 'react';
// FIX: Changed react-router-dom import to use namespace import to resolve module export errors.
import * as ReactRouterDOM from 'react-router-dom';
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
            <ReactRouterDOM.Routes>
                <ReactRouterDOM.Route path="/setup" element={<Setup />} />
                <ReactRouterDOM.Route path="*" element={<ReactRouterDOM.Navigate to="/setup" />} />
            </ReactRouterDOM.Routes>
        );
    }
    
    if (!currentUser) {
        return (
            <ReactRouterDOM.Routes>
                <ReactRouterDOM.Route path="/auth" element={<Auth />} />
                <ReactRouterDOM.Route path="*" element={<ReactRouterDOM.Navigate to="/auth" />} />
            </ReactRouterDOM.Routes>
        );
    }

    return (
        <Layout>
            <ReactRouterDOM.Routes>
                <ReactRouterDOM.Route path="/" element={<Dashboard />} />
                <ReactRouterDOM.Route path="/pos" element={<POS />} />
                <ReactRouterDOM.Route path="/sales" element={<Sales />} />
                <ReactRouterDOM.Route path="/inventory" element={<Inventory />} />
                <ReactRouterDOM.Route path="/categories" element={<Categories />} />
                <ReactRouterDOM.Route path="/customers" element={<Customers />} />
                <ReactRouterDOM.Route path="/users" element={<Users />} />
                <ReactRouterDOM.Route path="/reports" element={<Reports />} />
                <ReactRouterDOM.Route path="/demand" element={<Demand />} />
                <ReactRouterDOM.Route path="/expenses" element={<Expenses />} />
                <ReactRouterDOM.Route path="/profile" element={<Profile />} />
                <ReactRouterDOM.Route path="/settings" element={<Settings />} />
                <ReactRouterDOM.Route path="/loyalty" element={<LoyaltySettings />} />
                <ReactRouterDOM.Route path="/due-payments" element={<DuePayments />} />
                <ReactRouterDOM.Route path="*" element={<ReactRouterDOM.Navigate to="/" />} />
            </ReactRouterDOM.Routes>
        </Layout>
    );
};


const App: React.FC = () => {
    return (
        <AppProvider>
            <ReactRouterDOM.HashRouter>
                <AppRoutes />
            </ReactRouterDOM.HashRouter>
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