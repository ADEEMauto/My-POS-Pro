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
    items: SaleItem[];
    total: number;
    date: string; // ISO string
}