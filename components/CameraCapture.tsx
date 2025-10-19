import React, { useRef, useEffect, useState } from 'react';
import Button from './ui/Button';
import toast from 'react-hot-toast';
import { Camera, X } from 'lucide-react';

interface CameraCaptureProps {
    onCapture: (imageDataUrl: string) => void;
    onClose: () => void;
}

const CameraCapture: React.FC<CameraCaptureProps> = ({ onCapture, onClose }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [hasCamera, setHasCamera] = useState(true);

    useEffect(() => {
        const startCamera = async () => {
            try {
                // Prioritize environment camera
                const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    streamRef.current = stream;
                }
            } catch (err) {
                 try {
                     // Fallback to any available camera
                    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                    if (videoRef.current) {
                        videoRef.current.srcObject = stream;
                        streamRef.current = stream;
                    }
                } catch (finalErr) {
                    console.error("Error accessing camera:", finalErr);
                    toast.error("Could not access camera. Please check permissions.");
                    setHasCamera(false);
                }
            }
        };

        startCamera();

        return () => {
            // Stop camera stream on component unmount
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    const handleCapture = () => {
        if (videoRef.current) {
            const canvas = document.createElement('canvas');
            const video = videoRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const context = canvas.getContext('2d');
            if (context) {
                context.drawImage(video, 0, 0, canvas.width, canvas.height);
                // Compress the image here (e.g., JPEG at 70% quality)
                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                onCapture(dataUrl);
            } else {
                toast.error("Could not process image.");
            }
        }
    };

    if (!hasCamera) {
         return (
            <div className="text-center p-4">
                <p className="text-red-600 font-semibold">Camera not available.</p>
                <p className="text-sm text-gray-500 mt-2">Please ensure your device has a camera and you have granted permission for this site to use it.</p>
                 <Button variant="secondary" onClick={onClose} className="mt-4">Close</Button>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center gap-4">
            <div className="w-full rounded-lg overflow-hidden border bg-gray-200">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-auto block"></video>
            </div>
            <div className="flex gap-2">
                <Button onClick={handleCapture} className="flex-1 flex items-center justify-center gap-2">
                    <Camera size={18} /> Capture Photo
                </Button>
                <Button variant="secondary" onClick={onClose} className="flex items-center justify-center gap-2">
                    <X size={18} /> Cancel
                </Button>
            </div>
        </div>
    );
};

export default CameraCapture;
