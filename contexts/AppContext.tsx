
import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import useIndexedDB from '../hooks/useIndexedDB';
import { 
    ShopInfo, User, Category, Product, Sale, Customer, 
    LoyaltyTransaction, EarningRule, RedemptionRule, Promotion, 
    LoyaltyExpirySettings, CustomerTier, Expense, Payment, DemandItem,
    CartItem, SaleItem, OutsideServiceItem
} from '../types';
import { SAMPLE_PRODUCTS, SAMPLE_CATEGORIES } from '../constants';
import toast from 'react-hot-toast';
import { v4 as uuidv4 } from 'uuid';

interface AppData {
    shopInfo: ShopInfo | null;
    users: User[];
    categories: Category[];
    inventory: Product[];
    sales: Sale[];
    customers: Customer[];
    loyaltyTransactions: LoyaltyTransaction[];
    earningRules: EarningRule[];
    redemptionRule: RedemptionRule;
    promotions: Promotion[];
    loyaltyExpirySettings: LoyaltyExpirySettings;
    customerTiers: CustomerTier[];
    expenses: Expense[];
    payments: Payment[];
    demandItems: DemandItem[];
}

const INITIAL_DATA: AppData = {
    shopInfo: null,
    users: [],
    categories: SAMPLE_CATEGORIES,
    inventory: [],
    sales: [],
    customers: [],
    loyaltyTransactions: [],
    earningRules: [],
    redemptionRule: { method: 'fixedValue', points: 1, value: 1 },
    promotions: [],
    loyaltyExpirySettings: {
        enabled: false,
        inactivityPeriodValue: 1,
        inactivityPeriodUnit: 'years',
        pointsLifespanValue: 1,
        pointsLifespanUnit: 'years',
        reminderPeriodValue: 1,
        reminderPeriodUnit: 'months'
    },
    customerTiers: [],
    expenses: [],
    payments: [],
    demandItems: []
};

interface AppContextType extends AppData {
    loading: boolean;
    currentUser: User | null;
    
    // Auth
    login: (username: string, passwordHash: string) => Promise<boolean>;
    logout: () => void;
    signUp: (username: string, passwordHash: string) => Promise<boolean>;
    addUser: (username: string, passwordHash: string) => Promise<boolean>;
    deleteUser: (id: string) => void;
    updateUser: (id: string, updates: Partial<User>) => Promise<boolean>;

    // Shop
    saveShopInfo: (info: ShopInfo) => void;
    backupData: () => void;
    restoreData: (data: AppData) => void;

    // Inventory
    addProduct: (product: Omit<Product, 'id'>) => void;
    updateProduct: (product: Product) => void;
    deleteProduct: (id: string) => void;
    addStock: (id: string, quantity: number, newPrice?: number) => void;
    findProductByBarcode: (barcode: string) => Product | undefined;
    addSampleData: () => void;
    importFromExcel: (data: any[]) => void;

    // Categories
    addCategory: (name: string, parentId: string | null) => void;
    updateCategory: (id: string, name: string) => void;
    deleteCategory: (id: string) => void;

    // Sales
    createSale: (
        cartItems: CartItem[], 
        overallDiscount: number, 
        overallDiscountType: 'fixed' | 'percentage',
        customerDetails: { customerName: string, bikeNumber: string, contactNumber: string, serviceFrequencyValue?: number, serviceFrequencyUnit?: 'days' | 'months' | 'years' },
        pointsRedeemed: number,
        tuningCharges: number,
        laborCharges: number,
        amountPaid: number,
        outsideServices: OutsideServiceItem[]
    ) => Sale | null;
    updateSale: (updatedSale: Sale) => void;
    reverseSale: (saleId: string, itemsToReturn: SaleItem[]) => void;

    // Customers & Loyalty
    updateCustomer: (id: string, updates: Partial<Customer>) => boolean;
    deleteCustomer: (id: string) => void;
    adjustCustomerPoints: (customerId: string, points: number, reason: string) => boolean;
    recordCustomerPayment: (customerId: string, amount: number, notes?: string) => boolean;
    
    // Loyalty Settings
    updateEarningRules: (rules: EarningRule[]) => void;
    updateRedemptionRule: (rule: RedemptionRule) => void;
    addPromotion: (promo: Omit<Promotion, 'id'>) => void;
    updatePromotion: (promo: Promotion) => void;
    deletePromotion: (id: string) => void;
    updateLoyaltyExpirySettings: (settings: LoyaltyExpirySettings) => void;
    updateCustomerTiers: (tiers: CustomerTier[]) => void;

    // Expenses
    addExpense: (expense: Omit<Expense, 'id'>) => void;
    updateExpense: (expense: Expense) => void;
    deleteExpense: (id: string) => void;

    // Demand
    addDemandItem: (item: Omit<DemandItem, 'id'>) => void;
    addMultipleDemandItems: (items: Omit<DemandItem, 'id'>[]) => void;
    updateDemandItem: (item: DemandItem) => void;
    deleteDemandItem: (id: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { data, setData, loading: dbLoading } = useIndexedDB<AppData>(INITIAL_DATA);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [isAuthReady, setIsAuthReady] = useState(false);

    // Ensure data is never null after loading
    const appData = data || INITIAL_DATA;

    // Restore session logic
    useEffect(() => {
        // Wait for DB to load
        if (dbLoading) return;
        
        // Prevent running multiple times if auth is already determined
        if (isAuthReady) return;

        const storedUserId = localStorage.getItem('shopsync_user_id');
        
        if (storedUserId) {
            // Find user in the loaded data
            const user = appData.users.find(u => u.id === storedUserId);
            if (user) {
                console.log("Restoring session for user:", user.username);
                setCurrentUser(user);
            } else {
                console.warn("Stored user ID not found in database:", storedUserId);
            }
        }
        
        setIsAuthReady(true);
    }, [dbLoading, isAuthReady, appData.users]);

    // Global loading state: True if DB is loading OR auth check hasn't finished
    const loading = dbLoading || !isAuthReady;

    // Helper to update full state
    const updateData = async (updates: Partial<AppData>) => {
        await setData({ ...appData, ...updates });
    };

    // Auth Logic
    const login = async (username: string, passwordHash: string): Promise<boolean> => {
        const simpleHash = async (str: string) => {
            const encoder = new TextEncoder();
            const d = encoder.encode(str);
            const hashBuffer = await crypto.subtle.digest('SHA-256', d);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        };
        
        const hash = await simpleHash(passwordHash);

        const user = appData.users.find(u => u.username === username && u.passwordHash === hash);
        if (user) {
            setCurrentUser(user);
            localStorage.setItem('shopsync_user_id', user.id);
            toast.success(`Welcome back, ${user.username}!`);
            return true;
        } else {
            toast.error("Invalid credentials");
            return false;
        }
    };

    const logout = () => {
        setCurrentUser(null);
        localStorage.removeItem('shopsync_user_id');
        toast.success("Logged out successfully");
    };

    const signUp = async (username: string, passwordHash: string): Promise<boolean> => {
        if (appData.users.length > 0) {
            toast.error("Master account already exists.");
            return false;
        }

        const simpleHash = async (str: string) => {
            const encoder = new TextEncoder();
            const d = encoder.encode(str);
            const hashBuffer = await crypto.subtle.digest('SHA-256', d);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        };
        
        const hash = await simpleHash(passwordHash);
        
        const newUser: User = {
            id: uuidv4(),
            username,
            passwordHash: hash,
            role: 'master'
        };
        
        try {
            // Wait for DB write to confirm persistence before setting local auth state
            await updateData({ users: [newUser] });
            setCurrentUser(newUser);
            localStorage.setItem('shopsync_user_id', newUser.id);
            toast.success("Master account created!");
            return true;
        } catch (error) {
            console.error("SignUp persistence failed:", error);
            toast.error("Failed to create account. Please try again.");
            return false;
        }
    };

    const addUser = async (username: string, passwordHash: string): Promise<boolean> => {
         if (appData.users.some(u => u.username === username)) {
            toast.error("Username already exists.");
            return false;
        }

        const simpleHash = async (str: string) => {
            const encoder = new TextEncoder();
            const d = encoder.encode(str);
            const hashBuffer = await crypto.subtle.digest('SHA-256', d);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        };

        const hash = await simpleHash(passwordHash);

        const newUser: User = {
            id: uuidv4(),
            username,
            passwordHash: hash,
            role: 'sub'
        };
        
        try {
            await updateData({ users: [...appData.users, newUser] });
            toast.success("User added successfully.");
            return true;
        } catch (error) {
            toast.error("Failed to save user.");
            return false;
        }
    };

    const deleteUser = (id: string) => {
        updateData({ users: appData.users.filter(u => u.id !== id) });
        toast.success("User deleted.");
    };

    const updateUser = async (id: string, updates: Partial<User>) => {
        await updateData({ users: appData.users.map(u => u.id === id ? { ...u, ...updates } : u) });
        if(currentUser && currentUser.id === id) {
            setCurrentUser({ ...currentUser, ...updates });
        }
        toast.success("Profile updated.");
        return true;
    };

    // Shop Info
    const saveShopInfo = (info: ShopInfo) => {
        updateData({ shopInfo: info });
    };

    const backupData = () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appData));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "shopsync_backup_" + new Date().toISOString() + ".json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        toast.success("Backup downloaded.");
    };

    const restoreData = (newData: AppData) => {
        // Validate basic structure
        if (!newData.users || !newData.inventory) {
            toast.error("Invalid backup file structure.");
            return;
        }
        setData(newData);
        toast.success("Data restored successfully.");
    };

    // Inventory
    const addProduct = (product: Omit<Product, 'id'>) => {
        const newProduct = { ...product, id: uuidv4() };
        updateData({ inventory: [...appData.inventory, newProduct] });
        toast.success("Product added.");
    };

    const updateProduct = (product: Product) => {
        updateData({ inventory: appData.inventory.map(p => p.id === product.id ? product : p) });
        toast.success("Product updated.");
    };

    const deleteProduct = (id: string) => {
        updateData({ inventory: appData.inventory.filter(p => p.id !== id) });
        toast.success("Product deleted.");
    };

    const addStock = (id: string, quantity: number, newPrice?: number) => {
        updateData({
            inventory: appData.inventory.map(p => {
                if (p.id === id) {
                    return {
                        ...p,
                        quantity: p.quantity + quantity,
                        salePrice: newPrice !== undefined ? newPrice : p.salePrice
                    };
                }
                return p;
            })
        });
        toast.success("Stock updated.");
    };

    const findProductByBarcode = (barcode: string) => {
        return appData.inventory.find(p => p.barcode === barcode);
    };

    const addSampleData = () => {
        const products: Product[] = SAMPLE_PRODUCTS.map(p => ({ ...p, id: uuidv4() }));
        updateData({ inventory: [...appData.inventory, ...products] });
        toast.success("Sample products added.");
    };

    const importFromExcel = (json: any[]) => {
        let addedCount = 0;
        const newProducts: Product[] = [];
        
        json.forEach(row => {
            const name = row['Name'];
            const categoryId = row['Category ID'];
            const price = row['Sale Price (Rs)'];
            
            if (name && categoryId && price) {
                 newProducts.push({
                    id: uuidv4(),
                    name: row['Name'],
                    manufacturer: row['Manufacturer'] || 'N/A',
                    categoryId: row['Category ID'],
                    subCategoryId: row['SubCategory ID'] || null,
                    location: row['Location'] || '',
                    barcode: row['Barcode'] ? String(row['Barcode']) : undefined,
                    quantity: Number(row['Quantity']) || 0,
                    purchasePrice: Number(row['Purchase Price (Rs)']) || 0,
                    salePrice: Number(row['Sale Price (Rs)']),
                    imageUrl: row['Image URL'] || undefined
                });
                addedCount++;
            }
        });

        if (addedCount > 0) {
             updateData({ inventory: [...appData.inventory, ...newProducts] });
             toast.success(`${addedCount} products imported.`);
        } else {
            toast.error("No valid products found in Excel.");
        }
    };

    // Categories
    const addCategory = (name: string, parentId: string | null) => {
        updateData({ categories: [...appData.categories, { id: uuidv4(), name, parentId }] });
    };

    const updateCategory = (id: string, name: string) => {
        updateData({ categories: appData.categories.map(c => c.id === id ? { ...c, name } : c) });
    };

    const deleteCategory = (id: string) => {
        // Also delete subcategories and unset categories in products
        const idsToDelete = [id, ...appData.categories.filter(c => c.parentId === id).map(c => c.id)];
        
        updateData({
            categories: appData.categories.filter(c => !idsToDelete.includes(c.id)),
            inventory: appData.inventory.map(p => idsToDelete.includes(p.categoryId) ? { ...p, categoryId: 'uncategorized' } : p)
        });
        toast.success("Category deleted.");
    };

    // Sales Logic
    const createSale = (
        cartItems: CartItem[], 
        overallDiscount: number, 
        overallDiscountType: 'fixed' | 'percentage',
        customerDetails: { customerName: string, bikeNumber: string, contactNumber: string, serviceFrequencyValue?: number, serviceFrequencyUnit?: 'days' | 'months' | 'years' },
        pointsRedeemed: number,
        tuningCharges: number,
        laborCharges: number,
        amountPaid: number,
        outsideServices: OutsideServiceItem[]
    ) => {
        if (cartItems.length === 0 && tuningCharges === 0 && laborCharges === 0 && outsideServices.length === 0) {
            toast.error("Cart is empty.");
            return null;
        }

        // Auto-generate Bike Number if Name is present but Bike Number is missing
        if (customerDetails.customerName.trim() && !customerDetails.bikeNumber.trim()) {
            const existingIds = appData.customers.reduce((acc, c) => {
                if (/^\d+$/.test(c.id)) {
                    const num = parseInt(c.id, 10);
                    return num > acc ? num : acc;
                }
                return acc;
            }, 0);
            
            customerDetails.bikeNumber = String(existingIds + 1);
        }

        const saleItems: SaleItem[] = cartItems.map(item => ({
            productId: item.id,
            name: item.name,
            quantity: item.cartQuantity,
            originalPrice: item.salePrice,
            purchasePrice: item.purchasePrice,
            discount: item.discount,
            discountType: item.discountType,
            price: item.discountType === 'fixed' 
                ? item.salePrice - item.discount 
                : item.salePrice * (1 - item.discount / 100)
        }));

        const subtotal = saleItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
        const totalItemDiscounts = cartItems.reduce((acc, item) => {
            const discountAmount = item.discountType === 'fixed' 
                ? item.discount 
                : (item.salePrice * item.discount / 100);
            return acc + (discountAmount * item.cartQuantity);
        }, 0);

        const totalCharges = tuningCharges + laborCharges;
        const subtotalWithCharges = subtotal + totalCharges;
        
        const overallDiscountAmount = overallDiscountType === 'fixed' 
            ? overallDiscount 
            : (subtotalWithCharges * overallDiscount / 100);

        // Calculate Loyalty Discount
        let loyaltyDiscount = 0;
        if (pointsRedeemed > 0) {
            const rule = appData.redemptionRule;
            if (rule.method === 'fixedValue') {
                loyaltyDiscount = (pointsRedeemed / rule.points) * rule.value;
            } else {
                const percentage = (pointsRedeemed / rule.points) * rule.value;
                const totalBeforeLoyalty = (subtotalWithCharges - overallDiscountAmount) + (customerDetails.bikeNumber ? (appData.customers.find(c => c.id === customerDetails.bikeNumber && c.name === customerDetails.customerName)?.balance || 0) : 0);
                loyaltyDiscount = (totalBeforeLoyalty * percentage) / 100;
            }
        }
        
        const totalOutsideServicesCost = outsideServices.reduce((sum, s) => sum + s.amount, 0);

        const total = Math.max(0, (subtotalWithCharges - overallDiscountAmount) - loyaltyDiscount) + totalOutsideServicesCost;
        
        // Handle Customer Logic
        const normalizedBike = customerDetails.bikeNumber.replace(/\s+/g, '').toUpperCase();
        const normalizedName = customerDetails.customerName.trim().toLowerCase();

        let customerId = normalizedBike;
        const existingCustomer = appData.customers.find(c => 
            c.id === normalizedBike && c.name.toLowerCase() === normalizedName
        );
        const idTaken = appData.customers.some(c => c.id === normalizedBike && c.name.toLowerCase() !== normalizedName);

        if (!existingCustomer && idTaken) {
             customerId = uuidv4();
        } else if (!existingCustomer && !idTaken) {
             customerId = normalizedBike;
        } else if (existingCustomer) {
             customerId = existingCustomer.id;
        }
        
        // Generate Sale ID (YYMMDDHHMM)
        const now = new Date();
        const yy = String(now.getFullYear()).slice(-2);
        const mo = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const hh = String(now.getHours()).padStart(2, '0');
        const mi = String(now.getMinutes()).padStart(2, '0');
        
        let generatedSaleId = `${yy}${mo}${dd}${hh}${mi}`;
        let saleId = generatedSaleId;
        
        // Ensure uniqueness if multiple sales happen in the same minute
        let counter = 1;
        while (appData.sales.some(s => s.id === saleId)) {
            saleId = `${generatedSaleId}-${counter}`;
            counter++;
        }
        
        let previousBalance = 0;
        if (existingCustomer) {
            previousBalance = existingCustomer.balance;
        }

        const finalAmountDue = total + previousBalance;
        const balanceDue = Math.max(0, finalAmountDue - amountPaid);
        const paymentStatus = balanceDue <= 0 ? 'Paid' : (amountPaid > 0 ? 'Partial' : 'Unpaid');

        // Loyalty Points Calculation
        let pointsEarned = 0;
        let promotionApplied: { name: string, multiplier: number } | undefined;
        
        // Calculate Net Item Revenue for points
        // Strictly from items in inventory (excluding tuning, labor, outside services)
        const subtotalAfterItemDiscounts = subtotal; // subtotal is items total after item discounts
        const revenueBaseForAllocation = subtotalAfterItemDiscounts + totalCharges; // Items + Tuning + Labor

        let netItemRevenue = subtotalAfterItemDiscounts;
        
        if (revenueBaseForAllocation > 0) {
            // Determine proportion of revenue coming from items vs services to allocate global discounts correctly
            const itemRatio = subtotalAfterItemDiscounts / revenueBaseForAllocation;
            const allocatedOverallDiscount = overallDiscountAmount * itemRatio;
            const allocatedLoyaltyDiscount = loyaltyDiscount * itemRatio;
            
            // Deduct allocated discounts to get net revenue purely from items
            netItemRevenue = subtotalAfterItemDiscounts - allocatedOverallDiscount - allocatedLoyaltyDiscount;
        } else {
             netItemRevenue = 0;
        }
        
        // Points are generated only from the net money earned from items
        const spendForPoints = Math.max(0, netItemRevenue);

        // Find applicable rule
        const applicableRule = appData.earningRules.find(r => spendForPoints >= r.minSpend && (r.maxSpend === null || spendForPoints < r.maxSpend));
        
        if (applicableRule) {
            pointsEarned = Math.floor((spendForPoints / 100) * applicableRule.pointsPerHundred);
        }

        // Apply Promotions
        const activePromo = appData.promotions.find(p => new Date(p.startDate) <= now && new Date(p.endDate) >= now);
        if (activePromo) {
            pointsEarned = Math.floor(pointsEarned * activePromo.multiplier);
            promotionApplied = { name: activePromo.name, multiplier: activePromo.multiplier };
        }
        
        // Tier Multiplier
        let tierMultiplier = 1;
        if (existingCustomer && existingCustomer.tierId) {
             const tier = appData.customerTiers.find(t => t.id === existingCustomer.tierId);
             if (tier) tierMultiplier = tier.pointsMultiplier;
        }
        pointsEarned = Math.floor(pointsEarned * tierMultiplier);

        const newSale: Sale = {
            id: saleId,
            customerId,
            customerName: customerDetails.customerName,
            bikeNumber: customerDetails.bikeNumber,
            items: saleItems,
            subtotal: subtotal,
            totalItemDiscounts,
            overallDiscount,
            overallDiscountType,
            loyaltyDiscount,
            tuningCharges,
            laborCharges,
            outsideServices,
            totalOutsideServices: totalOutsideServicesCost,
            total,
            amountPaid,
            paymentStatus,
            balanceDue,
            previousBalanceBroughtForward: previousBalance,
            date: new Date().toISOString(),
            pointsEarned,
            redeemedPoints: pointsRedeemed,
            finalLoyaltyPoints: (existingCustomer?.loyaltyPoints || 0) - pointsRedeemed + pointsEarned,
            promotionApplied,
            tierApplied: tierMultiplier > 1 ? { name: 'Tier Bonus', multiplier: tierMultiplier } : undefined
        };

        // Update Inventory
        const updatedInventory = appData.inventory.map(p => {
            const saleItem = saleItems.find(i => i.productId === p.id);
            if (saleItem) {
                return { ...p, quantity: p.quantity - saleItem.quantity };
            }
            return p;
        });

        // Update Customer
        let updatedCustomers = [...appData.customers];
        let newTransactions = [...appData.loyaltyTransactions];
        
        // Add loyalty transactions
        if (pointsRedeemed > 0) {
            newTransactions.push({
                id: uuidv4(),
                customerId,
                type: 'redeemed',
                points: pointsRedeemed,
                date: newSale.date,
                relatedSaleId: saleId,
                pointsBefore: existingCustomer ? existingCustomer.loyaltyPoints : 0,
                pointsAfter: (existingCustomer ? existingCustomer.loyaltyPoints : 0) - pointsRedeemed
            });
        }
        
        if (pointsEarned > 0) {
             newTransactions.push({
                id: uuidv4(),
                customerId,
                type: 'earned',
                points: pointsEarned,
                date: newSale.date,
                relatedSaleId: saleId,
                pointsBefore: (existingCustomer ? existingCustomer.loyaltyPoints : 0) - pointsRedeemed,
                pointsAfter: (existingCustomer ? existingCustomer.loyaltyPoints : 0) - pointsRedeemed + pointsEarned
            });
        }

        if (existingCustomer) {
            updatedCustomers = updatedCustomers.map(c => {
                if (c.id === customerId) {
                    return {
                        ...c,
                        name: customerDetails.customerName, // Update name if changed
                        contactNumber: customerDetails.contactNumber || c.contactNumber,
                        saleIds: [saleId, ...c.saleIds],
                        lastSeen: newSale.date,
                        balance: balanceDue,
                        loyaltyPoints: c.loyaltyPoints - pointsRedeemed + pointsEarned,
                        serviceFrequencyValue: customerDetails.serviceFrequencyValue || c.serviceFrequencyValue,
                        serviceFrequencyUnit: customerDetails.serviceFrequencyUnit || c.serviceFrequencyUnit
                    };
                }
                return c;
            });
        } else if (customerDetails.bikeNumber && customerDetails.bikeNumber !== 'WALKIN') {
            updatedCustomers.push({
                id: customerId,
                name: customerDetails.customerName,
                bikeNumber: customerDetails.bikeNumber,
                contactNumber: customerDetails.contactNumber,
                saleIds: [saleId],
                firstSeen: newSale.date,
                lastSeen: newSale.date,
                loyaltyPoints: pointsEarned,
                balance: balanceDue,
                tierId: null,
                serviceFrequencyValue: customerDetails.serviceFrequencyValue,
                serviceFrequencyUnit: customerDetails.serviceFrequencyUnit,
                manualVisitAdjustment: 0
            });
        }

        // TIER EVALUATION (Basic)
        if (appData.customerTiers.length > 0) {
            updatedCustomers = updatedCustomers.map(c => {
                 if (c.id === customerId) {
                    const bestTier = evaluateTier(c, appData.customerTiers, [...appData.sales, newSale]);
                    return { ...c, tierId: bestTier ? bestTier.id : null };
                 }
                 return c;
            });
        }

        updateData({
            inventory: updatedInventory,
            sales: [newSale, ...appData.sales],
            customers: updatedCustomers,
            loyaltyTransactions: newTransactions
        });

        toast.success("Sale completed successfully!");
        return newSale;
    };

    const updateSale = (updatedSale: Sale) => {
        const oldSale = appData.sales.find(s => s.id === updatedSale.id);
        if (!oldSale) return;

        // 1. Inventory Diff
        let newInventory = [...appData.inventory];
        
        // Revert old inventory usage
        oldSale.items.forEach(item => {
            if(!item.productId.startsWith('manual-')) {
                const prod = newInventory.find(p => p.id === item.productId);
                if(prod) prod.quantity += item.quantity;
            }
        });

        // Apply new inventory usage
        updatedSale.items.forEach(item => {
             if(!item.productId.startsWith('manual-')) {
                const prod = newInventory.find(p => p.id === item.productId);
                if(prod) prod.quantity -= item.quantity;
            }
        });

        // 2. Customer & Loyalty Logic
        let newCustomers = [...appData.customers];
        const customer = newCustomers.find(c => c.id === updatedSale.customerId);

        // Remove old transactions
        let newTransactions = appData.loyaltyTransactions.filter(t => t.relatedSaleId !== updatedSale.id);

        if (customer) {
            // Revert Old Financials
            customer.balance -= oldSale.balanceDue;
            // Revert points: subtract earned, add back redeemed
            customer.loyaltyPoints = customer.loyaltyPoints - (oldSale.pointsEarned || 0) + (oldSale.redeemedPoints || 0);
            
            // Recalculate Points for New Sale (Re-using logic)
            let pointsEarned = 0;
            // Same logic as createSale for netItemRevenue
            const subtotalAfterItemDiscounts = updatedSale.subtotal; // Assuming updatedSale.subtotal is correct item subtotal
            const charges = (updatedSale.laborCharges || 0) + (updatedSale.tuningCharges || 0);
            const revenueBase = subtotalAfterItemDiscounts + charges;
            
            const overallDiscountAmount = updatedSale.overallDiscountType === 'fixed'
                ? updatedSale.overallDiscount
                : (revenueBase * updatedSale.overallDiscount) / 100;

            const totalGlobalDiscounts = overallDiscountAmount + (updatedSale.loyaltyDiscount || 0);

            let netItemRevenue = subtotalAfterItemDiscounts;
             if (revenueBase > 0) {
                const itemRatio = subtotalAfterItemDiscounts / revenueBase;
                netItemRevenue -= (totalGlobalDiscounts * itemRatio);
            } else {
                 netItemRevenue = 0;
            }
            const spendForPoints = Math.max(0, netItemRevenue);
            
            // Re-eval earning rule
            const applicableRule = appData.earningRules.find(r => spendForPoints >= r.minSpend && (r.maxSpend === null || spendForPoints < r.maxSpend));
            if (applicableRule) {
                pointsEarned = Math.floor((spendForPoints / 100) * applicableRule.pointsPerHundred);
            }
            
            // Re-apply promotion if it was applied (keep same promotion or check current date? 
            // Better to keep same promo multiplier if it exists on the sale object, or re-eval active promo?
            // For simplicity, let's assume we re-evaluate active promotions based on CURRENT date or keep existing multiplier if stored.
            // But updatedSale passed from UI might not have recalculated points. Let's rely on standard logic.
            const now = new Date();
             const activePromo = appData.promotions.find(p => new Date(p.startDate) <= now && new Date(p.endDate) >= now);
            if (activePromo) {
                pointsEarned = Math.floor(pointsEarned * activePromo.multiplier);
                updatedSale.promotionApplied = { name: activePromo.name, multiplier: activePromo.multiplier };
            } else {
                updatedSale.promotionApplied = undefined;
            }

            // Tier multiplier
            let tierMultiplier = 1;
            if (customer.tierId) {
                 const tier = appData.customerTiers.find(t => t.id === customer.tierId);
                 if (tier) tierMultiplier = tier.pointsMultiplier;
            }
            pointsEarned = Math.floor(pointsEarned * tierMultiplier);
            updatedSale.pointsEarned = pointsEarned;
            
            // Apply New Financials
            customer.balance += updatedSale.balanceDue;
            // Apply new points: add earned, subtract redeemed
            customer.loyaltyPoints = customer.loyaltyPoints + pointsEarned - (updatedSale.redeemedPoints || 0);
            
            // Update other customer fields if needed
            customer.name = updatedSale.customerName;
            
            // Add new transactions
             if ((updatedSale.redeemedPoints || 0) > 0) {
                newTransactions.push({
                    id: uuidv4(),
                    customerId: customer.id,
                    type: 'redeemed',
                    points: updatedSale.redeemedPoints!,
                    date: new Date().toISOString(), // Use current time for edit log or keep original? Keeping original date might be confusing if points change. Using new txn.
                    relatedSaleId: updatedSale.id,
                    pointsBefore: customer.loyaltyPoints + (updatedSale.redeemedPoints || 0) - pointsEarned, // Approximation
                    pointsAfter: customer.loyaltyPoints - pointsEarned // Approximation
                });
            }
            if (pointsEarned > 0) {
                 newTransactions.push({
                    id: uuidv4(),
                    customerId: customer.id,
                    type: 'earned',
                    points: pointsEarned,
                    date: new Date().toISOString(),
                    relatedSaleId: updatedSale.id,
                    pointsBefore: customer.loyaltyPoints - pointsEarned,
                    pointsAfter: customer.loyaltyPoints
                });
            }
            
            updatedSale.finalLoyaltyPoints = customer.loyaltyPoints;
        }

        // 4. Update Sales List
        const newSales = appData.sales.map(s => s.id === updatedSale.id ? updatedSale : s);

        updateData({
            inventory: newInventory,
            sales: newSales,
            customers: newCustomers,
            loyaltyTransactions: newTransactions
        });
        
        toast.success("Sale updated successfully.");
    };

    const reverseSale = (saleId: string, itemsToReturn: SaleItem[]) => {
        const sale = appData.sales.find(s => s.id === saleId);
        if (!sale) return;

        // 1. Restore Inventory
        const updatedInventory = appData.inventory.map(product => {
            const itemToReturn = itemsToReturn.find(i => i.productId === product.id);
            if (itemToReturn && !itemToReturn.productId.startsWith('manual-')) {
                return { ...product, quantity: product.quantity + itemToReturn.quantity };
            }
            return product;
        });

        const remainingItems = sale.items.filter(item => !itemsToReturn.some(r => r.productId === item.productId));
        
        let updatedSales = [...appData.sales];
        let updatedCustomers = [...appData.customers];
        let updatedTransactions = [...appData.loyaltyTransactions];
        let updatedPayments = [...appData.payments];
        
        if (remainingItems.length === 0) {
            // Full Reversal / Delete Sale
            const customer = appData.customers.find(c => c.id === sale.customerId);
            
            // Remove sale from sales
            updatedSales = appData.sales.filter(s => s.id !== saleId);

            // Revert Loyalty Points
            const saleTransactions = appData.loyaltyTransactions.filter(t => t.relatedSaleId === saleId);
            let pointsChange = 0;
            
            saleTransactions.forEach(t => {
                if(t.type === 'earned') pointsChange -= t.points;
                if(t.type === 'redeemed') pointsChange += t.points;
            });
            
            // Remove transactions
            updatedTransactions = appData.loyaltyTransactions.filter(t => t.relatedSaleId !== saleId);

            if (customer) {
                const updatedCustomer = {
                    ...customer,
                    saleIds: customer.saleIds.filter(id => id !== saleId),
                    balance: Math.max(0, customer.balance - sale.balanceDue),
                    loyaltyPoints: Math.max(0, customer.loyaltyPoints + pointsChange)
                };
                updatedCustomers = appData.customers.map(c => c.id === customer.id ? updatedCustomer : c);
            }
            toast.success("Sale deleted completely.");
        } else {
            // Partial Reversal
            // Just adjust totals roughly. Complex partial returns logic omitted for simplicity.
            
            const newSubtotal = remainingItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
            const returnedValue = itemsToReturn.reduce((acc, i) => acc + (i.price * i.quantity), 0);
            const newTotal = Math.max(0, sale.total - returnedValue);

            const updatedSale = {
                ...sale,
                items: remainingItems,
                subtotal: newSubtotal,
                total: newTotal
            };
            
            updatedSales = appData.sales.map(s => s.id === saleId ? updatedSale : s);
            toast.success("Items returned. Please adjust balance/points manually.");
        }

        updateData({
            inventory: updatedInventory,
            sales: updatedSales,
            customers: updatedCustomers,
            loyaltyTransactions: updatedTransactions,
            payments: updatedPayments
        });
    };
    
    // Evaluate Tier Helper
    const evaluateTier = (customer: Customer, tiers: CustomerTier[], salesList: Sale[]): CustomerTier | null => {
         const sortedTiers = [...tiers].sort((a,b) => b.rank - a.rank); // Check highest rank first
         for (const tier of sortedTiers) {
             if (tier.rank === 0) continue; // Always qualify for base tier if nothing else
             
             // Calculate metrics for period
             const now = new Date();
             const cutoff = new Date();
             if(tier.periodUnit === 'days') cutoff.setDate(now.getDate() - tier.periodValue);
             if(tier.periodUnit === 'months') cutoff.setMonth(now.getMonth() - tier.periodValue);
             if(tier.periodUnit === 'years') cutoff.setFullYear(now.getFullYear() - tier.periodValue);
             
             const relevantSales = salesList.filter(s => s.customerId === customer.id && new Date(s.date) >= cutoff);
             const visitCount = relevantSales.length + (customer.manualVisitAdjustment || 0);
             const totalSpend = relevantSales.reduce((sum, s) => sum + s.amountPaid, 0);
             
             if (visitCount >= tier.minVisits && totalSpend >= tier.minSpend) {
                 return tier;
             }
         }
         return sortedTiers.find(t => t.rank === 0) || null;
    }

    // Customer Updates
    const updateCustomer = (id: string, updates: Partial<Customer>) => {
        updateData({ customers: appData.customers.map(c => c.id === id ? { ...c, ...updates } : c) });
        return true;
    };

    const deleteCustomer = (id: string) => {
        updateData({ customers: appData.customers.filter(c => c.id !== id) });
        toast.success("Customer deleted.");
    };

    const adjustCustomerPoints = (customerId: string, points: number, reason: string) => {
        const customer = appData.customers.find(c => c.id === customerId);
        if (!customer) return false;

        const newPoints = customer.loyaltyPoints + points;
        if (newPoints < 0) {
            toast.error("Customer doesn't have enough points.");
            return false;
        }

        const transaction: LoyaltyTransaction = {
            id: uuidv4(),
            customerId,
            type: points >= 0 ? 'manual_add' : 'manual_subtract',
            points: Math.abs(points),
            date: new Date().toISOString(),
            reason,
            pointsBefore: customer.loyaltyPoints,
            pointsAfter: newPoints
        };

        updateData({
            customers: appData.customers.map(c => c.id === customerId ? { ...c, loyaltyPoints: newPoints } : c),
            loyaltyTransactions: [...appData.loyaltyTransactions, transaction]
        });
        toast.success("Points adjusted.");
        return true;
    };

    const recordCustomerPayment = (customerId: string, amount: number, notes?: string) => {
        const customer = appData.customers.find(c => c.id === customerId);
        if (!customer) return false;

        const payment: Payment = {
            id: uuidv4(),
            customerId,
            amount,
            date: new Date().toISOString(),
            notes
        };

        const newBalance = Math.max(0, customer.balance - amount);

        updateData({
            customers: appData.customers.map(c => c.id === customerId ? { ...c, balance: newBalance } : c),
            payments: [...appData.payments, payment]
        });
        toast.success("Payment recorded.");
        return true;
    };

    // Settings & Rules
    const updateEarningRules = (rules: EarningRule[]) => updateData({ earningRules: rules });
    const updateRedemptionRule = (rule: RedemptionRule) => {
        updateData({ redemptionRule: rule });
        toast.success("Redemption rule updated.");
    };
    
    const addPromotion = (promo: Omit<Promotion, 'id'>) => {
        updateData({ promotions: [...appData.promotions, { ...promo, id: uuidv4() }] });
        toast.success("Promotion added.");
    };
    const updatePromotion = (promo: Promotion) => {
        updateData({ promotions: appData.promotions.map(p => p.id === promo.id ? promo : p) });
        toast.success("Promotion updated.");
    };
    const deletePromotion = (id: string) => updateData({ promotions: appData.promotions.filter(p => p.id !== id) });
    
    const updateLoyaltyExpirySettings = (settings: LoyaltyExpirySettings) => {
        updateData({ loyaltyExpirySettings: settings });
        toast.success("Expiry settings saved.");
    };
    const updateCustomerTiers = (tiers: CustomerTier[]) => {
        updateData({ customerTiers: tiers });
        toast.success("Tiers updated.");
    };

    // Expenses
    const addExpense = (expense: Omit<Expense, 'id'>) => {
        updateData({ expenses: [...appData.expenses, { ...expense, id: uuidv4() }] });
        toast.success("Expense added.");
    };
    const updateExpense = (expense: Expense) => {
        updateData({ expenses: appData.expenses.map(e => e.id === expense.id ? expense : e) });
        toast.success("Expense updated.");
    };
    const deleteExpense = (id: string) => {
        updateData({ expenses: appData.expenses.filter(e => e.id !== id) });
        toast.success("Expense deleted.");
    };

    // Demand Items
    const addDemandItem = (item: Omit<DemandItem, 'id'>) => {
        updateData({ demandItems: [...appData.demandItems, { ...item, id: uuidv4() }] });
        toast.success("Item added to demand list.");
    };
    const addMultipleDemandItems = (items: Omit<DemandItem, 'id'>[]) => {
        const newItems = items.map(i => ({ ...i, id: uuidv4() }));
        updateData({ demandItems: [...appData.demandItems, ...newItems] });
        toast.success(`${items.length} items imported to demand list.`);
    };
    const updateDemandItem = (item: DemandItem) => {
        updateData({ demandItems: appData.demandItems.map(i => i.id === item.id ? item : i) });
        toast.success("Item updated.");
    };
    const deleteDemandItem = (id: string) => {
        updateData({ demandItems: appData.demandItems.filter(i => i.id !== id) });
        toast.success("Item removed from demand list.");
    };

    return (
        <AppContext.Provider value={{
            ...appData,
            loading,
            currentUser,
            login,
            logout,
            signUp,
            addUser,
            deleteUser,
            updateUser,
            saveShopInfo,
            backupData,
            restoreData,
            addProduct,
            updateProduct,
            deleteProduct,
            addStock,
            findProductByBarcode,
            addSampleData,
            importFromExcel,
            addCategory,
            updateCategory,
            deleteCategory,
            createSale,
            updateSale,
            reverseSale,
            updateCustomer,
            deleteCustomer,
            adjustCustomerPoints,
            recordCustomerPayment,
            updateEarningRules,
            updateRedemptionRule,
            addPromotion,
            updatePromotion,
            deletePromotion,
            updateLoyaltyExpirySettings,
            updateCustomerTiers,
            addExpense,
            updateExpense,
            deleteExpense,
            addDemandItem,
            addMultipleDemandItems,
            updateDemandItem,
            deleteDemandItem
        }}>
            {children}
        </AppContext.Provider>
    );
};

export const useAppContext = () => {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error("useAppContext must be used within an AppProvider");
    }
    return context;
};
