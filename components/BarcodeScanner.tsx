
import React, { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';

declare global {
    interface Window {
        Html5Qrcode: any;
    }
}

interface BarcodeScannerProps {
    onScanSuccess: (decodedText: string) => void;
    onScanFailure?: (error: string) => void;
}

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onScanSuccess, onScanFailure }) => {
    const readerRef = useRef<HTMLDivElement>(null);
    const scannerRef = useRef<any>(null);

    useEffect(() => {
        if (readerRef.current && !scannerRef.current) {
            const html5QrCode = new window.Html5Qrcode(readerRef.current.id);
            scannerRef.current = html5QrCode;

            const startScanner = async () => {
                try {
                    const cameras = await window.Html5Qrcode.getCameras();
                    if (cameras && cameras.length) {
                        html5QrCode.start(
                            { facingMode: "environment" },
                            {
                                fps: 10,
                                qrbox: { width: 250, height: 250 },
                            },
                            (decodedText: string) => {
                                onScanSuccess(decodedText);
                            },
                            (errorMessage: string) => {
                                if (onScanFailure) {
                                    onScanFailure(errorMessage);
                                }
                            }
                        ).catch((err: any) => {
                            console.error("Error starting scanner: ", err);
                            toast.error("Could not start scanner. Please grant camera permissions.");
                        });
                    } else {
                        toast.error("No cameras found.");
                    }
                } catch (err) {
                     console.error("Camera access error: ", err);
                     toast.error("Failed to get camera permissions.");
                }
            };
            
            startScanner();
        }

        return () => {
            if (scannerRef.current && scannerRef.current.isScanning) {
                scannerRef.current.stop().catch((err: any) => {
                    console.error("Failed to stop scanner", err);
                });
                scannerRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [onScanSuccess, onScanFailure]);

    return <div id="barcode-reader" ref={readerRef} className="w-full rounded-lg overflow-hidden border"></div>;
};

export default BarcodeScanner;
