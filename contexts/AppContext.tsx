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

    const createSale = (cartItems: CartItem[], overallDiscountValue: number, overallDiscountType: 'fixed' | 'percentage', customerInfo: { customerName: string, bikeNumber: string, contactNumber?: string, serviceFrequencyValue?: number, serviceFrequencyUnit?: 'days' | 'months' | 'years' }, redeemedPoints: number, tuningCharges: number, laborCharges: number, amountPaid: number): Sale | null => {
        if (cartItems.length === 0 && !tuningCharges && !laborCharges) {
            toast.error("Cannot create an empty sale.");
            return null;
        }

        const saleId = uuidv4();
        const saleDate = new Date().toISOString();
        const bikeNumberFormatted = customerInfo.bikeNumber.replace(/\s+/g, '').toUpperCase();
        
        let existingCustomer = customers.find(c => c.id === bikeNumberFormatted);
        let previousBalanceBroughtForward = existingCustomer?.balance || 0;

        const subtotal = cartItems.reduce((acc, item) => acc + (item.salePrice * item.cartQuantity), 0);

        const totalItemDiscount = cartItems.reduce((acc, item) => {
            const discount = item.discountType === 'fixed'
                ? item.discount
                : (item.salePrice * item.discount) / 100;
            return acc + (discount * item.cartQuantity);
        }, 0);
        
        const saleItems: SaleItem[] = cartItems.map(item => {
            const itemDiscountValue = item.discountType === 'fixed'
                ? item.discount
                : (item.salePrice * item.discount) / 100;
            return {
                productId: item.id,
                name: item.name,
                quantity: item.cartQuantity,
                originalPrice: item.salePrice,
                discount: item.discount,
                discountType: item.discountType,
                price: item.salePrice - itemDiscountValue,
                purchasePrice: item.purchasePrice,
            };
        });

        // Update inventory stock
        const newInventory = [...inventory];
        let stockUpdated = false;
        saleItems.forEach(item => {
            // Only update stock for non-manual items
            if (!item.productId.startsWith('manual-')) {
                const productIndex = newInventory.findIndex(p => p.id === item.productId);
                if (productIndex !== -1) {
                    newInventory[productIndex].quantity -= item.quantity;
                    stockUpdated = true;
                }
            }
        });
        if(stockUpdated) setInventory(newInventory);

        const subtotalAfterItemDiscount = subtotal - totalItemDiscount;
        const subtotalWithCharges = subtotalAfterItemDiscount + (tuningCharges || 0) + (laborCharges || 0);

        const overallDiscountAmount = overallDiscountType === 'fixed' 
            ? overallDiscountValue 
            : (subtotalWithCharges * overallDiscountValue) / 100;
        
        const cartTotal = subtotalWithCharges - overallDiscountAmount;
        
        const totalBeforeLoyalty = cartTotal + previousBalanceBroughtForward;

        let loyaltyDiscountAmount = 0;
        if (existingCustomer && redeemedPoints > 0) {
            if (redeemedPoints > existingCustomer.loyaltyPoints) {
                toast.error("Cannot redeem more points than available.");
                return null;
            }
            if (redemptionRule.method === 'fixedValue') {
                loyaltyDiscountAmount = (redeemedPoints / redemptionRule.points) * redemptionRule.value;
            } else {
                const percentage = (redeemedPoints / redemptionRule.points) * redemptionRule.value;
                loyaltyDiscountAmount = (totalBeforeLoyalty * percentage) / 100;
            }
            if (loyaltyDiscountAmount > totalBeforeLoyalty) {
                loyaltyDiscountAmount = totalBeforeLoyalty;
            }
        }
        
        const total = Math.round(totalBeforeLoyalty - loyaltyDiscountAmount);
        const balanceDue = total - amountPaid;
        const paymentStatus = balanceDue <= 0 ? 'Paid' : (amountPaid > 0 ? 'Partial' : 'Unpaid');

        // --- NEW LOYALTY POINTS CALCULATION LOGIC ---
        
        // 1. Calculate the value of only inventory items after their specific item-level discounts.
        const inventoryItemsValueAfterItemDiscounts = cartItems
            .filter(item => !item.id.startsWith('manual-'))
            .reduce((acc, item) => {
                const itemTotal = item.salePrice * item.cartQuantity;
                const itemDiscountAmount = item.discountType === 'fixed'
                    ? item.discount * item.cartQuantity
                    : (itemTotal * item.discount) / 100;
                return acc + (itemTotal - itemDiscountAmount);
            }, 0);

        // 2. The total value before applying the overall discount includes all items and charges.
        const totalValueBeforeOverallDiscount = subtotalAfterItemDiscount + (tuningCharges || 0) + (laborCharges || 0);

        // 3. Determine the proportional share of the overall discount that applies to inventory items.
        let proportionalOverallDiscountForInventory = 0;
        if (totalValueBeforeOverallDiscount > 0) {
            const inventoryItemsRatio = inventoryItemsValueAfterItemDiscounts / totalValueBeforeOverallDiscount;
            proportionalOverallDiscountForInventory = overallDiscountAmount * inventoryItemsRatio;
        }

        // 4. Calculate the final, discounted value of just the inventory items.
        const finalInventoryValue = Math.max(0, inventoryItemsValueAfterItemDiscounts - proportionalOverallDiscountForInventory);
        
        // 5. The amount eligible for points is the lesser of the amount paid and the final value of inventory items.
        // This ensures points are only awarded for paid inventory items, prioritizing them over services.
        const amountEligibleForPoints = Math.min(Number(amountPaid) || 0, finalInventoryValue);

        // Check for active promotions
        const now = new Date();
        now.setHours(0,0,0,0);
        const activePromotion = promotions.find(p => {
            const start = new Date(p.startDate);
            const end = new Date(p.endDate);
            start.setHours(0,0,0,0);
            end.setHours(23,59,59,999);
            return now >= start && now <= end;
        });
        
        // Check for customer tier multiplier
        const customerTier = existingCustomer?.tierId ? customerTiers.find(t => t.id === existingCustomer.tierId) : null;
        const tierMultiplier = customerTier?.pointsMultiplier || 1;
        const finalMultiplier = (activePromotion?.multiplier || 1) * tierMultiplier;
        
        let pointsEarned = 0;
        if (amountEligibleForPoints > 0) {
            // Find applicable earning rule
            const applicableRule = earningRules
                .sort((a, b) => b.minSpend - a.minSpend)
                .find(rule => amountEligibleForPoints >= rule.minSpend);

            if (applicableRule) {
                pointsEarned = (amountEligibleForPoints / 100) * applicableRule.pointsPerHundred;
            }
        }
        
        pointsEarned = Math.round(pointsEarned * finalMultiplier);
        // --- END OF NEW LOYALTY LOGIC ---

        let pointsBefore = existingCustomer?.loyaltyPoints || 0;
        let finalLoyaltyPoints = pointsBefore;

        const customerUpdates: Partial<Customer> = {
            lastSeen: saleDate,
        };

        const newTransactions: LoyaltyTransaction[] = [];
        
        // Handle redemption
        if (existingCustomer && redeemedPoints > 0 && loyaltyDiscountAmount > 0) {
            const pointsAfterRedemption = pointsBefore - redeemedPoints;
            newTransactions.push({
                id: uuidv4(),
                customerId: existingCustomer.id,
                type: 'redeemed',
                points: redeemedPoints,
                date: saleDate,
                relatedSaleId: saleId,
                pointsBefore: pointsBefore,
                pointsAfter: pointsAfterRedemption,
            });
            finalLoyaltyPoints = pointsAfterRedemption;
            pointsBefore = pointsAfterRedemption; // for the next transaction
        }

        // Handle earning
        if (pointsEarned > 0) {
             const pointsAfterEarned = finalLoyaltyPoints + pointsEarned;
             newTransactions.push({
                id: uuidv4(),
                customerId: bikeNumberFormatted, // Use formatted ID
                type: 'earned',
                points: pointsEarned,
                date: saleDate,
                relatedSaleId: saleId,
                pointsBefore: pointsBefore,
                pointsAfter: pointsAfterEarned
            });
            finalLoyaltyPoints = pointsAfterEarned;
        }

        customerUpdates.loyaltyPoints = finalLoyaltyPoints;
        customerUpdates.balance = balanceDue;

        const newSale: Sale = {
            id: saleId,
            customerId: bikeNumberFormatted,
            customerName: customerInfo.customerName,
            items: saleItems,
            subtotal: subtotal,
            totalItemDiscounts: totalItemDiscount,
            overallDiscount: overallDiscountValue,
            overallDiscountType: overallDiscountType,
            loyaltyDiscount: loyaltyDiscountAmount,
            tuningCharges: tuningCharges || 0,
            laborCharges: laborCharges || 0,
            total: total,
            amountPaid: amountPaid,
            paymentStatus: paymentStatus,
            balanceDue: balanceDue,
            previousBalanceBroughtForward: previousBalanceBroughtForward,
            date: saleDate,
            pointsEarned,
            redeemedPoints: redeemedPoints > 0 ? redeemedPoints : undefined,
            finalLoyaltyPoints,
            promotionApplied: activePromotion ? { name: activePromotion.name, multiplier: activePromotion.multiplier } : undefined,
            tierApplied: customerTier ? { name: customerTier.name, multiplier: customerTier.pointsMultiplier } : undefined,
        };
        
        let newCustomers = [...customers];
        if (existingCustomer) {
             newCustomers = newCustomers.map(c => 
                c.id === bikeNumberFormatted ? { ...c, ...customerUpdates, saleIds: [...c.saleIds, saleId] } : c
            );
        } else {
            const newCustomer: Customer = {
                id: bikeNumberFormatted,
                name: customerInfo.customerName,
                saleIds: [saleId],
                firstSeen: saleDate,
                lastSeen: saleDate,
                contactNumber: customerInfo.contactNumber,
                serviceFrequencyValue: customerInfo.serviceFrequencyValue,
                serviceFrequencyUnit: customerInfo.serviceFrequencyUnit,
                loyaltyPoints: finalLoyaltyPoints,
                tierId: null, // Initial tier will be assigned on next load
                balance: balanceDue,
            };
            newCustomers.push(newCustomer);
        }
        
        // Recalculate tier for the customer immediately after the sale
        newCustomers = recalculateAndAssignTier(bikeNumberFormatted, newCustomers, [...sales, newSale], customerTiers);

        setCustomers(newCustomers);
        setSales([...sales, newSale].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        if (newTransactions.length > 0) {
            setLoyaltyTransactions([...loyaltyTransactions, ...newTransactions]);
        }

        toast.success(`Sale ${saleId} completed!`);
        return newSale;
    };

    const updateSale = (saleId: string, updates: { items: SaleItem[]; overallDiscount: number; overallDiscountType: 'fixed' | 'percentage'; tuningCharges: number; laborCharges: number; }) => {
        const saleIndex = sales.findIndex(s => s.id === saleId);
        if (saleIndex === -1) {
            toast.error("Sale not found.");
            return;
        }
        
        const originalSale = sales[saleIndex];
        
        // Recalculate everything based on new values
        const newSubtotal = updates.items.reduce((acc, item) => acc + item.originalPrice * item.quantity, 0);
        const newItemDiscounts = updates.items.reduce((acc, item) => {
            const discountAmount = item.discountType === 'fixed' ? item.discount : (item.originalPrice * item.discount) / 100;
            const finalItemDiscount = discountAmount * item.quantity;
            item.price = item.originalPrice - discountAmount; // Update item price
            return acc + finalItemDiscount;
        }, 0);

        const subtotalAfterItemDiscounts = newSubtotal - newItemDiscounts;
        const totalWithCharges = subtotalAfterItemDiscounts + updates.tuningCharges + updates.laborCharges;
        
        const overallDiscountAmount = updates.overallDiscountType === 'fixed'
            ? updates.overallDiscount
            : (totalWithCharges * updates.overallDiscount) / 100;
            
        const cartTotal = totalWithCharges - overallDiscountAmount;
        const totalBeforeLoyalty = cartTotal + (originalSale.previousBalanceBroughtForward || 0);
        const newTotal = Math.round(totalBeforeLoyalty - (originalSale.loyaltyDiscount || 0));

        const newBalanceDue = newTotal - originalSale.amountPaid;
        const newPaymentStatus = newBalanceDue <= 0 ? 'Paid' : (originalSale.amountPaid > 0 ? 'Partial' : 'Unpaid');

        const updatedSale: Sale = {
            ...originalSale,
            items: updates.items,
            subtotal: newSubtotal,
            totalItemDiscounts: newItemDiscounts,
            overallDiscount: updates.overallDiscount,
            overallDiscountType: updates.overallDiscountType,
            tuningCharges: updates.tuningCharges,
            laborCharges: updates.laborCharges,
            total: newTotal,
            balanceDue: newBalanceDue,
            paymentStatus: newPaymentStatus,
        };

        const updatedSales = [...sales];
        updatedSales[saleIndex] = updatedSale;
        setSales(updatedSales);

        // Update customer balance
        const customerIndex = customers.findIndex(c => c.id === originalSale.customerId);
        if (customerIndex !== -1) {
            const updatedCustomers = [...customers];
            const oldBalanceContribution = originalSale.balanceDue;
            const customer = updatedCustomers[customerIndex];
            
            // Recalculate entire balance from scratch for accuracy
            const customerSales = updatedSales.filter(s => s.customerId === customer.id);
            const customerPayments = payments.filter(p => p.customerId === customer.id);
            const totalBilled = customerSales.reduce((sum, s) => sum + s.total, 0);
            const totalPaidViaSales = customerSales.reduce((sum, s) => sum + s.amountPaid, 0);
            const totalPaidViaPayments = customerPayments.reduce((sum, p) => sum + p.amount, 0);
            const newCustomerBalance = totalBilled - totalPaidViaSales - totalPaidViaPayments;

            updatedCustomers[customerIndex] = { ...customer, balance: newCustomerBalance };
            setCustomers(updatedCustomers);
        }

        toast.success(`Sale ${saleId} has been updated.`);
    };

    const reverseSale = (saleId: string, itemsToReturn: SaleItem[]) => {
        const sale = sales.find(s => s.id === saleId);
        if (!sale) {
            toast.error("Sale not found.");
            return;
        }

        // Return stock to inventory
        const newInventory = [...inventory];
        itemsToReturn.forEach(item => {
            const productIndex = newInventory.findIndex(p => p.id === item.productId);
            if (productIndex !== -1) {
                newInventory[productIndex].quantity += item.quantity;
            }
        });
        setInventory(newInventory);

        // If all items are returned, delete the sale entirely. Otherwise, update it.
        const remainingItems = sale.items.filter(item => !itemsToReturn.some(ret => ret.productId === item.productId));

        if (remainingItems.length === 0 && !sale.tuningCharges && !sale.laborCharges) {
            // Full reversal
            setSales(sales.filter(s => s.id !== saleId));
            
            // Update customer record
            setCustomers(customers.map(c => {
                if (c.id === sale.customerId) {
                    const newSaleIds = c.saleIds.filter(id => id !== saleId);
                    const newBalance = c.balance - sale.balanceDue;
                    return { ...c, saleIds: newSaleIds, balance: newBalance };
                }
                return c;
            }));
            
            // TODO: Reverse loyalty points? This can be complex. For now, we leave them.
            // A manual adjustment might be better.

            toast.success(`Sale ${saleId} and all its items have been reversed and stock restored.`);

        } else {
            // Partial reversal: Update the sale
            const newSubtotal = remainingItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
            const newTotal = newSubtotal + (sale.tuningCharges || 0) + (sale.laborCharges || 0); // Simplified, ignores discounts for now
            // FIX: Block-scoped variable 'newBalance' used before its declaration.
            // Renaming outer variable to avoid shadowing.
            const newSaleBalanceDue = newTotal - sale.amountPaid;

            const updatedSale: Sale = {
                ...sale,
                items: remainingItems,
                subtotal: newSubtotal,
                total: newTotal,
                balanceDue: newSaleBalanceDue,
                paymentStatus: newSaleBalanceDue <= 0 ? 'Paid' : 'Partial',
            };
            setSales(sales.map(s => s.id === saleId ? updatedSale : s));

             // Update customer balance
            setCustomers(customers.map(c => {
                if (c.id === sale.customerId) {
                    const newCustomerBalance = c.balance - (sale.balanceDue - newSaleBalanceDue);
                    return { ...c, balance: newCustomerBalance };
                }
                return c;
            }));

            toast.success(`${itemsToReturn.length} item(s) from sale ${saleId} reversed and stock restored.`);
        }
    };

    const updateCustomer = (customerId: string, details: Partial<Customer>): boolean => {
        const customerIndex = customers.findIndex(c => c.id === customerId);
        if (customerIndex === -1) {
            toast.error("Customer not found.");
            return false;
        }

        // Check if the ID (bike number) is being changed and if it's already taken
        if (details.id && details.id !== customerId && customers.some(c => c.id === details.id)) {
            toast.error(`Bike number "${details.id}" is already in use.`);
            return false;
        }
        
        let updatedCustomers = [...customers];
        updatedCustomers[customerIndex] = { ...updatedCustomers[customerIndex], ...details };
        
        // If ID changed, we need to update sales, loyalty transactions, and payments
        if (details.id && details.id !== customerId) {
            const newId = details.id;
            
            // Update sales
            setSales(sales.map(s => s.customerId === customerId ? { ...s, customerId: newId } : s));

            // Update loyalty transactions
            setLoyaltyTransactions(loyaltyTransactions.map(t => t.customerId === customerId ? { ...t, customerId: newId } : t));
            
            // Update payments
            setPayments(payments.map(p => p.customerId === customerId ? { ...p, customerId: newId } : p));
        }
        
        // After updating details, re-run tier calculation for this customer
        updatedCustomers = recalculateAndAssignTier(details.id || customerId, updatedCustomers, sales, customerTiers);

        setCustomers(updatedCustomers);
        toast.success(`Customer ${details.name || customers[customerIndex].name} updated.`);
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
            toast.error(`Amount cannot be greater than the balance of ${formatCurrency(customer.balance)}.`);
            return false;
        }

        const newPayment: Payment = {
            id: uuidv4(),
            customerId,
            amount,
            date: new Date().toISOString(),
            notes: notes || 'Payment towards outstanding balance',
        };
        
        setPayments(prev => [newPayment, ...prev].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        
        // Update customer balance
        setCustomers(customers.map(c => 
            c.id === customerId 
            ? { ...c, balance: c.balance - amount }
            : c
        ));

        toast.success(`Payment of ${formatCurrency(amount)} recorded for ${customer.name}.`);
        return true;
    };
    
    // --- Loyalty System ---
    const updateEarningRules = (rules: EarningRule[]) => setEarningRules(rules);
    const updateRedemptionRule = (rule: RedemptionRule) => {
        setRedemptionRule(rule);
        toast.success("Redemption rule updated!");
    };

    const addPromotion = (promotion: Omit<Promotion, 'id'>) => {
        const newPromotion: Promotion = { ...promotion, id: uuidv4() };
        setPromotions([...promotions, newPromotion]);
        toast.success(`Promotion "${newPromotion.name}" created.`);
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
            toast.error(`Cannot subtract ${Math.abs(points)}. Customer only has ${pointsBefore} points.`);
            return false;
        }

        const transaction: LoyaltyTransaction = {
            id: uuidv4(),
            customerId,
            type: points > 0 ? 'manual_add' : 'manual_subtract',
            points: Math.abs(points),
            date: new Date().toISOString(),
            reason,
            pointsBefore,
            pointsAfter,
        };
        
        setLoyaltyTransactions([...loyaltyTransactions, transaction]);
        setCustomers(customers.map(c => c.id === customerId ? { ...c, loyaltyPoints: pointsAfter } : c));
        
        toast.success(`${Math.abs(points)} points ${points > 0 ? 'added to' : 'subtracted from'} ${customer.name}.`);
        return true;
    };
    
    const updateLoyaltyExpirySettings = (settings: LoyaltyExpirySettings) => {
        setLoyaltyExpirySettings(settings);
        toast.success("Loyalty expiry settings updated!");
    };
    
    const updateCustomerTiers = (tiers: CustomerTier[]) => {
        setCustomerTiers(tiers);
        toast.success("Customer tiers updated. Re-evaluating all customers...");
        // This will be picked up by the daily check, but we can trigger it manually too.
        // For simplicity, we'll let the daily check handle it on next load to avoid complex state updates.
    };

    const addExpense = (expense: Omit<Expense, 'id'>) => {
        const newExpense: Expense = { ...expense, id: uuidv4() };
        setExpenses(prev => [newExpense, ...prev].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
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
        const newItem: DemandItem = { ...item, id: uuidv4() };
        setDemandItems(prev => [newItem, ...prev]);
        toast.success("Item added to demand list.");
    };

    const updateDemandItem = (item: DemandItem) => {
        setDemandItems(demandItems.map(i => i.id === item.id ? item : i));
        toast.success("Demand item updated.");
    };

    const deleteDemandItem = (itemId: string) => {
        setDemandItems(demandItems.filter(i => i.id !== itemId));
        toast.success("Demand item removed.");
    };


    const value = {
        loading,
        shopInfo,
        saveShopInfo,
        currentUser,
        users,
        signUp,
        login,
        logout,
        updateUser,
        addUser,
        deleteUser,
        inventory,
        addProduct,
        updateProduct,
        deleteProduct,
        findProductByBarcode,
        addSampleData,
        importFromExcel,
        addStock,
        categories,
        addCategory,
        updateCategory,
        deleteCategory,
        sales,
        createSale,
        updateSale,
        reverseSale,
        customers,
        updateCustomer,
        recordCustomerPayment,
        earningRules, 
        updateEarningRules,
        redemptionRule,
        updateRedemptionRule,
        promotions,
        addPromotion,
        updatePromotion,
        deletePromotion,
        loyaltyTransactions,
        adjustCustomerPoints,
        loyaltyExpirySettings,
        updateLoyaltyExpirySettings,
        customerTiers,
        updateCustomerTiers,
        expenses,
        addExpense,
        updateExpense,
        deleteExpense,
        payments,
        demandItems,
        addDemandItem,
        updateDemandItem,
        deleteDemandItem,
    };

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = (): AppContextType => {
    const context = useContext(AppContext);
    if (context === undefined) {
        throw new Error('useAppContext must be used within an AppProvider');
    }
    return context;
};
