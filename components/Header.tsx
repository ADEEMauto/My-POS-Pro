import React from 'react';
import { useAppContext } from '../contexts/AppContext';
import { User, LogOut } from 'lucide-react';
import { Link } from 'react-router-dom';

const Header: React.FC<{ onToggleSidebar: () => void }> = ({ onToggleSidebar }) => {
    const { shopInfo, currentUser, logout } = useAppContext();

    return (
        <header className="bg-primary-700 text-white shadow-md sticky top-0 z-40">
            <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                <div className="flex items-center">
                    <button onClick={onToggleSidebar} className="p-2 mr-4 lg:hidden text-white">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                        </svg>
                    </button>
                    <h1 className="text-lg sm:text-xl font-bold tracking-wider truncate">{shopInfo?.name || 'ShopSync POS'}</h1>
                </div>

                <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                        <User className="w-5 h-5" />
                        <span className="font-medium hidden sm:inline">{currentUser?.username} ({currentUser?.role})</span>
                    </div>
                     <Link to="/profile" className="p-2 hover:bg-primary-600 rounded-full transition-colors" title="Profile">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-1.007 1.11-1.226M10.343 3.94a2.25 2.25 0 01-2.25 2.25c-.939 0-1.707-.506-2.083-1.226m2.083 1.226c-.374.72.155 1.706.886 1.706H12m.118-4.945a2.25 2.25 0 00-2.25-2.25c-.939 0-1.707.506-2.083 1.226m2.083 1.226c.374.72-.155 1.706-.886 1.706H12m-1.75 4.5a.75.75 0 00-1.5 0v3.75a.75.75 0 001.5 0V10.5zM12 10.5a.75.75 0 00-1.5 0v3.75a.75.75 0 001.5 0V10.5zM13.657 3.94a2.25 2.25 0 012.25 2.25c.939 0 1.707-.506 2.083-1.226m-2.083 1.226c.374.72-.155 1.706-.886 1.706H12m6.75 4.5a.75.75 0 00-1.5 0v3.75a.75.75 0 001.5 0V10.5zm-3.75 0a.75.75 0 00-1.5 0v3.75a.75.75 0 001.5 0V10.5z" />
                        </svg>
                    </Link>
                    <button onClick={logout} className="p-2 hover:bg-primary-600 rounded-full transition-colors" title="Logout">
                        <LogOut className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </header>
    );
};

export default Header;