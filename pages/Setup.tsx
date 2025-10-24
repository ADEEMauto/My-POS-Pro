
import React, { useState } from 'react';
import { useAppContext } from '../contexts/AppContext';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { Building, MapPin, Upload, X } from 'lucide-react';
import { compressImage } from '../utils/helpers';
import toast from 'react-hot-toast';

const Setup: React.FC = () => {
    const { saveShopInfo } = useAppContext();
    const [name, setName] = useState('');
    const [address, setAddress] = useState('');
    const [logo, setLogo] = useState<string | undefined>(undefined);

    const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const toastId = toast.loading('Processing image...');
            try {
                const compressedLogo = await compressImage(file);
                setLogo(compressedLogo);
                toast.success('Logo uploaded!', { id: toastId });
            } catch (error) {
                console.error("Error compressing image:", error);
                toast.error("Failed to process image.", { id: toastId });
            }
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim() && address.trim()) {
            saveShopInfo({ name, address, logoUrl: logo });
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
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Shop Logo (Optional)</label>
                            {logo ? (
                                <div className="flex items-center gap-4">
                                    <img src={logo} alt="Logo Preview" className="h-16 w-16 object-cover rounded-md shadow-sm" />
                                    <Button type="button" variant="secondary" size="sm" onClick={() => setLogo(undefined)}>
                                        <X className="h-4 w-4 mr-2" /> Remove
                                    </Button>
                                </div>
                            ) : (
                                <>
                                    <input
                                        type="file"
                                        id="logo-upload"
                                        className="hidden"
                                        accept="image/png, image/jpeg, image/webp"
                                        onChange={handleLogoChange}
                                    />
                                    <label
                                        htmlFor="logo-upload"
                                        className="cursor-pointer flex items-center justify-center w-full px-4 py-6 border-2 border-gray-300 border-dashed rounded-md text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                                    >
                                        <Upload className="h-5 w-5 mr-2" />
                                        Click to upload an image
                                    </label>
                                </>
                            )}
                        </div>
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