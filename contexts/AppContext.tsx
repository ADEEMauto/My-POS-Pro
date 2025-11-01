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
                toast.error("No valid products were found in the file.");
            }
        } catch (error) {
            console.error("Excel import error:", error);
            toast.error("An error occurred during import. Please check file format and content.");
        }
    };

    const addCategory = (name: string, parentId: string | null) => {
        const newCategory: Category = { id: name.toLowerCase().replace(/\s+/g, '-'), name, parentId };
        setCategories([...categories, newCategory]);
        toast.success(`Category "${name}" added.`);
    };

    const updateCategory = (id: string, newName: string) => {
        setCategories(categories.map(c => c.id === id ? { ...c, name: newName } : c));
        toast.success(`Category updated to "${newName}".`);
    };

    const deleteCategory = (id: string) => {
        const childIds = categories.filter(c => c.parentId === id).map(c => c.id);
        const idsToDelete = [id, ...childIds];
        
        setCategories(categories.filter(c => !idsToDelete.includes(c.id)));
        
        // Uncategorize products
        setInventory(inventory.map(p => {
            if (idsToDelete.includes(p.categoryId)) {
                return { ...p, categoryId: 'uncategorized', subCategoryId: null };
            }
            if (p.subCategoryId && idsToDelete.includes(p.subCategoryId)) {
                 return { ...p, subCategoryId: null };
            }
            return p;
        }));
        toast.success("Category and its sub-categories deleted.");
    };

    const createBackup = (showToast: boolean = true) => {
        try {
            const dataToBackup: { [key: string]: any } = {};
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key) {
                    dataToBackup[key] = JSON.parse(localStorage.getItem(key)!);
                }
            }
    
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dataToBackup, null, 2));
            const downloadAnchorNode = document.createElement('a');
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", `shopsync_backup_${timestamp}.json`);
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
            
            if (showToast) {
                toast.success("Backup created successfully!");
            }
        } catch (error) {
            console.error("Backup failed:", error);
            if (showToast) {
                toast.error("Failed to create backup.");
            }
            throw error;
        }
    };

    const createSale = (cartItems: CartItem[], overallDiscountValue: number, overallDiscountType: 'fixed' | 'percentage', customerInfo: { customerName: string, bikeNumber: string, contactNumber?: string, serviceFrequencyValue?: number, serviceFrequencyUnit?: 'days' | 'months' | 'years' }, redeemedPoints: number, tuningCharges: number, laborCharges: number, amountPaid: number): Sale | null => {
        if (cartItems.length === 0 && !tuningCharges && !laborCharges) {
            toast.error("Cannot create an empty sale.");
            return null;
        }

        const now = new Date();
        const year = now.getFullYear().toString().slice(-2);
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const day = now.getDate().toString().padStart(2, '0');
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        const timestampPart = `${year}${month}${day}${hours}${minutes}`;
        const salesWithSameTimestamp = sales.filter(s => s.id.startsWith(timestampPart));
        const counter = salesWithSameTimestamp.length;
        const saleId = counter > 0 ? `${timestampPart}-${counter}` : timestampPart;
        const saleDate = now.toISOString();
        const bikeNumberFormatted = customerInfo.bikeNumber.replace(/\s+/g, '').toUpperCase();
        
        const existingCustomer = customers.find(c => c.id === bikeNumberFormatted);
        if (existingCustomer && redeemedPoints > 0 && redeemedPoints > existingCustomer.loyaltyPoints) {
            toast.error("Cannot redeem more points than available.");
            return null;
        }
        
        let previousBalanceBroughtForward = existingCustomer?.balance || 0;
        const subtotal = cartItems.reduce((acc, item) => acc + (item.salePrice * item.cartQuantity), 0);
        const totalItemDiscount = cartItems.reduce((acc, item) => {
            const discount = item.discountType === 'fixed' ? item.discount : (item.salePrice * item.discount) / 100;
            return acc + (discount * item.cartQuantity);
        }, 0);
        
        const saleItems: SaleItem[] = cartItems.map(item => {
            const itemDiscountValue = item.discountType === 'fixed' ? item.discount : (item.salePrice * item.discount) / 100;
            return {
                productId: item.id, name: item.name, quantity: item.cartQuantity,
                originalPrice: item.salePrice, discount: item.discount, discountType: item.discountType,
                price: item.salePrice - itemDiscountValue, purchasePrice: item.purchasePrice,
            };
        });

        const subtotalAfterItemDiscount = subtotal - totalItemDiscount;
        const subtotalWithCharges = subtotalAfterItemDiscount + (tuningCharges || 0) + (laborCharges || 0);
        const overallDiscountAmount = overallDiscountType === 'fixed' ? overallDiscountValue : (subtotalWithCharges * overallDiscountValue) / 100;
        const cartTotal = subtotalWithCharges - overallDiscountAmount;
        const totalBeforeLoyalty = cartTotal + previousBalanceBroughtForward;

        let loyaltyDiscountAmount = 0;
        if (existingCustomer && redeemedPoints > 0) {
            if (redemptionRule.method === 'fixedValue') {
                loyaltyDiscountAmount = (redeemedPoints / redemptionRule.points) * redemptionRule.value;
            } else {
                const percentage = (redeemedPoints / redemptionRule.points) * redemptionRule.value;
                loyaltyDiscountAmount = (totalBeforeLoyalty * percentage) / 100;
            }
            loyaltyDiscountAmount = Math.min(loyaltyDiscountAmount, totalBeforeLoyalty);
        }
        
        const total = Math.round(totalBeforeLoyalty - loyaltyDiscountAmount);
        const balanceDue = total - amountPaid;
        const paymentStatus = balanceDue <= 0 ? 'Paid' : (amountPaid > 0 ? 'Partial' : 'Unpaid');
        const inventoryItemsValueAfterItemDiscounts = cartItems.filter(item => !item.id.startsWith('manual-')).reduce((acc, item) => {
            const itemTotal = item.salePrice * item.cartQuantity;
            const itemDiscountAmount = item.discountType === 'fixed' ? item.discount * item.cartQuantity : (itemTotal * item.discount) / 100;
            return acc + (itemTotal - itemDiscountAmount);
        }, 0);
        const totalValueBeforeOverallDiscount = subtotalAfterItemDiscount + (tuningCharges || 0) + (laborCharges || 0);
        let proportionalOverallDiscountForInventory = 0;
        if (totalValueBeforeOverallDiscount > 0) {
            proportionalOverallDiscountForInventory = overallDiscountAmount * (inventoryItemsValueAfterItemDiscounts / totalValueBeforeOverallDiscount);
        }
        const finalInventoryValue = Math.max(0, inventoryItemsValueAfterItemDiscounts - proportionalOverallDiscountForInventory);
        const amountEligibleForPoints = Math.min(Number(amountPaid) || 0, finalInventoryValue);
        const promoCheckDate = new Date();
        promoCheckDate.setHours(0,0,0,0);
        const activePromotion = promotions.find(p => {
            const start = new Date(p.startDate); start.setHours(0,0,0,0);
            const end = new Date(p.endDate); end.setHours(23,59,59,999);
            return promoCheckDate >= start && promoCheckDate <= end;
        });
        const customerTier = existingCustomer?.tierId ? customerTiers.find(t => t.id === existingCustomer.tierId) : null;
        const finalMultiplier = (activePromotion?.multiplier || 1) * (customerTier?.pointsMultiplier || 1);
        let pointsEarned = 0;
        if (amountEligibleForPoints > 0) {
            const applicableRule = earningRules.sort((a, b) => b.minSpend - a.minSpend).find(rule => amountEligibleForPoints >= rule.minSpend);
            if (applicableRule) {
                pointsEarned = (amountEligibleForPoints / 100) * applicableRule.pointsPerHundred;
            }
        }
        pointsEarned = Math.round(pointsEarned * finalMultiplier);
        let pointsBefore = existingCustomer?.loyaltyPoints || 0;
        let finalLoyaltyPoints = pointsBefore;
        const newTransactions: LoyaltyTransaction[] = [];
        if (existingCustomer && redeemedPoints > 0 && loyaltyDiscountAmount > 0) {
            const pointsAfterRedemption = pointsBefore - redeemedPoints;
            newTransactions.push({
                id: uuidv4(), customerId: existingCustomer.id, type: 'redeemed', points: redeemedPoints, date: saleDate,
                relatedSaleId: saleId, pointsBefore: pointsBefore, pointsAfter: pointsAfterRedemption,
            });
            finalLoyaltyPoints = pointsAfterRedemption;
            pointsBefore = pointsAfterRedemption;
        }
        if (pointsEarned > 0) {
             const pointsAfterEarned = finalLoyaltyPoints + pointsEarned;
             newTransactions.push({
                id: uuidv4(), customerId: bikeNumberFormatted, type: 'earned', points: pointsEarned, date: saleDate,
                relatedSaleId: saleId, pointsBefore: pointsBefore, pointsAfter: pointsAfterEarned
            });
            finalLoyaltyPoints = pointsAfterEarned;
        }

        const newSale: Sale = {
            id: saleId, customerId: bikeNumberFormatted, customerName: customerInfo.customerName, items: saleItems,
            subtotal, totalItemDiscounts: totalItemDiscount, overallDiscount: overallDiscountValue, overallDiscountType,
            loyaltyDiscount: loyaltyDiscountAmount, tuningCharges: tuningCharges || 0, laborCharges: laborCharges || 0,
            total, amountPaid, paymentStatus, balanceDue, previousBalanceBroughtForward, date: saleDate,
            pointsEarned, redeemedPoints: redeemedPoints > 0 ? redeemedPoints : undefined, finalLoyaltyPoints,
            promotionApplied: activePromotion ? { name: activePromotion.name, multiplier: activePromotion.multiplier } : undefined,
            tierApplied: customerTier ? { name: customerTier.name, multiplier: customerTier.pointsMultiplier } : undefined,
        };
        
        // ATOMIC STATE UPDATES using functional form to prevent stale state issues
        setInventory(prevInventory => {
            const updatedInventory = [...prevInventory];
            saleItems.forEach(item => {
                if (!item.productId.startsWith('manual-')) {
                    const productIndex = updatedInventory.findIndex(p => p.id === item.productId);
                    if (productIndex !== -1) {
                        updatedInventory[productIndex].quantity -= item.quantity;
                    }
                }
            });
            return updatedInventory;
        });

        setSales(prevSales => 
            [...prevSales, newSale].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        );

        setCustomers(prevCustomers => {
            let tempCustomers = [...prevCustomers];
            const existingCustomerIndex = tempCustomers.findIndex(c => c.id === bikeNumberFormatted);

            if (existingCustomerIndex > -1) {
                 tempCustomers[existingCustomerIndex] = {
                    ...tempCustomers[existingCustomerIndex],
                    lastSeen: saleDate, loyaltyPoints: finalLoyaltyPoints, balance: balanceDue,
                    saleIds: [...tempCustomers[existingCustomerIndex].saleIds, saleId]
                 };
            } else {
                tempCustomers.push({
                    id: bikeNumberFormatted, name: customerInfo.customerName, saleIds: [saleId],
                    firstSeen: saleDate, lastSeen: saleDate, contactNumber: customerInfo.contactNumber,
                    serviceFrequencyValue: customerInfo.serviceFrequencyValue, serviceFrequencyUnit: customerInfo.serviceFrequencyUnit,
                    loyaltyPoints: finalLoyaltyPoints, tierId: null, balance: balanceDue,
                });
            }
            const salesForTierCalc = [...sales, newSale]; // `sales` is from closure, but includes new sale
            return recalculateAndAssignTier(bikeNumberFormatted, tempCustomers, salesForTierCalc, customerTiers);
        });

        if (newTransactions.length > 0) {
            setLoyaltyTransactions(prev => [...prev, ...newTransactions]);
        }

        try {
            createBackup(false);
            toast.success("Sale recorded. Backup file is downloading.");
        } catch (error) {
            console.error("Automatic backup failed after sale:", error);
            toast.error("Sale completed, but auto-backup failed. Please create a manual backup from Settings.");
        }

        return newSale;
    };
    // The following functions were missing from the provided file and have been stubbed.
    // In a real scenario, these would contain the full logic for updating and reversing sales.
    const updateSale = (saleId: string, updates: any) => {
      console.warn("updateSale function is not fully implemented in the provided file.");
      toast.error("Editing sales is not fully supported in this version.");
    };

    const reverseSale = (saleId: string, itemsToReturn: SaleItem[]) => {
      console.warn("reverseSale function is not fully implemented in the provided file.");
      toast.error("Reversing sales is not fully supported in this version.");
    };

    // FIX: Implement missing context functions
    const updateCustomer = (customerId: string, details: Partial<Customer>): boolean => {
        const customerToUpdate = customers.find(c => c.id === customerId);
        if (!customerToUpdate) {
            toast.error("Customer not found.");
            return false;
        }

        if (details.id && details.id !== customerId) {
            if (customers.some(c => c.id === details.id && c.id !== customerId)) {
                toast.error(`Another customer with ID "${details.id}" already exists.`);
                return false;
            }
        }
        
        setCustomers(customers.map(c => (c.id === customerId ? { ...c, ...details } : c)));
        
        if (details.id && details.id !== customerId) {
            setSales(sales.map(s => s.customerId === customerId ? { ...s, customerId: details.id! } : s));
        }

        toast.success("Customer details updated successfully.");
        return true;
    };

    const recordCustomerPayment = (customerId: string, amount: number, notes?: string): boolean => {
        let customerFound = false;
        const updatedCustomers = customers.map(c => {
            if (c.id === customerId) {
                customerFound = true;
                return { ...c, balance: c.balance - amount };
            }
            return c;
        });

        if (!customerFound) {
            toast.error("Customer not found.");
            return false;
        }

        const newPayment: Payment = {
            id: uuidv4(),
            customerId,
            amount,
            date: new Date().toISOString(),
            notes,
        };
        
        setCustomers(updatedCustomers);
        setPayments(prev => [newPayment, ...prev].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        toast.success(`Payment of ${formatCurrency(amount)} recorded for customer ${customerId}.`);
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
        setPromotions([...promotions, newPromotion]);
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

        const newTransaction: LoyaltyTransaction = {
            id: uuidv4(),
            customerId,
            type: points > 0 ? 'manual_add' : 'manual_subtract',
            points: Math.abs(points),
            date: new Date().toISOString(),
            reason,
            pointsBefore,
            pointsAfter
        };
        
        setCustomers(customers.map(c => c.id === customerId ? { ...c, loyaltyPoints: pointsAfter } : c));
        setLoyaltyTransactions(prev => [newTransaction, ...prev]);
        toast.success(`Points adjusted for ${customer.name}.`);
        return true;
    };

    const updateLoyaltyExpirySettings = (settings: LoyaltyExpirySettings) => {
        setLoyaltyExpirySettings(settings);
        toast.success("Loyalty expiry settings updated.");
    };
    
    const updateCustomerTiers = (tiers: CustomerTier[]) => {
        setCustomerTiers(tiers);
        toast.success("Customer tiers updated.");
    };
    
    const addExpense = (expense: Omit<Expense, 'id'>) => {
        const newExpense: Expense = { ...expense, id: uuidv4() };
        setExpenses(prev => [newExpense, ...prev].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        toast.success("Expense added.");
    };
    
    const updateExpense = (expense: Expense) => {
        setExpenses(prev => prev.map(e => e.id === expense.id ? expense : e).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        toast.success("Expense updated.");
    };

    const deleteExpense = (expenseId: string) => {
        setExpenses(prev => prev.filter(e => e.id !== expenseId));
        toast.success("Expense deleted.");
    };
    
    const addDemandItem = (item: Omit<DemandItem, 'id'>) => {
        const newItem: DemandItem = { ...item, id: uuidv4() };
        setDemandItems(prev => [newItem, ...prev]);
        toast.success(`"${newItem.name}" added to demand list.`);
    };

    const updateDemandItem = (item: DemandItem) => {
        setDemandItems(prev => prev.map(d => d.id === item.id ? item : d));
        toast.success(`"${item.name}" updated in demand list.`);
    };

    const deleteDemandItem = (itemId: string) => {
        setDemandItems(prev => prev.filter(d => d.id !== itemId));
        toast.success("Item removed from demand list.");
    };


    return (
        <AppContext.Provider value={{
            loading, shopInfo, saveShopInfo, currentUser, users, signUp, login, logout, updateUser, addUser, deleteUser,
            inventory, addProduct, updateProduct, deleteProduct, findProductByBarcode, addSampleData, importFromExcel, addStock,
            categories, addCategory, updateCategory, deleteCategory,
            sales, createSale, updateSale, reverseSale,
            customers, updateCustomer,
            // FIX: Replaced stubbed functions and missing properties with actual implementations.
            recordCustomerPayment,
            earningRules, updateEarningRules,
            redemptionRule, updateRedemptionRule,
            promotions, addPromotion, updatePromotion, deletePromotion,
            loyaltyTransactions, adjustCustomerPoints,
            loyaltyExpirySettings, updateLoyaltyExpirySettings,
            customerTiers, updateCustomerTiers,
            expenses, addExpense, updateExpense, deleteExpense,
            payments,
            demandItems, addDemandItem, updateDemandItem, deleteDemandItem,
            createBackup
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