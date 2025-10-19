
import React, { useState } from 'react';
import { useAppContext } from '../contexts/AppContext';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { User, Lock } from 'lucide-react';

const Auth: React.FC = () => {
    const { users, signUp, login } = useAppContext();
    const isFirstUser = users.length === 0;
    const [isLogin, setIsLogin] = useState(!isFirstUser);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isLogin) {
            await login(username, password);
        } else {
            if (password !== confirmPassword) {
                alert("Passwords don't match!");
                return;
            }
            const success = await signUp(username, password);
            if(success) setIsLogin(true);
        }
    };

    const toggleForm = () => {
        setIsLogin(!isLogin);
        setUsername('');
        setPassword('');
        setConfirmPassword('');
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-xl shadow-lg">
                <div>
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                        {isLogin ? 'Sign in to your account' : (isFirstUser ? 'Create Master Account' : 'Sign Up')}
                    </h2>
                     <p className="mt-2 text-center text-sm text-gray-600">
                        Or{' '}
                        {!isFirstUser && (
                           <button onClick={toggleForm} className="font-medium text-primary-600 hover:text-primary-500">
                                {isLogin ? 'create a new account' : 'sign in to your account'}
                           </button>
                        )}
                    </p>
                </div>
                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    <div className="rounded-md shadow-sm -space-y-px flex flex-col gap-4">
                        <Input
                            label="Username"
                            type="text"
                            required
                            placeholder="Username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            icon={<User className="h-5 w-5 text-gray-400" />}
                        />
                        <Input
                            label="Password"
                            type="password"
                            required
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            icon={<Lock className="h-5 w-5 text-gray-400" />}
                        />
                        {!isLogin && (
                            <Input
                                label="Confirm Password"
                                type="password"
                                required
                                placeholder="Confirm Password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                icon={<Lock className="h-5 w-5 text-gray-400" />}
                            />
                        )}
                    </div>

                    <div>
                        <Button type="submit" className="w-full">
                            {isLogin ? 'Sign In' : 'Sign Up'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Auth;
