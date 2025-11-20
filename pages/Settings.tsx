
import React, { useRef, useState, useEffect } from 'react';
import { useAppContext } from '../contexts/AppContext';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { Download, Upload, Server, AlertTriangle, Building, MapPin, Save, X, MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';
import useLocalStorage from '../hooks/useLocalStorage';
import { compressImage } from '../utils/helpers';
import { ShopInfo } from '../types';

const Settings: React.FC = () => {
    const { currentUser, shopInfo, saveShopInfo, backupData, restoreData } = useAppContext();
    const restoreInputRef = useRef<HTMLInputElement>(null);
    const [backupFrequency, setBackupFrequency] = useLocalStorage('backupFrequency', 'daily');
    const [shopDetails, setShopDetails] = useState<ShopInfo & { receiptLogoSize: number; pdfLogoSize: number }>({
        name: '',
        address: '',
        logoUrl: undefined,
        receiptLogoSize: 9,
        pdfLogoSize: 50,
        whatsappReminderTemplate: '',
    });
    // Separate state for the template to allow independent saving by sub-accounts if needed, 
    // although we will save it via saveShopInfo which updates the whole object.
    const [reminderTemplate, setReminderTemplate] = useState('');

    const isMaster = currentUser?.role === 'master';
    
    useEffect(() => {
        if (shopInfo) {
            setShopDetails({
                name: shopInfo.name,
                address: shopInfo.address,
                logoUrl: shopInfo.logoUrl,
                receiptLogoSize: shopInfo.receiptLogoSize ?? 9,
                pdfLogoSize: shopInfo.pdfLogoSize ?? 50,
                whatsappReminderTemplate: shopInfo.whatsappReminderTemplate,
            });
            setReminderTemplate(shopInfo.whatsappReminderTemplate || "Hello {name}, this is a friendly reminder from {shopName} that your service for bike {bikeNumber} is due. Please contact us to schedule an appointment.");
        }
    }, [shopInfo]);

    const handleRestore = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result as string;
                const data = JSON.parse(text);
                restoreData(data); // Use context function
            } catch (error) {
                toast.error("Invalid backup file.");
                console.error("Restore error:", error);
            }
        };
        reader.readAsText(file);
        // Reset file input
        event.target.value = '';
    };

    const handleDetailsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type } = e.target;
        setShopDetails(prev => ({
            ...prev,
            [name]: type === 'range' ? Number(value) : value
        }));
    };

    const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const toastId = toast.loading('Processing image...');
            try {
                const compressedLogo = await compressImage(file);
                setShopDetails({ ...shopDetails, logoUrl: compressedLogo });
                toast.success('Logo updated!', { id: toastId });
            } catch (error) {
                console.error("Error compressing image:", error);
                toast.error("Failed to process image.", { id: toastId });
            }
        }
    };

    const handleSaveChanges = (e: React.FormEvent) => {
        e.preventDefault();
        if (shopDetails.name.trim() && shopDetails.address.trim()) {
            saveShopInfo({
                name: shopDetails.name.trim(),
                address: shopDetails.address.trim(),
                logoUrl: shopDetails.logoUrl,
                receiptLogoSize: shopDetails.receiptLogoSize,
                pdfLogoSize: shopDetails.pdfLogoSize,
                whatsappReminderTemplate: shopDetails.whatsappReminderTemplate,
            });
            toast.success("Shop details updated successfully!");
        } else {
            toast.error("Shop name and address cannot be empty.");
        }
    };

    const handleSaveTemplate = () => {
        if(shopInfo) {
            saveShopInfo({
                ...shopInfo,
                whatsappReminderTemplate: reminderTemplate
            });
            toast.success("WhatsApp reminder template updated!");
        }
    }
    
    return (
        <div className="space-y-8 max-w-3xl mx-auto">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Settings</h1>

            {isMaster && (
                <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold text-gray-800 mb-4">Shop Information</h2>
                    <form onSubmit={handleSaveChanges} className="space-y-4">
                        <Input
                            label="Shop Name"
                            name="name"
                            value={shopDetails.name}
                            onChange={handleDetailsChange}
                            icon={<Building className="h-5 w-5 text-gray-400" />}
                            required
                        />
                        <Input
                            label="Shop Address"
                            name="address"
                            value={shopDetails.address}
                            onChange={handleDetailsChange}
                            icon={<MapPin className="h-5 w-5 text-gray-400" />}
                            required
                        />
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Shop Logo (Optional)</label>
                            {shopDetails.logoUrl ? (
                                <div className="flex items-center gap-4">
                                    <img src={shopDetails.logoUrl} alt="Logo Preview" className="h-16 w-16 object-cover rounded-md shadow-sm" />
                                    <Button type="button" variant="secondary" size="sm" onClick={() => setShopDetails({ ...shopDetails, logoUrl: undefined })}>
                                        <X className="h-4 w-4 mr-2" /> Remove
                                    </Button>
                                </div>
                            ) : (
                                <>
                                    <input
                                        type="file"
                                        id="logo-upload-settings"
                                        className="hidden"
                                        accept="image/png, image/jpeg, image/webp"
                                        onChange={handleLogoChange}
                                    />
                                    <label
                                        htmlFor="logo-upload-settings"
                                        className="cursor-pointer flex items-center justify-center w-full px-4 py-6 border-2 border-gray-300 border-dashed rounded-md text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                                    >
                                        <Upload className="h-5 w-5 mr-2" />
                                        Click to upload an image
                                    </label>
                                </>
                            )}
                        </div>

                        <div>
                            <label htmlFor="logo-size-slider" className="block text-sm font-medium text-gray-700 mb-2">
                                Receipt Logo Size: <span className="font-bold">{shopDetails.receiptLogoSize}rem</span>
                            </label>
                            <input
                                id="logo-size-slider"
                                type="range"
                                name="receiptLogoSize"
                                min="2"
                                max="50"
                                step="1"
                                value={shopDetails.receiptLogoSize}
                                onChange={handleDetailsChange}
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                            />
                             <div className="flex justify-between text-xs text-gray-500 mt-1">
                                <span>Small</span>
                                <span>Large</span>
                            </div>
                        </div>
                        
                        <div>
                            <label htmlFor="pdf-logo-size-slider" className="block text-sm font-medium text-gray-700 mb-2">
                                PDF Report Logo Size: <span className="font-bold">{shopDetails.pdfLogoSize}px</span>
                            </label>
                            <input
                                id="pdf-logo-size-slider"
                                type="range"
                                name="pdfLogoSize"
                                min="20"
                                max="300"
                                step="5"
                                value={shopDetails.pdfLogoSize}
                                onChange={handleDetailsChange}
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                            />
                             <div className="flex justify-between text-xs text-gray-500 mt-1">
                                <span>Small</span>
                                <span>Large</span>
                            </div>
                        </div>

                        <div className="flex justify-end pt-2 border-t">
                            <Button type="submit" className="flex items-center gap-2">
                                <Save size={18} /> Save Changes
                            </Button>
                        </div>
                    </form>
                </div>
            )}
            
            {/* Communication Settings - Accessible to Master and Sub accounts */}
            <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
                <div className="flex items-center gap-3 mb-4">
                    <MessageSquare className="w-6 h-6 text-green-600" />
                    <h2 className="text-xl font-semibold text-gray-800">Communication Settings</h2>
                </div>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Default WhatsApp Service Reminder Template</label>
                        <p className="text-xs text-gray-500 mb-2">
                            Use placeholders: <span className="font-mono bg-gray-100 px-1 rounded">{`{name}`}</span> for Customer Name, <span className="font-mono bg-gray-100 px-1 rounded">{`{bikeNumber}`}</span> for Bike Number, and <span className="font-mono bg-gray-100 px-1 rounded">{`{shopName}`}</span> for Shop Name.
                        </p>
                        <textarea
                            rows={4}
                            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                            value={reminderTemplate}
                            onChange={(e) => setReminderTemplate(e.target.value)}
                            placeholder="Hello {name}, this is a reminder that..."
                        />
                    </div>
                    <div className="flex justify-end">
                        <Button onClick={handleSaveTemplate} className="flex items-center gap-2">
                            <Save size={18} /> Save Template
                        </Button>
                    </div>
                </div>
            </div>

            <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
                <div className="flex items-center gap-3 mb-4">
                    <Server className="w-6 h-6 text-primary-600" />
                    <h2 className="text-xl font-semibold text-gray-800">Data Backup & Restore</h2>
                </div>
                
                {isMaster && (
                    <div className="bg-blue-50 text-blue-800 p-4 rounded-md text-sm mb-6">
                        <strong>Note on Google Drive Integration:</strong> A direct, automatic backup to Google Drive requires complex server-side authentication. For this client-side app, we provide manual backup (download) and restore (upload) functionality. Please keep your downloaded backup files in a safe place, like your own Google Drive.
                    </div>
                )}

                <div className="space-y-4">
                     {isMaster && (
                        <div>
                            <label htmlFor="backup-frequency" className="block text-sm font-medium text-gray-700 mb-1">Backup Frequency Reminder</label>
                            <select
                                id="backup-frequency"
                                value={backupFrequency}
                                onChange={(e) => setBackupFrequency(e.target.value)}
                                className="w-full md:w-1/2 p-2 border rounded-md"
                            >
                                <option value="daily">Daily</option>
                                <option value="weekly">Weekly</option>
                                <option value="monthly">Monthly</option>
                            </select>
                            <p className="text-xs text-gray-500 mt-1">This sets a reminder for you to perform a manual backup. Automatic backup is not supported.</p>
                        </div>
                     )}

                    <div className="flex flex-col md:flex-row gap-4">
                        <Button onClick={backupData} className="w-full md:w-auto flex-1 gap-2">
                            <Download size={18} /> Create & Download Backup
                        </Button>
                        {isMaster && (
                            <>
                                <input type="file" ref={restoreInputRef} onChange={handleRestore} accept=".json" className="hidden"/>
                                <Button onClick={() => restoreInputRef.current?.click()} variant="secondary" className="w-full md:w-auto flex-1 gap-2">
                                     <Upload size={18} /> Restore from Backup
                                </Button>
                            </>
                        )}
                    </div>
                </div>
                
                {isMaster && (
                    <div className="mt-6 bg-red-50 text-red-800 p-4 rounded-md border-l-4 border-red-500">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <AlertTriangle className="h-5 w-5 text-red-400" aria-hidden="true" />
                            </div>
                            <div className="ml-3">
                                <h3 className="text-sm font-medium">Warning</h3>
                                <div className="mt-2 text-sm">
                                    <p>Restoring from a backup will completely overwrite all existing data in the application. This action cannot be undone. Please be absolutely sure before proceeding.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Settings;
