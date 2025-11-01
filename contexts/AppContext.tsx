
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ShopInfo, User, UserRole, Category, Product, Sale, SaleItem, Customer, CartItem, EarningRule, RedemptionRule, Promotion, LoyaltyTransaction, LoyaltyExpirySettings, CustomerTier, Expense, Payment, DemandItem } from '../types';
import useLocalStorage from '../hooks/useLocalStorage';
import { SAMPLE_PRODUCTS, SAMPLE_CATEGORIES } from '../constants';
import toast from 'react-hot-toast';
import { formatCurrency } from '../utils/helpers';

// This is a simple hash function for demonstration. 
// In a real app, use a library like bcrypt.js on a server.
const simpleHash = async (password: string) => {
    // This is not secure. For demo purposes only.
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

const DEFAULT_TIERS: CustomerTier[] = [
    { id: 'bronze', name: 'Bronze', minVisits: 0, minSpend: 0, periodValue: 12, periodUnit: 'months', pointsMultiplier: 1, rank: 0 },
    { id: 'silver', name: 'Silver', minVisits: 5, minSpend: 10000, periodValue: 12, periodUnit: 'months', pointsMultiplier: 1.25, rank: 1 },
    { id: 'gold', name: 'Gold', minVisits: 15, minSpend: 50000, periodValue: 12, periodUnit: 'months', pointsMultiplier: 1.5, rank: 2 },
    { id: 'platinum', name: 'Platinum', minVisits: 30, minSpend: 150000, periodValue: 12, periodUnit: 'months', pointsMultiplier: 2, rank: 3 },
];

interface AppContextType {
    loading: boolean;
    shopInfo: ShopInfo | null;
    saveShopInfo: (info: ShopInfo) => void;
    currentUser: User | null;
    users: User[];
    signUp: (username: string, password: string) => Promise<boolean>;
    login: (username: string, password: string) => Promise<boolean>;
    logout: () => void;
    updateUser: (userId: string, data: Partial<Pick<User, 'username' | 'passwordHash'>>) => Promise<boolean>;
    addUser: (username: string, password: string) => Promise<User | null>;
    deleteUser: (userId: string) => void;
    
    inventory: Product[];
    addProduct: (product: Omit<Product, 'id'>) => void;
    updateProduct: (product: Product) => void;
    deleteProduct: (productId: string) => void;
    findProductByBarcode: (barcode: string) => Product | undefined;
    addSampleData: () => void;
    importFromExcel: (data: any[]) => void;
    addStock: (productId: string, quantityToAdd: number, newSalePrice?: number) => void;

    categories: Category[];
    addCategory: (name: string, parentId: string | null) => void;
    updateCategory: (id: string, name: string) => void;
    deleteCategory: (id: string) => void;

    sales: Sale[];
    createSale: (cartItems: CartItem[], overallDiscountValue: number, overallDiscountType: 'fixed' | 'percentage', customerInfo: { customerName: string, bikeNumber: string, contactNumber?: string, serviceFrequencyValue?: number, serviceFrequencyUnit?: 'days' | 'months' | 'years' }, redeemedPoints: number, tuningCharges: number, laborCharges: number, amountPaid: number) => Sale | null;
    updateSale: (saleId: string, updates: { items: SaleItem[]; overallDiscount: number; overallDiscountType: 'fixed' | 'percentage'; tuningCharges: number; laborCharges: number; }) => void;
    reverseSale: (saleId: string, itemsToReturn: SaleItem[]) => void;

    customers: Customer[];
    updateCustomer: (customerId: string, details: Partial<Customer>) => boolean;
    recordCustomerPayment: (customerId: string, amount: number, notes?: string) => boolean;

    earningRules: EarningRule[];
    updateEarningRules: (rules: EarningRule[]) => void;
    redemptionRule: RedemptionRule;
    updateRedemptionRule: (rule: RedemptionRule) => void;

    promotions: Promotion[];
    addPromotion: (promotion: Omit<Promotion, 'id'>) => void;
    updatePromotion: (promotion: Promotion) => void;
    deletePromotion: (promotionId: string) => void;

    loyaltyTransactions: LoyaltyTransaction[];
    adjustCustomerPoints: (customerId: string, points: number, reason: string) => boolean;

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
    updateDemandItem: (item: DemandItem) => void;
    deleteDemandItem: (itemId: string) => void;

    createBackup: (showToast?: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [shopInfo, setShopInfo] = useLocalStorage<ShopInfo | null>('shopInfo', null);
    const [users, setUsers] = useLocalStorage<User[]>('users', []);
    const [currentUser, setCurrentUser] = useLocalStorage<User | null>('currentUser', null);
    const [inventory, setInventory] = useLocalStorage<Product[]>('inventory', []);
    const [categories, setCategories] = useLocalStorage<Category[]>('categories', []);
    const [sales, setSales] = useLocalStorage<Sale[]>('sales', []);
    const [customers, setCustomers] = useLocalStorage<Customer[]>('customers', []);
    const [expenses, setExpenses] = useLocalStorage<Expense[]>('expenses', []);
    const [payments, setPayments] = useLocalStorage<Payment[]>('payments', []);
    const [demandItems, setDemandItems] = useLocalStorage<DemandItem[]>('demandItems', []);
    const [loading, setLoading] = useState(true);

    const [earningRules, setEarningRules] = useLocalStorage<EarningRule[]>('earningRules', [
        { id: '1', minSpend: 0, maxSpend: 500, pointsPerHundred: 1 },
        { id: '2', minSpend: 501, maxSpend: 1000, pointsPerHundred: 1.5 },
        { id: '3', minSpend: 1001, maxSpend: null, pointsPerHundred: 2 }
    ]);
    const [redemptionRule, setRedemptionRule] = useLocalStorage<RedemptionRule>('redemptionRule', {
        method: 'fixedValue',
        points: 1,
        value: 1
    });
    const [promotions, setPromotions] = useLocalStorage<Promotion[]>('promotions', []);
    const [loyaltyTransactions, setLoyaltyTransactions] = useLocalStorage<LoyaltyTransaction[]>('loyaltyTransactions', []);

    const [loyaltyExpirySettings, setLoyaltyExpirySettings] = useLocalStorage<LoyaltyExpirySettings>('loyaltyExpirySettings', {
        enabled: false,
        inactivityPeriodValue: 4,
        inactivityPeriodUnit: 'months',
        pointsLifespanValue: 2,
        pointsLifespanUnit: 'years',
        reminderPeriodValue: 30,
        reminderPeriodUnit: 'days',
    });
    const [lastExpiryCheck, setLastExpiryCheck] = useLocalStorage<string | null>('lastExpiryCheck', null);
    
    const [customerTiers, setCustomerTiers] = useLocalStorage<CustomerTier[]>('customerTiers', DEFAULT_TIERS);

    const modifyDate = (date: Date, value: number, unit: 'days' | 'months' | 'years', direction: 'add' | 'subtract'): Date => {
        const newDate = new Date(date);
        const multiplier = direction === 'add' ? 1 : -1;
        if (unit === 'days') newDate.setDate(newDate.getDate() + (value * multiplier));
        if (unit === 'months') newDate.setMonth(newDate.getMonth() + (value * multiplier));
        if (unit === 'years') newDate.setFullYear(newDate.getFullYear() + (value * multiplier));
        return newDate;
    };
    
    const recalculateAndAssignTier = useCallback((customerId: string, currentCustomers: Customer[], allSales: Sale[], allTiers: CustomerTier[]) => {
        const customerIndex = currentCustomers.findIndex(c => c.id === customerId);
        if (customerIndex === -1) return currentCustomers;
    
        const customer = currentCustomers[customerIndex];
        const customerSales = customer.saleIds.map(id => allSales.find(s => s.id === id)).filter((s): s is Sale => !!s);
        
        const sortedTiers = [...allTiers].sort((a, b) => b.rank - a.rank);
        let assignedTierId: string | null = null;
    
        for (const tier of sortedTiers) {
            const periodStartDate = modifyDate(new Date(), tier.periodValue, tier.periodUnit, 'subtract');
            
            const salesInPeriod = customerSales.filter(s => new Date(s.date) >= periodStartDate);
            const spendInPeriod = salesInPeriod.reduce((sum, s) => sum + s.total, 0);
            const visitsInPeriod = salesInPeriod.length + (customer.manualVisitAdjustment || 0);
    
            if (visitsInPeriod >= tier.minVisits && spendInPeriod >= tier.minSpend) {
                assignedTierId = tier.id;
                break; 
            }
        }
    
        if (customer.tierId !== assignedTierId) {
            const updatedCustomers = [...currentCustomers];
            updatedCustomers[customerIndex] = { ...customer, tierId: assignedTierId };
            return updatedCustomers;
        }
    
        return currentCustomers;
    }, []);

    const updateAllCustomerTiers = useCallback(() => {
        console.log("Updating all customer tiers...");
        let updatedCustomers = [...customers];
        let changed = false;
        for (const customer of customers) {
            const newCustomerList = recalculateAndAssignTier(customer.id, updatedCustomers, sales, customerTiers);
            if (newCustomerList !== updatedCustomers) {
                updatedCustomers = newCustomerList;
                changed = true;
            }
        }
        if (changed) {
            setCustomers(updatedCustomers);
            toast.success("Customer tiers have been updated.");
            console.log("Customer tiers updated.");
        } else {
            console.log("No tier changes for any customer.");
        }
    }, [customers, sales, customerTiers, recalculateAndAssignTier, setCustomers]);

    const runPointsExpiryCheck = useCallback(() => {
        if (!loyaltyExpirySettings.enabled) return;
        
        console.log("Running points expiry check...");
        const now = new Date();
        let updatedCustomers = [...customers];
        let updatedTransactions: LoyaltyTransaction[] = [];
        let anyChanges = false;
    
        updatedCustomers = updatedCustomers.map(customer => {
            if (customer.loyaltyPoints <= 0) return customer;
    
            // 1. Inactivity check
            const inactivityThreshold = modifyDate(now, loyaltyExpirySettings.inactivityPeriodValue, loyaltyExpirySettings.inactivityPeriodUnit, 'subtract');
            if (new Date(customer.lastSeen) < inactivityThreshold) {
                const pointsToExpire = customer.loyaltyPoints;
                const newTransaction: LoyaltyTransaction = {
                    id: uuidv4(), customerId: customer.id, type: 'manual_subtract', points: pointsToExpire,
                    date: now.toISOString(), reason: `Expired due to inactivity (${loyaltyExpirySettings.inactivityPeriodValue} ${loyaltyExpirySettings.inactivityPeriodUnit})`,
                    pointsBefore: customer.loyaltyPoints, pointsAfter: 0
                };
                updatedTransactions.push(newTransaction);
                anyChanges = true;
                return { ...customer, loyaltyPoints: 0 };
            }
    
            // 2. Points lifespan check (First-In, First-Out)
            const customerTransactions = loyaltyTransactions.filter(t => t.customerId === customer.id);
            const credits = customerTransactions.filter(t => t.type === 'earned' || t.type === 'manual_add').sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            let debitsToApply = customerTransactions.filter(t => t.type === 'redeemed' || t.type === 'manual_subtract').reduce((sum, t) => sum + t.points, 0);
            
            let totalPointsToExpire = 0;
            let currentBalance = customer.loyaltyPoints;
    
            for (const credit of credits) {
                let unspentPoints = credit.points;
                if (debitsToApply > 0) {
                    const deduction = Math.min(unspentPoints, debitsToApply);
                    unspentPoints -= deduction;
                    debitsToApply -= deduction;
                }
                
                const expiryDate = modifyDate(new Date(credit.date), loyaltyExpirySettings.pointsLifespanValue, loyaltyExpirySettings.pointsLifespanUnit, 'add');
    
                if (unspentPoints > 0 && now >= expiryDate) {
                    totalPointsToExpire += unspentPoints;
                }
            }
    
            if (totalPointsToExpire > 0) {
                const finalBalance = Math.max(0, currentBalance - totalPointsToExpire);
                const newTransaction: LoyaltyTransaction = {
                    id: uuidv4(), customerId: customer.id, type: 'manual_subtract', points: totalPointsToExpire,
                    date: now.toISOString(), reason: `Expired due to lifespan (${loyaltyExpirySettings.pointsLifespanValue} ${loyaltyExpirySettings.pointsLifespanUnit})`,
                    pointsBefore: currentBalance, pointsAfter: finalBalance
                };
                updatedTransactions.push(newTransaction);
                anyChanges = true;
                return { ...customer, loyaltyPoints: finalBalance };
            }
    
            return customer;
        });
    
        if (anyChanges) {
            setCustomers(updatedCustomers);
            setLoyaltyTransactions(prev => [...updatedTransactions, ...prev]);
            toast.success(`${updatedTransactions.length} point expiry transaction(s) processed.`);
            console.log(`${updatedTransactions.length} point expiry transaction(s) processed.`);
        } else {
            console.log("No points expired today.");
        }
    }, [customers, loyaltyTransactions, loyaltyExpirySettings, setCustomers, setLoyaltyTransactions]);

    useEffect(() => {
        const today = new Date().toDateString();
        if (lastExpiryCheck !== today) {
            console.log("Running daily tasks...");
            runPointsExpiryCheck();
            updateAllCustomerTiers();
            setLastExpiryCheck(today);
        }
        // This simulates loading data
        setTimeout(() => setLoading(false), 500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const saveShopInfo = (info: ShopInfo) => {
        setShopInfo(info);
    };

    const signUp = async (username: string, password: string): Promise<boolean> => {
        const existingUser = users.find(u => u.username.toLowerCase() === username.toLowerCase());
        if (existingUser) {
            toast.error("Username already exists.");
            return false;
        }
        
        const passwordHash = await simpleHash(password);
        const role: UserRole = users.length === 0 ? 'master' : 'sub'; // First user is always master
        const newUser: User = { id: uuidv4(), username, passwordHash, role };
        
        setUsers([...users, newUser]);
        if (role === 'master') {
             setCurrentUser(newUser); // Auto-login the first master user
        }
        toast.success(`Account created successfully! Role: ${role}.`);
        return true;
    };
    
    const addUser = async (username: string, password: string): Promise<User | null> => {
        const existingUser = users.find(u => u.username.toLowerCase() === username.toLowerCase());
        if (existingUser) {
            toast.error("Username already exists.");
            return null;
        }
        
        const passwordHash = await simpleHash(password);
        const newUser: User = { id: uuidv4(), username, passwordHash, role: 'sub' };
        
        setUsers([...users, newUser]);
        toast.success(`Sub account "${username}" created successfully!`);
        return newUser;
    };

    const login = async (username: string, password: string): Promise<boolean> => {
        const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
        if (user) {
            const passwordHash = await simpleHash(password);
            if (user.passwordHash === passwordHash) {
                setCurrentUser(user);
                toast.success(`Welcome back, ${user.username}!`);
                return true;
            }
        }
        toast.error("Invalid username or password.");
        return false;
    };

    const logout = () => {
        setCurrentUser(null);
        toast.success("You have been logged out.");
    };

    const updateUser = async (userId: string, data: Partial<Pick<User, 'username' | 'passwordHash'>>): Promise<boolean> => {
        const userToUpdate = users.find(u => u.id === userId);
        if(!userToUpdate) {
            toast.error("User not found.");
            return false;
        }

        if(data.username && data.username.toLowerCase() !== userToUpdate.username.toLowerCase()) {
             if(users.some(u => u.id !== userId && u.username.toLowerCase() === data.username?.toLowerCase())) {
                 toast.error("Username is already taken.");
                 return false;
             }
        }

        setUsers(users.map(u => u.id === userId ? { ...u, ...data } : u));
        
        // If the current user is updating their own info, update currentUser state as well
        if (currentUser && currentUser.id === userId) {
            setCurrentUser(prev => prev ? { ...prev, ...data } : null);
        }

        toast.success("Profile updated successfully!");
        return true;
    };
    
    const deleteUser = (userId: string) => {
        setUsers(users.filter(u => u.id !== userId));
        toast.success("User deleted successfully.");
    };

    const addProduct = (product: Omit<Product, 'id'>) => {
        const newProduct: Product = { ...product, id: uuidv4() };
        setInventory([newProduct, ...inventory]);
        toast.success(`${newProduct.name} added to inventory.`);
    };

    const updateProduct = (product: Product) => {
        setInventory(inventory.map(p => p.id === product.id ? product : p));
        toast.success(`${product.name} updated successfully.`);
    };
    
    const addStock = (productId: string, quantityToAdd: number, newSalePrice?: number) => {
        setInventory(inventory.map(p => {
            if (p.id === productId) {
                toast.success(`Added ${quantityToAdd} units to ${p.name}. New stock: ${p.quantity + quantityToAdd}.`);
                return {
                    ...p,
                    quantity: p.quantity + quantityToAdd,
                    salePrice: newSalePrice !== undefined ? newSalePrice : p.salePrice,
                };
            }
            return p;
        }));
    };

    const deleteProduct = (productId: string) => {
        const productName = inventory.find(p => p.id === productId)?.name || 'Product';
        setInventory(inventory.filter(p => p.id !== productId));
        toast.success(`${productName} deleted from inventory.`);
    };

    const findProductByBarcode = (barcode: string): Product | undefined => {
        return inventory.find(p => p.barcode === barcode);
    };
    
    const addSampleData = () => {
        const productsWithIds = SAMPLE_PRODUCTS.map(p => ({ ...p, id: uuidv4() }));
        setInventory(prev => [...productsWithIds, ...prev]);
        setCategories(prev => [...SAMPLE_CATEGORIES, ...prev.filter(c => !SAMPLE_CATEGORIES.some(sc => sc.id === c.id))]);
        toast.success("Sample data added!");
    };
    
    const importFromExcel = (data: any[]) => {
        try {
            const newProducts: Product[] = [];
            const categoryIdMap = new Map<string, string>();
            categories.forEach(c => categoryIdMap.set(c.name.toLowerCase(), c.id));
    
            data.forEach((row, index) => {
                const name = row['Name'] || row['name'];
                const salePrice = parseFloat(row['Sale Price (Rs)'] || row['sale price (rs)'] || row['Sale Price'] || row['sale price']);
                const purchasePrice = parseFloat(row['Purchase Price (Rs)'] || row['purchase price (rs)'] || row['Purchase Price'] || row['purchase price']);
                const quantity = parseInt(row['Quantity'] || row['quantity'], 10);
                const categoryId = row['Category ID'] || row['category id'];
    
                if (!name || isNaN(salePrice) || isNaN(purchasePrice) || isNaN(quantity) || !categoryId) {
                    toast.error(`Skipping row ${index + 2}: Missing required fields (Name, Sale Price, Purchase Price, Quantity, Category ID).`);
                    return;
                }
    
                if (!categories.some(c => c.id === categoryId)) {
                    toast.error(`Skipping row ${index + 2}: Category ID "${categoryId}" does not exist.`);
                    return;
                }
    
                newProducts.push({
                    id: uuidv4(),
                    name: String(name),
                    salePrice: salePrice,
                    purchasePrice: purchasePrice,
                    quantity: quantity,
                    categoryId: String(categoryId),
                    subCategoryId: row['SubCategory ID'] || row['subcategory id'] || null,
                    manufacturer: String(row['Manufacturer'] || row['manufacturer'] || 'N/A'),
                    location: String(row['Location'] || row['location'] || ''),
                    barcode: String(row['Barcode'] || row['barcode'] || ''),
                    imageUrl: String(row['Image URL'] || row['image url'] || ''),
                });
            });
    
            if (newProducts.length > 0) {
                setInventory(prev => [...newProducts, ...prev]);
                toast.success(`${newProducts.length} products imported successfully!`);
            } else {
                toast.error("No valid products were found in the file to import.");
            }
        } catch (error) {
            console.error(error);
            toast.error("An error occurred while importing the file.");
        }
    };
    
    const addCategory = (name: string, parentId: string | null) => {
        const newCategory = { id: name.toLowerCase().replace(/\s+/g, '-'), name, parentId };
        if(categories.some(c => c.id === newCategory.id)) {
            toast.error("Category with this name already exists.");
            return;
        }
        setCategories([...categories, newCategory]);
        toast.success(`Category "${name}" added.`);
    };

    const updateCategory = (id: string, name: string) => {
        setCategories(categories.map(c => c.id === id ? { ...c, name } : c));
        toast.success("Category updated.");
    };

    const deleteCategory = (id: string) => {
        const subcategoriesToDelete = categories.filter(c => c.parentId === id).map(c => c.id);
        const allIdsToDelete = [id, ...subcategoriesToDelete];
        
        setCategories(categories.filter(c => !allIdsToDelete.includes(c.id)));
        setInventory(inventory.map(p => {
            if (allIdsToDelete.includes(p.categoryId)) {
                return { ...p, categoryId: 'uncategorized', subCategoryId: null };
            }
            if (p.subCategoryId && allIdsToDelete.includes(p.subCategoryId)) {
                return { ...p, subCategoryId: null };
            }
            return p;
        }));
        toast.success("Category and its sub-categories deleted.");
    };
    
    const createSale = (
        cartItems: CartItem[], 
        overallDiscountValue: number, 
        overallDiscountType: 'fixed' | 'percentage', 
        customerInfo: { customerName: string, bikeNumber: string, contactNumber?: string, serviceFrequencyValue?: number, serviceFrequencyUnit?: 'days' | 'months' | 'years' },
        redeemedPoints: number,
        tuningCharges: number,
        laborCharges: number,
        amountPaid: number
    ): Sale | null => {
        if (cartItems.length === 0 && tuningCharges <= 0 && laborCharges <= 0) {
            toast.error("Cannot create an empty sale.");
            return null;
        }

        const now = new Date();
        const year = now.getFullYear().toString().slice(-2);
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const day = now.getDate().toString().padStart(2, '0');
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        const seconds = now.getSeconds().toString().padStart(2, '0');

        const saleIdBase = `${year}${month}${day}${hours}${minutes}${seconds}`;
        let finalSaleId = saleIdBase;
        let counter = 1;
        
        while (sales.some(s => s.id === finalSaleId)) {
            finalSaleId = `${saleIdBase}${counter}`;
            counter++;
        }

        const saleItems: SaleItem[] = cartItems.map(item => {
            const discountAmount = item.discountType === 'fixed' ? item.discount : (item.salePrice * item.discount) / 100;
            return {
                productId: item.id,
                name: item.name,
                quantity: item.cartQuantity,
                originalPrice: item.salePrice,
                discount: item.discount,
                discountType: item.discountType,
                price: item.salePrice - discountAmount,
                purchasePrice: item.purchasePrice,
            };
        });

        const subtotal = saleItems.reduce((acc, item) => acc + (item.originalPrice * item.quantity), 0);
        const totalItemDiscounts = saleItems.reduce((acc, item) => {
            const discount = item.discountType === 'fixed' ? item.discount : (item.originalPrice * item.discount) / 100;
            return acc + (discount * item.quantity);
        }, 0);

        const subtotalAfterItemDiscount = subtotal - totalItemDiscounts;
        const totalWithCharges = subtotalAfterItemDiscount + tuningCharges + laborCharges;
        
        const overallDiscountAmount = overallDiscountType === 'fixed' ? overallDiscountValue : (totalWithCharges * overallDiscountValue) / 100;
        const cartTotal = totalWithCharges - overallDiscountAmount;
        
        const customerId = customerInfo.bikeNumber.replace(/\s+/g, '').toUpperCase();
        const existingCustomer = customers.find(c => c.id === customerId);
        const previousBalance = existingCustomer?.balance || 0;
        
        const totalBeforeLoyalty = cartTotal + previousBalance;

        let loyaltyDiscountAmount = 0;
        if (existingCustomer && redeemedPoints > 0 && redeemedPoints <= existingCustomer.loyaltyPoints) {
            if (redemptionRule.method === 'fixedValue') {
                loyaltyDiscountAmount = (redeemedPoints / redemptionRule.points) * redemptionRule.value;
            } else {
                const percentage = (redeemedPoints / redemptionRule.points) * redemptionRule.value;
                loyaltyDiscountAmount = (totalBeforeLoyalty * percentage) / 100;
            }
             // Cap discount to not exceed the current bill total
            loyaltyDiscountAmount = Math.min(loyaltyDiscountAmount, totalBeforeLoyalty);
        }

        const total = Math.round(totalBeforeLoyalty - loyaltyDiscountAmount);
        const balanceDue = Math.round(total - amountPaid);
        const paymentStatus: 'Paid' | 'Partial' | 'Unpaid' = balanceDue <= 0 ? 'Paid' : (amountPaid > 0 ? 'Partial' : 'Unpaid');
        
        // --- Loyalty Points Calculation ---
        let pointsEarned = 0;
        let promotionApplied: Sale['promotionApplied'] = undefined;
        let tierApplied: Sale['tierApplied'] = undefined;

        if (subtotal > 0) {
            // Check for active promotions
            const todayStr = now.toISOString().split('T')[0];
            const activePromotion = promotions.find(p => p.startDate <= todayStr && p.endDate >= todayStr);
            if (activePromotion) {
                promotionApplied = { name: activePromotion.name, multiplier: activePromotion.multiplier };
            }
            
            // Find applicable earning rule
            const applicableRule = [...earningRules].sort((a,b) => a.minSpend - b.minSpend).find(r => subtotal >= r.minSpend && (r.maxSpend === null || subtotal <= r.maxSpend));
            
            if (applicableRule) {
                pointsEarned = (subtotal / 100) * applicableRule.pointsPerHundred;
                
                // Apply tier multiplier
                if (existingCustomer?.tierId) {
                    const tier = customerTiers.find(t => t.id === existingCustomer.tierId);
                    if (tier && tier.pointsMultiplier > 1) {
                        pointsEarned *= tier.pointsMultiplier;
                        tierApplied = { name: tier.name, multiplier: tier.pointsMultiplier };
                    }
                }
                
                // Apply promotion multiplier
                if (activePromotion) {
                    pointsEarned *= activePromotion.multiplier;
                }

                pointsEarned = Math.round(pointsEarned);
            }
        }

        const newSale: Sale = {
            id: finalSaleId,
            customerId: customerId,
            customerName: customerInfo.customerName,
            items: saleItems,
            subtotal,
            totalItemDiscounts,
            overallDiscount: overallDiscountValue,
            overallDiscountType,
            tuningCharges,
            laborCharges,
            loyaltyDiscount: loyaltyDiscountAmount,
            total,
            amountPaid,
            paymentStatus,
            balanceDue,
            previousBalanceBroughtForward: previousBalance > 0 ? previousBalance : undefined,
            date: now.toISOString(),
            pointsEarned,
            redeemedPoints,
            promotionApplied,
            tierApplied,
            finalLoyaltyPoints: 0 // Will be set after customer update
        };
        
        const updatedInventory = [...inventory];
        let inventoryUpdated = false;
        for (const item of cartItems) {
            // Do not deduct stock for manually added items
            if(item.id.startsWith('manual-')) continue;
            
            const index = updatedInventory.findIndex(p => p.id === item.id);
            if (index !== -1) {
                const currentQty = updatedInventory[index].quantity;
                if (currentQty < item.cartQuantity) {
                    toast.error(`Not enough stock for ${item.name}. Sale cancelled.`);
                    return null;
                }
                updatedInventory[index] = { ...updatedInventory[index], quantity: currentQty - item.cartQuantity };
                inventoryUpdated = true;
            } else {
                 toast.error(`Product ${item.name} not found in inventory. Sale cancelled.`);
                 return null;
            }
        }
        
        let newTransactions: LoyaltyTransaction[] = [];
        let finalCustomerList = [...customers];
        let customerUpdated = false;

        const customerIndex = finalCustomerList.findIndex(c => c.id === customerId);

        if (customerIndex > -1) { // Existing customer
            let customer = { ...finalCustomerList[customerIndex] };
            const pointsBefore = customer.loyaltyPoints;
            let pointsAfter = pointsBefore;

            if (pointsEarned > 0) {
                pointsAfter += pointsEarned;
                newTransactions.push({ id: uuidv4(), customerId, type: 'earned', points: pointsEarned, date: now.toISOString(), relatedSaleId: newSale.id, pointsBefore, pointsAfter });
            }
            if (redeemedPoints > 0) {
                const pointsBeforeRedeem = pointsAfter;
                pointsAfter -= redeemedPoints;
                newTransactions.push({ id: uuidv4(), customerId, type: 'redeemed', points: redeemedPoints, date: now.toISOString(), relatedSaleId: newSale.id, pointsBefore: pointsBeforeRedeem, pointsAfter });
            }

            customer = {
                ...customer,
                name: customerInfo.customerName, // Allow name updates on sale
                contactNumber: customerInfo.contactNumber || customer.contactNumber,
                saleIds: [...customer.saleIds, newSale.id],
                lastSeen: now.toISOString(),
                loyaltyPoints: pointsAfter,
                balance: balanceDue,
            };
            
            // Only update service frequency if new values are provided
            if (customerInfo.serviceFrequencyValue) {
                customer.serviceFrequencyValue = customerInfo.serviceFrequencyValue;
                customer.serviceFrequencyUnit = customerInfo.serviceFrequencyUnit;
            }
            
            newSale.finalLoyaltyPoints = pointsAfter;
            finalCustomerList[customerIndex] = customer;
            customerUpdated = true;

        } else { // New customer
            const newCustomer: Customer = {
                id: customerId,
                name: customerInfo.customerName,
                contactNumber: customerInfo.contactNumber,
                saleIds: [newSale.id],
                firstSeen: now.toISOString(),
                lastSeen: now.toISOString(),
                loyaltyPoints: pointsEarned,
                tierId: customerTiers.find(t => t.rank === 0)?.id || null, // Assign base tier
                balance: balanceDue,
                serviceFrequencyValue: customerInfo.serviceFrequencyValue,
                serviceFrequencyUnit: customerInfo.serviceFrequencyUnit
            };
            newSale.finalLoyaltyPoints = pointsEarned;
            finalCustomerList.push(newCustomer);
            customerUpdated = true;
            if (pointsEarned > 0) {
                 newTransactions.push({ id: uuidv4(), customerId, type: 'earned', points: pointsEarned, date: now.toISOString(), relatedSaleId: newSale.id, pointsBefore: 0, pointsAfter: pointsEarned });
            }
        }

        finalCustomerList = recalculateAndAssignTier(customerId, finalCustomerList, [...sales, newSale], customerTiers);

        // Perform state updates together
        setSales(prevSales => [newSale, ...prevSales]);
        if(inventoryUpdated) setInventory(updatedInventory);
        if(customerUpdated) setCustomers(finalCustomerList);
        if (newTransactions.length > 0) setLoyaltyTransactions(prev => [...newTransactions, ...prev]);

        toast.success(`Sale ${newSale.id} completed!`);
        return newSale;
    };
    
    const updateSale = (saleId: string, updates: { items: SaleItem[], overallDiscount: number, overallDiscountType: 'fixed' | 'percentage', tuningCharges: number, laborCharges: number }) => {
        setSales(prevSales => {
            const saleIndex = prevSales.findIndex(s => s.id === saleId);
            if (saleIndex === -1) return prevSales;

            const originalSale = prevSales[saleIndex];
            
            const subtotal = updates.items.reduce((acc, item) => acc + item.originalPrice * item.quantity, 0);
            const totalItemDiscounts = updates.items.reduce((acc, item) => {
                const discountAmount = item.discountType === 'fixed' ? item.discount : (item.originalPrice * item.discount) / 100;
                return acc + (discountAmount * item.quantity);
            }, 0);

            const subtotalAfterItemDiscount = subtotal - totalItemDiscounts;
            const totalWithCharges = subtotalAfterItemDiscount + updates.tuningCharges + updates.laborCharges;

            const overallDiscountAmount = updates.overallDiscountType === 'fixed' 
                ? updates.overallDiscount 
                : (totalWithCharges * updates.overallDiscount) / 100;

            const cartTotal = totalWithCharges - overallDiscountAmount;
            const totalBeforeLoyalty = cartTotal + (originalSale.previousBalanceBroughtForward || 0);
            const newTotal = Math.round(totalBeforeLoyalty - (originalSale.loyaltyDiscount || 0));
            const newBalanceDue = newTotal - originalSale.amountPaid;
            const newPaymentStatus: 'Paid' | 'Partial' | 'Unpaid' = newBalanceDue <= 0 ? 'Paid' : (originalSale.amountPaid > 0 ? 'Partial' : 'Unpaid');

            const updatedSale: Sale = {
                ...originalSale,
                items: updates.items.map(item => ({
                    ...item,
                    price: item.originalPrice - (item.discountType === 'fixed' ? item.discount : (item.originalPrice * item.discount) / 100)
                })),
                overallDiscount: updates.overallDiscount,
                overallDiscountType: updates.overallDiscountType,
                tuningCharges: updates.tuningCharges,
                laborCharges: updates.laborCharges,
                subtotal,
                totalItemDiscounts,
                total: newTotal,
                balanceDue: newBalanceDue,
                paymentStatus: newPaymentStatus,
            };

            // Update customer balance
            setCustomers(prevCustomers => {
                const customerIndex = prevCustomers.findIndex(c => c.id === updatedSale.customerId);
                if (customerIndex === -1) return prevCustomers;

                const customer = prevCustomers[customerIndex];
                const otherSalesTotalBalance = customer.saleIds
                    .filter(id => id !== saleId)
                    .map(id => prevSales.find(s => s.id === id))
                    .filter((s): s is Sale => !!s)
                    .reduce((sum, s) => sum + s.balanceDue, 0);
                
                const updatedCustomer = {
                    ...customer,
                    balance: otherSalesTotalBalance + newBalanceDue,
                };
                
                const newCustomers = [...prevCustomers];
                newCustomers[customerIndex] = updatedCustomer;
                return newCustomers;
            });

            const newSales = [...prevSales];
            newSales[saleIndex] = updatedSale;
            toast.success(`Sale ${saleId} updated successfully.`);
            return newSales;
        });
    };

    const reverseSale = (saleId: string, itemsToReturn: SaleItem[]) => {
        const sale = sales.find(s => s.id === saleId);
        if (!sale) {
            toast.error("Sale not found.");
            return;
        }

        // Add quantities back to inventory
        setInventory(prevInventory => {
            const newInventory = [...prevInventory];
            let updated = false;
            for (const item of itemsToReturn) {
                 if(item.productId.startsWith('manual-')) continue; // Don't add stock for manual items

                const index = newInventory.findIndex(p => p.id === item.productId);
                if (index !== -1) {
                    newInventory[index] = { ...newInventory[index], quantity: newInventory[index].quantity + item.quantity };
                    updated = true;
                }
            }
            if(updated) toast.success(`${itemsToReturn.length} item(s) returned to stock.`);
            return updated ? newInventory : prevInventory;
        });
        
        const remainingItems = sale.items.filter(item => !itemsToReturn.some(r => r.productId === item.productId));

        if (remainingItems.length === 0 && (sale.tuningCharges || 0) === 0 && (sale.laborCharges || 0) === 0) {
            // If all items are returned and no other charges, delete the sale
            setSales(sales.filter(s => s.id !== saleId));
            setCustomers(customers.map(c => {
                if (c.id === sale.customerId) {
                    return { ...c, saleIds: c.saleIds.filter(id => id !== saleId) };
                }
                return c;
            }));
            // TODO: A more robust loyalty reversal would be ideal here.
            // For simplicity, we just delete the transaction if it exists.
            setLoyaltyTransactions(lt => lt.filter(t => t.relatedSaleId !== saleId));
            
            toast.success(`Sale ${saleId} and associated loyalty points have been completely reversed and deleted.`);

        } else {
             // If some items remain, update the sale (recalculate totals)
             const newSubtotal = remainingItems.reduce((acc, item) => acc + (item.originalPrice * item.quantity), 0);
             const newItemDiscounts = remainingItems.reduce((acc, item) => {
                const discount = item.discountType === 'fixed' ? item.discount : (item.originalPrice * item.discount) / 100;
                return acc + (discount * item.quantity);
            }, 0);
            
            // Re-calculate total based on remaining items and original discounts/charges
            const subtotalAfterItemDiscount = newSubtotal - newItemDiscounts;
            const totalWithCharges = subtotalAfterItemDiscount + (sale.tuningCharges || 0) + (sale.laborCharges || 0);
            const overallDiscountAmount = sale.overallDiscountType === 'fixed' ? sale.overallDiscount : (totalWithCharges * sale.overallDiscount) / 100;
            const cartTotal = totalWithCharges - overallDiscountAmount;
            const totalBeforeLoyalty = cartTotal + (sale.previousBalanceBroughtForward || 0);
            const newTotal = Math.round(totalBeforeLoyalty - (sale.loyaltyDiscount || 0));

            const newBalanceDue = newTotal - sale.amountPaid;
            const newPaymentStatus: 'Paid' | 'Partial' | 'Unpaid' = newBalanceDue <= 0 ? 'Paid' : (sale.amountPaid > 0 ? 'Partial' : 'Unpaid');
             
            const updatedSale: Sale = {
                ...sale,
                items: remainingItems,
                subtotal: newSubtotal,
                totalItemDiscounts: newItemDiscounts,
                total: newTotal,
                balanceDue: newBalanceDue,
                paymentStatus: newPaymentStatus,
            };

            setSales(sales.map(s => s.id === saleId ? updatedSale : s));
            toast.success(`Sale ${saleId} partially reversed.`);
        }
    };

    const updateCustomer = (customerId: string, details: Partial<Customer>): boolean => {
        const customersCopy = [...customers];
        const index = customersCopy.findIndex(c => c.id === customerId);
        
        if (index === -1) {
            toast.error("Customer not found.");
            return false;
        }

        // If ID (bike number) is being changed, check for duplicates
        if (details.id && details.id !== customerId) {
            if (customers.some(c => c.id === details.id)) {
                toast.error(`A customer with bike number "${details.id}" already exists.`);
                return false;
            }
            // Update all related sale records with the new customer ID
            const customerSaleIds = customersCopy[index].saleIds;
            setSales(prevSales => prevSales.map(sale => {
                if (customerSaleIds.includes(sale.id)) {
                    return { ...sale, customerId: details.id! };
                }
                return sale;
            }));
            setLoyaltyTransactions(prev => prev.map(lt => lt.customerId === customerId ? {...lt, customerId: details.id!} : lt));
        }
        
        customersCopy[index] = { ...customersCopy[index], ...details };
        setCustomers(customersCopy);
        toast.success("Customer details updated.");
        return true;
    };
    
    const recordCustomerPayment = (customerId: string, amount: number, notes?: string): boolean => {
        const customerIndex = customers.findIndex(c => c.id === customerId);
        if (customerIndex === -1) {
            toast.error("Customer not found.");
            return false;
        }
        
        const customer = customers[customerIndex];
        if (amount > customer.balance) {
            toast.error(`Payment amount exceeds the balance of ${formatCurrency(customer.balance)}.`);
            return false;
        }

        const newPayment: Payment = {
            id: uuidv4(),
            customerId,
            amount,
            date: new Date().toISOString(),
            notes
        };
        
        const updatedCustomer = {
            ...customer,
            balance: customer.balance - amount,
            lastSeen: new Date().toISOString(), // Consider payment as an interaction
        };
        
        setCustomers(prev => prev.map(c => c.id === customerId ? updatedCustomer : c));
        setPayments(prev => [newPayment, ...prev]);
        toast.success(`Payment of ${formatCurrency(amount)} recorded for ${customer.name}.`);
        return true;
    };

    const updateEarningRules = (rules: EarningRule[]) => {
        setEarningRules(rules);
        toast.success("Earning rules updated.");
    };

    const updateRedemptionRule = (rule: RedemptionRule) => {
        setRedemptionRule(rule);
        toast.success("Redemption rule updated.");
    };

    const addPromotion = (promotion: Omit<Promotion, 'id'>) => {
        const newPromotion: Promotion = { ...promotion, id: uuidv4() };
        setPromotions([newPromotion, ...promotions]);
        toast.success(`Promotion "${newPromotion.name}" added.`);
    };

    const updatePromotion = (promotion: Promotion) => {
        setPromotions(promotions.map(p => p.id === promotion.id ? promotion : p));
        toast.success(`Promotion "${promotion.name}" updated.`);
    };

    const deletePromotion = (promotionId: string) => {
        setPromotions(promotions.filter(p => p.id !== promotionId));
        toast.success("Promotion deleted.");
    };

    const adjustCustomerPoints = (customerId: string, points: number, reason: string): boolean => {
        if (!reason.trim()) {
            toast.error("A reason is required for manual point adjustments.");
            return false;
        }
        
        const customerIndex = customers.findIndex(c => c.id === customerId);
        if (customerIndex === -1) {
            toast.error("Customer not found.");
            return false;
        }
        
        const customer = customers[customerIndex];
        const pointsBefore = customer.loyaltyPoints;
        const pointsAfter = pointsBefore + points;

        if (pointsAfter < 0) {
            toast.error("Cannot adjust points below zero.");
            return false;
        }

        const transactionType = points > 0 ? 'manual_add' : 'manual_subtract';
        const newTransaction: LoyaltyTransaction = {
            id: uuidv4(),
            customerId,
            type: transactionType,
            points: Math.abs(points),
            date: new Date().toISOString(),
            reason,
            pointsBefore,
            pointsAfter,
        };

        const updatedCustomer = { ...customer, loyaltyPoints: pointsAfter };
        setCustomers(prev => prev.map(c => c.id === customerId ? updatedCustomer : c));
        setLoyaltyTransactions(prev => [newTransaction, ...prev]);
        toast.success(`Points adjusted for ${customer.name}. New balance: ${pointsAfter}.`);
        return true;
    };
    
    const updateLoyaltyExpirySettings = (settings: LoyaltyExpirySettings) => {
        setLoyaltyExpirySettings(settings);
        toast.success("Loyalty expiry settings updated.");
    };

    const updateCustomerTiers = (tiers: CustomerTier[]) => {
        setCustomerTiers(tiers);
        toast.success("Customer tiers updated. Tiers for all customers will be re-evaluated on the next app load.");
    };

    const addExpense = (expense: Omit<Expense, 'id'>) => {
        const newExpense = { ...expense, id: uuidv4() };
        setExpenses([newExpense, ...expenses]);
        toast.success("Expense added successfully.");
    };

    const updateExpense = (expense: Expense) => {
        setExpenses(expenses.map(e => e.id === expense.id ? expense : e));
        toast.success("Expense updated successfully.");
    };

    const deleteExpense = (expenseId: string) => {
        setExpenses(expenses.filter(e => e.id !== expenseId));
        toast.success("Expense deleted.");
    };
    
    const addDemandItem = (item: Omit<DemandItem, 'id'>) => {
        const newItem = { ...item, id: uuidv4() };
        setDemandItems([newItem, ...demandItems]);
        toast.success(`"${newItem.name}" added to demand list.`);
    };
    
    const updateDemandItem = (item: DemandItem) => {
        setDemandItems(demandItems.map(d => d.id === item.id ? item : d));
        toast.success(`"${item.name}" updated.`);
    };
    
    const deleteDemandItem = (itemId: string) => {
        setDemandItems(demandItems.filter(d => d.id !== itemId));
        toast.success("Item removed from demand list.");
    };
    
    const createBackup = (showToast = true) => {
        const data: { [key: string]: any } = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key) {
                try {
                    data[key] = localStorage.getItem(key);
                } catch (e) {
                    console.warn(`Could not back up key: ${key}`);
                }
            }
        }
        
        // This is a simplified backup that stores raw strings. 
        // A more robust solution might parse and then stringify to ensure format.
        const backupObject = {
            timestamp: new Date().toISOString(),
            data: data
        };

        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupObject, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `shopsync_backup_${new Date().toISOString().split('T')[0]}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        if(showToast) toast.success("Backup created successfully!");
    };


    return (
        <AppContext.Provider value={{
            loading, shopInfo, saveShopInfo, currentUser, users, signUp, login, logout, updateUser, addUser, deleteUser,
            inventory, addProduct, updateProduct, deleteProduct, findProductByBarcode, addSampleData, importFromExcel, addStock,
            categories, addCategory, updateCategory, deleteCategory,
            sales, createSale, updateSale, reverseSale,
            customers, updateCustomer, recordCustomerPayment,
            earningRules, updateEarningRules, redemptionRule, updateRedemptionRule,
            promotions, addPromotion, updatePromotion, deletePromotion,
            loyaltyTransactions, adjustCustomerPoints,
            loyaltyExpirySettings, updateLoyaltyExpirySettings,
            customerTiers, updateCustomerTiers,
            expenses, addExpense, updateExpense, deleteExpense,
            payments,
            demandItems, addDemandItem, updateDemandItem, deleteDemandItem,
            createBackup,
        }}>
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
