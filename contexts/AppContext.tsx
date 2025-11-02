import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ShopInfo, User, UserRole, Category, Product, Sale, SaleItem, Customer, CartItem, EarningRule, RedemptionRule, Promotion, LoyaltyTransaction, LoyaltyExpirySettings, CustomerTier, Expense, Payment, DemandItem } from '../types';
import useLocalStorage from '../hooks/useLocalStorage';
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
    updateDemandItem: (item: DemandItem) => void;
    deleteDemandItem: (itemId: string) => void;
    createBackup: () => boolean;
    restoreBackup: (file: File) => void;
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

    const [appData, setAppData] = useLocalStorage<AppData>('appData', initialState);
    const {
        shopInfo, users, currentUser, inventory, categories, sales, customers,
        earningRules, redemptionRule, promotions, loyaltyTransactions,
        loyaltyExpirySettings, customerTiers, expenses, payments, demandItems
    } = appData;

    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(false);
    }, []);
    
    // AUTH & USERS
    const saveShopInfo = (info: ShopInfo) => {
        setAppData(prev => ({...prev, shopInfo: info}));
    };
    
    const signUp = async (username: string, password: string): Promise<boolean> => {
        if (appData.users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
            toast.error("Username already exists.");
            return false;
        }
        const passwordHash = await simpleHash(password);
        const role: UserRole = appData.users.length === 0 ? 'master' : 'sub';
        const newUser: User = { id: uuidv4(), username, passwordHash, role };
        setAppData(prev => ({...prev, users: [...prev.users, newUser]}));
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
        setAppData(prev => ({...prev, users: prev.users.filter(u => u.id !== userId)}));
        toast.success("User deleted.");
    };

    const login = async (username: string, password: string): Promise<boolean> => {
        const user = appData.users.find(u => u.username.toLowerCase() === username.toLowerCase());
        const passwordHash = await simpleHash(password);
        if (user && user.passwordHash === passwordHash) {
            setAppData(prev => ({...prev, currentUser: user}));
            toast.success(`Welcome, ${user.username}!`);
            return true;
        }
        toast.error("Invalid username or password.");
        return false;
    };

    const logout = () => {
        setAppData(prev => ({...prev, currentUser: null}));
        toast.success("Logged out successfully.");
    };
    
    const updateUser = async (userId: string, updates: Partial<Omit<User, 'id'>>) => {
        let success = false;
        setAppData(prev => {
            const userToUpdate = prev.users.find(u => u.id === userId);
            if (!userToUpdate) return prev;

            if (updates.username && prev.users.some(u => u.username.toLowerCase() === updates.username!.toLowerCase() && u.id !== userId)) {
                toast.error("Username already exists.");
                return prev;
            }
            
            success = true;
            return {
                ...prev,
                users: prev.users.map(user => user.id === userId ? { ...user, ...updates } : user)
            };
        });

        if(success) toast.success("Profile updated!");
        return success;
    };

    // INVENTORY
    const addSampleData = () => {
        const productsWithIds = SAMPLE_PRODUCTS.map(p => ({ ...p, id: uuidv4() }));
        setAppData(prev => ({
            ...prev,
            inventory: productsWithIds,
            categories: SAMPLE_CATEGORIES
        }));
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
            setAppData(prev => ({...prev, inventory: [...prev.inventory, ...newProducts]}));
            toast.success(`${newProducts.length} products imported successfully!`);
        } catch (error: any) {
            toast.error(`Import failed: ${error.message}`);
            console.error(error);
        }
    };
    
    const addProduct = (product: Omit<Product, 'id'>) => {
        const newProduct = { ...product, id: uuidv4() };
        setAppData(prev => ({...prev, inventory: [newProduct, ...prev.inventory]}));
        toast.success(`"${newProduct.name}" added to inventory.`);
    };

    const updateProduct = (updatedProduct: Product) => {
        setAppData(prev => ({...prev, inventory: prev.inventory.map(p => p.id === updatedProduct.id ? updatedProduct : p)}));
        toast.success(`"${updatedProduct.name}" updated.`);
    };
    
    const addStock = (productId: string, quantity: number, newSalePrice?: number) => {
        let productName = '';
        setAppData(prev => ({
            ...prev,
            inventory: prev.inventory.map(p => {
                if (p.id === productId) {
                    productName = p.name;
                    const updatedProduct = { ...p, quantity: p.quantity + quantity };
                    if (newSalePrice !== undefined) {
                        updatedProduct.salePrice = newSalePrice;
                    }
                    return updatedProduct;
                }
                return p;
            })
        }));
        toast.success(`${quantity} units added to ${productName}. ${newSalePrice !== undefined ? 'Price updated.' : ''}`);
    };

    const deleteProduct = (productId: string) => {
        const product = appData.inventory.find(p => p.id === productId);
        setAppData(prev => ({...prev, inventory: prev.inventory.filter(p => p.id !== productId)}));
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
        setAppData(prev => ({...prev, categories: [...prev.categories, newCategory]}));
        toast.success(`Category "${name}" added.`);
    };

    const updateCategory = (id: string, name: string) => {
        setAppData(prev => ({...prev, categories: prev.categories.map(c => c.id === id ? { ...c, name } : c)}));
        toast.success("Category updated.");
    };

    const deleteCategory = (id: string) => {
        const children = appData.categories.filter(c => c.parentId === id);
        if (children.length > 0 && !window.confirm("This will delete all sub-categories as well. Are you sure?")) {
            return;
        }
        const idsToDelete = [id, ...children.map(c => c.id)];
        setAppData(prev => ({
            ...prev,
            categories: prev.categories.filter(c => !idsToDelete.includes(c.id)),
            inventory: prev.inventory.map(p => {
                if (idsToDelete.includes(p.categoryId)) return { ...p, categoryId: 'uncategorized' };
                if (p.subCategoryId && idsToDelete.includes(p.subCategoryId)) return { ...p, subCategoryId: null };
                return p;
            })
        }));
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
        const baseSaleId = `${year}${month}${day}${hours}${minutes}`;

        let saleId = baseSaleId;
        let counter = 1;
        while (appData.sales.some(s => s.id === saleId)) {
            saleId = `${baseSaleId}-${counter}`;
            counter++;
        }
        
        let subtotal = 0;
        let totalItemDiscounts = 0;
        
        const saleItems: SaleItem[] = cart.map(item => {
            const originalPrice = item.salePrice;
            const discountAmount = item.discountType === 'fixed' ? item.discount : (originalPrice * item.discount) / 100;
            const finalPrice = originalPrice - discountAmount;
            subtotal += originalPrice * item.cartQuantity;
            totalItemDiscounts += discountAmount * item.cartQuantity;
            return {
                productId: item.id, name: item.name, quantity: item.cartQuantity, originalPrice: originalPrice,
                discount: item.discount, discountType: item.discountType, price: finalPrice, purchasePrice: item.purchasePrice,
            };
        });

        const subtotalWithCharges = (subtotal - totalItemDiscounts) + (tuningCharges || 0) + (laborCharges || 0);
        const overallDiscountAmount = overallDiscountType === 'fixed' ? overallDiscount : (subtotalWithCharges * overallDiscount) / 100;
        const totalAfterDiscounts = subtotalWithCharges - overallDiscountAmount;
        
        const customerId = customerDetails.bikeNumber.replace(/\s+/g, '').toUpperCase();
        const existingCustomer = appData.customers.find(c => c.id === customerId);
        const customerTier = existingCustomer?.tierId ? appData.customerTiers.find(t => t.id === existingCustomer.tierId) : appData.customerTiers.find(t => t.rank === 0);
        const tierMultiplier = customerTier?.pointsMultiplier || 1;

        const activePromotion = appData.promotions.find(p => {
            const now = new Date(); const start = new Date(p.startDate); const end = new Date(p.endDate);
            now.setHours(0,0,0,0); start.setHours(0,0,0,0); end.setHours(23,59,59,999);
            return now >= start && now <= end;
        });
        const promoMultiplier = activePromotion?.multiplier || 1;

        let pointsEarned = 0;
        if (totalAfterDiscounts > 0) {
            const applicableRule = appData.earningRules
                .filter(r => totalAfterDiscounts >= r.minSpend && (r.maxSpend === null || totalAfterDiscounts <= r.maxSpend))
                .sort((a,b) => b.minSpend - a.minSpend)[0];
            if (applicableRule) {
                pointsEarned = Math.floor((totalAfterDiscounts / 100) * applicableRule.pointsPerHundred * tierMultiplier * promoMultiplier);
            }
        }
        
        const loyaltyDiscountAmount = existingCustomer && pointsToRedeem > 0
            ? Math.min(
                appData.redemptionRule.method === 'fixedValue'
                    ? (pointsToRedeem / appData.redemptionRule.points) * appData.redemptionRule.value
                    : (totalAfterDiscounts * ((pointsToRedeem / appData.redemptionRule.points) * appData.redemptionRule.value)) / 100,
                totalAfterDiscounts
              ) : 0;
        
        const previousBalanceBroughtForward = existingCustomer?.balance || 0;
        const total = totalAfterDiscounts + previousBalanceBroughtForward - loyaltyDiscountAmount;
        const roundedTotal = Math.round(total);
        const balanceDue = roundedTotal - amountPaid;

        const newSale: Sale = {
            id: saleId, customerId: customerId, customerName: customerDetails.customerName, items: saleItems, subtotal: subtotal,
            totalItemDiscounts: totalItemDiscounts, overallDiscount, overallDiscountType, tuningCharges, laborCharges,
            loyaltyDiscount: loyaltyDiscountAmount, total: roundedTotal, amountPaid: amountPaid,
            paymentStatus: balanceDue <= 0 ? 'Paid' : (amountPaid > 0 ? 'Partial' : 'Unpaid'), balanceDue: balanceDue,
            previousBalanceBroughtForward: previousBalanceBroughtForward, date: new Date().toISOString(), pointsEarned: pointsEarned,
            redeemedPoints: pointsToRedeem, finalLoyaltyPoints: (existingCustomer?.loyaltyPoints || 0) + pointsEarned - pointsToRedeem,
            promotionApplied: activePromotion ? { name: activePromotion.name, multiplier: activePromotion.multiplier } : undefined,
            tierApplied: customerTier ? { name: customerTier.name, multiplier: customerTier.pointsMultiplier } : undefined,
        };

        const newInventory = [...appData.inventory];
        let updateFailed = false;
        cart.forEach(item => {
            if(item.id.startsWith('manual-')) return;
            const index = newInventory.findIndex(p => p.id === item.id);
            if (index !== -1) {
                if (newInventory[index].quantity >= item.cartQuantity) {
                    newInventory[index].quantity -= item.cartQuantity;
                } else {
                    toast.error(`Not enough stock for ${item.name}. Sale cancelled.`);
                    updateFailed = true;
                }
            }
        });

        if (updateFailed) return null;

        const customerUpdate: Partial<Customer> = {
            name: customerDetails.customerName, id: customerId, saleIds: [...(existingCustomer?.saleIds || []), newSale.id],
            lastSeen: newSale.date, contactNumber: customerDetails.contactNumber || existingCustomer?.contactNumber,
            serviceFrequencyValue: customerDetails.serviceFrequencyValue || existingCustomer?.serviceFrequencyValue,
            serviceFrequencyUnit: customerDetails.serviceFrequencyUnit || existingCustomer?.serviceFrequencyUnit,
            loyaltyPoints: newSale.finalLoyaltyPoints, balance: balanceDue,
        };
        
        const newTransactions: LoyaltyTransaction[] = [];
        const pointsBefore = existingCustomer?.loyaltyPoints || 0;
        if (pointsEarned > 0) newTransactions.push({ id: uuidv4(), customerId, type: 'earned', points: pointsEarned, date: newSale.date, relatedSaleId: newSale.id, pointsBefore, pointsAfter: pointsBefore + pointsEarned });
        if (pointsToRedeem > 0) {
            const balanceAfterEarn = pointsBefore + pointsEarned;
            newTransactions.push({ id: uuidv4(), customerId, type: 'redeemed', points: pointsToRedeem, date: newSale.date, relatedSaleId: newSale.id, pointsBefore: balanceAfterEarn, pointsAfter: balanceAfterEarn - pointsToRedeem });
        }

        setAppData(prev => {
            const currentCustomer = prev.customers.find(c => c.id === customerId);
            let updatedCustomers;
            if (currentCustomer) {
                updatedCustomers = prev.customers.map(c => c.id === customerId ? { ...c, ...customerUpdate } : c);
            } else {
                const newCustomer: Customer = {
                    id: customerId, name: customerDetails.customerName, saleIds: [newSale.id], firstSeen: newSale.date, lastSeen: newSale.date,
                    contactNumber: customerDetails.contactNumber, serviceFrequencyValue: customerDetails.serviceFrequencyValue, serviceFrequencyUnit: customerDetails.serviceFrequencyUnit,
                    loyaltyPoints: newSale.finalLoyaltyPoints!, tierId: customerTier?.id || null, balance: balanceDue,
                };
                updatedCustomers = [newCustomer, ...prev.customers];
            }

            return {
                ...prev,
                inventory: newInventory,
                sales: [newSale, ...prev.sales],
                customers: updatedCustomers,
                loyaltyTransactions: [...prev.loyaltyTransactions, ...newTransactions]
            };
        });
        
        toast.success(`Sale #${saleId} completed!`);
        createBackup();
        return newSale;
    };

    const reverseSale = (saleId: string, itemsToReturn: SaleItem[]) => {
        setAppData(prev => {
            const saleToReverse = prev.sales.find(s => s.id === saleId);
            if (!saleToReverse) {
                toast.error("Sale not found.");
                return prev;
            }

            const newInventory = [...prev.inventory];
            itemsToReturn.forEach(item => {
                const index = newInventory.findIndex(p => p.id === item.productId);
                if (index !== -1) {
                    newInventory[index].quantity += item.quantity;
                } else {
                    newInventory.push({
                        id: item.productId, name: item.name, quantity: item.quantity, purchasePrice: item.purchasePrice,
                        salePrice: item.originalPrice, categoryId: 'uncategorized', subCategoryId: null, manufacturer: 'N/A', location: 'N/A'
                    });
                }
            });

            const allItemsReturned = itemsToReturn.length === saleToReverse.items.length;
            let newSales;
            if (allItemsReturned) {
                newSales = prev.sales.filter(s => s.id !== saleId);
                toast.success("Sale completely reversed and deleted.");
            } else {
                const remainingItems = saleToReverse.items.filter(item => !itemsToReturn.some(ret => ret.productId === item.productId));
                const newSubtotal = remainingItems.reduce((acc, item) => acc + item.originalPrice * item.quantity, 0);
                const newItemDiscounts = remainingItems.reduce((acc, item) => acc + (item.originalPrice - item.price) * item.quantity, 0);
                const updatedSale = { ...saleToReverse, items: remainingItems, subtotal: newSubtotal, totalItemDiscounts: newItemDiscounts };
                newSales = prev.sales.map(s => s.id === saleId ? updatedSale : s);
                toast.success("Selected items returned to stock. Sale updated.");
            }
            toast("Please manually adjust customer loyalty points if necessary.", { icon: '⚠️' });

            return { ...prev, inventory: newInventory, sales: newSales };
        });
    };
    
    const updateSale = (saleId: string, updates: Partial<Sale>) => {
        setAppData(prev => ({
            ...prev,
            sales: prev.sales.map(sale => {
                if (sale.id === saleId) {
                    const newItems = updates.items || sale.items;
                    const subtotal = newItems.reduce((acc, item) => acc + item.originalPrice * item.quantity, 0);
                    const totalItemDiscounts = newItems.reduce((acc, item) => {
                        const discount = item.discountType === 'fixed' ? item.discount : (item.originalPrice * item.discount) / 100;
                        return acc + discount * item.quantity;
                    }, 0);
                    const subtotalWithCharges = (subtotal - totalItemDiscounts) + (updates.tuningCharges ?? sale.tuningCharges ?? 0) + (updates.laborCharges ?? sale.laborCharges ?? 0);
                    const overallDiscount = updates.overallDiscount ?? sale.overallDiscount;
                    const overallDiscountType = updates.overallDiscountType ?? sale.overallDiscountType;
                    const overallDiscountAmount = overallDiscountType === 'fixed' ? overallDiscount : (subtotalWithCharges * overallDiscount) / 100;
                    const totalAfterDiscounts = subtotalWithCharges - overallDiscountAmount;
                    const total = totalAfterDiscounts + (sale.previousBalanceBroughtForward || 0) - (sale.loyaltyDiscount || 0);
                    const roundedTotal = Math.round(total);
                    const balanceDue = roundedTotal - sale.amountPaid;
                    return { ...sale, ...updates, subtotal, totalItemDiscounts, total: roundedTotal, balanceDue };
                }
                return sale;
            })
        }));
        toast.success(`Sale #${saleId} updated.`);
    };

    const updateCustomer = (customerId: string, updates: Partial<Customer>): boolean => {
         if (updates.id && updates.id !== customerId && appData.customers.some(c => c.id === updates.id)) {
            toast.error(`Customer with Bike Number "${updates.id}" already exists.`);
            return false;
        }
        setAppData(prev => ({...prev, customers: prev.customers.map(c => c.id === customerId ? { ...c, ...updates } : c)}));
        toast.success("Customer details updated.");
        return true;
    };
    
    // LOYALTY
    const updateEarningRules = (rules: EarningRule[]) => setAppData(prev => ({...prev, earningRules: rules}));
    const updateRedemptionRule = (rule: RedemptionRule) => {
        setAppData(prev => ({...prev, redemptionRule: rule}));
        toast.success("Redemption rule updated.");
    };
    const addPromotion = (promo: Omit<Promotion, 'id'>) => {
        const newPromo = { ...promo, id: uuidv4() };
        setAppData(prev => ({...prev, promotions: [...prev.promotions, newPromo]}));
        toast.success(`Promotion "${newPromo.name}" added.`);
    };
    const updatePromotion = (updatedPromo: Promotion) => {
        setAppData(prev => ({...prev, promotions: prev.promotions.map(p => p.id === updatedPromo.id ? updatedPromo : p)}));
        toast.success(`"${updatedPromo.name}" updated.`);
    };
    const deletePromotion = (promoId: string) => {
        setAppData(prev => ({...prev, promotions: prev.promotions.filter(p => p.id !== promoId)}));
        toast.success("Promotion deleted.");
    };
    const adjustCustomerPoints = (customerId: string, points: number, reason: string) => {
        let success = false;
        setAppData(prev => {
            const customer = prev.customers.find(c => c.id === customerId);
            if (!customer) {
                toast.error("Customer not found.");
                return prev;
            }
            const type = points > 0 ? 'manual_add' : 'manual_subtract';
            const absPoints = Math.abs(points);
            const pointsBefore = customer.loyaltyPoints;
            const pointsAfter = pointsBefore + points;

            if (pointsAfter < 0) {
                toast.error("Cannot subtract more points than the customer has.");
                return prev;
            }

            const newTransaction: LoyaltyTransaction = {
                id: uuidv4(), customerId, type, points: absPoints, reason, date: new Date().toISOString(),
                pointsBefore, pointsAfter
            };
            
            success = true;
            toast.success(`${absPoints} points ${type === 'manual_add' ? 'added to' : 'subtracted from'} ${customer.name}.`);
            
            return {
                ...prev,
                loyaltyTransactions: [...prev.loyaltyTransactions, newTransaction],
                customers: prev.customers.map(c => c.id === customerId ? { ...c, loyaltyPoints: pointsAfter } : c)
            };
        });
        return success;
    };

    const updateLoyaltyExpirySettings = (settings: LoyaltyExpirySettings) => {
        setAppData(prev => ({...prev, loyaltyExpirySettings: settings}));
        toast.success("Expiry settings saved.");
    };
    
    const updateCustomerTiers = (tiers: CustomerTier[]) => setAppData(prev => ({...prev, customerTiers: tiers}));

    // EXPENSES
    const addExpense = (expense: Omit<Expense, 'id'>) => {
        const newExpense = { ...expense, id: uuidv4() };
        setAppData(prev => ({...prev, expenses: [newExpense, ...prev.expenses]}));
        toast.success("Expense recorded.");
    };
    const updateExpense = (updatedExpense: Expense) => {
        setAppData(prev => ({...prev, expenses: prev.expenses.map(e => e.id === updatedExpense.id ? updatedExpense : e)}));
        toast.success("Expense updated.");
    };
    const deleteExpense = (expenseId: string) => {
        setAppData(prev => ({...prev, expenses: prev.expenses.filter(e => e.id !== expenseId)}));
        toast.success("Expense deleted.");
    };

    // PAYMENTS
    const recordCustomerPayment = (customerId: string, amount: number, notes?: string): boolean => {
        let success = false;
        setAppData(prev => {
            const customer = prev.customers.find(c => c.id === customerId);
            if (!customer) {
                toast.error("Customer not found.");
                return prev;
            }
            if (amount > customer.balance) {
                toast.error("Payment exceeds balance due.");
                return prev;
            }
            const newPayment: Payment = { id: uuidv4(), customerId, amount, date: new Date().toISOString(), notes: notes || 'Payment against outstanding balance' };
            success = true;
            toast.success(`Payment of ${amount} recorded for ${customer.name}.`);
            return {
                ...prev,
                payments: [newPayment, ...prev.payments],
                customers: prev.customers.map(c => c.id === customerId ? { ...c, balance: c.balance - amount } : c)
            };
        });
        return success;
    };
    
    // DEMAND
    const addDemandItem = (item: Omit<DemandItem, 'id'>) => {
        const newItem = { ...item, id: uuidv4() };
        setAppData(prev => ({...prev, demandItems: [newItem, ...prev.demandItems]}));
        toast.success(`"${newItem.name}" added to demand list.`);
    };
    const updateDemandItem = (updatedItem: DemandItem) => {
        setAppData(prev => ({...prev, demandItems: prev.demandItems.map(item => item.id === updatedItem.id ? updatedItem : item)}));
        toast.success(`"${updatedItem.name}" updated.`);
    };
    const deleteDemandItem = (itemId: string) => {
        setAppData(prev => ({...prev, demandItems: prev.demandItems.filter(item => item.id !== itemId)}));
        toast.success("Item removed from demand list.");
    };

    // DATA MANAGEMENT (BACKUP/RESTORE)
    const createBackup = useCallback(() => {
        try {
            const jsonString = JSON.stringify(appData, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
    
            const link = document.createElement('a');
            link.href = url;
            link.download = `shopsync_backup_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            
            setTimeout(() => {
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
            }, 100);
            
            return true;
        } catch (error) {
            console.error("Backup failed:", error);
            toast.error("Failed to create backup.");
            return false;
        }
    }, [appData]);

    const restoreBackup = (file: File) => {
        if (!window.confirm("Are you sure you want to restore? This will overwrite ALL current data and reload the application.")) {
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result as string;
                const data = JSON.parse(text);
                
                if (!data.shopInfo || !data.users || !data.inventory) {
                    throw new Error("File does not appear to be a valid backup.");
                }
                
                // No need to clear, `setAppData` will overwrite everything.
                // localStorage.setItem('appData', JSON.stringify(data));
                setAppData(data);

                toast.success("Data restored successfully! The app will now reload.");
                setTimeout(() => window.location.reload(), 1500);

            } catch (error: any) {
                toast.error(`Restore failed: ${error.message}`);
                console.error("Restore error:", error);
            }
        };
        reader.onerror = () => {
            toast.error("Failed to read the backup file.");
        };
        reader.readAsText(file);
    };

    const contextValue: AppContextType = {
        shopInfo, saveShopInfo, users, currentUser, signUp, login, logout, addUser, deleteUser, updateUser,
        inventory, addProduct, updateProduct, deleteProduct, addStock, findProductByBarcode, addSampleData, importFromExcel,
        categories, addCategory, updateCategory, deleteCategory,
        sales, createSale, reverseSale, updateSale,
        customers, updateCustomer, adjustCustomerPoints, recordCustomerPayment,
        earningRules, updateEarningRules, redemptionRule, updateRedemptionRule,
        promotions, addPromotion, updatePromotion, deletePromotion,
        loyaltyTransactions, loyaltyExpirySettings, updateLoyaltyExpirySettings, customerTiers, updateCustomerTiers,
        expenses, addExpense, updateExpense, deleteExpense,
        payments,
        demandItems, addDemandItem, updateDemandItem, deleteDemandItem,
        createBackup, restoreBackup,
        loading
    };

    return <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>;
};

export const useAppContext = (): AppContextType => {
    const context = useContext(AppContext);
    if (context === undefined) {
        throw new Error('useAppContext must be used within an AppProvider');
    }
    return context;
};
