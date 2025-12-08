
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
    const isMounted = useRef(true);

    useEffect(() => {
        isMounted.current = true;
        let db: IDBDatabase | null = null;

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const dbInstance = (event.target as IDBOpenDBRequest).result;
            if (!dbInstance.objectStoreNames.contains(STORE_NAME)) {
                dbInstance.createObjectStore(STORE_NAME);
            }
        };

        request.onsuccess = (event) => {
            db = (event.target as IDBOpenDBRequest).result;
            dbRef.current = db;

            // Database opened, now read data
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const getRequest = store.get(KEY);

            getRequest.onsuccess = () => {
                if (isMounted.current) {
                    if (getRequest.result !== undefined) {
                        setStateData(getRequest.result);
                    } else {
                        // Key doesn't exist yet, stick with initial value but don't write it yet
                        // to avoid overwriting potential existing data in a race condition.
                        setStateData(initialValue);
                    }
                    setLoading(false);
                }
            };

            getRequest.onerror = (e) => {
                console.error('IndexedDB read error:', e);
                if (isMounted.current) {
                    setStateData(initialValue);
                    setLoading(false);
                }
            };
        };

        request.onerror = (event) => {
            console.error('IndexedDB open error:', (event.target as IDBOpenDBRequest).error);
            if (isMounted.current) {
                setLoading(false);
            }
        };

        return () => {
            isMounted.current = false;
            if (db) {
                db.close();
            }
        };
    }, []); // Only run on mount

    const setData = useCallback(async (value: T) => {
        // Optimistic UI update
        setStateData(value);

        return new Promise<void>((resolve, reject) => {
            const db = dbRef.current;
            if (!db) {
                // If DB isn't ready (extremely rare if loading is false), 
                // we try to reopen it or fail.
                const error = new Error("Database connection is not open.");
                console.error(error.message);
                reject(error);
                return;
            }

            try {
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
                    console.error('IndexedDB put error:', event);
                    reject((event.target as IDBRequest).error);
                };
            } catch (err) {
                console.error("Error creating transaction:", err);
                reject(err);
            }
        });
    }, []);

    return { data, setData, loading };
}

export default useIndexedDB;
