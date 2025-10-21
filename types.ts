export interface ShopInfo {
    name: string;
    address: string;
}

export type UserRole = 'master' | 'sub';

export interface User {
    id: string;
    username: string;
    passwordHash: string; // Storing hashed passwords is best practice
    role: UserRole;
}

export interface Category {
    id: string;
    name: string;
    parentId: string | null;
}

export interface Product {
    id: string;
    name: string;
    categoryId: string;
    subCategoryId: string | null;
    manufacturer: string;
    location: string;
    quantity: number;
    purchasePrice: number;
    salePrice: number;
    imageUrl?: string;
    barcode?: string;
}

export interface CartItem extends Product {
    cartQuantity: number;
}

export interface SaleItem {
    productId: string;
    name: string;
    quantity: number;
    price: number; // Sale price per item
    purchasePrice: number; // Purchase price per item at time of sale
}

export interface Sale {
    id: string;
    customerId: string; // The bike number
    customerName: string;
    items: SaleItem[];
    total: number;
    date: string; // ISO string
}

export interface Customer {
    id: string; // Bike number, unique identifier
    name: string;
    saleIds: string[];
    firstSeen: string; // ISO Date string
    lastSeen: string; // ISO Date string
    contactNumber?: string;
    servicingNotes?: string;
    nextServiceDate?: string; // ISO Date string for manual override
    serviceFrequencyValue?: number;
    serviceFrequencyUnit?: 'days' | 'months' | 'years';
}
