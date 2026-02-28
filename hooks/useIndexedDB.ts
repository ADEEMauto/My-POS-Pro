
import { useState, useEffect, useCallback, useRef } from 'react';

const DB_NAME = 'ShopSyncDB';
const DB_VERSION = 3; // Bumped to 3
const STORE_NAME = 'appDataStore';
const KEY = 'appData';

interface IDBHook<T> {
    data: T | null;
    setData: (valueOrUpdater: T | ((prev: T) => T)) => Promise<void>;
    loading: boolean;
}

function useIndexedDB<T>(initialValue: T): IDBHook<T> {
    const [data, setStateData] = useState<T | null>(null);
    const [loading, setLoading] = useState(true);
    const dbRef = useRef<IDBDatabase | null>(null);
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

            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const getRequest = store.get(KEY);

            getRequest.onsuccess = () => {
                if (!isMounted.current) return;
                
                if (getRequest.result !== undefined) {
                    setStateData(getRequest.result);
                } else {
                    console.log("IndexedDB: Empty, initializing with default data.");
                    setStateData(initialValue);
                    // Persist initial value so subsequent reads/updates are stable
                    try {
                        const transaction = db.transaction(STORE_NAME, 'readwrite');
                        transaction.objectStore(STORE_NAME).put(initialValue, KEY);
                    } catch (e) {
                        console.warn("IndexedDB: Failed to persist initial value", e);
                    }
                }
                setLoading(false);
            };

            getRequest.onerror = (e) => {
                console.error('IndexedDB: Read error:', e);
                if (isMounted.current) {
                    setStateData(initialValue);
                    setLoading(false);
                }
            };
        };

        request.onerror = (event) => {
            console.error('IndexedDB: Open error:', (event.target as IDBOpenDBRequest).error);
            if (isMounted.current) setLoading(false);
        };

        return () => {
            isMounted.current = false;
        };
    }, []);

    const setData = useCallback(async (valueOrUpdater: T | ((prev: T) => T)) => {
        return new Promise<void>((resolve, reject) => {
            if (!dbRef.current) {
                const err = new Error("Database connection not ready.");
                console.error(err);
                reject(err);
                return;
            }

            setStateData(prev => {
                // If prev is null, we are likely in a race condition where the initial load 
                // hasn't finished or returned null. We must use initialValue to avoid wiping data.
                const currentData = prev !== null ? prev : initialValue;

                const newValue = typeof valueOrUpdater === 'function' 
                    ? (valueOrUpdater as (prev: T) => T)(currentData) 
                    : valueOrUpdater;

                try {
                    const transaction = dbRef.current!.transaction(STORE_NAME, 'readwrite');
                    const store = transaction.objectStore(STORE_NAME);
                    const request = store.put(newValue, KEY);

                    transaction.oncomplete = () => resolve();
                    transaction.onerror = (event) => {
                        console.error('IndexedDB: Write error:', event);
                        reject(transaction.error);
                    };
                    request.onerror = (event) => {
                        console.error('IndexedDB: Put request error:', event);
                        reject((event.target as IDBRequest).error);
                    };
                } catch (error) {
                    console.error("IndexedDB: Transaction creation failed:", error);
                    reject(error);
                }

                return newValue;
            });
        });
    }, [initialValue]);

    return { data, setData, loading };
}

export default useIndexedDB;
