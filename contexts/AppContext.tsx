import React, { createContext, useContext, useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ShopInfo, User, UserRole, Category, Product, Sale, SaleItem, Customer, CartItem, EarningRule, RedemptionRule } from '../types';
import useLocalStorage from '../hooks/useLocalStorage';
import { SAMPLE_PRODUCTS, SAMPLE_CATEGORIES } from '../constants';
import toast from 'react-hot-toast';

// This is a simple hash function for demonstration. 
// In a real app, use a library like bcrypt.js on a server.
const simpleHash = async (password: string) => {
    // This is not secure. For demo purposes only.
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-26', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

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
    updateCustomerDetails: (customerId: string, details: Partial<Pick<Customer, 'contactNumber' | 'servicingNotes' | 'nextServiceDate' | 'serviceFrequencyValue' | 'serviceFrequencyUnit'>>) => void;

    earningRules: EarningRule[];
    updateEarningRules: (rules: EarningRule[]) => void;
    redemptionRule: RedemptionRule;
    updateRedemptionRule: (rule: RedemptionRule) => void;
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

    useEffect(() => {
        // This simulates loading data
        setTimeout(() => setLoading(false), 500);
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

        // Process inventory deductions
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
        
        // Calculate totals
        const subtotal = saleItems.reduce((acc, item) => acc + item.originalPrice * item.quantity, 0);
        const totalItemDiscounts = saleItems.reduce((acc, item) => acc + (item.originalPrice - item.price) * item.quantity, 0);
        const subtotalAfterItemDiscounts = subtotal - totalItemDiscounts;
        const overallDiscountAmount = overallDiscountType === 'fixed' ? overallDiscountValue : (subtotalAfterItemDiscounts * overallDiscountValue) / 100;
        const totalBeforeLoyalty = subtotalAfterItemDiscounts - overallDiscountAmount;

        // Loyalty Points Handling
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
            // Ensure discount doesn't exceed total
            loyaltyDiscount = Math.min(loyaltyDiscount, totalBeforeLoyalty);
        }

        const total = totalBeforeLoyalty - loyaltyDiscount;
        if (total < 0) {
            toast.error("Total amount cannot be negative.");
            return null;
        }

        const sortedEarningRules = [...earningRules].sort((a, b) => a.minSpend - b.minSpend);
        const applicableRule = sortedEarningRules.reverse().find(rule => totalBeforeLoyalty >= rule.minSpend);
        const pointsEarned = applicableRule ? Math.floor((totalBeforeLoyalty / 100) * applicableRule.pointsPerHundred) : 0;

        // Finalize sale object
        const now = new Date();
        const newSaleId = `${now.getFullYear().toString().slice(2)}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}-${customerId}`;
        let finalLoyaltyPoints = customer?.loyaltyPoints || 0;

        // Create or update customer
        if (customer) {
            customer.loyaltyPoints -= redeemedPoints;
            customer.loyaltyPoints += pointsEarned;
            finalLoyaltyPoints = customer.loyaltyPoints;
        }

        const newSale: Sale = {
            id: newSaleId, customerId, customerName: customerInfo.customerName.trim(), items: saleItems,
            subtotal, totalItemDiscounts, overallDiscount: overallDiscountValue, overallDiscountType,
            loyaltyDiscount: Math.round(loyaltyDiscount), total: Math.round(total), date: now.toISOString(),
            redeemedPoints, pointsEarned, finalLoyaltyPoints,
        };

        // Update state
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
            setCustomers(updatedCustomers);
        } else {
            const newCustomer: Customer = {
                id: customerId, name: customerInfo.customerName.trim() || `Customer ${customerId}`, saleIds: [newSale.id],
                firstSeen: now.toISOString(), lastSeen: now.toISOString(),
                contactNumber: customerInfo.contactNumber?.trim() || undefined,
                serviceFrequencyValue: customerInfo.serviceFrequencyValue,
                serviceFrequencyUnit: customerInfo.serviceFrequencyValue ? customerInfo.serviceFrequencyUnit : undefined,
                loyaltyPoints: pointsEarned,
            };
            setCustomers([newCustomer, ...customers]);
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

        // 1. Update inventory
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

        // 2. Update the sale record
        const itemsToReturnProductIds = new Set(itemsToReturn.map(item => item.productId));
        const remainingItems = saleToModify.items.filter(item => !itemsToReturnProductIds.has(item.productId));

        const updatedSales = [...sales];

        if (remainingItems.length === 0) {
            // All items were returned, so delete the sale
            updatedSales.splice(saleIndex, 1);
            
            // Also remove saleId from the customer's profile
            const customerId = saleToModify.customerId;
            setCustomers(prevCustomers => prevCustomers.map(c => 
                c.id === customerId 
                ? { ...c, saleIds: c.saleIds.filter(id => id !== saleId) }
                : c
            ));
            
            // Revert loyalty points
            if (saleToModify.pointsEarned || saleToModify.redeemedPoints) {
                 setCustomers(prevCustomers => prevCustomers.map(c => {
                    if (c.id === customerId) {
                        let newPoints = c.loyaltyPoints;
                        newPoints -= (saleToModify.pointsEarned || 0);
                        newPoints += (saleToModify.redeemedPoints || 0);
                        return { ...c, loyaltyPoints: Math.max(0, newPoints) };
                    }
                    return c;
                 }));
            }


            toast.success("Sale completely reversed. All items returned to inventory.");
        } else {
            // Some items remain, so update the sale. NOTE: Loyalty point reversal on partial returns is complex and not implemented.
            // A simple approach would be to inform the user.
            if (saleToModify.pointsEarned || saleToModify.redeemedPoints) {
                toast("Partial reversal complete. Loyalty points were not adjusted for this transaction.", { icon: 'ℹ️' });
            }
            
            const newSubtotal = remainingItems.reduce((acc, item) => acc + (item.originalPrice * item.quantity), 0);
            const newItemDiscounts = remainingItems.reduce((acc, item) => acc + (item.originalPrice - item.price) * item.quantity, 0);
            const newSubtotalAfterItemDiscounts = newSubtotal - newItemDiscounts;
            const overallDiscountAmount = saleToModify.overallDiscountType === 'fixed' ? saleToModify.overallDiscount : (newSubtotalAfterItemDiscounts * saleToModify.overallDiscount) / 100;
            const newTotal = newSubtotalAfterItemDiscounts - overallDiscountAmount;

            const updatedSale: Sale = { 
                ...saleToModify, items: remainingItems, subtotal: Math.round(newSubtotal),
                totalItemDiscounts: Math.round(newItemDiscounts), total: Math.round(newTotal) 
            };
            updatedSales[saleIndex] = updatedSale;
            toast.success(`${returnedItemsCount} item(s) returned to inventory. Sale record updated.`);
        }

        setSales(updatedSales);
    };


    const updateCustomerDetails = (customerId: string, details: Partial<Pick<Customer, 'contactNumber' | 'servicingNotes' | 'nextServiceDate' | 'serviceFrequencyValue' | 'serviceFrequencyUnit'>>) => {
        setCustomers(prevCustomers => {
            const updatedCustomers = prevCustomers.map(c => {
                if (c.id === customerId) {
                    return { ...c, ...details };
                }
                return c;
            });
            toast.success("Customer details updated.");
            return updatedCustomers;
        });
    };

    const updateEarningRules = (rules: EarningRule[]) => {
        setEarningRules(rules);
        toast.success("Earning rules updated.");
    };

    const updateRedemptionRule = (rule: RedemptionRule) => {
        setRedemptionRule(rule);
        toast.success("Redemption rule updated.");
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
        categories,
        addCategory,
        updateCategory,
        deleteCategory,
        sales,
        createSale,
        reverseSale,
        customers,
        updateCustomerDetails,
        earningRules,
        updateEarningRules,
        redemptionRule,
        updateRedemptionRule,
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