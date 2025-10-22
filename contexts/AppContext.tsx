
import React, { createContext, useContext, useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ShopInfo, User, UserRole, Category, Product, Sale, SaleItem, Customer, CartItem } from '../types';
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
    createSale: (cartItems: CartItem[], overallDiscountValue: number, overallDiscountType: 'fixed' | 'percentage', customerInfo: { customerName: string, bikeNumber: string, contactNumber?: string, serviceFrequencyValue?: number, serviceFrequencyUnit?: 'days' | 'months' | 'years' }) => Sale | null;
    reverseSale: (saleId: string, itemsToReturn: SaleItem[]) => void;

    customers: Customer[];
    updateCustomerDetails: (customerId: string, details: Partial<Pick<Customer, 'contactNumber' | 'servicingNotes' | 'nextServiceDate' | 'serviceFrequencyValue' | 'serviceFrequencyUnit'>>) => void;
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

    const createSale = (cartItems: CartItem[], overallDiscountValue: number, overallDiscountType: 'fixed' | 'percentage', customerInfo: { customerName: string, bikeNumber: string, contactNumber?: string, serviceFrequencyValue?: number, serviceFrequencyUnit?: 'days' | 'months' | 'years' }): Sale | null => {
        if (cartItems.length === 0) {
            toast.error("Cart is empty.");
            return null;
        }
    
        const saleItems: SaleItem[] = [];
        const updatedInventory = [...inventory];
    
        for (const item of cartItems) {
            const productInStock = updatedInventory.find(p => p.id === item.id);
            if (!productInStock || productInStock.quantity < item.cartQuantity) {
                toast.error(`Not enough stock for ${item.name}.`);
                return null;
            }
            productInStock.quantity -= item.cartQuantity;
    
            const discountAmount = item.discountType === 'fixed' 
                ? item.discount 
                : (item.salePrice * item.discount) / 100;

            saleItems.push({
                productId: item.id,
                name: item.name,
                quantity: item.cartQuantity,
                originalPrice: item.salePrice,
                discount: item.discount,
                discountType: item.discountType,
                price: item.salePrice - discountAmount,
                purchasePrice: item.purchasePrice,
            });
        }
    
        const subtotal = saleItems.reduce((acc, item) => acc + item.originalPrice * item.quantity, 0);
        const totalItemDiscounts = saleItems.reduce((acc, item) => {
            const discountAmount = item.discountType === 'fixed'
                ? item.discount
                : (item.originalPrice * item.discount) / 100;
            return acc + (discountAmount * item.quantity);
        }, 0);

        const subtotalAfterItemDiscounts = subtotal - totalItemDiscounts;

        const overallDiscountAmount = overallDiscountType === 'fixed'
            ? overallDiscountValue
            : (subtotalAfterItemDiscounts * overallDiscountValue) / 100;

        const total = subtotalAfterItemDiscounts - overallDiscountAmount;
    
        if (total < 0) {
            toast.error("Total amount cannot be negative after discounts.");
            return null;
        }
    
        const now = new Date();
        const year = now.getFullYear();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const day = now.getDate().toString().padStart(2, '0');
        const customerId = customerInfo.bikeNumber.replace(/\s+/g, '').toUpperCase();
        const newSaleId = `${year}${month}${day}${customerId}`;
    
        const newSale: Sale = {
            id: newSaleId,
            customerId: customerId,
            customerName: customerInfo.customerName.trim(),
            items: saleItems,
            subtotal: Math.round(subtotal),
            totalItemDiscounts: Math.round(totalItemDiscounts),
            overallDiscount: overallDiscountValue,
            overallDiscountType: overallDiscountType,
            total: Math.round(total),
            date: now.toISOString(),
        };
    
        setInventory(updatedInventory);
        setSales([newSale, ...sales]);
    
        // Create or update customer profile
        const existingCustomerIndex = customers.findIndex(c => c.id === customerId);
        if (existingCustomerIndex > -1) {
            const updatedCustomers = [...customers];
            const customer = updatedCustomers[existingCustomerIndex];
            customer.saleIds.unshift(newSale.id);
            customer.lastSeen = now.toISOString();
            if (customerInfo.customerName.trim()) {
                customer.name = customerInfo.customerName.trim();
            }
            if (customerInfo.contactNumber && customerInfo.contactNumber.trim()) {
                customer.contactNumber = customerInfo.contactNumber.trim();
            }
            if (customerInfo.serviceFrequencyValue && customerInfo.serviceFrequencyUnit) {
                customer.serviceFrequencyValue = customerInfo.serviceFrequencyValue;
                customer.serviceFrequencyUnit = customerInfo.serviceFrequencyUnit;
            }
            setCustomers(updatedCustomers);
        } else {
            const newCustomer: Customer = {
                id: customerId,
                name: customerInfo.customerName.trim() || `Customer ${customerId}`,
                saleIds: [newSale.id],
                firstSeen: now.toISOString(),
                lastSeen: now.toISOString(),
                contactNumber: customerInfo.contactNumber?.trim() || undefined,
                serviceFrequencyValue: customerInfo.serviceFrequencyValue,
                serviceFrequencyUnit: customerInfo.serviceFrequencyValue ? customerInfo.serviceFrequencyUnit : undefined,
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

            toast.success("Sale completely reversed. All items returned to inventory.");
        } else {
            // Some items remain, so update the sale
            const newSubtotal = remainingItems.reduce((acc, item) => acc + (item.originalPrice * item.quantity), 0);
            
            const newItemDiscounts = remainingItems.reduce((acc, item) => {
                const discountAmount = item.discountType === 'fixed'
                    ? item.discount
                    : (item.originalPrice * item.discount) / 100;
                return acc + (discountAmount * item.quantity);
            }, 0);

            const newSubtotalAfterItemDiscounts = newSubtotal - newItemDiscounts;

            const overallDiscountAmount = saleToModify.overallDiscountType === 'fixed'
                ? saleToModify.overallDiscount
                : (newSubtotalAfterItemDiscounts * saleToModify.overallDiscount) / 100;
            
            const newTotal = newSubtotalAfterItemDiscounts - overallDiscountAmount;

            const updatedSale: Sale = { 
                ...saleToModify, 
                items: remainingItems, 
                subtotal: Math.round(newSubtotal),
                totalItemDiscounts: Math.round(newItemDiscounts),
                total: Math.round(newTotal) 
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
