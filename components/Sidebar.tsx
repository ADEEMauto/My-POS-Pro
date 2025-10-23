import React from 'react';
// FIX: Changed react-router-dom import to use namespace import to resolve module export error.
import * as ReactRouterDOM from 'react-router-dom';
import { useAppContext } from '../contexts/AppContext';
import { LayoutDashboard, ShoppingCart, Archive, Layers, Users, BarChart2, User, Settings, X, Receipt, Contact, Award } from 'lucide-react';

const NavItem: React.FC<{ to: string; icon: React.ReactNode; label: string; onClick: () => void; }> = ({ to, icon, label, onClick }) => (
    <ReactRouterDOM.NavLink
        to={to}
        onClick={onClick}
        className={({ isActive }) =>
            `flex items-center px-4 py-3 text-gray-200 hover:bg-primary-600 hover:text-white rounded-lg transition-colors ${
                isActive ? 'bg-primary-800 text-white' : ''
            }`
        }
    >
        {icon}
        <span className="ml-3">{label}</span>
    </ReactRouterDOM.NavLink>
);

const Sidebar: React.FC<{ isOpen: boolean, onToggle: () => void }> = ({ isOpen, onToggle }) => {
    const { currentUser } = useAppContext();
    const isMaster = currentUser?.role === 'master';
    
    const masterLinks = [
        { to: "/", icon: <LayoutDashboard className="w-5 h-5" />, label: "Dashboard" },
        { to: "/pos", icon: <ShoppingCart className="w-5 h-5" />, label: "POS" },
        { to: "/sales", icon: <Receipt className="w-5 h-5" />, label: "Sales" },
        { to: "/inventory", icon: <Archive className="w-5 h-5" />, label: "Inventory" },
        { to: "/categories", icon: <Layers className="w-5 h-5" />, label: "Categories" },
        { to: "/customers", icon: <Contact className="w-5 h-5" />, label: "Customers" },
        { to: "/users", icon: <Users className="w-5 h-5" />, label: "Manage Users" },
        { to: "/reports", icon: <BarChart2 className="w-5 h-5" />, label: "Reports" },
        { to: "/loyalty", icon: <Award className="w-5 h-5" />, label: "Loyalty Program" },
        { to: "/settings", icon: <Settings className="w-5 h-5" />, label: "Settings" },
    ];

    const subLinks = [
        { to: "/", icon: <LayoutDashboard className="w-5 h-5" />, label: "Dashboard" },
        { to: "/pos", icon: <ShoppingCart className="w-5 h-5" />, label: "POS" },
        { to: "/settings", icon: <Settings className="w-5 h-5" />, label: "Settings" },
    ];
    
    const links = isMaster ? masterLinks : subLinks;

    return (
        <>
            <aside className={`fixed lg:relative inset-y-0 left-0 bg-primary-700 text-white w-64 p-4 space-y-2 transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 transition-transform duration-300 ease-in-out z-30 shadow-lg`}>
                <div className="flex justify-between items-center lg:hidden">
                    <span className="text-lg font-bold">Menu</span>
                    <button onClick={onToggle} className="p-2">
                        <X className="w-6 h-6" />
                    </button>
                </div>
                <nav className="flex flex-col space-y-2 mt-4">
                    {links.map(link => (
                        <NavItem key={link.to} to={link.to} icon={link.icon} label={link.label} onClick={onToggle}/>
                    ))}
                </nav>
            </aside>
            {isOpen && <div onClick={onToggle} className="fixed inset-0 bg-black opacity-50 z-20 lg:hidden"></div>}
        </>
    );
};

export default Sidebar;