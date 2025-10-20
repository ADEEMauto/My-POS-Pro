
import React, { useState } from 'react';
import { useAppContext } from '../contexts/AppContext';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import toast from 'react-hot-toast';

const simpleHash = async (password: string) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

const Profile: React.FC = () => {
    const { currentUser, updateUser } = useAppContext();
    const [username, setUsername] = useState(currentUser?.username || '');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    
    const handleProfileUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser) return;

        if (currentUser.username !== username) {
           await updateUser(currentUser.id, { username });
        }
    };
    
    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser) return;
        if(newPassword !== confirmPassword) {
            toast.error("New passwords do not match.");
            return;
        }
        if(newPassword.length < 4) {
             toast.error("Password should be at least 4 characters long.");
             return;
        }

        const passwordHash = await simpleHash(newPassword);
        const success = await updateUser(currentUser.id, { passwordHash });
        if(success) {
            setNewPassword('');
            setConfirmPassword('');
        }
    };


    return (
        <div className="space-y-8 max-w-2xl mx-auto">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">My Profile</h1>

            <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold mb-4">Update Username</h2>
                <form onSubmit={handleProfileUpdate} className="space-y-4">
                    <Input
                        label="Username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                    />
                    <div className="flex justify-end">
                        <Button type="submit">Update Username</Button>
                    </div>
                </form>
            </div>
            
            <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold mb-4">Change Password</h2>
                <form onSubmit={handlePasswordChange} className="space-y-4">
                     <Input
                        label="New Password"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                    />
                    <Input
                        label="Confirm New Password"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                    />
                    <div className="flex justify-end">
                        <Button type="submit">Change Password</Button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Profile;