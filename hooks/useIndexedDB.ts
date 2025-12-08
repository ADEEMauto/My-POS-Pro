
import { useState, useEffect, useCallback, useRef } from 'react';

const DB_NAME = 'ShopSyncDB';
const DB_VERSION = 1;
const STORE_NAME = 'appDataStore';
const KEY = 'appData';

interface IDBHook<T> {
    data: T | null;
    setData: (value: T) => Promise<void>;
    loading: boolean;
}

function useIndexedDB<T>(initialValue: T): IDBHook<T> {
    const [data, setStateData] = useState<T | null>(null);
    const [loading, setLoading] = useState(true);
    const dbRef = useRef<IDBDatabase | null>(null);
    
    // We use a ref to track if the hook is mounted to prevent state updates on unmounted components
    // but we intentionally DO NOT close the DB connection on unmount to handle StrictMode correctly.
    const isMounted = useRef(true);

    useEffect(() => {
        isMounted.current = true;
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };

        request.onsuccess = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            dbRef.current = db;

            // Generic error handler
            db.onerror = (e: Event) => {
                console.error("IndexedDB generic error:", (e.target as any).error);
            };

            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const getRequest = store.get(KEY);

            getRequest.onsuccess = () => {
                if (!isMounted.current) return;
                
                if (getRequest.result !== undefined) {
                    console.log("IndexedDB: Data loaded successfully.");
                    setStateData(getRequest.result);
                } else {
                    console.log("IndexedDB: No data found, using initial value.");
                    setStateData(initialValue);
                }
                setLoading(false);
            };

            getRequest.onerror = (e) => {
                if (!isMounted.current) return;
                console.error('IndexedDB: Error reading data:', e);
                // Fallback to initial value on error, but don't save it yet
                setStateData(initialValue);
                setLoading(false);
            };
        };

        request.onerror = (event) => {
            if (!isMounted.current) return;
            console.error('IndexedDB: Error opening database:', (event.target as IDBOpenDBRequest).error);
            setLoading(false);
        };

        return () => {
            isMounted.current = false;
            // NOTE: We deliberately do NOT close the DB connection here.
            // React Strict Mode mounts/unmounts components rapidly. Closing the DB here
            // causes the subsequent mount to fail or encounter a "closing" connection.
            // Browsers manage IDB connections efficiently; keeping it open is safe for this app.
        };
    }, []); // Run once on mount

    const setData = useCallback(async (value: T) => {
        // Optimistically update state
        setStateData(value);

        return new Promise<void>((resolve, reject) => {
            if (!dbRef.current) {
                console.error("IndexedDB: Database not ready, cannot save.");
                reject(new Error("Database not ready"));
                return;
            }

            try {
                const transaction = dbRef.current.transaction(STORE_NAME, 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.put(value, KEY);

                transaction.oncomplete = () => {
                    resolve();
                };

                transaction.onerror = (event) => {
                    console.error('IndexedDB: Transaction error:', event);
                    reject(transaction.error);
                };

                request.onerror = (event) => {
                    console.error('IndexedDB: Put request error:', event);
                    reject((event.target as IDBRequest).error);
                };
            } catch (error) {
                console.error("IndexedDB: Failed to initiate transaction:", error);
                reject(error);
            }
        });
    }, []);

    return { data, setData, loading };
}

export default useIndexedDB;
