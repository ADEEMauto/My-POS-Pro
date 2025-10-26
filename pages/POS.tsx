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

    const subtotalWithLabor = useMemo(() => {
        const numericLaborCharges = parseFloat(String(laborCharges)) || 0;
        return subtotalAfterItemDiscount + numericLaborCharges;
    }, [subtotalAfterItemDiscount, laborCharges]);

    const overallDiscountAmount = useMemo(() => {
        const value = parseFloat(String(overallDiscount));
        if (isNaN(value) || value < 0) return 0;
        return overallDiscountType === 'fixed' ? value : (subtotalWithLabor * value) / 100;
    }, [overallDiscount, overallDiscountType, subtotalWithLabor]);
    
    const cartTotal = useMemo(() => {
        return subtotalWithLabor - overallDiscountAmount;
    }, [subtotalWithLabor, overallDiscountAmount]);

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
                            <p className="text-sm">Click on a product to add it.</p>
                        </div>
                    ) : (
                        cart.map(item => {
                            const lineItemTotal = (item.salePrice - (item.discountType === 'fixed' ? item.discount : (item.salePrice * item.discount / 100))) * item.cartQuantity;
                            return (
                                <div key={item.id} className="py-3 border-b border-gray-100">
                                    <div className="flex justify-between items-start gap-2">
                                        <div>
                                            <p className="font-semibold text-sm text-gray-800 leading-tight">{item.name}</p>
                                            <p className="text-xs text-gray-500">{formatCurrency(item.salePrice)}</p>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <Input
                                                type="number"
                                                value={item.cartQuantity}
                                                onChange={e => updateQuantity(item.id, parseInt(e.target.value, 10))}
                                                className="w-16 h-8 text-center"
                                                min="1"
                                                max={item.quantity}
                                                aria-label={`Quantity for ${item.name}`}
                                            />
                                            <button onClick={() => updateQuantity(item.id, 0)} className="text-red-500 hover:text-red-700 p-1" title="Remove"><X size={18} /></button>
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
                                            aria-label={`Discount for ${item.name}`}
                                        />
                                        <select
                                            value={item.discountType}
                                            onChange={e => handleItemDiscountTypeChange(item.id, e.target.value as 'fixed' | 'percentage')}
                                            className="h-8 text-xs p-1 border border-gray-300 rounded-md bg-white focus:ring-primary-500 focus:border-primary-500"
                                            aria-label={`Discount type for ${item.name}`}
                                        >
                                            <option value="fixed">Rs.</option>
                                            <option value="percentage">%</option>
                                        </select>
                                        <div className="flex-grow text-right text-sm font-semibold">
                                            {formatCurrency(lineItemTotal)}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                <div className="border-t pt-4 mt-2 space-y-2 text-sm">
                    <Button onClick={addManualItemToCart} variant="secondary" className="w-full mb-2 flex items-center justify-center gap-2"><PlusCircle size={16}/> Add Manual Item</Button>
                    <div className="flex justify-between"><span>Subtotal</span> <span className="font-semibold">{formatCurrency(subtotal)}</span></div>
                    {totalItemDiscount > 0 && <div className="flex justify-between text-red-600"><span>Item Discounts</span> <span className="font-semibold">-{formatCurrency(totalItemDiscount)}</span></div>}
                     <div className="flex justify-between font-semibold border-t pt-2">
                        <span>Subtotal after Item Discounts</span>
                        <span>{formatCurrency(subtotalAfterItemDiscount)}</span>
                    </div>

                    <div className="pt-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Labor Charges (Optional)</label>
                        <Input
                            type="number"
                            placeholder="e.g., 500"
                            value={laborCharges}
                            onChange={e => setLaborCharges(e.target.value)}
                            className="h-9"
                        />
                    </div>

                    <div className="pt-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Overall Discount</label>
                        <div className="flex items-center gap-2">
                            <Input 
                                type="number"
                                placeholder="e.g., 100 or 10"
                                value={overallDiscount}
                                onChange={e => setOverallDiscount(e.target.value)}
                                className="flex-grow h-9"
                            />
                            <select 
                                value={overallDiscountType}
                                onChange={e => setOverallDiscountType(e.target.value as 'fixed' | 'percentage')}
                                className="p-2 h-9 border border-gray-300 rounded-md bg-white focus:ring-primary-500 focus:border-primary-500"
                            >
                                <option value="fixed">Rs.</option>
                                <option value="percentage">%</option>
                            </select>
                        </div>
                        {overallDiscountAmount > 0 && <p className="text-sm text-red-600 text-right mt-1">Discount Applied: -{formatCurrency(overallDiscountAmount)}</p>}
                    </div>
                    
                    <div className="text-xl font-bold flex justify-between pt-2 border-t text-primary-700"><span>TOTAL</span> <span>{formatCurrency(cartTotal)}</span></div>
                </div>

                <Button onClick={() => setCheckoutModalOpen(true)} disabled={cart.length === 0} className="w-full mt-4 text-lg">
                    Checkout
                </Button>
            </div>
            
            <Modal isOpen={isCheckoutModalOpen} onClose={() => setCheckoutModalOpen(false)} title="Complete Sale" size="lg">
                 <div className="space-y-4">
                     <div className="p-4 bg-gray-50 rounded-lg space-y-2">
                        {previousBalance > 0 && (
                             <div className="flex justify-between items-center text-md">
                                <span>Previous Balance</span>
                                <span className="font-semibold text-red-600">{formatCurrency(previousBalance)}</span>
                            </div>
                        )}
                        <div className="flex justify-between items-center text-md">
                            <span>Today's Bill</span>
                            <span className="font-semibold">{formatCurrency(cartTotal)}</span>
                        </div>
                        <div className="flex justify-between items-center text-xl font-bold pt-2 border-t">
                            <span>TOTAL DUE</span>
                            <span className="text-primary-600">{formatCurrency(totalDue)}</span>
                        </div>
                    </div>

                    <div className="pt-4 border-t">
                        <h3 className="text-lg font-semibold text-gray-800 mb-2 flex items-center gap-2"><UserPlus size={20}/> Customer Information</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Bike Number (ID)</label>
                                <div className="flex">
                                    <Input value={bikeNumber} onChange={e => setBikeNumber(e.target.value)} placeholder="e.g., KHI-1234"/>
                                    <Button type="button" variant="ghost" onClick={() => setCustomerLookupOpen(true)} className="ml-2" title="Find Customer">
                                        <FileSearch />
                                    </Button>
                                </div>
                            </div>
                            <Input label="Customer Name" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="e.g., John Doe"/>
                            <Input label="Contact Number" type="tel" value={contactNumber} onChange={e => setContactNumber(e.target.value)} placeholder="For receipts & reminders"/>
                             <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Service Frequency</label>
                                <div className="flex items-center gap-2">
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

                    {currentCustomer && (
                         <div className="pt-4 border-t">
                             <h3 className="text-lg font-semibold text-gray-800 mb-2 flex items-center gap-2"><Star size={20}/> Loyalty Points</h3>
                             <div className="p-3 bg-indigo-50 rounded-md text-center">
                                <p className="text-sm text-indigo-700">
                                    <span className="font-semibold">{currentCustomer.name}</span> has <span className="font-bold text-lg">{currentCustomer.loyaltyPoints}</span> points available.
                                    {customerTier && <span className="ml-2 px-2 py-0.5 bg-indigo-200 text-indigo-800 text-xs rounded-full font-semibold">{customerTier.name} Tier</span>}
                                </p>
                                <p className="text-xs text-indigo-500 mt-1">
                                    Rule: {redemptionRule.points} pts = {redemptionRule.method === 'fixedValue' ? `${formatCurrency(redemptionRule.value)} off` : `${redemptionRule.value}% off`}
                                </p>
                             </div>
                             <div className="flex items-end gap-2 mt-2">
                                <Input label="Points to Redeem" type="number" placeholder="e.g., 500" value={pointsToRedeem} onChange={e => setPointsToRedeem(e.target.value)} max={currentCustomer.loyaltyPoints}/>
                             </div>
                             {loyaltyDiscountAmount > 0 && <p className="text-sm text-green-600 text-right font-semibold">Loyalty Discount: {formatCurrency(loyaltyDiscountAmount)}</p>}
                             {Number(pointsToRedeem) > currentCustomer.loyaltyPoints && <p className="text-sm text-red-500 text-right">Cannot redeem more points than available.</p>}
                         </div>
                    )}
                    
                    <div className="pt-4 border-t">
                         <Input 
                            label="Amount Paid"
                            type="number"
                            value={amountPaid}
                            onChange={(e) => setAmountPaid(e.target.value)}
                            required
                            min="0"
                            max={Math.round(totalDue)}
                            className="text-xl h-12 text-center font-bold"
                        />
                    </div>

                 </div>
                 <div className="flex justify-end gap-2 pt-6 mt-4 border-t">
                     <Button variant="secondary" onClick={() => setCheckoutModalOpen(false)}>Cancel</Button>
                     <Button onClick={handleCheckout}>Confirm Sale</Button>
                 </div>
            </Modal>
            
            <Modal isOpen={isScannerModalOpen} onClose={() => setScannerModalOpen(false)} title="Scan Product Barcode">
                <BarcodeScanner onScanSuccess={handleBarcodeScan} />
            </Modal>
            
            <CustomerLookupModal 
                isOpen={isCustomerLookupOpen}
                onClose={() => setCustomerLookupOpen(false)}
                onSelectCustomer={handleSelectCustomer}
            />

            {completedSale && (
                <Modal 
                    isOpen={isSaleCompleteModalOpen} 
                    onClose={() => {
                        setCompletedSale(null);
                        setIsSaleCompleteModalOpen(false);
                    }} 
                    title="Sale Successful!"
                    size="sm"
                >
                    <div ref={receiptRef} className="bg-white p-1">
                        <Receipt sale={completedSale} />
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-4 border-t mt-4">
                         <Button onClick={handlePrintReceipt} className="w-full flex items-center justify-center gap-2">
                            <Printer size={18} /> Print
                        </Button>
                        <Button onClick={handleDownloadImage} className="w-full flex items-center justify-center gap-2">
                            <ImageDown size={18} /> Download Image
                        </Button>
                         <Button
                            onClick={handleShareWhatsAppClick}
                            className="w-full flex items-center justify-center gap-2 col-span-2 bg-green-500 hover:bg-green-600 text-white"
                        >
                            <MessageSquare size={18} /> Send via WhatsApp
                        </Button>
                    </div>
                </Modal>
            )}

            <Modal isOpen={showWhatsAppInput} onClose={() => setShowWhatsAppInput(false)} title="Enter WhatsApp Number">
                <div className="space-y-4">
                    <p>This customer does not have a saved contact number. Please enter their WhatsApp number to proceed. The number will be saved to their profile.</p>
                    <Input 
                        type="tel"
                        placeholder="e.g., 55555555"
                        value={whatsAppNumber}
                        onChange={(e) => setWhatsAppNumber(e.target.value)}
                        autoFocus
                    />
                    <div className="flex justify-end gap-2">
                        <Button variant="secondary" onClick={() => setShowWhatsAppInput(false)}>Cancel</Button>
                        <Button onClick={handleWhatsAppNumberSubmit}>
                            Download & Open WhatsApp
                        </Button>
                    </div>
                </div>
            </Modal>

        </div>
    );
};

export default POS;
