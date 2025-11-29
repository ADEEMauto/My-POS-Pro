
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useAppContext } from '../contexts/AppContext';
import { Product, CartItem, Sale, Customer, OutsideServiceItem } from '../types';
import { formatCurrency } from '../utils/helpers';
import { Search, X, ShoppingCart, ScanLine, Printer, ImageDown, Check, PlusCircle, Star, MessageSquare, Trash2, FileSearch, Hammer, Plus, Bike } from 'lucide-react';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import BarcodeScanner from '../components/BarcodeScanner';
import Receipt from '../components/Receipt';
import toast from 'react-hot-toast';
// @ts-ignore
import html2canvas from 'html2canvas';

// Interface for a single POS Session (Cart)
interface POSSession {
    id: string;
    name: string; // Display name (e.g., "Order 1" or Bike Number)
    cart: CartItem[];
    customerName: string;
    bikeNumber: string;
    contactNumber: string;
    serviceFrequencyValue: number | string;
    serviceFrequencyUnit: 'days' | 'months' | 'years';
    tuningCharges: number | string;
    laborCharges: number | string;
    overallDiscount: number | string;
    overallDiscountType: 'fixed' | 'percentage';
    outsideServices: OutsideServiceItem[];
    pointsToRedeem: number | string;
    amountPaid: number | string;
}

const ProductCard: React.FC<{ product: Product; onSelect: (productId: string) => void; isSelected: boolean; categoryName?: string; }> = ({ product, onSelect, isSelected, categoryName }) => {
    const isOutOfStock = product.quantity <= 0;
    return (
        <div
            className={`bg-white rounded-lg shadow-md p-4 flex flex-col justify-between transition-all relative overflow-hidden border-2 ${
                isOutOfStock ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-lg hover:-translate-y-1 cursor-pointer'
            } ${isSelected ? 'border-primary-600 ring-2 ring-primary-200' : 'border-transparent'}`}
            onClick={() => !isOutOfStock && onSelect(product.id)}
            aria-label={`Add ${product.name} to cart`}
            role="button"
        >
             {isSelected && (
                <div className="absolute top-1 right-1 bg-primary-600 text-white rounded-full p-0.5 z-10">
                    <Check size={16} />
                </div>
            )}
            {isOutOfStock && (
                <div className="absolute inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-20">
                    <span className="text-white font-bold text-lg">OUT OF STOCK</span>
                </div>
            )}
            <img src={product.imageUrl || 'https://picsum.photos/200'} alt={product.name} className="w-full h-32 object-cover rounded-md mb-2" />
            <h3 className="font-semibold text-gray-800 text-sm truncate">{product.name}</h3>
            <p className="text-xs text-gray-500 truncate">
                {categoryName || 'N/A'} &bull; {product.manufacturer} &bull; {product.location || 'N/A'}
            </p>
            <p className="text-lg font-bold text-primary-600 mt-1">{formatCurrency(product.salePrice)}</p>
        </div>
    );
};

const CustomerLookupModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSelectCustomer: (customer: Customer) => void;
}> = ({ isOpen, onClose, onSelectCustomer }) => {
    const { customers } = useAppContext();
    const [search, setSearch] = useState('');

    const filteredCustomers = useMemo(() => {
        if (!search) return customers;
        const lowercasedSearch = search.toLowerCase();
        return customers.filter(c => 
            c.name.toLowerCase().includes(lowercasedSearch) ||
            c.id.toLowerCase().includes(lowercasedSearch)
        );
    }, [customers, search]);

    const handleSelect = (customer: Customer) => {
        onSelectCustomer(customer);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Find Existing Customer" size="lg">
            <Input 
                placeholder="Search by name or bike number..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                icon={<Search className="w-5 h-5 text-gray-400" />}
                autoFocus
            />
            <div className="max-h-80 overflow-y-auto mt-4 border rounded-md divide-y">
                {filteredCustomers.length > 0 ? filteredCustomers.map(c => (
                    <div 
                        key={c.id}
                        className="p-3 flex justify-between items-center cursor-pointer hover:bg-gray-50"
                        onClick={() => handleSelect(c)}
                    >
                        <div>
                            <p className="font-semibold">{c.name}</p>
                            <p className="text-sm text-gray-500">{c.id}</p>
                        </div>
                        <span className="text-xs text-gray-400">Last Seen: {new Date(c.lastSeen).toLocaleDateString()}</span>
                    </div>
                )) : (
                    <p className="text-center text-gray-500 p-4">No customers found.</p>
                )}
            </div>
        </Modal>
    );
};


const POS: React.FC = () => {
    const { inventory, sales, categories, createSale, findProductByBarcode, customers, redemptionRule, shopInfo, customerTiers } = useAppContext();
    
    // Search & Sorting State
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [sortBy, setSortBy] = useState('most_selling');

    // Multi-Session State
    const createEmptySession = (index: number): POSSession => ({
        id: uuidv4(),
        name: `Order ${index + 1}`,
        cart: [],
        customerName: '',
        bikeNumber: '',
        contactNumber: '',
        serviceFrequencyValue: '',
        serviceFrequencyUnit: 'months',
        tuningCharges: '',
        laborCharges: '',
        overallDiscount: '',
        overallDiscountType: 'fixed',
        outsideServices: [],
        pointsToRedeem: '',
        amountPaid: ''
    });

    const [sessions, setSessions] = useState<POSSession[]>([createEmptySession(0)]);
    const [activeSessionId, setActiveSessionId] = useState<string>(sessions[0].id);

    // Derived Active Session
    const currentSession = useMemo(() => sessions.find(s => s.id === activeSessionId) || sessions[0], [sessions, activeSessionId]);
    
    // Helper to update current session
    const updateCurrentSession = (updates: Partial<POSSession>) => {
        setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, ...updates } : s));
    };

    // Helper to update session AND rename it if bike number changes
    const updateSessionAndName = (updates: Partial<POSSession>) => {
        setSessions(prev => prev.map(s => {
            if (s.id === activeSessionId) {
                const updatedSession = { ...s, ...updates };
                // If bike number is present, use it as tab name, else fallback to default logic or keep existing if generic
                if (updates.bikeNumber !== undefined) {
                    updatedSession.name = updates.bikeNumber.trim() || s.name; 
                    if(!updatedSession.name || updatedSession.name.startsWith('Order ')) {
                         // If clearing bike number, revert to generic name if customer name is also empty
                         if(!updatedSession.customerName) updatedSession.name = "New Order";
                    }
                }
                return updatedSession;
            }
            return s;
        }));
    };

    // Modals State
    const [isCheckoutModalOpen, setCheckoutModalOpen] = useState(false);
    const [isSaleCompleteModalOpen, setIsSaleCompleteModalOpen] = useState(false);
    const [completedSale, setCompletedSale] = useState<Sale | null>(null);
    const receiptRef = useRef<HTMLDivElement>(null);
    const [isScannerModalOpen, setScannerModalOpen] = useState(false);
    const [isCustomerLookupOpen, setCustomerLookupOpen] = useState(false);

    // WhatsApp State
    const [showWhatsAppInput, setShowWhatsAppInput] = useState(false);
    const [whatsAppNumber, setWhatsAppNumber] = useState('');
    const [customerForReceipt, setCustomerForReceipt] = useState<Customer | null>(null);


    // --- Derived Computations for Current Session ---

    // Current Customer Lookup
    const currentCustomer = useMemo(() => {
        const bikeId = currentSession.bikeNumber.replace(/\s+/g, '').toUpperCase();
        return customers.find(c => c.id === bikeId);
    }, [customers, currentSession.bikeNumber]);
    
    const customerTier = useMemo(() => currentCustomer?.tierId ? customerTiers.find(t => t.id === currentCustomer.tierId) : null, [currentCustomer, customerTiers]);
    
    // Reset redemption points if customer changes
    useEffect(() => {
        if (!currentCustomer && currentSession.pointsToRedeem) {
             updateCurrentSession({ pointsToRedeem: '' });
        }
    }, [currentCustomer]);

    const categoryMap = useMemo(() => {
        const map = new Map<string, string>();
        categories.forEach(c => map.set(c.id, c.name));
        return map;
    }, [categories]);
    
    const productSales = useMemo(() => {
        const salesCount = new Map<string, number>();
        sales.forEach(sale => {
            sale.items.forEach(item => {
                if (!item.productId.startsWith('manual-')) {
                    salesCount.set(item.productId, (salesCount.get(item.productId) || 0) + item.quantity);
                }
            });
        });
        return salesCount;
    }, [sales]);

    // --- Inventory Filtering ---
    const filteredInventory = useMemo(() => {
        const lowercasedSearchTerm = searchTerm.toLowerCase();
        const filtered = inventory.filter(product => {
            const matchesCategory = selectedCategory === 'all' || product.categoryId === selectedCategory || product.subCategoryId === selectedCategory;
            const matchesSearch = product.name.toLowerCase().includes(lowercasedSearchTerm) || 
                                  (product.barcode && product.barcode.toLowerCase().includes(lowercasedSearchTerm));
            return matchesCategory && matchesSearch;
        });
        
        filtered.sort((a, b) => {
            switch (sortBy) {
                case 'name_asc': return a.name.localeCompare(b.name);
                case 'name_desc': return b.name.localeCompare(a.name);
                case 'price_desc': return b.salePrice - a.salePrice;
                case 'price_asc': return a.salePrice - b.salePrice;
                case 'most_selling': return (productSales.get(b.id) || 0) - (productSales.get(a.id) || 0);
                case 'least_selling': return (productSales.get(a.id) || 0) - (productSales.get(b.id) || 0);
                case 'category_asc': {
                    const catA = categoryMap.get(a.categoryId) || '';
                    const catB = categoryMap.get(b.categoryId) || '';
                    return catA.localeCompare(catB);
                }
                case 'manufacturer_asc': return a.manufacturer.localeCompare(b.manufacturer);
                case 'location_asc': return (a.location || '').localeCompare(b.location || '');
                default: return 0;
            }
        });
        return filtered;
    }, [inventory, searchTerm, selectedCategory, sortBy, productSales, categoryMap]);

    const mainCategories = useMemo(() => categories.filter(c => c.parentId === null), [categories]);


    // --- Cart Logic (Operates on Current Session) ---

    const addToCart = (productId: string) => {
        const product = inventory.find(p => p.id === productId);
        if (!product) return;

        const existingItem = currentSession.cart.find(item => item.id === productId);
        let newCart;

        if (existingItem) {
            if (existingItem.cartQuantity < product.quantity) {
                newCart = currentSession.cart.map(item => item.id === productId ? { ...item, cartQuantity: item.cartQuantity + 1 } : item);
            } else {
                toast.error(`No more stock for ${product.name}.`);
                return;
            }
        } else {
            if (product.quantity > 0) {
                newCart = [...currentSession.cart, { ...product, cartQuantity: 1, discount: 0, discountType: 'fixed' }];
            } else {
                toast.error(`${product.name} is out of stock.`);
                return;
            }
        }
        updateCurrentSession({ cart: newCart });
    };
    
    const addManualItemToCart = () => {
        const itemName = prompt("Enter item name:");
        if (!itemName) return;
        const itemPriceInput = prompt("Enter item price:");
        if (itemPriceInput === null) return;
        const itemPrice = parseFloat(itemPriceInput || '0');
        
        if (isNaN(itemPrice) || itemPrice <= 0) {
            toast.error("Invalid price entered.");
            return;
        }

        const quantityInput = prompt("Enter quantity:", "1");
        if (quantityInput === null) return;
        const quantity = parseInt(quantityInput || '1', 10);

        if (isNaN(quantity) || quantity <= 0) {
            toast.error("Invalid quantity entered.");
            return;
        }

        const manualProduct: CartItem = {
            id: `manual-${uuidv4()}`,
            name: itemName,
            salePrice: itemPrice,
            purchasePrice: 0,
            quantity: Infinity,
            cartQuantity: quantity,
            discount: 0,
            discountType: 'fixed',
            categoryId: 'manual',
            subCategoryId: null,
            manufacturer: 'N/A',
            location: 'N/A'
        };
        updateCurrentSession({ cart: [...currentSession.cart, manualProduct] });
    };

    const handleBarcodeScan = (decodedText: string) => {
        const product = findProductByBarcode(decodedText);
        if (product) {
            addToCart(product.id);
            toast.success(`${product.name} added to cart.`);
            setScannerModalOpen(false);
        } else {
            toast.error(`Product with barcode ${decodedText} not found.`);
        }
    };

    const updateQuantity = (productId: string, newQuantity: number) => {
        const productInStock = inventory.find(p => p.id === productId);
        const maxQuantity = productInStock ? productInStock.quantity : Infinity;
        
        let newCart;
        if (newQuantity <= 0) {
            newCart = currentSession.cart.filter(item => item.id !== productId);
        } else if (newQuantity > maxQuantity) {
            toast.error(`Only ${maxQuantity} units of ${productInStock?.name} available.`);
            newCart = currentSession.cart.map(item => item.id === productId ? { ...item, cartQuantity: maxQuantity } : item);
        } else {
            newCart = currentSession.cart.map(item => item.id === productId ? { ...item, cartQuantity: newQuantity } : item);
        }
        updateCurrentSession({ cart: newCart });
    };

    const handleItemPriceChange = (productId: string, value: string) => {
        const numericValue = parseFloat(value);
        const newCart = currentSession.cart.map(item => 
            item.id === productId 
            ? { ...item, salePrice: isNaN(numericValue) ? 0 : numericValue } 
            : item
        );
        updateCurrentSession({ cart: newCart });
    };

     const handleItemDiscountChange = (productId: string, value: string) => {
        const numericValue = parseFloat(value);
        const newCart = currentSession.cart.map(item => 
            item.id === productId 
            ? { ...item, discount: isNaN(numericValue) ? 0 : numericValue } 
            : item
        );
        updateCurrentSession({ cart: newCart });
    };

    const handleItemDiscountTypeChange = (productId: string, type: 'fixed' | 'percentage') => {
        const newCart = currentSession.cart.map(item => 
            item.id === productId 
            ? { ...item, discountType: type } 
            : item
        );
        updateCurrentSession({ cart: newCart });
    };

    // --- Calculations ---
    const subtotal = useMemo(() => currentSession.cart.reduce((acc, item) => acc + (item.salePrice * item.cartQuantity), 0), [currentSession.cart]);
    
    const totalItemDiscount = useMemo(() => {
        return currentSession.cart.reduce((acc, item) => {
            const discount = item.discountType === 'fixed'
                ? item.discount
                : (item.salePrice * item.discount) / 100;
            return acc + (discount * item.cartQuantity);
        }, 0);
    }, [currentSession.cart]);
    
    const subtotalAfterItemDiscount = subtotal - totalItemDiscount;

    const subtotalWithCharges = useMemo(() => {
        const numericTuningCharges = parseFloat(String(currentSession.tuningCharges)) || 0;
        const numericLaborCharges = parseFloat(String(currentSession.laborCharges)) || 0;
        return subtotalAfterItemDiscount + numericTuningCharges + numericLaborCharges;
    }, [subtotalAfterItemDiscount, currentSession.tuningCharges, currentSession.laborCharges]);

    const overallDiscountAmount = useMemo(() => {
        const value = parseFloat(String(currentSession.overallDiscount));
        if (isNaN(value) || value < 0) return 0;
        return currentSession.overallDiscountType === 'fixed' ? value : (subtotalWithCharges * value) / 100;
    }, [currentSession.overallDiscount, currentSession.overallDiscountType, subtotalWithCharges]);
    
    const totalOutsideServices = useMemo(() => currentSession.outsideServices.reduce((sum, s) => sum + s.amount, 0), [currentSession.outsideServices]);

    const cartTotal = useMemo(() => {
        return (subtotalWithCharges - overallDiscountAmount) + totalOutsideServices;
    }, [subtotalWithCharges, overallDiscountAmount, totalOutsideServices]);

    const previousBalance = useMemo(() => currentCustomer?.balance || 0, [currentCustomer]);
    
    const totalBeforeLoyalty = useMemo(() => {
        return cartTotal + previousBalance;
    }, [cartTotal, previousBalance]);

    const loyaltyDiscountAmount = useMemo(() => {
        if (!currentCustomer || !currentSession.pointsToRedeem) return 0;
        const points = Number(currentSession.pointsToRedeem);
        if (isNaN(points) || points <= 0 || points > currentCustomer.loyaltyPoints) return 0;
        
        let discount = 0;
        if (redemptionRule.method === 'fixedValue') {
            discount = (points / redemptionRule.points) * redemptionRule.value;
        } else { // percentage
            const percentage = (points / redemptionRule.points) * redemptionRule.value;
            discount = (totalBeforeLoyalty * percentage) / 100;
        }
        return discount > totalBeforeLoyalty ? totalBeforeLoyalty : discount;
    }, [currentSession.pointsToRedeem, currentCustomer, redemptionRule, totalBeforeLoyalty]);

    const totalDue = useMemo(() => {
        const finalTotal = totalBeforeLoyalty - loyaltyDiscountAmount;
        return finalTotal > 0 ? finalTotal : 0;
    }, [totalBeforeLoyalty, loyaltyDiscountAmount]);

    // Auto-fill amount paid when totalDue settles
    useEffect(() => {
        if(isCheckoutModalOpen) {
             updateCurrentSession({ amountPaid: Math.round(totalDue) });
        }
    }, [totalDue, isCheckoutModalOpen]);


    // --- Session Management Actions ---

    const handleAddSession = () => {
        const newSession = createEmptySession(sessions.length);
        setSessions([...sessions, newSession]);
        setActiveSessionId(newSession.id);
    };

    const handleCloseSession = (e: React.MouseEvent, sessionId: string) => {
        e.stopPropagation();
        
        const sessionToClose = sessions.find(s => s.id === sessionId);
        if(sessionToClose && sessionToClose.cart.length > 0) {
            if(!window.confirm(`"Order ${sessionToClose.name}" has items in cart. Are you sure you want to close it?`)) {
                return;
            }
        }

        const remainingSessions = sessions.filter(s => s.id !== sessionId);
        
        if (remainingSessions.length === 0) {
            const newSession = createEmptySession(0);
            setSessions([newSession]);
            setActiveSessionId(newSession.id);
        } else {
            setSessions(remainingSessions);
            if (activeSessionId === sessionId) {
                setActiveSessionId(remainingSessions[remainingSessions.length - 1].id);
            }
        }
    };


    const handleCheckout = () => {
        const numericAmountPaid = Number(currentSession.amountPaid) || 0;
        const roundedTotalDue = Math.round(totalDue);

        if (numericAmountPaid < roundedTotalDue && (!currentSession.bikeNumber.trim() || !currentSession.customerName.trim())) {
            toast.error("Customer details (Bike No & Name) are required when the bill is not fully paid.");
            return;
        }
        
        let finalCustomerName = currentSession.customerName.trim();
        let finalBikeNumber = currentSession.bikeNumber.trim();

        if (!finalCustomerName && !finalBikeNumber) {
            finalCustomerName = 'Walk-in';
            finalBikeNumber = 'WALKIN';
        } else if (!finalBikeNumber) {
            finalBikeNumber = `${finalCustomerName.replace(/\s+/g, '').toUpperCase()}-${Date.now()}`;
        } else if (!finalCustomerName) {
            const existingCustomer = customers.find(c => c.id === finalBikeNumber.replace(/\s+/g, '').toUpperCase());
            finalCustomerName = existingCustomer ? existingCustomer.name : `Customer ${finalBikeNumber}`;
        }

        const sale = createSale(
            currentSession.cart,
            parseFloat(String(currentSession.overallDiscount)) || 0,
            currentSession.overallDiscountType,
            { 
                customerName: finalCustomerName, 
                bikeNumber: finalBikeNumber, 
                contactNumber: currentSession.contactNumber, 
                serviceFrequencyValue: Number(currentSession.serviceFrequencyValue) || undefined, 
                serviceFrequencyUnit: currentSession.serviceFrequencyValue ? currentSession.serviceFrequencyUnit : undefined 
            },
            Number(currentSession.pointsToRedeem) || 0,
            parseFloat(String(currentSession.tuningCharges)) || 0,
            parseFloat(String(currentSession.laborCharges)) || 0,
            Number(currentSession.amountPaid) || 0,
            currentSession.outsideServices
        );

        if (sale) {
            setCompletedSale(sale);
            setIsSaleCompleteModalOpen(true);
            setCheckoutModalOpen(false);
            
            // Remove the completed session and switch
            const remainingSessions = sessions.filter(s => s.id !== activeSessionId);
            if (remainingSessions.length === 0) {
                const newSession = createEmptySession(0);
                setSessions([newSession]);
                setActiveSessionId(newSession.id);
            } else {
                setSessions(remainingSessions);
                setActiveSessionId(remainingSessions[0].id);
            }
        }
    };
    
    const handlePrintReceipt = () => {
        if (receiptRef.current) {
            const printContents = receiptRef.current.innerHTML;
            const originalContents = document.body.innerHTML;
            document.body.innerHTML = printContents;
            window.print();
            document.body.innerHTML = originalContents;
            window.location.reload();
        }
    };

    const handleDownloadImage = async () => {
        if (receiptRef.current) {
            const toastId = toast.loading("Generating image...");
            try {
                const canvas = await html2canvas(receiptRef.current, { scale: 6, useCORS: true, backgroundColor: '#ffffff' });
                const link = document.createElement('a');
                link.download = `receipt-${completedSale?.id}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
                toast.success("Image downloaded!", { id: toastId });
            } catch (error) {
                console.error("Error generating image:", error);
                toast.error("Could not generate image.", { id: toastId });
            }
        }
    };

    const handleShareWhatsAppClick = () => {
        if (!completedSale) return;
        const customer = customers.find(c => c.id === completedSale.customerId);
        setCustomerForReceipt(customer || null);
        if (customer?.contactNumber) {
            handleShareWhatsApp(customer.contactNumber);
        } else {
            setShowWhatsAppInput(true);
        }
    };
    
    const handleShareWhatsApp = async (number: string) => {
        if (!receiptRef.current || !completedSale) return;

        let formattedNumber = number.replace(/\D/g, '');
        if (formattedNumber.startsWith('0')) {
            formattedNumber = '92' + formattedNumber.substring(1);
        } else if (!formattedNumber.startsWith('92')) {
            formattedNumber = '92' + formattedNumber;
        }

        const shopName = shopInfo?.name || "our shop";
        const customerNameForMsg = customerForReceipt?.name || completedSale.customerName;

        const message = `Dear ${customerNameForMsg},\n\nThank you for your purchase from ${shopName}.\n\n*Sale ID:* ${completedSale.id}\n*Total Amount:* ${formatCurrency(completedSale.total)}\n\nWe appreciate your business!`;
        const encodedMessage = encodeURIComponent(message);
        
        try {
            const toastId = toast.loading("Preparing receipt...");
            const canvas = await html2canvas(receiptRef.current, { scale: 6, useCORS: true, backgroundColor: '#ffffff' });
            const link = document.createElement('a');
            link.download = `receipt-${completedSale.id}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();

            toast.success("Receipt downloaded. Please attach it in WhatsApp.", { id: toastId, duration: 5000 });
            const whatsappUrl = `https://wa.me/${formattedNumber}?text=${encodedMessage}`;
            window.open(whatsappUrl, '_blank');

        } catch (error) {
            toast.error("Could not generate receipt image for sharing.");
        }
        setShowWhatsAppInput(false);
        setWhatsAppNumber('');
    };

    const handleSelectCustomer = (customer: Customer) => {
        updateSessionAndName({
            bikeNumber: customer.id,
            customerName: customer.name,
            contactNumber: customer.contactNumber || '',
            serviceFrequencyValue: customer.serviceFrequencyValue || '',
            serviceFrequencyUnit: customer.serviceFrequencyUnit || 'months'
        });
    };

    // Outside Services handlers
    const handleAddService = () => updateCurrentSession({ outsideServices: [...currentSession.outsideServices, { id: uuidv4(), name: '', amount: 0 }] });
    const handleUpdateService = (id: string, field: 'name' | 'amount', value: string) => {
        const updatedServices = currentSession.outsideServices.map(s => s.id === id ? { ...s, [field]: field === 'amount' ? Number(value) || 0 : value } : s);
        updateCurrentSession({ outsideServices: updatedServices });
    };
    const handleRemoveService = (id: string) => {
        updateCurrentSession({ outsideServices: currentSession.outsideServices.filter(s => s.id !== id) });
    };

    return (
        <div className="flex flex-col md:flex-row h-[calc(100vh-4rem)] bg-gray-50">
            {/* Main content - Product Grid */}
            <div className="flex-grow p-4 overflow-y-auto">
                <div className="flex flex-col sm:flex-row gap-4 mb-4 sticky top-0 bg-gray-50 py-2 z-10">
                    <div className="flex-grow">
                        <Input 
                            placeholder="Search products by name or barcode..." 
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            icon={<Search className="w-5 h-5 text-gray-400" />}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)} className="p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500">
                            <option value="all">All Categories</option>
                            {mainCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500">
                            <option value="most_selling">Most Selling</option>
                            <option value="least_selling">Least Selling</option>
                            <option value="name_asc">Alphabetical (A-Z)</option>
                            <option value="name_desc">Alphabetical (Z-A)</option>
                            <option value="price_desc">Price: High to Low</option>
                            <option value="price_asc">Price: Low to High</option>
                            <option value="category_asc">Category</option>
                            <option value="manufacturer_asc">Manufacturer</option>
                            <option value="location_asc">Location</option>
                        </select>
                        <Button variant="secondary" onClick={() => setScannerModalOpen(true)} className="p-2" title="Scan Barcode">
                            <ScanLine className="w-5 h-5"/>
                        </Button>
                    </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {filteredInventory.map(product => (
                        <ProductCard 
                            key={product.id} 
                            product={product} 
                            onSelect={addToCart} 
                            isSelected={currentSession.cart.some(item => item.id === product.id)}
                            categoryName={categoryMap.get(product.categoryId)}
                        />
                    ))}
                </div>
            </div>

            {/* Right Sidebar - Cart */}
            <div className="w-full md:w-96 bg-white shadow-lg flex flex-col border-l">
                {/* Active Sessions Tabs */}
                <div className="flex items-center overflow-x-auto bg-gray-100 border-b scrollbar-thin">
                    {sessions.map((session) => (
                        <div 
                            key={session.id}
                            onClick={() => setActiveSessionId(session.id)}
                            className={`flex items-center px-3 py-2 cursor-pointer min-w-[100px] justify-between border-r border-gray-200 select-none transition-colors ${
                                activeSessionId === session.id 
                                ? 'bg-white text-primary-700 font-bold border-t-2 border-t-primary-600' 
                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            }`}
                        >
                            <div className="flex items-center gap-2 truncate mr-2">
                                <Bike size={14} className={activeSessionId === session.id ? "text-primary-600" : "text-gray-400"} />
                                <span className="truncate text-sm max-w-[80px]" title={session.name}>{session.name}</span>
                            </div>
                            <button 
                                onClick={(e) => handleCloseSession(e, session.id)}
                                className="text-gray-400 hover:text-red-500 rounded-full p-0.5 hover:bg-gray-300"
                            >
                                <X size={12} />
                            </button>
                        </div>
                    ))}
                    <button 
                        onClick={handleAddSession}
                        className="p-2 text-gray-500 hover:text-primary-600 hover:bg-gray-200"
                        title="New Order"
                    >
                        <Plus size={18} />
                    </button>
                </div>

                <div className="p-4 flex-grow flex flex-col overflow-hidden">
                    <h2 className="text-xl font-bold mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2"><ShoppingCart /> Current Sale</div>
                        {currentSession.cart.length > 0 && (
                            <Button variant="danger" size="sm" onClick={() => updateCurrentSession({ cart: [] })}><Trash2 size={16} /></Button>
                        )}
                    </h2>

                    {currentSession.cart.length > 0 && (
                        <div className="bg-primary-600 text-white rounded-lg p-3 text-center mb-4 shadow-inner">
                            <p className="text-xs opacity-80 uppercase tracking-wider">Total Amount</p>
                            <p className="text-3xl font-bold tracking-tight">{formatCurrency(subtotalAfterItemDiscount)}</p>
                        </div>
                    )}

                    <div className="space-y-2 mb-4">
                        <Button onClick={() => setCheckoutModalOpen(true)} className="w-full">
                            {currentSession.cart.length > 0 ? 'Proceed to Checkout' : 'Add Charges / Checkout'}
                        </Button>
                        <Button onClick={addManualItemToCart} variant="ghost" className="w-full flex items-center justify-center gap-2">
                            <PlusCircle size={18} /> Add Manual Item
                        </Button>
                    </div>
                    
                    <div className="flex-grow overflow-y-auto -mr-4 pr-4">
                        {currentSession.cart.length === 0 ? (
                            <p className="text-gray-500 text-center mt-8">Your cart is empty.</p>
                        ) : (
                            <div>
                                <div className="space-y-3">
                                    {currentSession.cart.map(item => (
                                        <div key={item.id} className="flex items-start gap-3 p-2 bg-gray-50 rounded-lg">
                                            <img src={item.imageUrl || 'https://picsum.photos/200'} alt={item.name} className="w-16 h-16 object-cover rounded-md"/>
                                            <div className="flex-grow">
                                                <p className="font-semibold text-sm">{item.name}</p>
                                                
                                                <div className="flex items-center gap-2 mt-1">
                                                    <div className="flex flex-col">
                                                        <label className="text-[10px] text-gray-500 font-medium">Price</label>
                                                        <input 
                                                            type="number" 
                                                            value={item.salePrice} 
                                                            onChange={e => handleItemPriceChange(item.id, e.target.value)}
                                                            className="w-20 h-8 text-xs p-1 border border-gray-300 rounded-md text-center focus:ring-primary-500 focus:border-primary-500"
                                                            min="0"
                                                        />
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <label className="text-[10px] text-gray-500 font-medium">Qty</label>
                                                        <input 
                                                            type="number" 
                                                            value={item.cartQuantity} 
                                                            onChange={e => updateQuantity(item.id, parseInt(e.target.value, 10))} 
                                                            className="w-16 h-8 text-xs p-1 border border-gray-300 rounded-md text-center focus:ring-primary-500 focus:border-primary-500"
                                                            min="1"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2 mt-2">
                                                    <label htmlFor={`discount-${item.id}`} className="text-xs text-gray-500">Discount:</label>
                                                    <Input 
                                                        id={`discount-${item.id}`}
                                                        type="number"
                                                        value={item.discount || ''}
                                                        onChange={e => handleItemDiscountChange(item.id, e.target.value)}
                                                        className="w-20 h-8 text-xs p-1"
                                                        placeholder="0"
                                                    />
                                                    <select
                                                        value={item.discountType}
                                                        onChange={e => handleItemDiscountTypeChange(item.id, e.target.value as 'fixed' | 'percentage')}
                                                        className="h-8 text-xs p-1 border border-gray-300 rounded-md bg-white"
                                                    >
                                                        <option value="fixed">Rs.</option>
                                                        <option value="percentage">%</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <button onClick={() => updateQuantity(item.id, 0)} className="text-gray-400 hover:text-red-500"><X size={18}/></button>
                                        </div>
                                    ))}
                                </div>
                                <div className="border-t pt-4 mt-4 space-y-2 pb-4">
                                    <div className="flex justify-between font-semibold">
                                        <span>Subtotal</span>
                                        <span>{formatCurrency(subtotal)}</span>
                                    </div>
                                    {totalItemDiscount > 0 && (
                                        <div className="flex justify-between text-sm text-red-600">
                                            <span>Item Discounts</span>
                                            <span>-{formatCurrency(totalItemDiscount)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between font-bold text-xl pt-2 border-t">
                                        <span>Total</span>
                                        <span>{formatCurrency(subtotalAfterItemDiscount)}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            
            {/* Modals */}
            <Modal isOpen={isCheckoutModalOpen} onClose={() => setCheckoutModalOpen(false)} title={`Checkout: ${currentSession.name}`} size="2xl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Left side: Customer and Charges */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg flex items-center justify-between">
                            Customer Details
                            <Button variant="ghost" size="sm" onClick={() => setCustomerLookupOpen(true)} className="flex items-center gap-1">
                                <FileSearch size={16}/> Find Existing
                            </Button>
                        </h3>
                        <Input label="Bike Number (Unique ID)" value={currentSession.bikeNumber} onChange={e => updateSessionAndName({ bikeNumber: e.target.value.toUpperCase() })} placeholder="e.g., KHI1234" />
                        <Input label="Customer Name" value={currentSession.customerName} onChange={e => updateSessionAndName({ customerName: e.target.value })} />
                        <Input label="Contact Number" type="tel" value={currentSession.contactNumber} onChange={e => updateCurrentSession({ contactNumber: e.target.value })} />
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Service Frequency</label>
                            <div className="flex items-center gap-2 mt-1">
                                <Input type="number" placeholder="e.g., 3" min="1" value={currentSession.serviceFrequencyValue} onChange={(e) => updateCurrentSession({ serviceFrequencyValue: e.target.value })} className="w-1/3" />
                                <select value={currentSession.serviceFrequencyUnit} onChange={(e) => updateCurrentSession({ serviceFrequencyUnit: e.target.value as 'days' | 'months' | 'years' })} className="flex-grow p-2 border border-gray-300 rounded-md">
                                    <option value="days">Days</option>
                                    <option value="months">Months</option>
                                    <option value="years">Years</option>
                                </select>
                            </div>
                        </div>
                        <div className="pt-4 border-t">
                            <h3 className="font-semibold text-lg">Additional Charges</h3>
                            <div className="flex gap-4">
                                <Input label="Tuning (Rs)" type="number" value={currentSession.tuningCharges} onChange={e => updateCurrentSession({ tuningCharges: e.target.value })} />
                                <Input label="Labor (Rs)" type="number" value={currentSession.laborCharges} onChange={e => updateCurrentSession({ laborCharges: e.target.value })} />
                            </div>
                        </div>
                        <div className="pt-4 border-t">
                            <h3 className="font-semibold text-lg flex items-center justify-between">
                                <span className="flex items-center gap-2"><Hammer size={16}/> Outside Services</span>
                                <Button size="sm" variant="ghost" onClick={handleAddService}><PlusCircle size={16}/></Button>
                            </h3>
                            <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                                {currentSession.outsideServices.map(service => (
                                    <div key={service.id} className="flex items-center gap-2">
                                        <Input placeholder="Service Name" value={service.name} onChange={e => handleUpdateService(service.id, 'name', e.target.value)} className="flex-grow"/>
                                        <Input placeholder="Amount" type="number" value={service.amount || ''} onChange={e => handleUpdateService(service.id, 'amount', e.target.value)} className="w-28"/>
                                        <Button size="sm" variant="danger" onClick={() => handleRemoveService(service.id)} className="p-2"><X size={16}/></Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right side: Summary and Payment */}
                    <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
                        <h3 className="font-semibold text-lg border-b pb-2">Order Summary</h3>
                        <div className="flex justify-between text-sm"><span>Cart Total:</span> <span>{formatCurrency(subtotalAfterItemDiscount)}</span></div>
                        <div className="flex justify-between text-sm"><span>Charges:</span> <span>{formatCurrency((parseFloat(String(currentSession.tuningCharges)) || 0) + (parseFloat(String(currentSession.laborCharges)) || 0))}</span></div>
                        <div className="flex justify-between font-semibold text-sm"><span>Subtotal:</span> <span>{formatCurrency(subtotalWithCharges)}</span></div>
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Overall Discount</label>
                            <div className="flex items-center gap-2">
                                <Input type="number" value={currentSession.overallDiscount} onChange={e => updateCurrentSession({ overallDiscount: e.target.value })} />
                                <select value={currentSession.overallDiscountType} onChange={e => updateCurrentSession({ overallDiscountType: e.target.value as 'fixed' | 'percentage' })} className="p-2 border border-gray-300 rounded-md">
                                    <option value="fixed">Rs.</option>
                                    <option value="percentage">%</option>
                                </select>
                            </div>
                        </div>
                         <div className="flex justify-between font-bold"><span>Total After Discount:</span> <span>{formatCurrency(subtotalWithCharges - overallDiscountAmount)}</span></div>
                        
                         {totalOutsideServices > 0 && (
                             <div className="flex justify-between text-sm text-cyan-600">
                                <span>Outside Services:</span>
                                <span>+ {formatCurrency(totalOutsideServices)}</span>
                             </div>
                         )}

                        {currentCustomer && (
                             <div className="pt-3 border-t">
                                 <h4 className="font-semibold flex items-center justify-between">
                                    <div className="flex items-center gap-1"><Star size={14}/> Loyalty Points</div>
                                    {customerTier && <span className="text-xs font-bold text-white bg-primary-600 px-2 py-0.5 rounded-full">{customerTier.name} Tier</span>}
                                 </h4>
                                <p className="text-sm text-gray-600">Available: <span className="font-bold">{currentCustomer.loyaltyPoints}</span> points</p>
                                <Input 
                                    label="Points to Redeem" 
                                    type="number" 
                                    value={currentSession.pointsToRedeem}
                                    onChange={e => updateCurrentSession({ pointsToRedeem: e.target.value })}
                                    max={currentCustomer.loyaltyPoints}
                                    min="0"
                                    placeholder={`1 point = ${formatCurrency(redemptionRule.value / redemptionRule.points)}`}
                                />
                                {loyaltyDiscountAmount > 0 && <p className="text-sm text-green-600 text-right font-semibold">-{formatCurrency(loyaltyDiscountAmount)} Discount</p>}
                            </div>
                        )}

                        {previousBalance > 0 && (
                            <div className="flex justify-between text-sm text-red-600 pt-3 border-t">
                                <span>Previous Balance:</span>
                                <span>{formatCurrency(previousBalance)}</span>
                            </div>
                        )}
                        
                        <div className="flex justify-between font-extrabold text-2xl pt-3 border-t">
                            <span>TOTAL DUE:</span>
                            <span>{formatCurrency(totalDue)}</span>
                        </div>
                         <div className="pt-3 border-t">
                             <Input label="Amount Paid" type="number" value={currentSession.amountPaid} onChange={e => updateCurrentSession({ amountPaid: e.target.value })} required />
                             {Number(currentSession.amountPaid) < Math.round(totalDue) && <p className="text-xs text-red-500 mt-1">Remaining balance will be added to customer's due amount.</p>}
                         </div>
                    </div>
                </div>
                 <div className="flex justify-end gap-2 pt-6 mt-4 border-t">
                    <Button variant="secondary" onClick={() => setCheckoutModalOpen(false)}>Cancel</Button>
                    <Button onClick={handleCheckout}>Complete Sale</Button>
                </div>
            </Modal>
            
            <Modal isOpen={isSaleCompleteModalOpen} onClose={() => setIsSaleCompleteModalOpen(false)} title={`Sale ${completedSale?.id} Complete!`} size="md">
                {completedSale && (
                    <div className="flex flex-col gap-4">
                        <div className="w-full bg-gray-100 p-1 rounded-lg border">
                            <Receipt sale={completedSale} ref={receiptRef} />
                        </div>

                        {showWhatsAppInput && (
                            <div className="p-3 bg-gray-50 rounded-md border">
                                <Input 
                                    label="Enter WhatsApp Number"
                                    placeholder="e.g., 03001234567"
                                    value={whatsAppNumber}
                                    onChange={e => setWhatsAppNumber(e.target.value)}
                                />
                                <Button onClick={() => handleShareWhatsApp(whatsAppNumber)} size="sm" className="mt-2 w-full">
                                    Send Receipt
                                </Button>
                            </div>
                        )}
                        
                        <div className="w-full flex flex-col sm:flex-row justify-center items-center gap-3 pt-4 border-t">
                            <Button onClick={handlePrintReceipt} className="w-full sm:w-auto flex items-center justify-center gap-2">
                                <Printer size={18} /> Print
                            </Button>
                            <Button onClick={handleDownloadImage} variant="secondary" className="w-full sm:w-auto flex items-center justify-center gap-2">
                                <ImageDown size={18} /> Download
                            </Button>
                            <Button onClick={handleShareWhatsAppClick} variant="secondary" className="w-full sm:w-auto flex items-center justify-center gap-2 bg-green-100 text-green-800 hover:bg-green-200">
                                <MessageSquare size={18} /> WhatsApp
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>
            
            <Modal isOpen={isScannerModalOpen} onClose={() => setScannerModalOpen(false)} title="Scan Barcode">
                <BarcodeScanner onScanSuccess={handleBarcodeScan} />
            </Modal>

            <CustomerLookupModal 
                isOpen={isCustomerLookupOpen}
                onClose={() => setCustomerLookupOpen(false)}
                onSelectCustomer={handleSelectCustomer}
            />
        </div>
    );
};

export default POS;
