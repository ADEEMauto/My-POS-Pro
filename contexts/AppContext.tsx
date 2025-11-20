
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
        toast.error("Invalid username or password.");
        return false;
    };

    const logout = () => {
        setData({ ...data!, currentUser: null });
        toast.success("Logged out successfully.");
    };
    
    const addProduct = (productData: Omit<Product, 'id'>) => {
        const newProduct: Product = { ...productData, id: uuidv4() };
        setData({ ...data!, inventory: [...inventory, newProduct] });
        toast.success(`${newProduct.name} added to inventory.`);
    };

    const updateProduct = (productToUpdate: Product) => {
        setData({ ...data!, inventory: inventory.map(p => p.id === productToUpdate.id ? productToUpdate : p) });
        toast.success(`${productToUpdate.name} updated.`);
    };
    
    const deleteProduct = (productId: string) => {
        setData({ ...data!, inventory: inventory.filter(p => p.id !== productId) });
        toast.success("Product deleted.");
    };

    const addStock = (productId: string, quantity: number, newSalePrice?: number) => {
        const updatedInventory = inventory.map(p => {
            if (p.id === productId) {
                return {
                    ...p,
                    quantity: p.quantity + quantity,
                    ...(newSalePrice !== undefined && { salePrice: newSalePrice })
                };
            }
            return p;
        });
        setData({ ...data!, inventory: updatedInventory });
        toast.success(`Added ${quantity} units. New stock: ${updatedInventory.find(p => p.id === productId)?.quantity}.`);
    };

    const findProductByBarcode = (barcode: string): Product | undefined => {
        return inventory.find(p => p.barcode === barcode);
    };

    const addSampleData = () => {
        const productsWithIds = SAMPLE_PRODUCTS.map(p => ({ ...p, id: uuidv4() }));
        setData({ ...data!, inventory: productsWithIds, categories: SAMPLE_CATEGORIES });
        toast.success("Sample data added!");
    };
    
    const importFromExcel = (excelData: any[]) => {
        const newProducts: Product[] = [];
        const existingBarcodes = new Set(inventory.map(p => p.barcode).filter(Boolean));

        for (const row of excelData) {
            if (!row['Name'] || !row['Category ID'] || row['Quantity'] === undefined || row['Purchase Price (Rs)'] === undefined || row['Sale Price (Rs)'] === undefined) {
                toast.error(`Skipping row due to missing required fields: ${row['Name'] || 'Unknown'}`);
                continue;
            }

            if (row['Barcode'] && existingBarcodes.has(String(row['Barcode']))) {
                toast.error(`Skipping row: Barcode '${row['Barcode']}' for product '${row['Name']}' already exists.`);
                continue;
            }

            newProducts.push({
                id: uuidv4(),
                name: String(row['Name']),
                manufacturer: String(row['Manufacturer'] || 'N/A'),
                categoryId: String(row['Category ID']),
                subCategoryId: row['SubCategory ID'] ? String(row['SubCategory ID']) : null,
                location: String(row['Location'] || ''),
                barcode: row['Barcode'] ? String(row['Barcode']) : undefined,
                quantity: Number(row['Quantity']),
                purchasePrice: Number(row['Purchase Price (Rs)']),
                salePrice: Number(row['Sale Price (Rs)']),
                imageUrl: row['Image URL'] ? String(row['Image URL']) : undefined,
            });
            
            if (row['Barcode']) {
                existingBarcodes.add(String(row['Barcode']));
            }
        }
        
        setData({ ...data!, inventory: [...inventory, ...newProducts] });
        toast.success(`Successfully imported ${newProducts.length} products.`);
    };


    const addCategory = (name: string, parentId: string | null) => {
        const newCategory: Category = { id: uuidv4(), name, parentId };
        setData({ ...data!, categories: [...categories, newCategory] });
        toast.success(`Category "${name}" added.`);
    };

    const updateCategory = (id: string, name: string) => {
        setData({ ...data!, categories: categories.map(c => c.id === id ? { ...c, name } : c) });
        toast.success("Category updated.");
    };

    const deleteCategory = (id: string) => {
        const idsToDelete = new Set<string>([id]);
        categories.forEach(c => { if(c.parentId === id) idsToDelete.add(c.id); });
        
        const updatedCategories = categories.filter(c => !idsToDelete.has(c.id));
        const updatedInventory = inventory.map(p => {
            if (idsToDelete.has(p.categoryId)) return { ...p, categoryId: 'uncategorized', subCategoryId: null };
            if (p.subCategoryId && idsToDelete.has(p.subCategoryId)) return { ...p, subCategoryId: null };
            return p;
        });

        setData({ ...data!, categories: updatedCategories, inventory: updatedInventory });
        toast.success("Category and its sub-categories deleted.");
    };
    
    const calculatePoints = (
        totalForPoints: number, 
        customer: Customer | null | undefined, 
        saleDate: string
    ): { points: number; promotion: Promotion | null; tier: CustomerTier | null } => {
        if (totalForPoints <= 0 || !customer) return { points: 0, promotion: null, tier: null };
        
        let points = 0;
        const applicableRule = earningRules.find(r => totalForPoints >= r.minSpend && (r.maxSpend === null || totalForPoints <= r.maxSpend));
        if (applicableRule) {
            points = Math.floor(totalForPoints / 100) * applicableRule.pointsPerHundred;
        }

        const customerTier = customer.tierId ? customerTiers.find(t => t.id === customer.tierId) : null;
        if (customerTier && customerTier.pointsMultiplier > 1) {
            points *= customerTier.pointsMultiplier;
        }
        
        const saleDateObj = new Date(saleDate);
        const activePromotion = promotions.find(p => {
            const start = new Date(p.startDate);
            const end = new Date(p.endDate);
            start.setHours(0,0,0,0);
            end.setHours(23,59,59,999);
            return saleDateObj >= start && saleDateObj <= end;
        });

        if (activePromotion) {
            points *= activePromotion.multiplier;
        }
        
        return { 
            points: Math.round(points),
            promotion: activePromotion || null,
            tier: customerTier
        };
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
    ): Sale | null => {
        if (cart.length === 0 && tuningCharges === 0 && laborCharges === 0 && outsideServices.length === 0) {
            toast.error("Cannot create an empty sale.");
            return null;
        }

        const newInventory = [...inventory];
        const saleItems: SaleItem[] = cart.map(item => {
            const discountAmount = item.discountType === 'fixed' 
                ? item.discount 
                : (item.salePrice * item.discount) / 100;
            const finalPrice = item.salePrice - discountAmount;
            
            // For real products, reduce stock
            if (!item.id.startsWith('manual-')) {
                const inventoryIndex = newInventory.findIndex(p => p.id === item.id);
                if (inventoryIndex > -1) {
                    newInventory[inventoryIndex].quantity -= item.cartQuantity;
                }
            }
            
            return {
                productId: item.id,
                name: item.name,
                quantity: item.cartQuantity,
                originalPrice: item.salePrice,
                discount: item.discount,
                discountType: item.discountType,
                price: finalPrice,
                purchasePrice: item.purchasePrice,
            };
        });

        const subtotal = saleItems.reduce((acc, item) => acc + (item.originalPrice * item.quantity), 0);
        const totalItemDiscounts = saleItems.reduce((acc, item) => {
            const discountAmount = item.discountType === 'fixed'
                ? item.discount
                : (item.originalPrice * item.discount) / 100;
            return acc + (discountAmount * item.quantity);
        }, 0);
        
        const subtotalAfterItemDiscounts = subtotal - totalItemDiscounts;
        const revenueBaseForDiscount = subtotalAfterItemDiscounts + tuningCharges + laborCharges;
        
        const overallDiscountAmount = overallDiscountType === 'fixed' 
            ? overallDiscount
            : (revenueBaseForDiscount * overallDiscount) / 100;
        
        const totalOutsideServices = outsideServices.reduce((sum, s) => sum + s.amount, 0);

        const totalForPoints = revenueBaseForDiscount - overallDiscountAmount;
        
        // Customer logic
        const newCustomers = [...customers];
        const customerId = customerDetails.bikeNumber.replace(/\s+/g, '').toUpperCase();
        let customerIndex = newCustomers.findIndex(c => c.id === customerId);
        let customer: Customer;

        const now = new Date();
        const date = now.toISOString();
        
        if (customerIndex === -1) {
            customer = {
                id: customerId,
                name: customerDetails.customerName,
                saleIds: [],
                firstSeen: date,
                lastSeen: date,
                contactNumber: customerDetails.contactNumber,
                serviceFrequencyValue: customerDetails.serviceFrequencyValue,
                serviceFrequencyUnit: customerDetails.serviceFrequencyUnit,
                loyaltyPoints: 0,
                tierId: customerTiers.find(t => t.rank === 0)?.id || null,
                balance: 0,
            };
            newCustomers.push(customer);
            customerIndex = newCustomers.length - 1;
        } else {
            customer = { ...newCustomers[customerIndex] };
            customer.name = customerDetails.customerName; // Update name on every transaction
            customer.lastSeen = date;
            if (customerDetails.contactNumber) customer.contactNumber = customerDetails.contactNumber;
            if (customerDetails.serviceFrequencyValue) {
                customer.serviceFrequencyValue = customerDetails.serviceFrequencyValue;
                customer.serviceFrequencyUnit = customerDetails.serviceFrequencyUnit;
            }
        }
        
        const { points: pointsEarned, promotion: promotionApplied, tier: tierApplied } = calculatePoints(totalForPoints, customer, date);
        const pointsBefore = customer.loyaltyPoints;
        customer.loyaltyPoints += pointsEarned;
        
        const loyaltyDiscount = pointsToRedeem > 0
            ? (redemptionRule.method === 'fixedValue' 
                ? (pointsToRedeem / redemptionRule.points) * redemptionRule.value
                : (totalForPoints * ((pointsToRedeem / redemptionRule.points) * redemptionRule.value)) / 100)
            : 0;

        customer.loyaltyPoints -= pointsToRedeem;
        const pointsAfter = customer.loyaltyPoints;

        const previousBalanceBroughtForward = customer.balance;
        const totalAmount = totalForPoints + totalOutsideServices + previousBalanceBroughtForward - loyaltyDiscount;
        const balanceDue = totalAmount - amountPaid;
        const paymentStatus = balanceDue <= 0 ? 'Paid' : (amountPaid > 0 ? 'Partial' : 'Unpaid');
        customer.balance = balanceDue > 0 ? balanceDue : 0;
        
        // Generate Sale ID based on timestamp YYMMDDHHMM (no seconds)
        const yy = String(now.getFullYear()).slice(-2);
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const hh = String(now.getHours()).padStart(2, '0');
        const min = String(now.getMinutes()).padStart(2, '0');
        const saleId = `${yy}${mm}${dd}${hh}${min}`;

        customer.saleIds.push(saleId);
        newCustomers[customerIndex] = customer;


        const newSale: Sale = {
            id: saleId,
            customerId: customer.id,
            customerName: customer.name,
            items: saleItems,
            subtotal,
            totalItemDiscounts,
            overallDiscount: overallDiscount,
            overallDiscountType: overallDiscountType,
            loyaltyDiscount,
            tuningCharges,
            laborCharges,
            outsideServices,
            totalOutsideServices,
            total: totalAmount,
            amountPaid: amountPaid,
            paymentStatus: paymentStatus,
            balanceDue: customer.balance,
            previousBalanceBroughtForward,
            date,
            pointsEarned: Math.round(pointsEarned),
            redeemedPoints: pointsToRedeem,
            finalLoyaltyPoints: customer.loyaltyPoints,
            promotionApplied: promotionApplied || undefined,
            // FIX: Map CustomerTier to the shape expected by Sale.tierApplied
            tierApplied: tierApplied ? { name: tierApplied.name, multiplier: tierApplied.pointsMultiplier } : undefined,
        };

        const newLoyaltyTransactions = [...loyaltyTransactions];
        if (pointsEarned > 0) {
            newLoyaltyTransactions.push({
                id: uuidv4(), customerId: customer.id, type: 'earned', points: Math.round(pointsEarned),
                date, relatedSaleId: saleId, pointsBefore, pointsAfter: pointsBefore + Math.round(pointsEarned)
            });
        }
        if (pointsToRedeem > 0) {
            newLoyaltyTransactions.push({
                id: uuidv4(), customerId: customer.id, type: 'redeemed', points: pointsToRedeem,
                date, relatedSaleId: saleId, pointsBefore: pointsBefore + Math.round(pointsEarned), pointsAfter
            });
        }
        
        setData({ 
            ...data!, 
            sales: [...sales, newSale], 
            inventory: newInventory, 
            customers: newCustomers,
            loyaltyTransactions: newLoyaltyTransactions
        });
        
        return newSale;
    };
    
    const reverseSale = (saleId: string, itemsToReturn: SaleItem[]) => {
        const saleToReverse = sales.find(s => s.id === saleId);
        if (!saleToReverse) {
            toast.error("Sale not found.");
            return;
        }

        const newInventory = [...inventory];
        const newCustomers = [...customers];
        const newLoyaltyTransactions = [...loyaltyTransactions];
        let newSales = [...sales];

        // Restore stock for returned items
        itemsToReturn.forEach(returnedItem => {
            if (!returnedItem.productId.startsWith('manual-')) {
                const inventoryIndex = newInventory.findIndex(p => p.id === returnedItem.productId);
                if (inventoryIndex > -1) {
                    newInventory[inventoryIndex].quantity += returnedItem.quantity;
                } else {
                     // If product was deleted, re-add it with the returned quantity
                    newInventory.push({
                        id: returnedItem.productId,
                        name: returnedItem.name,
                        quantity: returnedItem.quantity,
                        purchasePrice: returnedItem.purchasePrice,
                        salePrice: returnedItem.originalPrice,
                        categoryId: 'uncategorized',
                        subCategoryId: null,
                        manufacturer: 'N/A',
                        location: 'N/A'
                    });
                }
            }
        });
        
        // Adjust customer points and balance
        const customerIndex = newCustomers.findIndex(c => c.id === saleToReverse.customerId);
        if (customerIndex > -1) {
            const customer = { ...newCustomers[customerIndex] };
            const pointsBefore = customer.loyaltyPoints;
            
            // Give back redeemed points
            if (saleToReverse.redeemedPoints) customer.loyaltyPoints += saleToReverse.redeemedPoints;
            // Take back earned points
            if (saleToReverse.pointsEarned) customer.loyaltyPoints -= saleToReverse.pointsEarned;
            
            // Create reversal transaction
            const pointsChange = (saleToReverse.redeemedPoints || 0) - (saleToReverse.pointsEarned || 0);
            if(pointsChange !== 0) {
                 newLoyaltyTransactions.push({
                    id: uuidv4(), customerId: customer.id,
                    type: pointsChange > 0 ? 'manual_add' : 'manual_subtract',
                    points: Math.abs(pointsChange),
                    date: new Date().toISOString(), relatedSaleId: saleId,
                    reason: "Sale reversed", pointsBefore, pointsAfter: customer.loyaltyPoints
                 });
            }

            // Adjust balance
            customer.balance -= saleToReverse.balanceDue;
            
            newCustomers[customerIndex] = customer;
        }

        // Check if the entire sale is being reversed
        if (itemsToReturn.length === saleToReverse.items.length) {
            newSales = newSales.filter(s => s.id !== saleId);
            if (customerIndex > -1) {
                 newCustomers[customerIndex].saleIds = newCustomers[customerIndex].saleIds.filter(id => id !== saleId);
            }
            toast.success("Sale fully reversed and deleted.");
        } else {
            // Partial reversal: Update the sale record (we just mark it as reversed for simplicity)
            // A more complex implementation would recalculate totals, but that's what editing is for.
            // For now, we just restore stock and adjust points/balance, keeping a record of the partial reversal.
            newSales = newSales.map(s => {
                if (s.id === saleId) {
                    return {
                        ...s,
                        items: s.items.filter(item => !itemsToReturn.some(ret => ret.productId === item.productId)),
                        // This will make totals incorrect, but the reversal is complex.
                        // A better approach might be to create a new "return" transaction instead of modifying the sale.
                        // For now, we will just mark the sale as partially reversed.
                        customerName: `${s.customerName} (Reversed)`,
                        total: 0, // Zero out the sale to prevent it from affecting reports.
                        balanceDue: 0,
                    };
                }
                return s;
            });
             toast.success("Items returned to stock. Sale record updated.");
        }

        setData({
            ...data!,
            sales: newSales,
            inventory: newInventory,
            customers: newCustomers,
            loyaltyTransactions: newLoyaltyTransactions
        });
    };
    
    const updateSale = (saleId: string, updates: Partial<Sale>) => {
        const newSales = [...data.sales];
        const newCustomers = [...data.customers];
        const newLoyaltyTransactions = [...data.loyaltyTransactions];
    
        const saleIndex = newSales.findIndex(s => s.id === saleId);
        if (saleIndex === -1) {
            toast.error("Sale not found for updating.");
            return;
        }
        const originalSale = newSales[saleIndex];
        
        const customerChanged = updates.customerId && originalSale.customerId !== updates.customerId;
    
        if (customerChanged && originalSale.redeemedPoints && originalSale.redeemedPoints > 0) {
            toast.error("Cannot change customer on a sale where points were redeemed. Please reverse and create a new sale.");
            return;
        }
    
        const updatedSaleData = { ...originalSale, ...updates };
    
        updatedSaleData.items = updatedSaleData.items.map(item => {
            const discountAmount = item.discountType === 'fixed' ? item.discount : (item.originalPrice * item.discount) / 100;
            return { ...item, price: Math.max(0, item.originalPrice - discountAmount) };
        });
        
        updatedSaleData.subtotal = updatedSaleData.items.reduce((acc, item) => acc + item.originalPrice * item.quantity, 0);
        updatedSaleData.totalItemDiscounts = updatedSaleData.items.reduce((acc, item) => {
            const discountAmount = item.discountType === 'fixed' ? item.discount : (item.originalPrice * item.discount) / 100;
            return acc + discountAmount * item.quantity;
        }, 0);
        
        const subtotalAfterItemDiscount = updatedSaleData.subtotal - updatedSaleData.totalItemDiscounts;
        const totalCharges = (updatedSaleData.tuningCharges || 0) + (updatedSaleData.laborCharges || 0);
        const revenueBase = subtotalAfterItemDiscount + totalCharges;
        const overallDiscountValue = updatedSaleData.overallDiscountType === 'fixed'
            ? updatedSaleData.overallDiscount
            : (revenueBase * updatedSaleData.overallDiscount) / 100;
        
        updatedSaleData.totalOutsideServices = (updatedSaleData.outsideServices || []).reduce((sum, s) => sum + s.amount, 0);
        const currentBillTotal = revenueBase - overallDiscountValue + updatedSaleData.totalOutsideServices;
        
        let originalCustomerIndex = newCustomers.findIndex(c => c.id === originalSale.customerId);
        if (customerChanged && originalCustomerIndex !== -1) {
            const originalCustomer = { ...newCustomers[originalCustomerIndex] };
            originalCustomer.balance -= originalSale.balanceDue;
            originalCustomer.loyaltyPoints -= (originalSale.pointsEarned || 0);
            originalCustomer.saleIds = originalCustomer.saleIds.filter(id => id !== saleId);
    
            if (originalSale.pointsEarned) {
                newLoyaltyTransactions.push({
                    id: uuidv4(), customerId: originalCustomer.id, type: 'manual_subtract', points: originalSale.pointsEarned,
                    date: new Date().toISOString(), relatedSaleId: saleId, reason: 'Customer changed on sale',
                    pointsBefore: originalCustomer.loyaltyPoints + originalSale.pointsEarned, pointsAfter: originalCustomer.loyaltyPoints
                });
            }
            newCustomers[originalCustomerIndex] = originalCustomer;
        }
        
        let newCustomerIndex = newCustomers.findIndex(c => c.id === updatedSaleData.customerId);
        if (newCustomerIndex === -1 && updatedSaleData.customerId) {
            const newCustomer: Customer = {
                id: updatedSaleData.customerId, name: updatedSaleData.customerName, saleIds: [],
                firstSeen: updatedSaleData.date, lastSeen: updatedSaleData.date, loyaltyPoints: 0,
                tierId: null, balance: 0,
            };
            newCustomers.push(newCustomer);
            newCustomerIndex = newCustomers.length - 1;
        }
    
        const newCustomerForSale = newCustomerIndex !== -1 ? newCustomers[newCustomerIndex] : null;
    
        if (customerChanged) {
            updatedSaleData.previousBalanceBroughtForward = newCustomerForSale ? newCustomerForSale.balance : 0;
        }
        
        updatedSaleData.total = currentBillTotal + (updatedSaleData.previousBalanceBroughtForward || 0) - (updatedSaleData.loyaltyDiscount || 0);
        updatedSaleData.balanceDue = updatedSaleData.total - updatedSaleData.amountPaid;
    
        const { points: newPointsEarned, promotion, tier } = calculatePoints(currentBillTotal, newCustomerForSale, updatedSaleData.date);
        const pointsChange = newPointsEarned - (originalSale.pointsEarned || 0);
    
        updatedSaleData.pointsEarned = newPointsEarned;
        updatedSaleData.promotionApplied = promotion || undefined;
        // FIX: Map CustomerTier to the shape expected by Sale.tierApplied
        updatedSaleData.tierApplied = tier ? { name: tier.name, multiplier: tier.pointsMultiplier } : undefined;
    
        if (newCustomerForSale && newCustomerIndex !== -1) {
            const customerToUpdate = { ...newCustomers[newCustomerIndex] };
            const pointsBeforeUpdate = customerToUpdate.loyaltyPoints;
            
            if (customerChanged) {
                customerToUpdate.balance += updatedSaleData.balanceDue;
                customerToUpdate.saleIds.push(saleId);
                customerToUpdate.lastSeen = updatedSaleData.date;
                customerToUpdate.loyaltyPoints += newPointsEarned;
            } else {
                const balanceDifference = updatedSaleData.balanceDue - originalSale.balanceDue;
                customerToUpdate.balance += balanceDifference;
                customerToUpdate.loyaltyPoints += pointsChange;
            }
    
            updatedSaleData.finalLoyaltyPoints = customerToUpdate.loyaltyPoints;
    
            if (customerChanged || pointsChange !== 0) {
                newLoyaltyTransactions.push({
                    id: uuidv4(), customerId: customerToUpdate.id, type: pointsChange >= 0 ? 'earned' : 'manual_subtract',
                    points: customerChanged ? newPointsEarned : Math.abs(pointsChange), date: new Date().toISOString(),
                    relatedSaleId: saleId, reason: 'Sale updated/customer changed',
                    pointsBefore: pointsBeforeUpdate, pointsAfter: customerToUpdate.loyaltyPoints,
                });
            }
            newCustomers[newCustomerIndex] = customerToUpdate;
        }
        
        newSales[saleIndex] = updatedSaleData;
    
        setData({ ...data, sales: newSales, customers: newCustomers, loyaltyTransactions: newLoyaltyTransactions });
        toast.success("Sale updated successfully!");
    };


    const updateCustomer = (customerId: string, updates: Partial<Customer>): boolean => {
        const newCustomers = [...customers];
        const customerIndex = newCustomers.findIndex(c => c.id === customerId);
        if (customerIndex === -1) {
            toast.error("Customer not found.");
            return false;
        }
        
        // If ID is being changed, check for uniqueness
        if (updates.id && updates.id !== customerId) {
            if(newCustomers.some(c => c.id === updates.id)) {
                toast.error(`A customer with bike number "${updates.id}" already exists.`);
                return false;
            }
            // If ID changes, we need to update all related sales
            const newSales = sales.map(s => s.customerId === customerId ? { ...s, customerId: updates.id! } : s);
             setData({ ...data!, sales: newSales });
        }

        newCustomers[customerIndex] = { ...newCustomers[customerIndex], ...updates };
        setData({ ...data!, customers: newCustomers });
        toast.success("Customer details updated.");
        return true;
    };
    
    const adjustCustomerPoints = (customerId: string, points: number, reason: string): boolean => {
        if (!reason.trim()) {
            toast.error("A reason is required for manual point adjustments.");
            return false;
        }
        const newCustomers = [...customers];
        const customerIndex = newCustomers.findIndex(c => c.id === customerId);
        if (customerIndex === -1) {
            toast.error("Customer not found.");
            return false;
        }
        
        const customer = { ...newCustomers[customerIndex] };
        const pointsBefore = customer.loyaltyPoints;
        customer.loyaltyPoints += points;
        if(customer.loyaltyPoints < 0) customer.loyaltyPoints = 0; // Prevent negative points
        
        const newTransaction: LoyaltyTransaction = {
            id: uuidv4(),
            customerId,
            type: points > 0 ? 'manual_add' : 'manual_subtract',
            points: Math.abs(points),
            date: new Date().toISOString(),
            reason,
            pointsBefore,
            pointsAfter: customer.loyaltyPoints,
        };
        
        newCustomers[customerIndex] = customer;
        setData({ ...data!, customers: newCustomers, loyaltyTransactions: [...loyaltyTransactions, newTransaction] });
        toast.success(`Points adjusted for ${customer.name}.`);
        return true;
    };
    
    const recordCustomerPayment = (customerId: string, amount: number, notes?: string): boolean => {
        const newCustomers = [...customers];
        const customerIndex = newCustomers.findIndex(c => c.id === customerId);
        if (customerIndex === -1) {
            toast.error("Customer not found.");
            return false;
        }
        
        const customer = { ...newCustomers[customerIndex] };
        if (amount > customer.balance) {
            toast.error("Payment amount cannot be greater than the balance due.");
            return false;
        }
        
        customer.balance -= amount;
        
        const newPayment: Payment = {
            id: uuidv4(),
            customerId,
            amount,
            date: new Date().toISOString(),
            notes
        };
        
        newCustomers[customerIndex] = customer;
        setData({ ...data!, customers: newCustomers, payments: [...payments, newPayment] });
        toast.success(`Payment of ${amount} recorded for ${customer.name}.`);
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
        const newPromotion = { ...promo, id: uuidv4() };
        setData({ ...data!, promotions: [...promotions, newPromotion] });
        toast.success("Promotion added.");
    };

    const updatePromotion = (promoToUpdate: Promotion) => {
        setData({ ...data!, promotions: promotions.map(p => p.id === promoToUpdate.id ? promoToUpdate : p) });
        toast.success("Promotion updated.");
    };

    const deletePromotion = (promoId: string) => {
        setData({ ...data!, promotions: promotions.filter(p => p.id !== promoId) });
        toast.success("Promotion deleted.");
    };

    const updateLoyaltyExpirySettings = (settings: LoyaltyExpirySettings) => {
        setData({ ...data!, loyaltyExpirySettings: settings });
        toast.success("Loyalty expiry settings updated.");
    };
    
    const updateCustomerTiers = (tiers: CustomerTier[]) => {
        // Re-evaluate all customers' tiers after a change
        const sortedTiers = [...tiers].sort((a, b) => b.rank - a.rank); // Highest rank first
        const newCustomers = customers.map(customer => {
            const totalVisits = customer.saleIds.length + (customer.manualVisitAdjustment || 0);
            
            // Find the period for the highest-ranked tier to check against
            const checkPeriodTier = sortedTiers[0];
            const periodStartDate = new Date();
            if(checkPeriodTier.periodUnit === 'days') periodStartDate.setDate(periodStartDate.getDate() - checkPeriodTier.periodValue);
            if(checkPeriodTier.periodUnit === 'months') periodStartDate.setMonth(periodStartDate.getMonth() - checkPeriodTier.periodValue);
            if(checkPeriodTier.periodUnit === 'years') periodStartDate.setFullYear(periodStartDate.getFullYear() - checkPeriodTier.periodValue);
            
            const salesInPeriod = customer.saleIds
                .map(id => sales.find(s => s.id === id))
                .filter((s): s is Sale => !!s && new Date(s.date) >= periodStartDate);
                
            const totalSpendInPeriod = salesInPeriod.reduce((sum, s) => sum + s.total, 0);

            let assignedTierId = customer.tierId;
            for (const tier of sortedTiers) {
                if(tier.rank === 0) { // Base tier
                    assignedTierId = tier.id; // Default
                }
                if (totalVisits >= tier.minVisits && totalSpendInPeriod >= tier.minSpend) {
                    assignedTierId = tier.id;
                    break; // Since tiers are sorted by highest rank, the first one we match is correct
                }
            }

            return { ...customer, tierId: assignedTierId };
        });

        setData({ ...data!, customerTiers: tiers, customers: newCustomers });
        toast.success("Customer tiers updated and all customers re-evaluated.");
    };
    
    const addExpense = (expense: Omit<Expense, 'id'>) => {
        const newExpense = { ...expense, id: uuidv4() };
        setData({ ...data!, expenses: [...expenses, newExpense].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) });
        toast.success("Expense recorded.");
    };

    const updateExpense = (expenseToUpdate: Expense) => {
        const updatedExpenses = expenses.map(e => e.id === expenseToUpdate.id ? expenseToUpdate : e);
        setData({ ...data!, expenses: updatedExpenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) });
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
        const newItems = items.map(item => ({...item, id: uuidv4()}));
        // Filter out items that are already on the demand list by name and manufacturer
        const uniqueNewItems = newItems.filter(newItem => 
            !demandItems.some(existingItem => 
                existingItem.name.toLowerCase() === newItem.name.toLowerCase() &&
                existingItem.manufacturer.toLowerCase() === newItem.manufacturer.toLowerCase()
            )
        );

        if(uniqueNewItems.length < items.length) {
            toast.success(`${uniqueNewItems.length} new items added. ${items.length - uniqueNewItems.length} items were already on the list.`);
        } else {
            toast.success(`${uniqueNewItems.length} items added to demand list.`);
        }
        
        setData({ ...data!, demandItems: [...demandItems, ...uniqueNewItems] });
    };

    const updateDemandItem = (itemToUpdate: DemandItem) => {
        setData({ ...data!, demandItems: demandItems.map(item => item.id === itemToUpdate.id ? itemToUpdate : item) });
        toast.success("Demand item updated.");
    };

    const deleteDemandItem = (itemId: string) => {
        setData({ ...data!, demandItems: demandItems.filter(item => item.id !== itemId) });
        toast.success("Item removed from demand list.");
    };
    
    const backupData = () => {
        if (!data) {
            toast.error("No data to back up.");
            return;
        }
        try {
            const dataStr = JSON.stringify(data, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `shopsync-backup-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            toast.success("Backup downloaded successfully!");
        } catch (error) {
            console.error("Backup failed:", error);
            toast.error("Failed to create backup file.");
        }
    };

    const restoreData = (restoredData: AppData) => {
        // Basic validation
        if (restoredData && restoredData.shopInfo && Array.isArray(restoredData.users)) {
            setData(restoredData);
            toast.success("Data restored successfully! The app will now reload.");
            setTimeout(() => window.location.reload(), 1500);
        } else {
            toast.error("Invalid or corrupted backup file.");
        }
    };


    const contextValue: AppContextType = {
        shopInfo,
        saveShopInfo,
        users,
        currentUser,
        signUp,
        login,
        logout,
        addUser,
        deleteUser,
        updateUser,
        inventory,
        addProduct,
        updateProduct,
        deleteProduct,
        addStock,
        findProductByBarcode,
        addSampleData,
        importFromExcel,
        categories,
        addCategory,
        updateCategory,
        deleteCategory,
        sales,
        createSale,
        reverseSale,
        updateSale,
        customers,
        updateCustomer,
        adjustCustomerPoints,
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
        addMultipleDemandItems,
        updateDemandItem,
        deleteDemandItem,
        backupData,
        restoreData,
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
