import { useState, useEffect, useCallback } from 'react';

const DB_NAME = 'ShopSyncDB';
const DB_VERSION = 1;
const STORE_NAME = 'appDataStore';
const KEY = 'appData';

interface IDBHook<T> {
    data: T | null;
    setData: (value: T) => Promise<void>;
    loading: boolean;
}

// Helper function to promisify IDB requests (used for get)
function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function useIndexedDB<T>(initialValue: T): IDBHook<T> {
    const [data, setStateData] = useState<T | null>(null);
    const [loading, setLoading] = useState(true);
    const [db, setDb] = useState<IDBDatabase | null>(null);

    useEffect(() => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const dbInstance = (event.target as IDBOpenDBRequest).result;
            if (!dbInstance.objectStoreNames.contains(STORE_NAME)) {
                dbInstance.createObjectStore(STORE_NAME);
            }
        };

        request.onsuccess = (event) => {
            const dbInstance = (event.target as IDBOpenDBRequest).result;
            setDb(dbInstance);

            const transaction = dbInstance.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const getRequest = store.get(KEY);

            promisifyRequest(getRequest)
                .then((storedData) => {
                    setStateData((storedData as T) || initialValue);
                })
                .catch((error) => {
                    console.error('Failed to retrieve data from IndexedDB:', error);
                    setStateData(initialValue);
                })
                .finally(() => {
                    setLoading(false);
                });
        };

        request.onerror = (event) => {
            console.error('IndexedDB error:', (event.target as IDBOpenDBRequest).error);
            setStateData(initialValue);
            setLoading(false);
        };
    }, []);

    const setData = useCallback(async (value: T) => {
        // Optimistically update state
        setStateData(value);

        if (!db) {
            console.warn("Database not initialized, cannot save data.");
            return;
        }

        return new Promise<void>((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(value, KEY);

            transaction.oncomplete = () => {
                resolve();
            };

            transaction.onerror = (event) => {
                console.error('IndexedDB transaction error:', event);
                reject(transaction.error);
            };

            request.onerror = (event) => {
                console.error('IndexedDB put request error:', event);
                // transaction.onerror will also fire
            };
        });
    }, [db]);

    return { data, setData, loading };
}

export default useIndexedDB;
