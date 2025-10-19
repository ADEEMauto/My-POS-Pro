
import React, { useState } from 'react';
import { useAppContext } from '../contexts/AppContext';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { Building, MapPin } from 'lucide-react';

const Setup: React.FC = () => {
    const { saveShopInfo } = useAppContext();
    const [name, setName] = useState('');
    const [address, setAddress] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim() && address.trim()) {
            saveShopInfo({ name, address });
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-xl shadow-lg">
                <div>
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                        Welcome to ShopSync POS
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-600">
                        Let's set up your shop details.
                    </p>
                </div>
                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    <div className="rounded-md shadow-sm -space-y-px flex flex-col gap-4">
                        <Input
                            label="Shop Name"
                            id="shop-name"
                            name="name"
                            type="text"
                            required
                            placeholder="e.g., The Corner Store"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            icon={<Building className="h-5 w-5 text-gray-400" />}
                        />
                        <Input
                            label="Shop Address"
                            id="shop-address"
                            name="address"
                            type="text"
                            required
                            placeholder="e.g., 123 Main St, Karachi"
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            icon={<MapPin className="h-5 w-5 text-gray-400" />}
                        />
                    </div>

                    <div>
                        <Button type="submit" className="w-full">
                            Save and Continue
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Setup;
