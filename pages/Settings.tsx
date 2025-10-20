import React, { useRef, useState } from 'react';
import { useAppContext } from '../contexts/AppContext';
import Button from '../components/ui/Button';
import { Download, Upload, Server, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import useLocalStorage from '../hooks/useLocalStorage';

const Settings: React.FC = () => {
    const { currentUser } = useAppContext();
    const restoreInputRef = useRef<HTMLInputElement>(null);
    const [backupFrequency, setBackupFrequency] = useLocalStorage('backupFrequency', 'daily');

    const isMaster = currentUser?.role === 'master';
    
    const handleBackup = () => {
        const dataToBackup: { [key: string]: any } = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key) {
                dataToBackup[key] = JSON.parse(localStorage.getItem(key)!);
            }
        }

        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dataToBackup, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `shopsync_backup_${new Date().toISOString().split('T')[0]}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        toast.success("Backup created successfully!");
    };
    
    const handleRestore = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!window.confirm("Are you sure you want to restore? This will overwrite all current data.")) {
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result as string;
                const data = JSON.parse(text);
                
                // Clear existing local storage before restoring
                localStorage.clear();

                Object.keys(data).forEach(key => {
                    localStorage.setItem(key, JSON.stringify(data[key]));
                });

                toast.success("Data restored successfully! The app will now reload.");
                setTimeout(() => window.location.reload(), 1500);

            } catch (error) {
                toast.error("Invalid backup file.");
                console.error("Restore error:", error);
            }
        };
        reader.readAsText(file);
    };
    
    return (
        <div className="space-y-8 max-w-3xl mx-auto">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Settings</h1>

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
                        <Button onClick={handleBackup} className="w-full md:w-auto flex-1 gap-2">
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