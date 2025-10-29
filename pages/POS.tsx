import React, { useState, useRef, useMemo, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useAppContext } from '../contexts/AppContext';
import { Product, CartItem, Sale, Customer } from '../types';
import { formatCurrency } from '../utils/helpers';
import { Search, X, ShoppingCart, ScanLine, Printer, ImageDown, Check, PlusCircle, Star, MessageSquare, Trash2, UserPlus, FileSearch, ArrowUpDown } from 'lucide-react';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import BarcodeScanner from '../components/BarcodeScanner';
import Receipt from '../components/Receipt';
import toast from 'react-hot-toast';
import html2canvas from 'html2canvas';

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
    const { inventory, sales, categories, createSale, findProductByBarcode, customers, redemptionRule, updateCustomer, shopInfo, customerTiers } = useAppContext();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [sortBy, setSortBy] = useState('name_asc');
    const [cart, setCart] = useState<CartItem[]>([]);
    
    const [isCheckoutModalOpen, setCheckoutModalOpen] = useState(false);
    const [overallDiscount, setOverallDiscount] = useState<number | string>('');
    const [overallDiscountType, setOverallDiscountType] = useState<'fixed' | 'percentage'>('fixed');
    const [tuningCharges, setTuningCharges] = useState<number | string>('');
    const [laborCharges, setLaborCharges] = useState<number | string>('');
    
    const [isSaleCompleteModalOpen, setIsSaleCompleteModalOpen] = useState(false);
    const [completedSale, setCompletedSale] = useState<Sale | null>(null);
    const receiptRef = useRef<HTMLDivElement>(null);

    const [isScannerModalOpen, setScannerModalOpen] = useState(false);
    
    // Customer state for checkout
    const [customerName, setCustomerName] = useState('');
    const [bikeNumber, setBikeNumber] = useState('');
    const [contactNumber, setContactNumber] = useState('');
    const [serviceFrequencyValue, setServiceFrequencyValue] = useState<number | string>('');
    const [serviceFrequencyUnit, setServiceFrequencyUnit] = useState<'days' | 'months' | 'years'>('months');
    const [isCustomerLookupOpen, setCustomerLookupOpen] = useState(false);
    const [amountPaid, setAmountPaid] = useState<number | string>('');

    // Loyalty Points Redemption
    const [pointsToRedeem, setPointsToRedeem] = useState<number | string>('');
    const currentCustomer = useMemo(() => customers.find(c => c.id === bikeNumber.replace(/\s+/g, '').toUpperCase()), [customers, bikeNumber]);
    const customerTier = useMemo(() => currentCustomer?.tierId ? customerTiers.find(t => t.id === currentCustomer.tierId) : null, [currentCustomer, customerTiers]);
    
    // State for WhatsApp modal
    const [showWhatsAppInput, setShowWhatsAppInput] = useState(false);
    const [whatsAppNumber, setWhatsAppNumber] = useState('');
    const [customerForReceipt, setCustomerForReceipt] = useState<Customer | null>(null);


    useEffect(() => {
        // When a customer is selected, reset redemption points
        setPointsToRedeem('');
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
                // FIX: SaleItem has 'productId', not 'id'. This check is to exclude manually added items from sales stats.
                if (!item.productId.startsWith('manual-')) {
                    salesCount.set(item.productId, (salesCount.get(item.productId) || 0) + item.quantity);
                }
            });
        });
        return salesCount;
    }, [sales]);

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
                case 'name_asc':
                    return a.name.localeCompare(b.name);
                case 'name_desc':
                    return b.name.localeCompare(b.name);
                case 'price_desc':
                    return b.salePrice - a.salePrice;
                case 'price_asc':
                    return a.salePrice - b.salePrice;
                case 'most_selling':
                    return (productSales.get(b.id) || 0) - (productSales.get(a.id) || 0);
                case 'least_selling':
                    return (productSales.get(a.id) || 0) - (productSales.get(b.id) || 0);
                case 'category_asc': {
                    const catA = categoryMap.get(a.categoryId) || '';
                    const catB = categoryMap.get(b.categoryId) || '';
                    if (catA.localeCompare(catB) !== 0) {
                        return catA.localeCompare(catB);
                    }
                    const subCatA = a.subCategoryId ? categoryMap.get(a.subCategoryId) || '' : '';
                    const subCatB = b.subCategoryId ? categoryMap.get(b.subCategoryId) || '' : '';
                    return subCatA.localeCompare(subCatB);
                }
                case 'manufacturer_asc':
                    return a.manufacturer.localeCompare(b.manufacturer);
                case 'location_asc':
                    return (a.location || '').localeCompare(b.location || '');
                default:
                    return 0;
            }
        });

        return filtered;
    }, [inventory, searchTerm, selectedCategory, sortBy, productSales, categoryMap]);

    const mainCategories = useMemo(() => categories.filter(c => c.parentId === null), [categories]);

    const addToCart = (productId: string) => {
        const product = inventory.find(p => p.id === productId);
        if (!product) return;

        const existingItem = cart.find(item => item.id === productId);
        if (existingItem) {
            if (existingItem.cartQuantity < product.quantity) {
                 setCart(cart.map(item => item.id === productId ? { ...item, cartQuantity: item.cartQuantity + 1 } : item));
            } else {
                toast.error(`No more stock for ${product.name}.`);
            }
        } else {
            if (product.quantity > 0) {
                 setCart([...cart, { ...product, cartQuantity: 1, discount: 0, discountType: 'fixed' }]);
            } else {
                toast.error(`${product.name} is out of stock.`);
            }
        }
    };
    
    const addManualItemToCart = () => {
        const itemName = prompt("Enter item name:");
        if (!itemName) return;
        const itemPrice = parseFloat(prompt("Enter item price:") || '0');
        if (isNaN(itemPrice) || itemPrice <= 0) {
            toast.error("Invalid price entered.");
            return;
        }

        const manualProduct: CartItem = {
            id: `manual-${uuidv4()}`,
            name: itemName,
            salePrice: itemPrice,
            purchasePrice: 0, // No profit tracking for manual items
            quantity: Infinity, // No stock limit
            cartQuantity: 1,
            discount: 0,
            discountType: 'fixed',
            categoryId: 'manual',
            subCategoryId: null,
            manufacturer: 'N/A',
            location: 'N/A'
        };
        setCart([...cart, manualProduct]);
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
        const maxQuantity = productInStock ? productInStock.quantity : Infinity; // Infinity for manual items
        
        if (newQuantity <= 0) {
            setCart(cart.filter(item => item.id !== productId));
        } else if (newQuantity > maxQuantity) {
            toast.error(`Only ${maxQuantity} units of ${productInStock?.name} available.`);
            setCart(cart.map(item => item.id === productId ? { ...item, cartQuantity: maxQuantity } : item));
        } else {
            setCart(cart.map(item => item.id === productId ? { ...item, cartQuantity: newQuantity } : item));
        }
    };

     const handleItemDiscountChange = (productId: string, value: string) => {
        const numericValue = parseFloat(value);
        setCart(cart.map(item => 
            item.id === productId 
            ? { ...item, discount: isNaN(numericValue) ? 0 : numericValue } 
            : item
        ));
    };

    const handleItemDiscountTypeChange = (productId: string, type: 'fixed' | 'percentage') => {
        setCart(cart.map(item => 
            item.id === productId 
            ? { ...item, discountType: type } 
            : item
        ));
    };

    const subtotal = useMemo(() => cart.reduce((acc, item) => acc + (item.salePrice * item.cartQuantity), 0), [cart]);
    
    const totalItemDiscount = useMemo(() => {
        return cart.reduce((acc, item) => {
            const discount = item.discountType === 'fixed'
                ? item.discount
                : (item.salePrice * item.discount) / 100;
            return acc + (discount * item.cartQuantity);
        }, 0);
    }, [cart]);
    
    const subtotalAfterItemDiscount = subtotal - totalItemDiscount;

    const subtotalWithCharges = useMemo(() => {
        const numericTuningCharges = parseFloat(String(tuningCharges)) || 0;
        const numericLaborCharges = parseFloat(String(laborCharges)) || 0;
        return subtotalAfterItemDiscount + numericTuningCharges + numericLaborCharges;
    }, [subtotalAfterItemDiscount, tuningCharges, laborCharges]);

    const overallDiscountAmount = useMemo(() => {
        const value = parseFloat(String(overallDiscount));
        if (isNaN(value) || value < 0) return 0;
        return overallDiscountType === 'fixed' ? value : (subtotalWithCharges * value) / 100;
    }, [overallDiscount, overallDiscountType, subtotalWithCharges]);
    
    const cartTotal = useMemo(() => {
        return subtotalWithCharges - overallDiscountAmount;
    }, [subtotalWithCharges, overallDiscountAmount]);

    const previousBalance = useMemo(() => currentCustomer?.balance || 0, [currentCustomer]);
    
    const totalBeforeLoyalty = useMemo(() => {
        return cartTotal + previousBalance;
    }, [cartTotal, previousBalance]);

    const loyaltyDiscountAmount = useMemo(() => {
        if (!currentCustomer || !pointsToRedeem) return 0;
        const points = Number(pointsToRedeem);
        if (isNaN(points) || points <= 0 || points > currentCustomer.loyaltyPoints) return 0;
        
        let discount = 0;
        if (redemptionRule.method === 'fixedValue') {
            discount = (points / redemptionRule.points) * redemptionRule.value;
        } else { // percentage
            const percentage = (points / redemptionRule.points) * redemptionRule.value;
            discount = (totalBeforeLoyalty * percentage) / 100;
        }
        return discount > totalBeforeLoyalty ? totalBeforeLoyalty : discount;
    }, [pointsToRedeem, currentCustomer, redemptionRule, totalBeforeLoyalty]);

    const totalDue = useMemo(() => {
        const finalTotal = totalBeforeLoyalty - loyaltyDiscountAmount;
        return finalTotal > 0 ? finalTotal : 0;
    }, [totalBeforeLoyalty, loyaltyDiscountAmount]);

    // Effect to update amountPaid when totalDue changes
    useEffect(() => {
        if(isCheckoutModalOpen) {
            setAmountPaid(Math.round(totalDue));
        }
    }, [totalDue, isCheckoutModalOpen]);

    const handleCheckout = () => {
        const numericAmountPaid = Number(amountPaid) || 0;
        const roundedTotalDue = Math.round(totalDue);

        if (numericAmountPaid < roundedTotalDue && (!bikeNumber.trim() || !customerName.trim())) {
            toast.error("Customer details (Bike No & Name) are required when the bill is not fully paid.");
            return;
        }
        
        let finalCustomerName = customerName.trim();
        let finalBikeNumber = bikeNumber.trim();

        if (!finalCustomerName && !finalBikeNumber) {
            finalCustomerName = 'Walk-in';
            // Use a single, static ID for all walk-in customers to consolidate them.
            finalBikeNumber = 'WALKIN';
        } else if (!finalBikeNumber) {
            // If only name is given, generate a unique ID.
            finalBikeNumber = `${finalCustomerName.replace(/\s+/g, '').toUpperCase()}-${Date.now()}`;
        } else if (!finalCustomerName) {
            // If only bike number is given, find existing name or generate a default one.
            const existingCustomer = customers.find(c => c.id === finalBikeNumber.replace(/\s+/g, '').toUpperCase());
            finalCustomerName = existingCustomer ? existingCustomer.name : `Customer ${finalBikeNumber}`;
        }

        const sale = createSale(
            cart,
            parseFloat(String(overallDiscount)) || 0,
            overallDiscountType,
            { customerName: finalCustomerName, bikeNumber: finalBikeNumber, contactNumber, serviceFrequencyValue: Number(serviceFrequencyValue) || undefined, serviceFrequencyUnit: serviceFrequencyValue ? serviceFrequencyUnit : undefined },
            Number(pointsToRedeem) || 0,
            parseFloat(String(tuningCharges)) || 0,
            parseFloat(String(laborCharges)) || 0,
            Number(amountPaid) || 0
        );

        if (sale) {
            setCompletedSale(sale);
            setIsSaleCompleteModalOpen(true);
            setCheckoutModalOpen(false);
            // Reset state for next sale
            setCart([]);
            setOverallDiscount('');
            setTuningCharges('');
            setLaborCharges('');
            setCustomerName('');
            setBikeNumber('');
            setContactNumber('');
            setServiceFrequencyValue('');
            setPointsToRedeem('');
            setAmountPaid('');
        }
    };
    
    const handlePrintReceipt = () => {
        if (receiptRef.current) {
            const printContents = receiptRef.current.innerHTML;
            const originalContents = document.body.innerHTML;
            document.body.innerHTML = printContents;
            window.print();
            document.body.innerHTML = originalContents;
            window.location.reload(); // Reload to restore styles and event handlers
        }
    };

    const handleDownloadImage = async () => {
        if (receiptRef.current) {
            const toastId = toast.loading("Generating image...");
            try {
                const canvas = await html2canvas(receiptRef.current, { scale: 3, useCORS: true, backgroundColor: '#ffffff' });
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
        setCustomerForReceipt(customer || null); // Store customer for later use
        if (customer?.contactNumber) {
            handleShareWhatsApp(customer.contactNumber);
        } else {
            setWhatsAppNumber(''); // Clear previous number
            setShowWhatsAppInput(true);
        }
    };

    const handleWhatsAppNumberSubmit = () => {
        if (!whatsAppNumber.trim()) {
            toast.error("Please enter a valid number.");
            return;
        }
        handleShareWhatsApp(whatsAppNumber);
        
        // Attempt to save the number back to the customer profile
        if (customerForReceipt && !customerForReceipt.contactNumber) {
            updateCustomer(customerForReceipt.id, { ...customerForReceipt, contactNumber: whatsAppNumber });
            toast.success(`Contact number saved for ${customerForReceipt.name}.`);
        }

        setShowWhatsAppInput(false);
    };

    const handleShareWhatsApp = async (number: string) => {
        if (!completedSale || !receiptRef.current) {
            toast.error("Receipt data not available.");
            return;
        }
    
        // 1. Format phone number
        let formattedNumber = number.replace(/\D/g, '');
        if (formattedNumber.startsWith('0')) {
            formattedNumber = '92' + formattedNumber.substring(1);
        } else if (!formattedNumber.startsWith('92')) {
            // Assuming PK numbers if not starting with 92.
            formattedNumber = '92' + formattedNumber;
        }
        
        const toastId = toast.loading("Generating receipt image...");
    
        try {
            // 2. Generate HD image from the receipt element
            const canvas = await html2canvas(receiptRef.current, {
                scale: 3, // Higher scale for HD quality
                useCORS: true,
                backgroundColor: '#ffffff',
            });
            const dataUrl = canvas.toDataURL('image/png');
    
            // 3. Trigger download of the image
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = `receipt-${completedSale.id}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            toast.success("Receipt downloaded. Opening WhatsApp...", { id: toastId, duration: 4000 });
    
            // 4. Open WhatsApp in a new tab without any pre-filled text
            const whatsappUrl = `https://wa.me/${formattedNumber}`;
            window.open(whatsappUrl, '_blank');
    
        } catch (error) {
            console.error("Failed to generate or open WhatsApp:", error);
            toast.error("Could not generate receipt image.", { id: toastId });
        }
    };
    
    const handleSelectCustomer = (customer: Customer) => {
        setBikeNumber(customer.id);
        setCustomerName(customer.name);
        setContactNumber(customer.contactNumber || '');
        setServiceFrequencyValue(customer.serviceFrequencyValue || '');
        if(customer.serviceFrequencyUnit) setServiceFrequencyUnit(customer.serviceFrequencyUnit);
    };

    const handleClearCart = () => {
        if (cart.length > 0 && window.confirm("Are you sure you want to clear the entire cart?")) {
            setCart([]);
            toast.success("Cart cleared.");
        }
    };

    return (
        <div className="flex h-[calc(100vh-4rem)]"> {/* Full height minus header */}
            {/* Main Content - Product Grid */}
            <div className="flex-1 flex flex-col p-4">
                <div className="flex flex-col md:flex-row gap-4 mb-4">
                    <div className="relative flex-grow">
                        <Input 
                          placeholder="Search by name or barcode..." 
                          value={searchTerm} 
                          onChange={e => setSearchTerm(e.target.value)}
                          icon={<Search className="w-5 h-5 text-gray-400" />}
                        />
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <select
                            value={selectedCategory}
                            onChange={e => setSelectedCategory(e.target.value)}
                            className="p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                        >
                            <option value="all">All Categories</option>
                            {mainCategories.map(cat => (
                                <optgroup label={cat.name} key={cat.id}>
                                    <option value={cat.id}>{cat.name} (All)</option>
                                    {categories.filter(sub => sub.parentId === cat.id).map(sub => (
                                        <option key={sub.id} value={sub.id}>&nbsp;&nbsp;{sub.name}</option>
                                    ))}
                                </optgroup>
                            ))}
                        </select>
                        <select
                            value={sortBy}
                            onChange={e => setSortBy(e.target.value)}
                            className="p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                            aria-label="Sort by"
                        >
                            <option value="name_asc">Alphabetical (A-Z)</option>
                            <option value="name_desc">Alphabetical (Z-A)</option>
                            <option value="price_desc">Price: High to Low</option>
                            <option value="price_asc">Price: Low to High</option>
                            <option value="most_selling">Most Selling</option>
                            <option value="least_selling">Least Selling</option>
                            <option value="category_asc">Category</option>
                            <option value="manufacturer_asc">Manufacturer</option>
                            <option value="location_asc">Location</option>
                        </select>
                         <Button onClick={() => setScannerModalOpen(true)} variant="secondary" className="px-3" aria-label="Scan barcode">
                            <ScanLine className="w-5 h-5" />
                        </Button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 -mr-2">
                     <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {filteredInventory.map(product => (
                            <ProductCard 
                                key={product.id} 
                                product={product} 
                                onSelect={addToCart} 
                                isSelected={cart.some(item => item.id === product.id)}
                                categoryName={categoryMap.get(product.subCategoryId || product.categoryId)}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {/* Right Sidebar - Cart */}
            <div className="w-full md:w-96 bg-white shadow-lg flex flex-col p-4 border-l">
                <h2 className="text-2xl font-bold mb-4 text-gray-800 flex items-center justify-between">
                    <span>Cart</span>
                    <div className="flex items-center gap-2">
                        {cart.length > 0 && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleClearCart}
                                className="text-red-600 hover:bg-red-100 hover:text-red-700 px-2 py-1 flex items-center gap-1"
                                aria-label="Clear cart"
                            >
                                <Trash2 size={14} /> Clear
                            </Button>
                        )}
                        <span className="text-sm font-normal text-white bg-primary-600 rounded-full px-2 py-0.5">{cart.length} items</span>
                    </div>
                </h2>
                
                <div className="flex-1 overflow-y-auto -mr-2 pr-2 space-y-3">
                    {cart.length === 0 ? (
                        <div className="text-center text-gray-500 pt-10">
                            <ShoppingCart size={48} className="mx-auto text-gray-300" />
                            <p>Your cart is empty</p>
                            <p className="text-sm">Click an item to add it to the cart</p>
                        </div>
                    ) : (
                        cart.map(item => (
                            <div key={item.id} className="bg-gray-50 p-3 rounded-md">
                                <div className="flex justify-between items-start">
                                    <p className="font-semibold text-sm flex-grow pr-2">{item.name}</p>
                                    <button onClick={() => updateQuantity(item.id, 0)} className="text-gray-400 hover:text-red-600 shrink-0"><X size={16} /></button>
                                </div>
                                <div className="flex items-center justify-between mt-2">
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => updateQuantity(item.id, item.cartQuantity - 1)} className="p-1 border rounded-md">-</button>
                                        <Input 
                                            type="number" 
                                            value={item.cartQuantity} 
                                            onChange={(e) => updateQuantity(item.id, parseInt(e.target.value) || 1)} 
                                            className="w-12 text-center h-8"
                                        />
                                        <button onClick={() => updateQuantity(item.id, item.cartQuantity + 1)} className="p-1 border rounded-md">+</button>
                                    </div>
                                    <span className="font-semibold">{formatCurrency(item.salePrice * item.cartQuantity)}</span>
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
                        ))
                    )}
                    <Button onClick={addManualItemToCart} variant="secondary" size="sm" className="w-full mt-2 flex items-center justify-center gap-2">
                        <PlusCircle size={16}/> Add Manual Item/Service
                    </Button>
                </div>

                <div className="mt-auto pt-4 border-t">
                    <div className="space-y-2 text-sm">
                         <div className="flex justify-between">
                            <span>Subtotal</span>
                            <span>{formatCurrency(subtotal)}</span>
                        </div>
                         {totalItemDiscount > 0 && (
                            <div className="flex justify-between text-red-600">
                                <span>Item Discounts</span>
                                <span>-{formatCurrency(totalItemDiscount)}</span>
                            </div>
                        )}
                         <div className="flex justify-between font-semibold">
                            <span>Total</span>
                            <span className="text-lg">{formatCurrency(subtotalAfterItemDiscount)}</span>
                        </div>
                    </div>
                    <Button 
                        onClick={() => setCheckoutModalOpen(true)} 
                        disabled={cart.length === 0 && !tuningCharges && !laborCharges}
                        className="w-full mt-4 text-lg"
                    >
                        Checkout
                    </Button>
                </div>
            </div>
            
             {/* Checkout Modal */}
            <Modal 
                isOpen={isCheckoutModalOpen} 
                onClose={() => setCheckoutModalOpen(false)} 
                title="Complete Sale" 
                size="xl"
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setCheckoutModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleCheckout} disabled={!bikeNumber.trim() && Math.round(totalDue) > Number(amountPaid)}>
                            Complete Sale
                        </Button>
                    </>
                }
            >
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left Side: Customer & Charges */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Customer & Charges</h3>
                        <div>
                             <label className="block text-sm font-medium text-gray-700 mb-1">Customer (Bike No.)</label>
                             <div className="flex gap-2">
                                <Input 
                                    placeholder="e.g., KHI1234" 
                                    value={bikeNumber} 
                                    onChange={e => setBikeNumber(e.target.value)} 
                                />
                                <Button type="button" variant="secondary" onClick={() => setCustomerLookupOpen(true)} className="px-3" aria-label="Find customer"><FileSearch size={18}/></Button>
                            </div>
                        </div>
                        <Input label="Customer Name" placeholder="e.g., John Doe" value={customerName} onChange={e => setCustomerName(e.target.value)} />
                        
                         {currentCustomer && (
                            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                                <p className="font-semibold text-blue-800">Existing Customer Found</p>
                                <p className="text-sm text-blue-700">Name: {currentCustomer.name}</p>
                                <p className="text-sm text-blue-700">Tier: {customerTier?.name || 'N/A'}</p>
                                <p className="text-sm text-blue-700">Balance: {formatCurrency(currentCustomer.balance)}</p>
                                <p className="text-sm text-blue-700">Points: {currentCustomer.loyaltyPoints}</p>
                            </div>
                        )}

                        <Input label="Tuning (Rs)" type="number" value={tuningCharges} onChange={e => setTuningCharges(e.target.value)} placeholder="0" />
                        <Input label="Labor Charges (Rs)" type="number" value={laborCharges} onChange={e => setLaborCharges(e.target.value)} placeholder="0" />

                        <div className="pt-4 border-t">
                            <h4 className="text-md font-semibold mb-2">New Customer Settings</h4>
                            <Input label="Contact Number (Optional)" value={contactNumber} onChange={e => setContactNumber(e.target.value)} />
                             <div className="mt-2">
                                <label className="block text-sm font-medium text-gray-700">Service Frequency (Optional)</label>
                                <div className="flex items-center gap-2 mt-1">
                                    <Input type="number" placeholder="e.g., 3" min="1" value={serviceFrequencyValue} onChange={(e) => setServiceFrequencyValue(e.target.value)} className="w-1/3" />
                                    <select value={serviceFrequencyUnit} onChange={(e) => setServiceFrequencyUnit(e.target.value as 'days' | 'months' | 'years')} className="flex-grow p-2 border border-gray-300 rounded-md">
                                        <option value="days">Days</option>
                                        <option value="months">Months</option>
                                        <option value="years">Years</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                    </div>
                    {/* Right Side: Summary & Payment */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Summary & Payment</h3>
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Overall Discount</label>
                            <div className="flex items-center gap-2">
                                <Input type="number" value={overallDiscount} onChange={e => setOverallDiscount(e.target.value)} placeholder="0" />
                                <select value={overallDiscountType} onChange={e => setOverallDiscountType(e.target.value as 'fixed' | 'percentage')} className="p-2 border border-gray-300 rounded-md">
                                    <option value="fixed">Rs.</option>
                                    <option value="percentage">%</option>
                                </select>
                            </div>
                        </div>
                        
                         {currentCustomer && currentCustomer.loyaltyPoints > 0 && (
                             <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Redeem Loyalty Points</label>
                                <Input 
                                    type="number" 
                                    value={pointsToRedeem} 
                                    onChange={e => setPointsToRedeem(e.target.value)} 
                                    placeholder={`Max ${currentCustomer.loyaltyPoints} points`} 
                                    max={currentCustomer.loyaltyPoints}
                                />
                                {loyaltyDiscountAmount > 0 && (
                                    <p className="text-sm text-green-600 mt-1">
                                        This gives a discount of {formatCurrency(loyaltyDiscountAmount)}.
                                    </p>
                                )}
                            </div>
                        )}

                        <div className="mt-4 p-4 bg-gray-100 rounded-lg space-y-2">
                            <div className="flex justify-between text-sm">
                                <span>Cart Total:</span>
                                <span>{formatCurrency(cartTotal)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span>Previous Balance:</span>
                                <span className={previousBalance > 0 ? "text-red-600" : ""}>{formatCurrency(previousBalance)}</span>
                            </div>
                             {loyaltyDiscountAmount > 0 && (
                                <div className="flex justify-between text-sm text-green-600">
                                    <span>Loyalty Discount:</span>
                                    <span>- {formatCurrency(loyaltyDiscountAmount)}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-lg font-bold pt-1 border-t">
                                <span>Total Due:</span>
                                <span className="text-primary-600">{formatCurrency(totalDue)}</span>
                            </div>
                        </div>

                        <div>
                            <Input 
                                label="Amount Paid" 
                                type="number" 
                                value={amountPaid} 
                                onChange={e => setAmountPaid(e.target.value)} 
                                required
                            />
                        </div>

                    </div>
                </div>
            </Modal>

            <Modal isOpen={isScannerModalOpen} onClose={() => setScannerModalOpen(false)} title="Scan Barcode">
                 <p className="text-center text-gray-600 mb-4">Point the camera at a barcode to add the item to the cart.</p>
                <BarcodeScanner onScanSuccess={handleBarcodeScan} />
            </Modal>
            
            <Modal isOpen={isSaleCompleteModalOpen} onClose={() => setIsSaleCompleteModalOpen(false)} title="Sale Complete!" size="lg">
                <div className="flex flex-col md:flex-row gap-6">
                    <div className="flex-grow">
                        <h3 className="font-semibold text-lg text-center mb-2">Receipt</h3>
                        <div className="border rounded-md p-2 bg-gray-50 max-h-96 overflow-y-auto">
                            <Receipt sale={completedSale!} ref={receiptRef} />
                        </div>
                    </div>
                    <div className="flex flex-col gap-4 w-full md:w-48">
                         <h3 className="font-semibold text-lg text-center mb-2">Actions</h3>
                         <Button onClick={handlePrintReceipt} className="w-full flex items-center justify-center gap-2"><Printer size={18}/> Print Receipt</Button>
                         <Button onClick={handleDownloadImage} variant="secondary" className="w-full flex items-center justify-center gap-2"><ImageDown size={18}/> Download Image</Button>
                         <Button onClick={handleShareWhatsAppClick} variant="secondary" className="w-full flex items-center justify-center gap-2 bg-green-500 text-white hover:bg-green-600 focus:ring-green-400">
                             <MessageSquare size={18}/> WhatsApp
                         </Button>
                         <Button onClick={() => setIsSaleCompleteModalOpen(false)} variant="secondary" className="w-full">Close</Button>
                    </div>
                </div>
                {showWhatsAppInput && (
                    <div className="mt-4 p-4 border-t">
                        <h4 className="font-semibold mb-2">Send Receipt via WhatsApp</h4>
                        <p className="text-sm text-gray-600 mb-2">Customer has no saved number. Enter a number to continue.</p>
                        <div className="flex gap-2">
                             <Input 
                                placeholder="e.g., 03001234567" 
                                value={whatsAppNumber} 
                                onChange={e => setWhatsAppNumber(e.target.value)} 
                                autoFocus
                             />
                             <Button onClick={handleWhatsAppNumberSubmit}>Send</Button>
                        </div>
                    </div>
                )}
            </Modal>
            
            <CustomerLookupModal
                isOpen={isCustomerLookupOpen}
                onClose={() => setCustomerLookupOpen(false)}
                onSelectCustomer={handleSelectCustomer}
            />
        </div>
    );
};
// FIX: Added default export for POS component.
export default POS;