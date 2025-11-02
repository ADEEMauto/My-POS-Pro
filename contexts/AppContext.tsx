import React, { createContext, useContext, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ShopInfo, User, UserRole, Category, Product, Sale, SaleItem, Customer, CartItem, EarningRule, RedemptionRule, Promotion, LoyaltyTransaction, LoyaltyExpirySettings, CustomerTier, Expense, Payment, DemandItem } from '../types';
import useIndexedDB from '../hooks/useIndexedDB';
import { SAMPLE_PRODUCTS, SAMPLE_CATEGORIES } from '../constants';
import toast from 'react-hot-toast';

// Helper for hashing passwords
const simpleHash = async (password: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

interface AppData {
    shopInfo: ShopInfo | null;
    users: User[];
    currentUser: User | null;
    inventory: Product[];
    categories: Category[];
    sales: Sale[];
    customers: Customer[];
    earningRules: EarningRule[];
    redemptionRule: RedemptionRule;
    promotions: Promotion[];
    loyaltyTransactions: LoyaltyTransaction[];
    loyaltyExpirySettings: LoyaltyExpirySettings;
    customerTiers: CustomerTier[];
    expenses: Expense[];
    payments: Payment[];
    demandItems: DemandItem[];
}


interface AppContextType {
    shopInfo: ShopInfo | null;
    saveShopInfo: (info: ShopInfo) => void;
    users: User[];
    currentUser: User | null;
    signUp: (username: string, password: string) => Promise<boolean>;
    login: (username: string, password: string) => Promise<boolean>;
    logout: () => void;
    addUser: (username: string, password: string) => Promise<boolean>;
    deleteUser: (userId: string) => void;
    updateUser: (userId: string, updates: Partial<Omit<User, 'id'>>) => Promise<boolean>;
    inventory: Product[];
    addProduct: (product: Omit<Product, 'id'>) => void;
    updateProduct: (product: Product) => void;
    deleteProduct: (productId: string) => void;
    addStock: (productId: string, quantity: number, newSalePrice?: number) => void;
    findProductByBarcode: (barcode: string) => Product | undefined;
    addSampleData: () => void;
    importFromExcel: (data: any[]) => void;
    categories: Category[];
    addCategory: (name: string, parentId: string | null) => void;
    updateCategory: (id: string, name: string) => void;
    deleteCategory: (id: string) => void;
    sales: Sale[];
    createSale: (
        cart: CartItem[], 
        overallDiscount: number, 
        overallDiscountType: 'fixed' | 'percentage', 
        customerDetails: { customerName: string; bikeNumber: string; contactNumber?: string, serviceFrequencyValue?: number, serviceFrequencyUnit?: 'days'|'months'|'years' },
        pointsToRedeem: number,
        tuningCharges: number,
        laborCharges: number,
        amountPaid: number
    ) => Sale | null;
    reverseSale: (saleId: string, itemsToReturn: SaleItem[]) => void;
    updateSale: (saleId: string, updates: Partial<Sale>) => void;
    customers: Customer[];
    updateCustomer: (customerId: string, updates: Partial<Customer>) => boolean;
    adjustCustomerPoints: (customerId: string, points: number, reason: string) => boolean;
    recordCustomerPayment: (customerId: string, amount: number, notes?: string) => boolean;
    earningRules: EarningRule[];
    updateEarningRules: (rules: EarningRule[]) => void;
    redemptionRule: RedemptionRule;
    updateRedemptionRule: (rule: RedemptionRule) => void;
    promotions: Promotion[];
    addPromotion: (promo: Omit<Promotion, 'id'>) => void;
    updatePromotion: (promo: Promotion) => void;
    deletePromotion: (promoId: string) => void;
    loyaltyTransactions: LoyaltyTransaction[];
    loyaltyExpirySettings: LoyaltyExpirySettings;
    updateLoyaltyExpirySettings: (settings: LoyaltyExpirySettings) => void;
    customerTiers: CustomerTier[];
    updateCustomerTiers: (tiers: CustomerTier[]) => void;
    expenses: Expense[];
    addExpense: (expense: Omit<Expense, 'id'>) => void;
    updateExpense: (expense: Expense) => void;
    deleteExpense: (expenseId: string) => void;
    payments: Payment[];
    demandItems: DemandItem[];
    addDemandItem: (item: Omit<DemandItem, 'id'>) => void;
    addMultipleDemandItems: (items: Omit<DemandItem, 'id'>[]) => void;
    updateDemandItem: (item: DemandItem) => void;
    deleteDemandItem: (itemId: string) => void;
    backupData: () => void;
    restoreData: (data: any) => Promise<void>;
    loading: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    
    const initialState: AppData = {
        shopInfo: null,
        users: [],
        currentUser: null,
        inventory: [],
        categories: [],
        sales: [],
        customers: [],
        earningRules: [{ id: 'default', minSpend: 0, maxSpend: null, pointsPerHundred: 1 }],
        redemptionRule: { method: 'fixedValue', points: 1, value: 1 },
        promotions: [],
        loyaltyTransactions: [],
        loyaltyExpirySettings: {
            enabled: false,
            inactivityPeriodValue: 12, inactivityPeriodUnit: 'months',
            pointsLifespanValue: 2, pointsLifespanUnit: 'years',
            reminderPeriodValue: 30, reminderPeriodUnit: 'days',
        },
        customerTiers: [
            { id: uuidv4(), name: 'Bronze', minVisits: 0, minSpend: 0, periodValue: 12, periodUnit: 'months', pointsMultiplier: 1, rank: 0 },
        ],
        expenses: [],
        payments: [],
        demandItems: [],
    };

    const { data: appData, setData: setAppData, loading } = useIndexedDB<AppData>(initialState);

    if (loading || !appData) {
         return (
            <div className="flex items-center justify-center h-screen bg-gray-100">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-24 w-24 border-t-4 border-b-4 border-primary-600 mx-auto"></div>
                    <p className="mt-4 text-lg font-semibold text-gray-700">Loading Your Shop...</p>
                    <p className="text-sm text-gray-500">Please wait while we prepare your data.</p>
                </div>
            </div>
        );
    }

    const {
        shopInfo, users, currentUser, inventory, categories, sales, customers,
        earningRules, redemptionRule, promotions, loyaltyTransactions,
        loyaltyExpirySettings, customerTiers, expenses, payments, demandItems
    } = appData;
    
    // AUTH & USERS
    const saveShopInfo = (info: ShopInfo) => {
        setAppData({ ...appData, shopInfo: info });
    };
    
    const signUp = async (username: string, password: string): Promise<boolean> => {
        if (appData.users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
            toast.error("Username already exists.");
            return false;
        }
        const passwordHash = await simpleHash(password);
        const role: UserRole = appData.users.length === 0 ? 'master' : 'sub';
        const newUser: User = { id: uuidv4(), username, passwordHash, role };
        await setAppData({ ...appData, users: [...appData.users, newUser] });
        toast.success(`User "${username}" created as ${role}.`);
        return true;
    };
    
    const addUser = signUp;
    
    const deleteUser = (userId: string) => {
        const user = appData.users.find(u => u.id === userId);
        if(user && user.role === 'master') {
            toast.error("Cannot delete master account.");
            return;
        }
        setAppData({ ...appData, users: appData.users.filter(u => u.id !== userId) });
        toast.success("User deleted.");
    };

    const login = async (username: string, password: string): Promise<boolean> => {
        const user = appData.users.find(u => u.username.toLowerCase() === username.toLowerCase());
        const passwordHash = await simpleHash(password);
        if (user && user.passwordHash === passwordHash) {
            await setAppData({ ...appData, currentUser: user });
            toast.success(`Welcome, ${user.username}!`);
            return true;
        }
        toast.error("Invalid username or password.");
        return false;
    };

    const logout = () => {
        setAppData({ ...appData, currentUser: null });
        toast.success("Logged out successfully.");
    };
    
    const updateUser = async (userId: string, updates: Partial<Omit<User, 'id'>>) => {
        const userToUpdate = appData.users.find(u => u.id === userId);
        if (!userToUpdate) return false;

        if (updates.username && appData.users.some(u => u.username.toLowerCase() === updates.username!.toLowerCase() && u.id !== userId)) {
            toast.error("Username already exists.");
            return false;
        }
        
        const updatedUsers = appData.users.map(user => user.id === userId ? { ...user, ...updates } : user);
        await setAppData({ ...appData, users: updatedUsers });

        toast.success("Profile updated!");
        return true;
    };

    // INVENTORY
    const addSampleData = () => {
        const productsWithIds = SAMPLE_PRODUCTS.map(p => ({ ...p, id: uuidv4() }));
        setAppData({
            ...appData,
            inventory: productsWithIds,
            categories: SAMPLE_CATEGORIES
        });
        toast.success("Sample data added!");
    };
    
    const importFromExcel = (data: any[]) => {
        try {
            const newProducts: Product[] = [];
            const categoryIdMap = new Map<string, string>();
            appData.categories.forEach(c => categoryIdMap.set(c.id.toLowerCase(), c.id));
            
            data.forEach(row => {
                 if (!row.Name || !row['Category ID'] || !row['Sale Price (Rs)']) {
                    throw new Error(`Row for "${row.Name || 'Unknown'}" is missing required fields.`);
                }
                const categoryId = String(row['Category ID']).toLowerCase();
                const subCategoryId = row['SubCategory ID'] ? String(row['SubCategory ID']).toLowerCase() : null;

                if (!categoryIdMap.has(categoryId)) {
                     throw new Error(`Category ID "${row['Category ID']}" not found. Please create it first.`);
                }
                if (subCategoryId && !categoryIdMap.has(subCategoryId)) {
                    throw new Error(`Sub-Category ID "${row['SubCategory ID']}" not found. Please create it first.`);
                }

                newProducts.push({
                    id: uuidv4(),
                    name: row.Name,
                    manufacturer: row.Manufacturer || 'N/A',
                    categoryId: categoryIdMap.get(categoryId)!,
                    subCategoryId: subCategoryId ? categoryIdMap.get(subCategoryId)! : null,
                    location: row.Location || '',
                    barcode: row.Barcode ? String(row.Barcode) : undefined,
                    quantity: Number(row.Quantity) || 0,
                    purchasePrice: Number(row['Purchase Price (Rs)']) || 0,
                    salePrice: Number(row['Sale Price (Rs)']),
                    imageUrl: row['Image URL'] || undefined,
                });
            });
            setAppData({...appData, inventory: [...appData.inventory, ...newProducts]});
            toast.success(`${newProducts.length} products imported successfully!`);
        } catch (error: any) {
            toast.error(`Import failed: ${error.message}`);
            console.error(error);
        }
    };
    
    const addProduct = (product: Omit<Product, 'id'>) => {
        const newProduct = { ...product, id: uuidv4() };
        setAppData({...appData, inventory: [newProduct, ...appData.inventory]});
        toast.success(`"${newProduct.name}" added to inventory.`);
    };

    const updateProduct = (updatedProduct: Product) => {
        setAppData({...appData, inventory: appData.inventory.map(p => p.id === updatedProduct.id ? updatedProduct : p)});
        toast.success(`"${updatedProduct.name}" updated.`);
    };
    
    const addStock = (productId: string, quantity: number, newSalePrice?: number) => {
        let productName = '';
        const newInventory = appData.inventory.map(p => {
            if (p.id === productId) {
                productName = p.name;
                const updatedProduct = { ...p, quantity: p.quantity + quantity };
                if (newSalePrice !== undefined) {
                    updatedProduct.salePrice = newSalePrice;
                }
                return updatedProduct;
            }
            return p;
        });
        setAppData({...appData, inventory: newInventory });
        toast.success(`${quantity} units added to ${productName}. ${newSalePrice !== undefined ? 'Price updated.' : ''}`);
    };

    const deleteProduct = (productId: string) => {
        const product = appData.inventory.find(p => p.id === productId);
        setAppData({...appData, inventory: appData.inventory.filter(p => p.id !== productId)});
        if (product) toast.success(`"${product.name}" deleted.`);
    };

    const findProductByBarcode = (barcode: string) => appData.inventory.find(p => p.barcode === barcode);

    // CATEGORIES
    const addCategory = (name: string, parentId: string | null) => {
        if (appData.categories.some(c => c.name.toLowerCase() === name.toLowerCase() && c.parentId === parentId)) {
            toast.error("Category with this name already exists.");
            return;
        }
        const newCategory: Category = { id: name.toLowerCase().replace(/\s+/g, '-'), name, parentId };
        setAppData({...appData, categories: [...appData.categories, newCategory]});
        toast.success(`Category "${name}" added.`);
    };

    const updateCategory = (id: string, name: string) => {
        setAppData({...appData, categories: appData.categories.map(c => c.id === id ? { ...c, name } : c)});
        toast.success("Category updated.");
    };

    const deleteCategory = (id: string) => {
        const children = appData.categories.filter(c => c.parentId === id);
        if (children.length > 0 && !window.confirm("This will delete all sub-categories as well. Are you sure?")) {
            return;
        }
        const idsToDelete = [id, ...children.map(c => c.id)];
        const newCategories = appData.categories.filter(c => !idsToDelete.includes(c.id));
        const newInventory = appData.inventory.map(p => {
            if (idsToDelete.includes(p.categoryId)) return { ...p, categoryId: 'uncategorized' };
            if (p.subCategoryId && idsToDelete.includes(p.subCategoryId)) return { ...p, subCategoryId: null };
            return p;
        });
        setAppData({
            ...appData,
            categories: newCategories,
            inventory: newInventory
        });
        toast.success("Category and related sub-categories deleted.");
    };

    // SALES & CUSTOMERS
    const createSale = (...args: Parameters<AppContextType['createSale']>) => {
        const [cart, overallDiscount, overallDiscountType, customerDetails, pointsToRedeem, tuningCharges, laborCharges, amountPaid] = args;
        
        const now = new Date();
        const year = now.getFullYear().toString().slice(-2);
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const day = now.getDate().toString().padStart(2, '0');
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        const seconds = now.getSeconds().toString().padStart(2, '0');
        const saleId = `${year}${month}${day}-${hours}${minutes}${seconds}`;

        let updatedInventory = [...appData.inventory];
        let inventoryUpdated = false;

        const saleItems: SaleItem[] = cart.map(cartItem => {
            if (!cartItem.id.startsWith('manual-')) {
                const productIndex = updatedInventory.findIndex(p => p.id === cartItem.id);
                if (productIndex !== -1) {
                    updatedInventory[productIndex] = {
                        ...updatedInventory[productIndex],
                        quantity: updatedInventory[productIndex].quantity - cartItem.cartQuantity
                    };
                    inventoryUpdated = true;
                }
            }

            const discountAmount = cartItem.discountType === 'fixed'
                ? cartItem.discount
                : (cartItem.salePrice * cartItem.discount) / 100;

            return {
                productId: cartItem.id,
                name: cartItem.name,
                quantity: cartItem.cartQuantity,
                originalPrice: cartItem.salePrice,
                discount: cartItem.discount,
                discountType: cartItem.discountType,
                price: cartItem.salePrice - discountAmount,
                purchasePrice: cartItem.purchasePrice
            };
        });

        // Calculations
        const subtotal = saleItems.reduce((acc, item) => acc + item.originalPrice * item.quantity, 0);
        const totalItemDiscounts = saleItems.reduce((acc, item) => {
            const discount = item.discountType === 'fixed' ? item.discount : (item.originalPrice * item.discount) / 100;
            return acc + (discount * item.quantity);
        }, 0);
        
        const subtotalAfterItemDiscount = subtotal - totalItemDiscounts;
        const totalWithCharges = subtotalAfterItemDiscount + tuningCharges + laborCharges;
        
        const overallDiscountAmount = overallDiscountType === 'fixed'
            ? overallDiscount
            : (totalWithCharges * overallDiscount) / 100;

        let cartTotal = totalWithCharges - overallDiscountAmount;
        
        // Customer & Loyalty Logic
        const bikeNumberUpper = customerDetails.bikeNumber.replace(/\s+/g, '').toUpperCase();
        let existingCustomer = appData.customers.find(c => c.id === bikeNumberUpper);
        let updatedCustomers = [...appData.customers];
        let updatedLoyaltyTransactions = [...appData.loyaltyTransactions];
        let pointsEarned = 0;
        let finalLoyaltyPoints = 0;
        let promotionApplied: Sale['promotionApplied'] = undefined;
        let tierApplied: Sale['tierApplied'] = undefined;

        // Calculate Loyalty Discount
        let loyaltyDiscountAmount = 0;
        if (existingCustomer && pointsToRedeem > 0) {
            if (redemptionRule.method === 'fixedValue') {
                loyaltyDiscountAmount = (pointsToRedeem / redemptionRule.points) * redemptionRule.value;
            } else { // percentage
                const percentage = (pointsToRedeem / redemptionRule.points) * redemptionRule.value;
                loyaltyDiscountAmount = (cartTotal * percentage) / 100;
            }
             // Ensure discount doesn't exceed total
            if (loyaltyDiscountAmount > cartTotal) {
                loyaltyDiscountAmount = cartTotal;
            }
            cartTotal -= loyaltyDiscountAmount;
        }

        const previousBalanceBroughtForward = existingCustomer?.balance || 0;
        const grandTotal = cartTotal + previousBalanceBroughtForward;
        const balanceDue = Math.round(grandTotal - amountPaid);
        const paymentStatus = balanceDue <= 0 ? 'Paid' : (amountPaid > 0 ? 'Partial' : 'Unpaid');

        // Points Earning Calculation
        if (bikeNumberUpper !== 'WALKIN') {
            let eligibleSpend = subtotal; // Points are usually earned on original price
            
            // Find applicable earning rule
            const applicableRule = appData.earningRules
                .filter(r => eligibleSpend >= r.minSpend && (r.maxSpend === null || eligibleSpend <= r.maxSpend))
                .sort((a, b) => b.minSpend - a.minSpend)[0] || appData.earningRules[0];

            pointsEarned = (eligibleSpend / 100) * applicableRule.pointsPerHundred;
            
             // Apply active promotions
            const nowStr = now.toISOString().split('T')[0];
            const activePromotion = appData.promotions.find(p => p.startDate <= nowStr && p.endDate >= nowStr);
            if (activePromotion) {
                pointsEarned *= activePromotion.multiplier;
                promotionApplied = { name: activePromotion.name, multiplier: activePromotion.multiplier };
            }
            
            // Find existing customer's tier and apply multiplier
            const tier = existingCustomer?.tierId ? appData.customerTiers.find(t => t.id === existingCustomer.tierId) : appData.customerTiers.find(t=> t.rank === 0);
             if (tier) {
                pointsEarned *= tier.pointsMultiplier;
                tierApplied = { name: tier.name, multiplier: tier.pointsMultiplier };
             }

            pointsEarned = Math.round(pointsEarned);

            // Update or Create Customer
            if (existingCustomer) {
                const pointsBefore = existingCustomer.loyaltyPoints;
                let newPoints = pointsBefore + pointsEarned - pointsToRedeem;
                finalLoyaltyPoints = Math.max(0, newPoints);
                
                updatedCustomers = updatedCustomers.map(c => c.id === bikeNumberUpper
                    ? {
                        ...c,
                        name: customerDetails.customerName, // Update name if changed
                        contactNumber: customerDetails.contactNumber || c.contactNumber,
                        lastSeen: now.toISOString(),
                        saleIds: [...c.saleIds, saleId],
                        loyaltyPoints: finalLoyaltyPoints,
                        balance: balanceDue <= 0 ? 0 : balanceDue,
                        serviceFrequencyValue: customerDetails.serviceFrequencyValue || c.serviceFrequencyValue,
                        serviceFrequencyUnit: customerDetails.serviceFrequencyUnit || c.serviceFrequencyUnit,
                      }
                    : c
                );

                if(pointsEarned > 0) updatedLoyaltyTransactions.push({ id: uuidv4(), customerId: bikeNumberUpper, type: 'earned', points: pointsEarned, date: now.toISOString(), relatedSaleId: saleId, pointsBefore, pointsAfter: pointsBefore + pointsEarned });
                if(pointsToRedeem > 0) updatedLoyaltyTransactions.push({ id: uuidv4(), customerId: bikeNumberUpper, type: 'redeemed', points: pointsToRedeem, date: now.toISOString(), relatedSaleId: saleId, pointsBefore: pointsBefore + pointsEarned, pointsAfter: finalLoyaltyPoints });
            
            } else {
                finalLoyaltyPoints = pointsEarned;
                const newCustomer: Customer = {
                    id: bikeNumberUpper,
                    name: customerDetails.customerName,
                    contactNumber: customerDetails.contactNumber,
                    firstSeen: now.toISOString(),
                    lastSeen: now.toISOString(),
                    saleIds: [saleId],
                    loyaltyPoints: finalLoyaltyPoints,
                    tierId: appData.customerTiers.find(t=> t.rank === 0)?.id || null, // Default tier
                    balance: balanceDue <= 0 ? 0 : balanceDue,
                    serviceFrequencyValue: customerDetails.serviceFrequencyValue,
                    serviceFrequencyUnit: customerDetails.serviceFrequencyUnit
                };
                updatedCustomers.push(newCustomer);
                 if(pointsEarned > 0) updatedLoyaltyTransactions.push({ id: uuidv4(), customerId: bikeNumberUpper, type: 'earned', points: pointsEarned, date: now.toISOString(), relatedSaleId: saleId, pointsBefore: 0, pointsAfter: finalLoyaltyPoints });
            }
        }
        

        const newSale: Sale = {
            id: saleId,
            items: saleItems,
            subtotal,
            totalItemDiscounts,
            overallDiscount,
            overallDiscountType,
            tuningCharges,
            laborCharges,
            loyaltyDiscount: loyaltyDiscountAmount,
            total: Math.round(grandTotal),
            amountPaid: amountPaid,
            paymentStatus: paymentStatus,
            balanceDue: balanceDue,
            previousBalanceBroughtForward: previousBalanceBroughtForward,
            date: now.toISOString(),
            customerId: bikeNumberUpper,
            customerName: customerDetails.customerName,
            pointsEarned,
            redeemedPoints: pointsToRedeem,
            finalLoyaltyPoints,
            promotionApplied,
            tierApplied,
        };

        const newAppData = {
            ...appData,
            inventory: inventoryUpdated ? updatedInventory : appData.inventory,
            sales: [newSale, ...appData.sales],
            customers: updatedCustomers,
            loyaltyTransactions: updatedLoyaltyTransactions,
        };
        
        setAppData(newAppData);
        return newSale;
    };

    const reverseSale = (saleId: string, itemsToReturn: SaleItem[]) => {
        const saleToReverse = appData.sales.find(s => s.id === saleId);
        if (!saleToReverse) {
            toast.error("Sale not found.");
            return;
        }

        const allItemsReturned = saleToReverse.items.length === itemsToReturn.length;
        
        let newSales = [...appData.sales];
        let newInventory = [...appData.inventory];
        let newCustomers = [...appData.customers];
        
        // Update Inventory
        itemsToReturn.forEach(item => {
            if (!item.productId.startsWith('manual-')) {
                const productIndex = newInventory.findIndex(p => p.id === item.productId);
                if (productIndex !== -1) {
                    newInventory[productIndex].quantity += item.quantity;
                } else {
                    // Item was deleted, re-add it
                    newInventory.push({
                        id: item.productId,
                        name: item.name,
                        quantity: item.quantity,
                        purchasePrice: item.purchasePrice || 0,
                        salePrice: item.originalPrice,
                        categoryId: 'uncategorized', 
                        subCategoryId: null,
                        manufacturer: 'N/A',
                        location: 'N/A'
                    });
                }
            }
        });
        
        if (allItemsReturned) {
            newSales = newSales.filter(s => s.id !== saleId);
            toast.success(`Sale ${saleId} deleted and stock returned.`);
        } else {
            // Update the existing sale record
            const remainingItems = saleToReverse.items.filter(i => !itemsToReturn.some(r => r.productId === i.productId));
            // Recalculate totals for the updated sale
            const newSubtotal = remainingItems.reduce((acc, item) => acc + item.originalPrice * item.quantity, 0);
            const newTotalItemDiscounts = remainingItems.reduce((acc, item) => {
                 const discount = item.discountType === 'fixed' ? item.discount : (item.originalPrice * item.discount) / 100;
                 return acc + (discount * item.quantity);
            }, 0);
            
            // We keep overall discounts and charges as they might not be item-specific.
            const subtotalAfterItemDiscount = newSubtotal - newTotalItemDiscounts;
            const totalWithCharges = subtotalAfterItemDiscount + (saleToReverse.tuningCharges || 0) + (saleToReverse.laborCharges || 0);
            const overallDiscountAmount = saleToReverse.overallDiscountType === 'fixed'
                ? saleToReverse.overallDiscount
                : (totalWithCharges * saleToReverse.overallDiscount) / 100;

            const newCartTotal = totalWithCharges - overallDiscountAmount;
            const grandTotal = newCartTotal + (saleToReverse.previousBalanceBroughtForward || 0) - (saleToReverse.loyaltyDiscount || 0);
            const balanceDue = grandTotal - saleToReverse.amountPaid;

            const updatedSale: Sale = {
                ...saleToReverse,
                items: remainingItems,
                subtotal: newSubtotal,
                totalItemDiscounts: newTotalItemDiscounts,
                total: Math.round(grandTotal),
                balanceDue: balanceDue,
                paymentStatus: balanceDue <= 0 ? 'Paid' : (saleToReverse.amountPaid > 0 ? 'Partial' : 'Unpaid')
            };
            
            newSales = newSales.map(s => s.id === saleId ? updatedSale : s);
            
            // Update customer balance based on the new balance due
            const customerIndex = newCustomers.findIndex(c => c.id === updatedSale.customerId);
            if(customerIndex > -1) {
                newCustomers[customerIndex] = {...newCustomers[customerIndex], balance: balanceDue <= 0 ? 0 : balanceDue};
            }
            
            toast.success(`Items returned from Sale ${saleId}. Sale and customer balance updated.`);
        }
        
        // TODO: Reversing loyalty points can be complex (e.g., if they've been spent).
        // For now, we don't reverse points to avoid negative balances. A manual adjustment can be made.
        
        setAppData({ ...appData, sales: newSales, inventory: newInventory, customers: newCustomers });
    };

    const updateSale = (saleId: string, updates: Partial<Sale>) => {
        let saleToUpdate = appData.sales.find(s => s.id === saleId);
        if (!saleToUpdate) return;
        
        let updatedSale = { ...saleToUpdate, ...updates };

        // Recalculate totals if items or discounts were changed
        const subtotal = updatedSale.items.reduce((acc, item) => acc + item.originalPrice * item.quantity, 0);
        const totalItemDiscounts = updatedSale.items.reduce((acc, item) => {
            const discount = item.discountType === 'fixed' ? item.discount : (item.originalPrice * item.discount) / 100;
            return acc + (discount * item.quantity);
        }, 0);
        
        const subtotalAfterItemDiscount = subtotal - totalItemDiscounts;
        const totalWithCharges = subtotalAfterItemDiscount + (updatedSale.tuningCharges || 0) + (updatedSale.laborCharges || 0);
        
        const overallDiscountAmount = updatedSale.overallDiscountType === 'fixed'
            ? updatedSale.overallDiscount
            : (totalWithCharges * updatedSale.overallDiscount) / 100;

        const cartTotal = totalWithCharges - overallDiscountAmount;
        const grandTotal = cartTotal + (updatedSale.previousBalanceBroughtForward || 0) - (updatedSale.loyaltyDiscount || 0);
        const balanceDue = grandTotal - updatedSale.amountPaid;
        const paymentStatus = balanceDue <= 0 ? 'Paid' : (updatedSale.amountPaid > 0 ? 'Partial' : 'Unpaid');

        updatedSale = {
            ...updatedSale,
            subtotal,
            totalItemDiscounts,
            total: Math.round(grandTotal),
            balanceDue,
            paymentStatus
        };

        const newSales = appData.sales.map(s => s.id === saleId ? updatedSale : s);
        
        // Update customer balance
        const newCustomers = appData.customers.map(c => {
            if (c.id === updatedSale.customerId) {
                return { ...c, balance: balanceDue <= 0 ? 0 : balanceDue };
            }
            return c;
        });

        setAppData({ ...appData, sales: newSales, customers: newCustomers });
        toast.success("Sale updated successfully!");
    };
    
    const updateCustomer = (customerId: string, updates: Partial<Customer>) => {
        let customerToUpdate = appData.customers.find(c => c.id === customerId);
        if (!customerToUpdate) return false;
        
        // Prevent ID change if it's already in use by another customer
        if (updates.id && updates.id !== customerId && appData.customers.some(c => c.id === updates.id)) {
            toast.error(`Bike Number "${updates.id}" is already in use.`);
            return false;
        }

        const newCustomers = appData.customers.map(c => c.id === customerId ? { ...c, ...updates } : c);
        
        // If ID was changed, we need to update all related sales and transactions
        if (updates.id && updates.id !== customerId) {
            const newSales = appData.sales.map(s => s.customerId === customerId ? { ...s, customerId: updates.id! } : s);
            const newTransactions = appData.loyaltyTransactions.map(t => t.customerId === customerId ? { ...t, customerId: updates.id! } : t);
            const newPayments = appData.payments.map(p => p.customerId === customerId ? { ...p, customerId: updates.id! } : p);
            
             setAppData({ ...appData, customers: newCustomers, sales: newSales, loyaltyTransactions: newTransactions, payments: newPayments });
        } else {
             setAppData({ ...appData, customers: newCustomers });
        }
        
        toast.success("Customer details updated.");
        return true;
    };
    
    const adjustCustomerPoints = (customerId: string, points: number, reason: string): boolean => {
        const customer = appData.customers.find(c => c.id === customerId);
        if (!customer) {
            toast.error("Customer not found.");
            return false;
        }
        
        const type = points > 0 ? 'manual_add' : 'manual_subtract';
        const pointsValue = Math.abs(points);
        const pointsBefore = customer.loyaltyPoints;
        const pointsAfter = Math.max(0, pointsBefore + points);
        
        const newTransaction: LoyaltyTransaction = {
            id: uuidv4(),
            customerId,
            type,
            points: pointsValue,
            date: new Date().toISOString(),
            reason,
            pointsBefore,
            pointsAfter,
        };
        
        const newCustomers = appData.customers.map(c => c.id === customerId ? { ...c, loyaltyPoints: pointsAfter } : c);
        const newTransactions = [...appData.loyaltyTransactions, newTransaction];
        
        setAppData({...appData, customers: newCustomers, loyaltyTransactions: newTransactions});
        toast.success("Points adjusted successfully!");
        return true;
    };

    const recordCustomerPayment = (customerId: string, amount: number, notes?: string): boolean => {
        const customer = appData.customers.find(c => c.id === customerId);
        if (!customer || customer.balance <= 0) {
            toast.error("This customer has no outstanding balance.");
            return false;
        }
        if (amount > customer.balance) {
            toast.error("Payment cannot exceed the outstanding balance.");
            return false;
        }

        const newPayment: Payment = {
            id: uuidv4(),
            customerId,
            amount,
            date: new Date().toISOString(),
            notes
        };

        const newCustomers = appData.customers.map(c => {
            if (c.id === customerId) {
                return { ...c, balance: Math.round(c.balance - amount) };
            }
            return c;
        });
        
        // Also update the balanceDue in the last relevant sale if it exists
        const lastUnpaidSaleIndex = appData.sales.findIndex(s => s.customerId === customerId && (s.paymentStatus === 'Unpaid' || s.paymentStatus === 'Partial'));
        let newSales = [...appData.sales];
        if (lastUnpaidSaleIndex !== -1) {
            const lastSale = newSales[lastUnpaidSaleIndex];
            const newBalanceDue = Math.max(0, lastSale.balanceDue - amount);
            const newAmountPaid = lastSale.amountPaid + amount;
            const newPaymentStatus = newBalanceDue <= 0 ? 'Paid' : 'Partial';
            
            newSales[lastUnpaidSaleIndex] = {
                ...lastSale,
                balanceDue: newBalanceDue,
                amountPaid: newAmountPaid,
                paymentStatus: newPaymentStatus,
            };
        }

        const newPayments = [...appData.payments, newPayment].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        setAppData({ ...appData, customers: newCustomers, payments: newPayments, sales: newSales });
        toast.success(`Payment of ${amount} recorded for ${customer.name}.`);
        return true;
    };

    // LOYALTY
    const updateEarningRules = (rules: EarningRule[]) => {
        setAppData({...appData, earningRules: rules});
        toast.success("Earning rules updated.");
    };

    const updateRedemptionRule = (rule: RedemptionRule) => {
        setAppData({...appData, redemptionRule: rule});
        toast.success("Redemption rule updated.");
    };

    const addPromotion = (promo: Omit<Promotion, 'id'>) => {
        const newPromo = { ...promo, id: uuidv4() };
        setAppData({...appData, promotions: [newPromo, ...appData.promotions]});
        toast.success("Promotion added.");
    };
    
    const updatePromotion = (updatedPromo: Promotion) => {
        setAppData({...appData, promotions: appData.promotions.map(p => p.id === updatedPromo.id ? updatedPromo : p)});
        toast.success("Promotion updated.");
    };
    
    const deletePromotion = (promoId: string) => {
        setAppData({...appData, promotions: appData.promotions.filter(p => p.id !== promoId)});
        toast.success("Promotion deleted.");
    };
    
    const updateLoyaltyExpirySettings = (settings: LoyaltyExpirySettings) => {
        setAppData({...appData, loyaltyExpirySettings: settings});
        toast.success("Expiry settings updated.");
    };
    
    const updateCustomerTiers = (tiers: CustomerTier[]) => {
        setAppData({...appData, customerTiers: tiers});
        toast.success("Customer tiers updated.");
    };

    // EXPENSES
    const addExpense = (expense: Omit<Expense, 'id'>) => {
        const newExpense = { ...expense, id: uuidv4() };
        const sortedExpenses = [...appData.expenses, newExpense].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setAppData({...appData, expenses: sortedExpenses});
        toast.success("Expense added.");
    };
    
    const updateExpense = (updatedExpense: Expense) => {
        setAppData({...appData, expenses: appData.expenses.map(e => e.id === updatedExpense.id ? updatedExpense : e)});
        toast.success("Expense updated.");
    };

    const deleteExpense = (expenseId: string) => {
        setAppData({...appData, expenses: appData.expenses.filter(e => e.id !== expenseId)});
        toast.success("Expense deleted.");
    };
    
    // DEMAND
    const addDemandItem = (item: Omit<DemandItem, 'id'>) => {
        const newItem = { ...item, id: uuidv4() };
        setAppData({...appData, demandItems: [...appData.demandItems, newItem]});
        toast.success("Item added to demand list.");
    };
    
    const addMultipleDemandItems = (items: Omit<DemandItem, 'id'>[]) => {
        const newDemandItems = [...appData.demandItems];
        let addedCount = 0;
        
        for (const item of items) {
            // Check for duplicates based on name and manufacturer (case-insensitive)
            const isDuplicate = newDemandItems.some(
                existingItem =>
                    existingItem.name.toLowerCase() === item.name.toLowerCase() &&
                    existingItem.manufacturer.toLowerCase() === item.manufacturer.toLowerCase()
            );
            
            if (!isDuplicate) {
                newDemandItems.push({ ...item, id: uuidv4() });
                addedCount++;
            }
        }

        if (addedCount > 0) {
            setAppData({ ...appData, demandItems: newDemandItems });
            toast.success(`${addedCount} item(s) imported to demand list.`);
        } else {
            // FIX: The 'react-hot-toast' library does not have a dedicated `info` method. The standard `toast()` function is used for informational messages.
            toast("All out-of-stock items were already in the demand list.");
        }
    };
    
    const updateDemandItem = (updatedItem: DemandItem) => {
        setAppData({...appData, demandItems: appData.demandItems.map(i => i.id === updatedItem.id ? updatedItem : i)});
        toast.success("Demand item updated.");
    };

    const deleteDemandItem = (itemId: string) => {
        setAppData({...appData, demandItems: appData.demandItems.filter(i => i.id !== itemId)});
        toast.success("Demand item removed.");
    };
    
    // Backup & Restore
    const backupData = () => {
        if (!appData) {
            toast.error("Data not loaded yet. Cannot perform backup.");
            return;
        }
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appData, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `shopsync_backup_${new Date().toISOString().split('T')[0]}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        toast.success("Backup created successfully!");
    };

    const restoreData = async (data: any) => {
        // Basic validation
        if (!data || !data.hasOwnProperty('shopInfo') || !data.hasOwnProperty('users')) {
            toast.error("Invalid or corrupted backup file.");
            return;
        }
        
        if (!window.confirm("Are you sure you want to restore? This will overwrite ALL current data and reload the application.")) {
            return;
        }

        try {
            await setAppData(data as AppData);
            toast.success("Data restored successfully! The app will now reload.");
            setTimeout(() => window.location.reload(), 1500);
        } catch (error) {
            toast.error("Failed to restore data.");
            console.error("Restore error:", error);
        }
    };


    const value = {
        shopInfo, saveShopInfo,
        users, currentUser, signUp, login, logout, addUser, deleteUser, updateUser,
        inventory, addProduct, updateProduct, deleteProduct, addStock, findProductByBarcode, addSampleData, importFromExcel,
        categories, addCategory, updateCategory, deleteCategory,
        sales, createSale, reverseSale, updateSale,
        customers, updateCustomer, adjustCustomerPoints, recordCustomerPayment,
        earningRules, updateEarningRules,
        redemptionRule, updateRedemptionRule,
        promotions, addPromotion, updatePromotion, deletePromotion,
        loyaltyTransactions,
        loyaltyExpirySettings, updateLoyaltyExpirySettings,
        customerTiers, updateCustomerTiers,
        expenses, addExpense, updateExpense, deleteExpense,
        payments,
        demandItems, addDemandItem, addMultipleDemandItems, updateDemandItem, deleteDemandItem,
        backupData,
        restoreData,
        loading,
    };

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = () => {
    const context = useContext(AppContext);
    if (context === undefined) {
        throw new Error('useAppContext must be used within an AppProvider');
    }
    return context;
};