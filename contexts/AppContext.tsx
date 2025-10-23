import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ShopInfo, User, UserRole, Category, Product, Sale, SaleItem, Customer, CartItem, EarningRule, RedemptionRule, Promotion, LoyaltyTransaction, LoyaltyExpirySettings, CustomerTier } from '../types';
import useLocalStorage from '../hooks/useLocalStorage';
import { SAMPLE_PRODUCTS, SAMPLE_CATEGORIES } from '../constants';
import toast from 'react-hot-toast';

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

    categories: Category[];
    addCategory: (name: string, parentId: string | null) => void;
    updateCategory: (id: string, name: string) => void;
    deleteCategory: (id: string) => void;

    sales: Sale[];
    createSale: (cartItems: CartItem[], overallDiscountValue: number, overallDiscountType: 'fixed' | 'percentage', customerInfo: { customerName: string, bikeNumber: string, contactNumber?: string, serviceFrequencyValue?: number, serviceFrequencyUnit?: 'days' | 'months' | 'years' }, redeemedPoints: number) => Sale | null;
    reverseSale: (saleId: string, itemsToReturn: SaleItem[]) => void;

    customers: Customer[];
    updateCustomer: (customerId: string, details: { id: string; name: string; contactNumber?: string; servicingNotes?: string; nextServiceDate?: string; serviceFrequencyValue?: number; serviceFrequencyUnit?: 'days' | 'months' | 'years'; }) => boolean;

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
            const visitsInPeriod = salesInPeriod.length;
    
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
        if (currentUser?.role !== 'master') {
            toast.error("Only master account can add users.");
            return null;
        }
        const existingUser = users.find(u => u.username.toLowerCase() === username.toLowerCase());
        if (existingUser) {
            toast.error("Username already exists.");
            return null;
        }
        const passwordHash = await simpleHash(password);
        const newUser: User = { id: uuidv4(), username, passwordHash, role: 'sub' };
        setUsers([...users, newUser]);
        toast.success("Sub account created.");
        return newUser;
    };

    const deleteUser = (userId: string) => {
        if (currentUser?.role !== 'master') {
            toast.error("Only master account can delete users.");
            return;
        }
        if(users.find(u => u.id === userId)?.role === 'master') {
            toast.error("Cannot delete the master account.");
            return;
        }
        setUsers(users.filter(u => u.id !== userId));
        toast.success("User deleted.");
    };

    const login = async (username: string, password: string): Promise<boolean> => {
        const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
        const passwordHash = await simpleHash(password);
        if (user && user.passwordHash === passwordHash) {
            setCurrentUser(user);
            toast.success(`Welcome back, ${user.username}!`);
            return true;
        }
        toast.error("Invalid username or password.");
        return false;
    };

    const logout = () => {
        setCurrentUser(null);
        toast.success("Logged out successfully.");
    };

    const updateUser = async (userId: string, data: Partial<Pick<User, 'username' | 'passwordHash'>>) => {
        const userToUpdate = users.find(u => u.id === userId);
        if(!userToUpdate){
             toast.error("User not found.");
             return false;
        }

        if(data.username && users.some(u => u.username.toLowerCase() === data.username!.toLowerCase() && u.id !== userId)){
            toast.error("Username already taken.");
            return false;
        }

        const updatedUsers = users.map(u => u.id === userId ? { ...u, ...data } : u);
        setUsers(updatedUsers);
        
        if (currentUser?.id === userId) {
            setCurrentUser({ ...currentUser, ...data });
        }
        toast.success("Profile updated successfully.");
        return true;
    }

    const addProduct = (product: Omit<Product, 'id'>) => {
        const newProduct = { ...product, id: uuidv4() };
        setInventory([newProduct, ...inventory]);
        toast.success(`${product.name} added to inventory.`);
    };

    const updateProduct = (updatedProduct: Product) => {
        setInventory(inventory.map(p => p.id === updatedProduct.id ? updatedProduct : p));
        toast.success(`${updatedProduct.name} updated.`);
    };
    
    const deleteProduct = (productId: string) => {
        setInventory(inventory.filter(p => p.id !== productId));
        toast.success("Product deleted.");
    };

    const findProductByBarcode = (barcode: string) => {
        return inventory.find(p => p.barcode === barcode);
    };

    const addSampleData = () => {
        const productsWithIds = SAMPLE_PRODUCTS.map(p => ({...p, id: uuidv4()}));
        setInventory([...inventory, ...productsWithIds]);
        setCategories([...categories, ...SAMPLE_CATEGORIES]);
        toast.success("Sample data added!");
    };
    
    const importFromExcel = (data: any[]) => {
        const newProducts: Product[] = data.map(row => ({
            id: uuidv4(),
            name: row['Name'] || 'Unnamed',
            categoryId: row['Category ID'] || 'uncategorized',
            subCategoryId: row['SubCategory ID'] || null,
            manufacturer: row['Manufacturer'] || 'N/A',
            location: row['Location'] || 'N/A',
            quantity: parseInt(row['Quantity'], 10) || 0,
            purchasePrice: parseInt(row['Purchase Price (Rs)'], 10) || 0,
            salePrice: parseInt(row['Sale Price (Rs)'], 10) || 0,
            barcode: row['Barcode'] || undefined,
            imageUrl: row['Image URL'] || undefined,
        }));

        setInventory([...inventory, ...newProducts]);
        toast.success(`${newProducts.length} products imported successfully!`);
    };

    const addCategory = (name: string, parentId: string | null) => {
        const newCategory = { id: uuidv4(), name, parentId };
        setCategories([...categories, newCategory]);
        toast.success(`Category "${name}" added.`);
    };

    const updateCategory = (id: string, name: string) => {
        setCategories(categories.map(c => c.id === id ? { ...c, name } : c));
        toast.success("Category updated.");
    };

    const deleteCategory = (id: string) => {
        // Also delete sub-categories and re-assign products
        const childIds = categories.filter(c => c.parentId === id).map(c => c.id);
        const allIdsToDelete = [id, ...childIds];
        
        setCategories(categories.filter(c => !allIdsToDelete.includes(c.id)));
        setInventory(inventory.map(p => {
            if (allIdsToDelete.includes(p.categoryId)) return {...p, categoryId: 'uncategorized'};
            if (p.subCategoryId && allIdsToDelete.includes(p.subCategoryId)) return {...p, subCategoryId: null};
            return p;
        }));
        toast.success("Category and its sub-categories deleted.");
    };

    const createSale = (cartItems: CartItem[], overallDiscountValue: number, overallDiscountType: 'fixed' | 'percentage', customerInfo: { customerName: string, bikeNumber: string, contactNumber?: string, serviceFrequencyValue?: number, serviceFrequencyUnit?: 'days' | 'months' | 'years' }, redeemedPoints: number): Sale | null => {
        if (cartItems.length === 0) {
            toast.error("Cart is empty.");
            return null;
        }

        const saleItems: SaleItem[] = [];
        const updatedInventory = [...inventory];

        for (const item of cartItems) {
            if (!item.id.startsWith('manual-')) {
                const productInStock = updatedInventory.find(p => p.id === item.id);
                if (!productInStock || productInStock.quantity < item.cartQuantity) {
                    toast.error(`Not enough stock for ${item.name}.`);
                    return null;
                }
                productInStock.quantity -= item.cartQuantity;
            }
             const discountAmount = item.discountType === 'fixed' ? item.discount : (item.salePrice * item.discount) / 100;
             saleItems.push({
                productId: item.id, name: item.name, quantity: item.cartQuantity,
                originalPrice: item.salePrice, discount: item.discount, discountType: item.discountType,
                price: item.salePrice - discountAmount, purchasePrice: item.purchasePrice,
            });
        }
        
        const subtotal = saleItems.reduce((acc, item) => acc + item.originalPrice * item.quantity, 0);
        const totalItemDiscounts = saleItems.reduce((acc, item) => acc + (item.originalPrice - item.price) * item.quantity, 0);
        const subtotalAfterItemDiscounts = subtotal - totalItemDiscounts;
        const overallDiscountAmount = overallDiscountType === 'fixed' ? overallDiscountValue : (subtotalAfterItemDiscounts * overallDiscountValue) / 100;
        const totalBeforeLoyalty = subtotalAfterItemDiscounts - overallDiscountAmount;

        const customerId = customerInfo.bikeNumber.replace(/\s+/g, '').toUpperCase();
        let customer = customers.find(c => c.id === customerId);
        let loyaltyDiscount = 0;
        
        if (customer && redeemedPoints > 0) {
            if (customer.loyaltyPoints < redeemedPoints) {
                toast.error("Customer does not have enough points to redeem.");
                return null;
            }
            if (redemptionRule.method === 'fixedValue') {
                loyaltyDiscount = (redeemedPoints / redemptionRule.points) * redemptionRule.value;
            } else { // percentage
                const percentage = (redeemedPoints / redemptionRule.points) * redemptionRule.value;
                loyaltyDiscount = (totalBeforeLoyalty * percentage) / 100;
            }
            loyaltyDiscount = Math.min(loyaltyDiscount, totalBeforeLoyalty);
        }

        const total = totalBeforeLoyalty - loyaltyDiscount;
        if (total < 0) {
            toast.error("Total amount cannot be negative.");
            return null;
        }

        const sortedEarningRules = [...earningRules].sort((a, b) => a.minSpend - b.minSpend);
        const applicableRule = sortedEarningRules.reverse().find(rule => totalBeforeLoyalty >= rule.minSpend);
        let pointsEarned = applicableRule ? Math.floor((totalBeforeLoyalty / 100) * applicableRule.pointsPerHundred) : 0;
        
        let promotionApplied: Sale['promotionApplied'] | undefined = undefined;
        let tierApplied: Sale['tierApplied'] | undefined = undefined;

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        // Tier Bonus Check
        if (customer && customer.tierId && pointsEarned > 0) {
            const tier = customerTiers.find(t => t.id === customer.tierId);
            if (tier && tier.pointsMultiplier > 1) {
                pointsEarned = Math.floor(pointsEarned * tier.pointsMultiplier);
                tierApplied = { name: tier.name, multiplier: tier.pointsMultiplier };
                toast.success(`Tier Bonus Applied: ${tier.name} (${tier.pointsMultiplier}x)!`);
            }
        }

        // Promotion Bonus Check (applied on top of tier bonus)
        const activePromotion = promotions.find(p => {
            const startDate = new Date(p.startDate);
            const endDate = new Date(p.endDate);
            startDate.setHours(0, 0, 0, 0);
            endDate.setHours(23, 59, 59, 999);
            return today >= startDate && today <= endDate;
        });

        if (activePromotion && pointsEarned > 0) {
            pointsEarned = Math.floor(pointsEarned * activePromotion.multiplier);
            promotionApplied = { name: activePromotion.name, multiplier: activePromotion.multiplier };
            toast.success(`Promotional points applied: ${activePromotion.name} (${activePromotion.multiplier}x)!`);
        }

        const newSaleId = `${now.getFullYear().toString().slice(2)}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}-${customerId}`;
        let finalLoyaltyPoints = customer?.loyaltyPoints || 0;

        if (customer) {
            let currentPoints = customer.loyaltyPoints;

            if (redeemedPoints > 0) {
                const pointsAfterRedeem = currentPoints - redeemedPoints;
                const redeemTransaction: LoyaltyTransaction = {
                    id: uuidv4(), customerId: customer.id, type: 'redeemed',
                    points: redeemedPoints, date: now.toISOString(), relatedSaleId: newSaleId,
                    pointsBefore: currentPoints, pointsAfter: pointsAfterRedeem,
                };
                setLoyaltyTransactions(prev => [redeemTransaction, ...prev]);
                currentPoints = pointsAfterRedeem;
            }

            if (pointsEarned > 0) {
                const pointsAfterEarn = currentPoints + pointsEarned;
                const reasonParts = [];
                if(tierApplied) reasonParts.push(`${tierApplied.name} Tier Bonus`);
                if(promotionApplied) reasonParts.push(`Promotion: ${promotionApplied.name}`);
                if(reasonParts.length === 0) reasonParts.push('Sale Purchase');
                
                const earnTransaction: LoyaltyTransaction = {
                    id: uuidv4(), customerId: customer.id, type: 'earned',
                    points: pointsEarned, date: now.toISOString(), relatedSaleId: newSaleId,
                    reason: reasonParts.join(' + '),
                    pointsBefore: currentPoints, pointsAfter: pointsAfterEarn
                };
                setLoyaltyTransactions(prev => [earnTransaction, ...prev]);
                currentPoints = pointsAfterEarn;
            }
            finalLoyaltyPoints = currentPoints;
        }

        const newSale: Sale = {
            id: newSaleId, customerId, customerName: customerInfo.customerName.trim(), items: saleItems,
            subtotal, totalItemDiscounts, overallDiscount: overallDiscountValue, overallDiscountType,
            loyaltyDiscount: Math.round(loyaltyDiscount), total: Math.round(total), date: now.toISOString(),
            redeemedPoints, pointsEarned, finalLoyaltyPoints, promotionApplied, tierApplied,
        };

        setInventory(updatedInventory);
        setSales([newSale, ...sales]);

        const existingCustomerIndex = customers.findIndex(c => c.id === customerId);
        if (existingCustomerIndex > -1) {
            const updatedCustomers = [...customers];
            const custToUpdate = { ...updatedCustomers[existingCustomerIndex] };
            custToUpdate.saleIds.unshift(newSale.id);
            custToUpdate.lastSeen = now.toISOString();
            if (customerInfo.customerName.trim()) custToUpdate.name = customerInfo.customerName.trim();
            if (customerInfo.contactNumber?.trim()) custToUpdate.contactNumber = customerInfo.contactNumber.trim();
            if (customerInfo.serviceFrequencyValue && customerInfo.serviceFrequencyUnit) {
                custToUpdate.serviceFrequencyValue = customerInfo.serviceFrequencyValue;
                custToUpdate.serviceFrequencyUnit = customerInfo.serviceFrequencyUnit;
            }
            custToUpdate.loyaltyPoints = finalLoyaltyPoints;
            updatedCustomers[existingCustomerIndex] = custToUpdate;
            setCustomers(recalculateAndAssignTier(customerId, updatedCustomers, [newSale, ...sales], customerTiers));
        } else {
            const newCustomer: Customer = {
                id: customerId, name: customerInfo.customerName.trim() || `Customer ${customerId}`, saleIds: [newSale.id],
                firstSeen: now.toISOString(), lastSeen: now.toISOString(),
                contactNumber: customerInfo.contactNumber?.trim() || undefined,
                serviceFrequencyValue: customerInfo.serviceFrequencyValue,
                serviceFrequencyUnit: customerInfo.serviceFrequencyValue ? customerInfo.serviceFrequencyUnit : undefined,
                loyaltyPoints: pointsEarned,
                tierId: null,
            };
            setCustomers(recalculateAndAssignTier(customerId, [newCustomer, ...customers], [newSale, ...sales], customerTiers));
        }

        toast.success("Sale completed successfully!");
        return newSale;
    };
    

    const reverseSale = (saleId: string, itemsToReturn: SaleItem[]) => {
        const saleIndex = sales.findIndex(s => s.id === saleId);
        if (saleIndex === -1) {
            toast.error("Sale not found.");
            return;
        }
        if (itemsToReturn.length === 0) {
            toast.error("No items selected for reversal.");
            return;
        }

        const saleToModify = { ...sales[saleIndex] };
        const updatedInventory = [...inventory];
        let returnedItemsCount = 0;
        for (const item of itemsToReturn) {
            const productIndex = updatedInventory.findIndex(p => p.id === item.productId);
            if (productIndex > -1) {
                updatedInventory[productIndex].quantity += item.quantity;
                returnedItemsCount++;
            } else {
                console.warn(`Product with ID ${item.productId} not found during sale reversal.`);
            }
        }
        setInventory(updatedInventory);

        const itemsToReturnProductIds = new Set(itemsToReturn.map(i => i.productId));
        const remainingItems = saleToModify.items.filter(item => !itemsToReturnProductIds.has(item.productId));

        if (remainingItems.length === 0) {
             const customer = customers.find(c => c.id === saleToModify.customerId);
            if (customer && (saleToModify.pointsEarned || saleToModify.redeemedPoints)) {
                let currentPoints = customer.loyaltyPoints;
                let finalPoints = currentPoints;

                // Add back redeemed points
                if (saleToModify.redeemedPoints && saleToModify.redeemedPoints > 0) {
                    const pointsAfter = currentPoints + saleToModify.redeemedPoints;
                    const redeemReversalTx: LoyaltyTransaction = {
                        id: uuidv4(), customerId: customer.id, type: 'manual_add',
                        points: saleToModify.redeemedPoints, date: new Date().toISOString(),
                        reason: `Points returned from reversed sale #${saleToModify.id}`,
                        pointsBefore: currentPoints, pointsAfter: pointsAfter
                    };
                    setLoyaltyTransactions(prev => [redeemReversalTx, ...prev]);
                    finalPoints += saleToModify.redeemedPoints;
                }
                
                // Subtract earned points
                if (saleToModify.pointsEarned && saleToModify.pointsEarned > 0) {
                    const tempPointsBefore = finalPoints;
                    const pointsAfter = finalPoints - saleToModify.pointsEarned;
                    const earnReversalTx: LoyaltyTransaction = {
                        id: uuidv4(), customerId: customer.id, type: 'manual_subtract',
                        points: saleToModify.pointsEarned, date: new Date().toISOString(),
                        reason: `Points clawed back from reversed sale #${saleToModify.id}`,
                        pointsBefore: tempPointsBefore, pointsAfter: pointsAfter
                    };
                    setLoyaltyTransactions(prev => [earnReversalTx, ...prev]);
                    finalPoints -= saleToModify.pointsEarned;
                }
                
                setCustomers(customers.map(c => c.id === customer.id ? {...c, loyaltyPoints: finalPoints } : c));
                toast.success(`Loyalty points for ${customer.name} have been reverted.`);
            }
            setSales(sales.filter(s => s.id !== saleId));
            toast.success("All items returned. Sale has been fully reversed and deleted.");
        } else {
            // Recalculate the sale totals based on remaining items. This is a simplified reversal.
            // A more complex system would handle discounts more granularly.
            const newSubtotal = remainingItems.reduce((acc, item) => acc + item.originalPrice * item.quantity, 0);
            const newItemDiscounts = remainingItems.reduce((acc, item) => acc + (item.originalPrice - item.price) * item.quantity, 0);
            const subtotalAfterItemDiscounts = newSubtotal - newItemDiscounts;

            let newTotal = subtotalAfterItemDiscounts;
            if (saleToModify.overallDiscountType === 'percentage') {
                newTotal = newTotal - (newTotal * (saleToModify.overallDiscount / 100));
            } else {
                newTotal = Math.max(0, newTotal - saleToModify.overallDiscount);
            }

            const updatedSale = {
                ...saleToModify,
                items: remainingItems,
                subtotal: newSubtotal,
                totalItemDiscounts: newItemDiscounts,
                total: newTotal
            };
            setSales(sales.map(s => s.id === saleId ? updatedSale : s));
            toast.success(`${returnedItemsCount} item(s) returned to stock. Sale record updated.`);
        }
    };
    
    // Customer Management
    const updateCustomer = (customerId: string, details: Partial<Customer>): boolean => {
         const customerIndex = customers.findIndex(c => c.id === customerId);
         if (customerIndex === -1) {
             toast.error("Customer not found.");
             return false;
         }

         const newId = details.id?.replace(/\s+/g, '').toUpperCase();
         if (newId && newId !== customerId && customers.some(c => c.id === newId)) {
             toast.error(`Another customer with bike number ${newId} already exists.`);
             return false;
         }
         
         const updatedCustomers = [...customers];
         updatedCustomers[customerIndex] = { ...updatedCustomers[customerIndex], ...details, id: newId || customerId };
         setCustomers(updatedCustomers);
         toast.success("Customer details updated.");
         return true;
    };
    
    // Loyalty & Promotions
    const updateEarningRules = (rules: EarningRule[]) => {
        setEarningRules(rules);
        toast.success("Earning rules updated.");
    };
    
    const updateRedemptionRule = (rule: RedemptionRule) => {
        setRedemptionRule(rule);
        toast.success("Redemption rule updated.");
    };

    const addPromotion = (promotion: Omit<Promotion, 'id'>) => {
        const newPromotion = { ...promotion, id: uuidv4() };
        setPromotions([...promotions, newPromotion]);
        toast.success("Promotion created successfully!");
    };

    const updatePromotion = (updatedPromotion: Promotion) => {
        setPromotions(promotions.map(p => p.id === updatedPromotion.id ? updatedPromotion : p));
        toast.success("Promotion updated successfully!");
    };
    
    const deletePromotion = (promotionId: string) => {
        setPromotions(promotions.filter(p => p.id !== promotionId));
        toast.success("Promotion deleted.");
    };

    const adjustCustomerPoints = (customerId: string, points: number, reason: string): boolean => {
        if (currentUser?.role !== 'master') {
            toast.error("You are not authorized to perform this action.");
            return false;
        }
        if (points === 0) {
            toast.error("Points to adjust cannot be zero.");
            return false;
        }
        if (!reason.trim()) {
            toast.error("A reason is required for manual adjustments.");
            return false;
        }
    
        const customerIndex = customers.findIndex(c => c.id === customerId);
        if (customerIndex === -1) {
            toast.error("Customer not found.");
            return false;
        }
        
        const updatedCustomers = [...customers];
        const customerToUpdate = { ...updatedCustomers[customerIndex] };
        const pointsBefore = customerToUpdate.loyaltyPoints;
        const pointsAfter = pointsBefore + points;
    
        if (pointsAfter < 0) {
            toast.error("Customer points cannot go below zero.");
            return false;
        }
        
        customerToUpdate.loyaltyPoints = pointsAfter;
        updatedCustomers[customerIndex] = customerToUpdate;
        setCustomers(updatedCustomers);
    
        const newTransaction: LoyaltyTransaction = {
            id: uuidv4(), customerId,
            type: points > 0 ? 'manual_add' : 'manual_subtract',
            points: Math.abs(points), date: new Date().toISOString(),
            reason, pointsBefore, pointsAfter,
        };
        setLoyaltyTransactions(prev => [newTransaction, ...prev]);
    
        toast.success(`Points adjusted for ${customerToUpdate.name}.`);
        return true;
    };

    const updateLoyaltyExpirySettings = (settings: LoyaltyExpirySettings) => {
        setLoyaltyExpirySettings(settings);
        toast.success("Loyalty expiry settings updated.");
    };
    
    const runPointsExpiryCheck = () => {
        if (!loyaltyExpirySettings.enabled) {
            console.log("Point expiry system is disabled.");
            return;
        }
        console.log("Running daily points expiry check...");
        
        const now = new Date();
        const updatedCustomers = [...customers];
        const newTransactions: LoyaltyTransaction[] = [];
        let totalPointsExpired = 0;

        const inactivityThresholdDate = modifyDate(now, loyaltyExpirySettings.inactivityPeriodValue, loyaltyExpirySettings.inactivityPeriodUnit, 'subtract');
        const pointsLifespanThresholdDate = modifyDate(now, loyaltyExpirySettings.pointsLifespanValue, loyaltyExpirySettings.pointsLifespanUnit, 'subtract');

        for (let i = 0; i < updatedCustomers.length; i++) {
            const customer = updatedCustomers[i];
            
            if (customer.loyaltyPoints <= 0) continue;

            // 1. Inactivity Check
            if (new Date(customer.lastSeen) < inactivityThresholdDate) {
                const pointsToExpire = customer.loyaltyPoints;
                totalPointsExpired += pointsToExpire;
                
                const pointsBefore = customer.loyaltyPoints;
                updatedCustomers[i] = { ...customer, loyaltyPoints: 0 };

                newTransactions.push({
                    id: uuidv4(), customerId: customer.id,
                    type: 'manual_subtract', points: pointsToExpire,
                    date: now.toISOString(), reason: 'Points expired due to inactivity',
                    pointsBefore, pointsAfter: 0
                });
                continue; // Move to next customer
            }

            // 2. Point Aging Check (for active customers)
            const customerTransactions = loyaltyTransactions.filter(t => t.customerId === customer.id);
            const credits = customerTransactions
                .filter(t => t.type === 'earned' || t.type === 'manual_add')
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            
            const debits = customerTransactions
                .filter(t => t.type === 'redeemed' || t.type === 'manual_subtract');

            let debitsToApply = debits.reduce((sum, t) => sum + t.points, 0);
            let customerPointsToExpire = 0;

            for (const credit of credits) {
                let unspentPoints = credit.points;
                if (debitsToApply > 0) {
                    const deduction = Math.min(unspentPoints, debitsToApply);
                    unspentPoints -= deduction;
                    debitsToApply -= deduction;
                }

                if (unspentPoints > 0 && new Date(credit.date) < pointsLifespanThresholdDate) {
                    customerPointsToExpire += unspentPoints;
                }
            }
            
            customerPointsToExpire = Math.round(customerPointsToExpire);

            if (customerPointsToExpire > 0) {
                totalPointsExpired += customerPointsToExpire;
                const pointsBefore = customer.loyaltyPoints;
                const pointsAfter = Math.max(0, pointsBefore - customerPointsToExpire);
                updatedCustomers[i] = { ...customer, loyaltyPoints: pointsAfter };

                newTransactions.push({
                    id: uuidv4(), customerId: customer.id,
                    type: 'manual_subtract', points: customerPointsToExpire,
                    date: now.toISOString(), reason: `Points older than ${loyaltyExpirySettings.pointsLifespanValue} ${loyaltyExpirySettings.pointsLifespanUnit} expired`,
                    pointsBefore, pointsAfter
                });
            }
        }

        if (totalPointsExpired > 0) {
            setCustomers(updatedCustomers);
            setLoyaltyTransactions(prev => [...newTransactions, ...prev]); // Prepend new transactions
            toast.success(`${totalPointsExpired} total points expired across all customers.`);
            console.log(`${totalPointsExpired} total points expired.`);
        } else {
            console.log("No points expired today.");
        }
    };

    const updateCustomerTiers = (tiers: CustomerTier[]) => {
        setCustomerTiers(tiers);
        toast.success("Customer tiers updated.");
        // After updating tiers, it's good practice to re-evaluate all customers
        updateAllCustomerTiers();
    };

    return (
        <AppContext.Provider value={{
            loading, shopInfo, saveShopInfo, currentUser, users, signUp, login, logout, updateUser, addUser, deleteUser,
            inventory, addProduct, updateProduct, deleteProduct, findProductByBarcode, addSampleData, importFromExcel,
            categories, addCategory, updateCategory, deleteCategory,
            sales, createSale, reverseSale,
            customers, updateCustomer,
            earningRules, updateEarningRules, redemptionRule, updateRedemptionRule,
            promotions, addPromotion, updatePromotion, deletePromotion,
            loyaltyTransactions, adjustCustomerPoints,
            loyaltyExpirySettings, updateLoyaltyExpirySettings,
            customerTiers, updateCustomerTiers
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