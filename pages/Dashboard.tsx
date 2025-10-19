
import React from 'react';
import { useAppContext } from '../contexts/AppContext';
import { Link } from 'react-router-dom';
import { ShoppingCart, Archive, Layers, Users, BarChart2, DollarSign, Package, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '../utils/helpers';

const StatCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode; color: string }> = ({ title, value, icon, color }) => (
    <div className="bg-white p-6 rounded-lg shadow-md flex items-center space-x-4">
        <div className={`p-3 rounded-full ${color}`}>
            {icon}
        </div>
        <div>
            <p className="text-sm text-gray-500">{title}</p>
            <p className="text-2xl font-bold text-gray-800">{value}</p>
        </div>
    </div>
);

const QuickLink: React.FC<{ to: string; label: string; icon: React.ReactNode }> = ({ to, label, icon }) => (
    <Link to={to} className="flex flex-col items-center justify-center bg-white p-6 rounded-lg shadow-md hover:shadow-lg hover:bg-primary-50 transition-all text-center">
        <div className="mb-2 text-primary-600">{icon}</div>
        <span className="font-semibold text-gray-700">{label}</span>
    </Link>
);


const Dashboard: React.FC = () => {
    const { currentUser, inventory, sales } = useAppContext();
    const isMaster = currentUser?.role === 'master';

    const totalInvestment = inventory.reduce((acc, p) => acc + p.purchasePrice * p.quantity, 0);
    const totalSales = sales.reduce((acc, s) => acc + s.total, 0);
    const lowStockItems = inventory.filter(p => p.quantity > 0 && p.quantity <= 5).length;

    return (
        <div className="space-y-8">
            <h1 className="text-3xl font-bold text-gray-800">Welcome, {currentUser?.username}!</h1>

            {isMaster && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <StatCard title="Total Investment" value={formatCurrency(totalInvestment)} icon={<DollarSign className="w-6 h-6 text-white" />} color="bg-blue-500" />
                        <StatCard title="Total Sales" value={formatCurrency(totalSales)} icon={<ShoppingCart className="w-6 h-6 text-white" />} color="bg-green-500" />
                        <StatCard title="Total Products" value={inventory.length} icon={<Package className="w-6 h-6 text-white" />} color="bg-purple-500" />
                        <StatCard title="Low Stock Items" value={lowStockItems} icon={<AlertTriangle className="w-6 h-6 text-white" />} color="bg-yellow-500" />
                    </div>
                </>
            )}

            <div>
                <h2 className="text-2xl font-semibold text-gray-700 mb-4">Quick Actions</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
                    <QuickLink to="/pos" label="Start Selling" icon={<ShoppingCart size={32} />} />
                    {isMaster && (
                        <>
                            <QuickLink to="/inventory" label="Manage Inventory" icon={<Archive size={32} />} />
                            <QuickLink to="/categories" label="Manage Categories" icon={<Layers size={32} />} />
                            <QuickLink to="/users" label="Manage Users" icon={<Users size={32} />} />
                            <QuickLink to="/reports" label="View Reports" icon={<BarChart2 size={32} />} />
                        </>
                    )}
                </div>
            </div>

            {isMaster && lowStockItems > 0 && (
                <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded-md" role="alert">
                    <p className="font-bold">Low Stock Alert</p>
                    <p>You have {lowStockItems} item(s) running low on stock. Check your inventory.</p>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
