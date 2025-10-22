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
    discount: number;
    discountType: 'fixed' | 'percentage';
}

export interface SaleItem {
    productId: string;
    name: string;
    quantity: number;
    originalPrice: number; // Original sale price per item
    discount: number; // The value of the discount (e.g. 50 or 10)
    discountType: 'fixed' | 'percentage';
    price: number; // Final price per item after discount
    purchasePrice: number; // Purchase price per item at time of sale
}

export interface Sale {
    id: string;
    customerId: string; // The bike number
    customerName: string;
    items: SaleItem[];
    subtotal: number; // Sum of original prices before any discounts
    totalItemDiscounts: number; // Sum of all calculated item-level discounts
    overallDiscount: number; // The value of the discount (e.g. 500 or 15)
    overallDiscountType: 'fixed' | 'percentage';
    total: number; // Final amount
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