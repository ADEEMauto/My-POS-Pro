
import React, { createContext, useContext, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ShopInfo, User, UserRole, Category, Product, Sale, SaleItem, Customer, CartItem, EarningRule, RedemptionRule, Promotion, LoyaltyTransaction, LoyaltyExpirySettings, CustomerTier, Expense, Payment, DemandItem, OutsideServiceItem } from '../types';
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
        amountPaid: number,
        outsideServices: OutsideServiceItem[]
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
    restoreData: (data: AppData) => void;
    loading: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const initialData: AppData = {
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
        pointsLifespanValue: 24, pointsLifespanUnit: 'months',
        reminderPeriodValue: 1, reminderPeriodUnit: 'months',
    },
    customerTiers: [{
        id: 'base-tier',
        name: 'Standard',
        minVisits: 0,
        minSpend: 0,
        periodValue: 12,
        periodUnit: 'months',
        pointsMultiplier: 1,
        rank: 0,
    }],
    expenses: [],
    payments: [],
    demandItems: [],
};


export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { data, setData, loading } = useIndexedDB<AppData>(initialData);
    
    // Derived state for easier access
    const shopInfo = data?.shopInfo || null;
    const users = data?.users || [];
    const currentUser = data?.currentUser || null;
    const inventory = data?.inventory || [];
    const categories = data?.categories || [];
    const sales = data?.sales || [];
    const customers = data?.customers || [];
    const earningRules = data?.earningRules || initialData.earningRules;
    const redemptionRule = data?.redemptionRule || initialData.redemptionRule;
    const promotions = data?.promotions || [];
    const loyaltyTransactions = data?.loyaltyTransactions || [];
    const loyaltyExpirySettings = data?.loyaltyExpirySettings || initialData.loyaltyExpirySettings;
    const customerTiers = data?.customerTiers || initialData.customerTiers;
    const expenses = data?.expenses || [];
    const payments = data?.payments || [];
    const demandItems = data?.demandItems || [];


    const saveShopInfo = (info: ShopInfo) => {
        setData({ ...data!, shopInfo: info });
    };

    const signUp = async (username: string, password: string): Promise<boolean> => {
        if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
            toast.error("Username already exists.");
            return false;
        }
        const passwordHash = await simpleHash(password);
        const isFirstUser = users.length === 0;
        const newUser: User = {
            id: uuidv4(),
            username,
            passwordHash,
            role: isFirstUser ? 'master' : 'sub',
        };
        setData({ ...data!, users: [...users, newUser] });
        toast.success(isFirstUser ? "Master account created! Please log in." : "User created successfully!");
        return true;
    };
    
    const addUser = async (username: string, password: string): Promise<boolean> => {
        if (currentUser?.role !== 'master') {
            toast.error("Only master users can add new users.");
            return false;
        }
        return signUp(username, password);
    };

    const deleteUser = (userId: string) => {
        if (currentUser?.role !== 'master') {
            toast.error("Permission denied.");
            return;
        }
        setData({ ...data!, users: users.filter(u => u.id !== userId) });
        toast.success("User deleted.");
    };
    
    const updateUser = async (userId: string, updates: Partial<Omit<User, 'id'>>) => {
        const userToUpdate = users.find(u => u.id === userId);
        if(!userToUpdate) {
            toast.error("User not found.");
            return false;
        }

        // Check for username uniqueness if it's being changed
        if (updates.username && updates.username !== userToUpdate.username) {
            if (users.some(u => u.username.toLowerCase() === updates.username?.toLowerCase() && u.id !== userId)) {
                toast.error("Username already exists.");
                return false;
            }
        }
        
        const updatedUsers = users.map(u => u.id === userId ? { ...u, ...updates } : u);
        
        // If the current user is being updated, update the currentUser object as well
        const newCurrentUser = userId === currentUser?.id ? { ...currentUser, ...updates } : currentUser;

        setData({ ...data!, users: updatedUsers, currentUser: newCurrentUser });
        toast.success("Profile updated successfully!");
        return true;
    };


    const login = async (username: string, password: string): Promise<boolean> => {
        const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
        if (user) {
            const passwordHash = await simpleHash(password);
            if (user.passwordHash === passwordHash) {
                setData({ ...data!, currentUser: user });
                toast.success(`Welcome back, ${user.username}!`);
                return true;
            }
        }
        toast.error("Invalid credentials.");
        return false;
    };

    const logout = () => {
        setData({ ...data!, currentUser: null });
        toast.success("Logged out successfully.");
    };

    const addProduct = (product: Omit<Product, 'id'>) => {
        const newProduct = { ...product, id: uuidv4() };
        setData({ ...data!, inventory: [...inventory, newProduct] });
        toast.success("Product added.");
    };

    const updateProduct = (product: Product) => {
        setData({ ...data!, inventory: inventory.map(p => p.id === product.id ? product : p) });
        toast.success("Product updated.");
    };

    const deleteProduct = (id: string) => {
        setData({ ...data!, inventory: inventory.filter(p => p.id !== id) });
        toast.success("Product deleted.");
    };

    const addStock = (id: string, qty: number, price?: number) => {
        const product = inventory.find(p => p.id === id);
        if (product) {
            const updates: Partial<Product> = { quantity: product.quantity + qty };
            if (price !== undefined) updates.salePrice = price;
            updateProduct({ ...product, ...updates });
        }
    };
    
    const findProductByBarcode = (barcode: string) => inventory.find(p => p.barcode === barcode);
    
    const addSampleData = () => {
         const newProducts = SAMPLE_PRODUCTS.map(p => ({ ...p, id: uuidv4() }));
         const newCategories = SAMPLE_CATEGORIES;
         setData({...data!, inventory: [...inventory, ...newProducts], categories: [...categories, ...newCategories]});
         toast.success("Sample data added.");
    };

    const importFromExcel = (json: any[]) => {
         const newProducts: Product[] = json.map((row: any) => ({
             id: uuidv4(),
             name: row['Name'] || 'Unknown',
             categoryId: row['Category ID'] || 'uncategorized',
             subCategoryId: row['SubCategory ID'] || null,
             manufacturer: row['Manufacturer'] || 'N/A',
             location: row['Location'] || '',
             quantity: Number(row['Quantity']) || 0,
             purchasePrice: Number(row['Purchase Price (Rs)']) || 0,
             salePrice: Number(row['Sale Price (Rs)']) || 0,
             barcode: row['Barcode'] ? String(row['Barcode']) : undefined,
             imageUrl: row['Image URL'] || undefined
         }));
         setData({...data!, inventory: [...inventory, ...newProducts]});
         toast.success(`Imported ${newProducts.length} products.`);
    };

    const addCategory = (name: string, parentId: string | null) => {
        const newCat = { id: uuidv4(), name, parentId };
        setData({ ...data!, categories: [...categories, newCat] });
    };

    const updateCategory = (id: string, name: string) => {
        setData({ ...data!, categories: categories.map(c => c.id === id ? { ...c, name } : c) });
    };

    const deleteCategory = (id: string) => {
        const idsToDelete = new Set<string>();
        const collectIds = (catId: string) => {
            idsToDelete.add(catId);
            categories.filter(c => c.parentId === catId).forEach(c => collectIds(c.id));
        };
        collectIds(id);
        setData({ ...data!, categories: categories.filter(c => !idsToDelete.has(c.id)) });
    };

    // Helper to calculate points earned on items only
    const calculateNetItemRevenue = (
        items: SaleItem[],
        tuningCharges: number,
        laborCharges: number,
        overallDiscountAmount: number,
        totalOutsideServices: number,
        loyaltyDiscountAmount: number
    ): number => {
        // 1. Calculate Item Subtotal after item-level discounts
        const itemSubtotal = items.reduce((acc, item) => acc + (item.price * item.quantity), 0);

        // 2. Determine base for overall discount (Items + Services)
        const revenueBaseForDiscount = itemSubtotal + tuningCharges + laborCharges;

        // 3. Proportion of overall discount allocated to items
        const itemRatioForOverallDiscount = revenueBaseForDiscount > 0 ? (itemSubtotal / revenueBaseForDiscount) : 0;
        const itemShareOfOverallDiscount = overallDiscountAmount * itemRatioForOverallDiscount;

        // 4. Net Item Revenue before loyalty redemption
        const netItemRevenueBeforeLoyalty = itemSubtotal - itemShareOfOverallDiscount;

        // 5. Determine total bill value that loyalty points are paying off
        // (Items + Services + OutsideServices - OverallDiscount)
        const totalBillBeforeLoyalty = (revenueBaseForDiscount - overallDiscountAmount) + totalOutsideServices;

        // 6. Proportion of loyalty discount allocated to items
        // (We deduct the portion of points used to pay for items, so points are earned on PAID item amount)
        const itemRatioForLoyalty = totalBillBeforeLoyalty > 0 ? (netItemRevenueBeforeLoyalty / totalBillBeforeLoyalty) : 0;
        const itemShareOfLoyaltyDiscount = loyaltyDiscountAmount * itemRatioForLoyalty;

        // 7. Final Net Item Revenue (Money earned from sale of items)
        const finalItemRevenue = Math.max(0, netItemRevenueBeforeLoyalty - itemShareOfLoyaltyDiscount);

        return finalItemRevenue;
    };

    const createSale = (
        cart: CartItem[], 
        overallDiscount: number, 
        overallDiscountType: 'fixed' | 'percentage', 
        customerDetails: { customerName: string; bikeNumber: string; contactNumber?: string, serviceFrequencyValue?: number, serviceFrequencyUnit?: 'days'|'months'|'years' },
        pointsToRedeem: number,
        tuningCharges: number,
        laborCharges: number,
        amountPaid: number,
        outsideServices: OutsideServiceItem[]
    ) => {
        // Deduct inventory
        const newInventory = inventory.map(product => {
            const cartItem = cart.find(c => c.id === product.id);
            if (cartItem && !cartItem.id.startsWith('manual-')) {
                return { ...product, quantity: product.quantity - cartItem.cartQuantity };
            }
            return product;
        });

        const saleItems: SaleItem[] = cart.map(item => {
            const discountAmount = item.discountType === 'fixed' ? item.discount : (item.salePrice * item.discount / 100);
            return {
                productId: item.id,
                name: item.name,
                quantity: item.cartQuantity,
                originalPrice: item.salePrice,
                discount: item.discount,
                discountType: item.discountType,
                price: item.salePrice - discountAmount,
                purchasePrice: item.purchasePrice
            };
        });

        const subtotal = cart.reduce((acc, item) => acc + (item.salePrice * item.cartQuantity), 0);
        
        const subtotalAfterItemDiscounts = saleItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);

        const totalItemDiscounts = subtotal - subtotalAfterItemDiscounts;

        const revenueBaseForDiscount = subtotalAfterItemDiscounts + tuningCharges + laborCharges;

        const overallDiscountAmount = overallDiscountType === 'fixed'
            ? overallDiscount
            : (revenueBaseForDiscount * overallDiscount) / 100;
        
        // Find or create customer
        // Logic: Same name AND same bike number = Same Customer. Otherwise different.
        const bikeNum = customerDetails.bikeNumber.replace(/\s+/g, '').toUpperCase();
        const custName = customerDetails.customerName.trim();
        const isWalkIn = bikeNum === 'WALKIN';

        let customer: Customer | undefined;
        
        if (isWalkIn) {
             // For Walk-ins, we can optionally use a shared 'WALKIN' customer or just null.
             // Existing app used 'WALKIN' ID. Let's keep it consistent.
             customer = customers.find(c => c.id === 'WALKIN');
        } else {
             customer = customers.find(c => {
                 const cBike = c.bikeNumber || c.id; // Fallback for legacy data where id=bikeNumber
                 return cBike === bikeNum && c.name.toLowerCase() === custName.toLowerCase();
             });
        }

        const isNewCustomer = !customer;
        const now = new Date().toISOString();
        let customerId: string;

        if (isNewCustomer) {
            customerId = isWalkIn ? 'WALKIN' : uuidv4();
        } else {
            customerId = customer!.id;
        }

        // Loyalty Redemption Logic
        let loyaltyDiscountAmount = 0;
        let redeemedPoints = 0;

        if (customer && pointsToRedeem > 0) {
            if (customer.loyaltyPoints >= pointsToRedeem) {
                 redeemedPoints = pointsToRedeem;
                 if (redemptionRule.method === 'fixedValue') {
                     loyaltyDiscountAmount = (pointsToRedeem / redemptionRule.points) * redemptionRule.value;
                 } else {
                     // Percentage logic usually applies to the whole bill.
                     // Calculate total before loyalty to determine discount amount
                     const totalBeforeLoyalty = (revenueBaseForDiscount - overallDiscountAmount) + outsideServices.reduce((sum, s) => sum + s.amount, 0) + (customer.balance || 0);
                     const percentage = (pointsToRedeem / redemptionRule.points) * redemptionRule.value;
                     loyaltyDiscountAmount = (totalBeforeLoyalty * percentage) / 100;
                 }
            } else {
                toast.error("Insufficient loyalty points.");
                redeemedPoints = 0;
            }
        }

        const totalOutsideServices = outsideServices.reduce((sum, s) => sum + s.amount, 0);

        const total = (revenueBaseForDiscount - overallDiscountAmount) + totalOutsideServices - loyaltyDiscountAmount;
        
        // --- Earning Points Logic ---
        let pointsEarned = 0;
        const pointsBase = calculateNetItemRevenue(
            saleItems, 
            tuningCharges, 
            laborCharges, 
            overallDiscountAmount, 
            totalOutsideServices, 
            loyaltyDiscountAmount
        );

        let finalLoyaltyPoints = customer ? customer.loyaltyPoints - redeemedPoints : 0;
        let appliedPromotion: { name: string, multiplier: number } | undefined;
        let appliedTier: { name: string, multiplier: number } | undefined;

        if (customerId && !isWalkIn) {
             const applicableRule = earningRules
                .sort((a, b) => b.minSpend - a.minSpend)
                .find(r => pointsBase >= r.minSpend && (r.maxSpend === null || pointsBase <= r.maxSpend));
             
             if (applicableRule) {
                 let multiplier = 1;
                 
                 const nowDate = new Date();
                 const activePromo = promotions.find(p => {
                     const start = new Date(p.startDate);
                     const end = new Date(p.endDate);
                     start.setHours(0,0,0,0);
                     end.setHours(23,59,59,999);
                     return nowDate >= start && nowDate <= end;
                 });

                 if (activePromo) {
                     multiplier *= activePromo.multiplier;
                     appliedPromotion = { name: activePromo.name, multiplier: activePromo.multiplier };
                 }

                 if (customer?.tierId) {
                     const tier = customerTiers.find(t => t.id === customer.tierId);
                     if (tier) {
                         multiplier *= tier.pointsMultiplier;
                         appliedTier = { name: tier.name, multiplier: tier.pointsMultiplier };
                     }
                 }
                 
                 pointsEarned = Math.floor((pointsBase / 100) * applicableRule.pointsPerHundred * multiplier);
             }
             finalLoyaltyPoints += pointsEarned;
        } else {
            finalLoyaltyPoints = 0;
            redeemedPoints = 0;
            pointsEarned = 0;
        }

        const balanceDue = total - amountPaid;
        const newBalance = (customer?.balance || 0) + balanceDue;

        const newSale: Sale = {
            id: uuidv4().substring(0, 8).toUpperCase(),
            customerId: customerId,
            customerName: customerDetails.customerName,
            bikeNumber: bikeNum, // Store bike number snapshot
            items: saleItems,
            subtotal,
            totalItemDiscounts,
            overallDiscount,
            overallDiscountType,
            loyaltyDiscount: loyaltyDiscountAmount,
            tuningCharges,
            laborCharges,
            outsideServices,
            totalOutsideServices,
            total,
            amountPaid,
            paymentStatus: balanceDue <= 0.5 ? 'Paid' : (amountPaid > 0 ? 'Partial' : 'Unpaid'),
            balanceDue,
            previousBalanceBroughtForward: customer?.balance || 0,
            date: now,
            pointsEarned,
            redeemedPoints,
            finalLoyaltyPoints,
            promotionApplied: appliedPromotion,
            tierApplied: appliedTier
        };

        const updatedCustomer: Customer = {
            id: customerId,
            bikeNumber: bikeNum,
            name: customerDetails.customerName,
            saleIds: customer ? [...customer.saleIds, newSale.id] : [newSale.id],
            firstSeen: customer ? customer.firstSeen : now,
            lastSeen: now,
            contactNumber: customerDetails.contactNumber || customer?.contactNumber,
            serviceFrequencyValue: customerDetails.serviceFrequencyValue || customer?.serviceFrequencyValue,
            serviceFrequencyUnit: customerDetails.serviceFrequencyUnit || customer?.serviceFrequencyUnit,
            servicingNotes: customer?.servicingNotes,
            nextServiceDate: customer?.nextServiceDate,
            loyaltyPoints: finalLoyaltyPoints,
            tierId: customer?.tierId || customerTiers.find(t => t.rank === 0)?.id || null,
            balance: Math.max(0, newBalance),
            manualVisitAdjustment: customer?.manualVisitAdjustment || 0
        };

        const newTransactions: LoyaltyTransaction[] = [];
        if (pointsEarned > 0) {
            newTransactions.push({
                id: uuidv4(),
                customerId,
                type: 'earned',
                points: pointsEarned,
                date: now,
                relatedSaleId: newSale.id,
                pointsBefore: (customer?.loyaltyPoints || 0) - redeemedPoints,
                pointsAfter: finalLoyaltyPoints
            });
        }
        if (redeemedPoints > 0) {
            newTransactions.push({
                id: uuidv4(),
                customerId,
                type: 'redeemed',
                points: redeemedPoints,
                date: now,
                relatedSaleId: newSale.id,
                pointsBefore: customer!.loyaltyPoints,
                pointsAfter: customer!.loyaltyPoints - redeemedPoints
            });
        }

        let updatedCustomers;
        if (isNewCustomer) {
            updatedCustomers = [...customers, updatedCustomer];
        } else {
            updatedCustomers = customers.map(c => c.id === customerId ? updatedCustomer : c);
        }

        setData({
            ...data!,
            inventory: newInventory,
            sales: [...sales, newSale],
            customers: updatedCustomers,
            loyaltyTransactions: [...loyaltyTransactions, ...newTransactions]
        });

        toast.success("Sale completed successfully!");
        return newSale;
    };

    const reverseSale = (saleId: string, itemsToReturn: SaleItem[]) => {
        const sale = sales.find(s => s.id === saleId);
        if (!sale) return;

        // 1. Restore Inventory
        const updatedInventory = inventory.map(product => {
            const itemToReturn = itemsToReturn.find(i => i.productId === product.id);
            if (itemToReturn && !itemToReturn.productId.startsWith('manual-')) {
                return { ...product, quantity: product.quantity + itemToReturn.quantity };
            }
            return product;
        });

        const remainingItems = sale.items.filter(item => !itemsToReturn.some(r => r.productId === item.productId));
        
        let updatedSales = [...sales];
        let updatedCustomers = [...customers];
        let updatedTransactions = [...loyaltyTransactions];
        
        if (remainingItems.length === 0 && sale.tuningCharges === 0 && sale.laborCharges === 0 && (!sale.outsideServices || sale.outsideServices.length === 0)) {
            // Full Reversal / Delete Sale
            const customer = customers.find(c => c.id === sale.customerId);
            
            // Remove sale from sales
            updatedSales = sales.filter(s => s.id !== saleId);

            // Revert Loyalty Points
            const saleTransactions = loyaltyTransactions.filter(t => t.relatedSaleId === saleId);
            let pointsToRevert = 0;
            
            saleTransactions.forEach(t => {
                if(t.type === 'earned') pointsToRevert -= t.points;
                if(t.type === 'redeemed') pointsToRevert += t.points;
            });
            
            // Remove transactions
            updatedTransactions = loyaltyTransactions.filter(t => t.relatedSaleId !== saleId);

            if (customer) {
                const updatedCustomer = {
                    ...customer,
                    saleIds: customer.saleIds.filter(id => id !== saleId),
                    balance: Math.max(0, customer.balance - sale.balanceDue), // Assuming reversal wipes due balance from this sale
                    loyaltyPoints: Math.max(0, customer.loyaltyPoints + pointsToRevert)
                };
                updatedCustomers = customers.map(c => c.id === customer.id ? updatedCustomer : c);
            }

            toast.success("Sale reversed and deleted.");

        } else {
            // Partial Reversal
            // This is complex - for now, we just update the sale items and total, 
            // but correcting loyalty points proportionally is hard without re-running the whole logic.
            // Simplified: Update items, total, and inventory. Leave points/balance manual adjustment for user if needed.
            
            const newSubtotal = remainingItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
            // Re-calculate basic totals roughly
            const newTotal = Math.max(0, sale.total - itemsToReturn.reduce((acc, i) => acc + (i.price * i.quantity), 0));

            const updatedSale = {
                ...sale,
                items: remainingItems,
                subtotal: newSubtotal,
                total: newTotal
            };
            
            updatedSales = sales.map(s => s.id === saleId ? updatedSale : s);
            toast.success("Items returned to inventory. Please adjust customer balance/points manually if needed.");
        }

        setData({
            ...data!,
            inventory: updatedInventory,
            sales: updatedSales,
            customers: updatedCustomers,
            loyaltyTransactions: updatedTransactions
        });
    };

    const updateSale = (saleId: string, updates: Partial<Sale>) => {
        const updatedSales = sales.map(s => s.id === saleId ? { ...s, ...updates } : s);
        setData({ ...data!, sales: updatedSales });
        toast.success("Sale updated.");
    };

    const updateCustomer = (customerId: string, updates: Partial<Customer>) => {
        const updatedCustomers = customers.map(c => c.id === customerId ? { ...c, ...updates } : c);
        setData({ ...data!, customers: updatedCustomers });
        toast.success("Customer updated.");
        return true;
    };

    const adjustCustomerPoints = (customerId: string, points: number, reason: string) => {
        const customer = customers.find(c => c.id === customerId);
        if (!customer) return false;

        const newPoints = customer.loyaltyPoints + points;
        if (newPoints < 0) {
            toast.error("Cannot deduct more points than available.");
            return false;
        }

        const transaction: LoyaltyTransaction = {
            id: uuidv4(),
            customerId,
            type: points > 0 ? 'manual_add' : 'manual_subtract',
            points: Math.abs(points),
            date: new Date().toISOString(),
            reason,
            pointsBefore: customer.loyaltyPoints,
            pointsAfter: newPoints
        };

        const updatedCustomer = { ...customer, loyaltyPoints: newPoints };
        const updatedCustomers = customers.map(c => c.id === customerId ? updatedCustomer : c);

        setData({
            ...data!,
            customers: updatedCustomers,
            loyaltyTransactions: [...loyaltyTransactions, transaction]
        });
        toast.success("Points adjusted.");
        return true;
    };

    const recordCustomerPayment = (customerId: string, amount: number, notes?: string) => {
        const customer = customers.find(c => c.id === customerId);
        if (!customer) return false;

        const newBalance = Math.max(0, customer.balance - amount);
        const updatedCustomer = { ...customer, balance: newBalance };
        const updatedCustomers = customers.map(c => c.id === customerId ? updatedCustomer : c);
        
        const newPayment: Payment = {
            id: uuidv4(),
            customerId,
            amount,
            date: new Date().toISOString(),
            notes
        };

        setData({
            ...data!,
            customers: updatedCustomers,
            payments: [...payments, newPayment]
        });
        toast.success("Payment recorded.");
        return true;
    };

    const updateEarningRules = (rules: EarningRule[]) => {
        setData({ ...data!, earningRules: rules });
        toast.success("Earning rules updated.");
    };

    const updateRedemptionRule = (rule: RedemptionRule) => {
        setData({ ...data!, redemptionRule: rule });
        toast.success("Redemption rule updated.");
    };

    const addPromotion = (promo: Omit<Promotion, 'id'>) => {
        const newPromo = { ...promo, id: uuidv4() };
        setData({ ...data!, promotions: [...promotions, newPromo] });
        toast.success("Promotion added.");
    };

    const updatePromotion = (promo: Promotion) => {
        const updatedPromos = promotions.map(p => p.id === promo.id ? promo : p);
        setData({ ...data!, promotions: updatedPromos });
        toast.success("Promotion updated.");
    };

    const deletePromotion = (promoId: string) => {
        const updatedPromos = promotions.filter(p => p.id !== promoId);
        setData({ ...data!, promotions: updatedPromos });
        toast.success("Promotion deleted.");
    };

    const updateLoyaltyExpirySettings = (settings: LoyaltyExpirySettings) => {
        setData({ ...data!, loyaltyExpirySettings: settings });
        toast.success("Expiry settings updated.");
    };

    const updateCustomerTiers = (tiers: CustomerTier[]) => {
        setData({ ...data!, customerTiers: tiers });
        toast.success("Tiers updated.");
    };

    const addExpense = (expense: Omit<Expense, 'id'>) => {
        const newExpense = { ...expense, id: uuidv4() };
        setData({ ...data!, expenses: [...expenses, newExpense] });
        toast.success("Expense added.");
    };

    const updateExpense = (expense: Expense) => {
        const updatedExpenses = expenses.map(e => e.id === expense.id ? expense : e);
        setData({ ...data!, expenses: updatedExpenses });
        toast.success("Expense updated.");
    };

    const deleteExpense = (expenseId: string) => {
        setData({ ...data!, expenses: expenses.filter(e => e.id !== expenseId) });
        toast.success("Expense deleted.");
    };

    const addDemandItem = (item: Omit<DemandItem, 'id'>) => {
        const newItem = { ...item, id: uuidv4() };
        setData({ ...data!, demandItems: [...demandItems, newItem] });
        toast.success("Item added to demand list.");
    };

    const addMultipleDemandItems = (items: Omit<DemandItem, 'id'>[]) => {
        const newItems = items.map(item => ({ ...item, id: uuidv4() }));
        setData({ ...data!, demandItems: [...demandItems, ...newItems] });
        toast.success(`${newItems.length} items added to demand list.`);
    }

    const updateDemandItem = (item: DemandItem) => {
        const updatedItems = demandItems.map(i => i.id === item.id ? item : i);
        setData({ ...data!, demandItems: updatedItems });
        toast.success("Demand item updated.");
    };

    const deleteDemandItem = (itemId: string) => {
        setData({ ...data!, demandItems: demandItems.filter(i => i.id !== itemId) });
        toast.success("Item removed from demand list.");
    };

    const backupData = () => {
        if (!data) return;
        const json = JSON.stringify(data);
        const blob = new Blob([json], { type: 'application/json' });
        const href = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = href;
        link.download = `shopsync_backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("Backup downloaded.");
    };

    const restoreData = (newData: AppData) => {
        setData(newData);
        toast.success("Data restored successfully! Refreshing...");
        setTimeout(() => window.location.reload(), 1500);
    };

    const contextValue: AppContextType = {
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
        backupData, restoreData,
        loading
    };

    return (
        <AppContext.Provider value={contextValue}>
            {children}
        </AppContext.Provider>
    );
};

export const useAppContext = () => {
    const context = useContext(AppContext);
    if (context === undefined) {
        throw new Error('useAppContext must be used within an AppProvider');
    }
    return context;
};
