export interface ShopInfo {
    name: string;
    address: string;
    logoUrl?: string;
    receiptLogoSize?: number;
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
    loyaltyDiscount?: number; // Discount from redeemed loyalty points
    laborCharges?: number;
    total: number; // Final amount
    amountPaid: number;
    paymentStatus: 'Paid' | 'Partial' | 'Unpaid';
    balanceDue: number;
    previousBalanceBroughtForward?: number;
    date: string; // ISO string
    pointsEarned?: number;
    redeemedPoints?: number;
    finalLoyaltyPoints?: number;
    promotionApplied?: {
        name: string;
        multiplier: number;
    };
    tierApplied?: {
        name: string;
        multiplier: number;
    };
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
    loyaltyPoints: number;
    tierId: string | null;
    balance: number;
}

export interface EarningRule {
    id: string;
    minSpend: number;
    maxSpend: number | null; // null for the highest tier
    pointsPerHundred: number;
}

export interface RedemptionRule {
    method: 'fixedValue' | 'percentage';
    // For 'fixedValue': points required for 1 unit of currency discount (e.g., 1 point = 1 Rs)
    // `points`: 1, `value`: 1
    points: number; 
    // For 'percentage': points required for a 1% discount
    // `points`: 100, `value`: 1
    value: number; 
}

export interface Promotion {
    id: string;
    name: string;
    startDate: string; // ISO Date string YYYY-MM-DD
    endDate: string;   // ISO Date string YYYY-MM-DD
    multiplier: number;
}

export interface LoyaltyTransaction {
    id: string;
    customerId: string;
    type: 'earned' | 'redeemed' | 'manual_add' | 'manual_subtract';
    points: number; // always a positive value
    date: string; // ISO string
    relatedSaleId?: string;
    reason?: string;
    pointsBefore: number;
    pointsAfter: number;
}

export interface LoyaltyExpirySettings {
    enabled: boolean;
    inactivityPeriodValue: number;
    inactivityPeriodUnit: 'days' | 'months' | 'years';
    pointsLifespanValue: number;
    pointsLifespanUnit: 'days' | 'months' | 'years';
    reminderPeriodValue: number;
    reminderPeriodUnit: 'days' | 'months' | 'years';
}

export interface CustomerTier {
    id: string;
    name: string;
    minVisits: number;
    minSpend: number;
    periodValue: number;
    periodUnit: 'days' | 'months' | 'years';
    pointsMultiplier: number;
    rank: number; // Higher is better
}

export interface Expense {
    id: string;
    description: string;
    amount: number;
    date: string; // ISO string
    category: string;
}