
import React, { useState } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { User } from '../types';
import { Plus, Trash2 } from 'lucide-react';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';

const Users: React.FC = () => {
    const { users, currentUser, addUser, deleteUser } = useAppContext();
    const [isModalOpen, setModalOpen] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    const isMaster = currentUser?.role === 'master';

    const handleAddUser = async (e: React.FormEvent) => {
        e.preventDefault();
        const success = await addUser(username, password);
        if (success) {
            setUsername('');
            setPassword('');
            setModalOpen(false);
        }
    };
    
    const handleDelete = (userId: string) => {
        if(window.confirm("Are you sure you want to delete this user? This action cannot be undone.")) {
            deleteUser(userId);
        }
    }

    if (!isMaster) {
        return (
            <div className="text-center p-8 bg-white rounded-lg shadow-md">
                <h2 className="text-2xl font-bold text-red-600">Access Denied</h2>
                <p className="mt-2 text-gray-600">You do not have permission to view this page.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Manage Users</h1>
                <Button onClick={() => setModalOpen(true)} className="flex items-center gap-2">
                    <Plus size={18} /> Add Sub Account
                </Button>
            </div>

            <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <ul className="divide-y divide-gray-200">
                    {users.map(user => (
                        <li key={user.id} className="px-4 sm:px-6 py-4 flex items-center justify-between">
                            <div>
                                <p className="text-lg font-medium text-gray-900">{user.username}</p>
                                <p className={`text-sm font-semibold px-2 py-0.5 rounded-full inline-block ${user.role === 'master' ? 'bg-primary-100 text-primary-800' : 'bg-gray-200 text-gray-800'}`}>
                                    {user.role}
                                </p>
                            </div>
                            {user.role !== 'master' && (
                                <button onClick={() => handleDelete(user.id)} className="text-red-500 hover:text-red-700">
                                    <Trash2 size={20} />
                                </button>
                            )}
                        </li>
                    ))}
                </ul>
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title="Create Sub Account">
                <form onSubmit={handleAddUser} className="space-y-4">
                    <Input
                        label="Username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                    />
                    <Input
                        label="Password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                    <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
                        <Button type="submit">Create User</Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default Users;