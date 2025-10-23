
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useAppContext } from '../contexts/AppContext';
import { Product, CartItem, Sale, Customer } from '../types';
import { formatCurrency } from '../utils/helpers';
import { Search, X, ShoppingCart, ScanLine, Printer, ImageDown, Check, Tag, PlusCircle, Star } from 'lucide-react';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import BarcodeScanner from '../components/BarcodeScanner';
import Receipt from '../components/Receipt';
import toast from 'react-hot-toast';
// @ts-ignore
import html2canvas from 'html2canvas';

const ProductCard: React.FC<{ product: Product; onSelect: (productId: string) => void; isSelected: boolean; categoryName?: string; }> = ({ product, onSelect, isSelected, categoryName }) => {
    const isOutOfStock = product.quantity <= 0;
    return (
        <div
            className={`bg-white rounded-lg shadow-md p-4 flex flex-col justify-between transition-all relative overflow-hidden border-2 ${
                isOutOfStock ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-lg hover:-translate-y-1 cursor-pointer'
            } ${isSelected ? 'border-primary-600 ring-2 ring-primary-200' : 'border-transparent'}`}
            onClick={() => !isOutOfStock && onSelect(product.id)}
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

const POS: React.FC = () => {
    const { inventory, categories, findProductByBarcode, createSale, customers, redemptionRule } = useAppContext();
    const [cart, setCart] = useState<CartItem[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [isScannerOpen, setScannerOpen] = useState(false);
    const [completedSale, setCompletedSale] = useState<Sale | null>(null);
    const [isCheckoutModalOpen, setCheckoutModalOpen] = useState(false);
    
    // Checkout states
    const [customerName, setCustomerName] = useState('');
    const [bikeNumber, setBikeNumber] = useState('');
    const [contactNumber, setContactNumber] = useState('');
    const [serviceFrequencyValue, setServiceFrequencyValue] = useState<number | string>('');
    const [serviceFrequencyUnit, setServiceFrequencyUnit] = useState<'days' | 'months' | 'years'>('months');
    const [customerForCheckout, setCustomerForCheckout] = useState<Customer | null>(null);
    const [pointsToRedeem, setPointsToRedeem] = useState('');

    const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
    const [overallDiscount, setOverallDiscount] = useState('');
    const [overallDiscountType, setOverallDiscountType] = useState<'fixed' | 'percentage'>('fixed');
    const [isManualItemModalOpen, setManualItemModalOpen] = useState(false);
    const [manualItemName, setManualItemName] = useState('');
    const [manualItemPrice, setManualItemPrice] = useState('');
    const [manualItemQuantity, setManualItemQuantity] = useState('1');


    const receiptRef = useRef<HTMLDivElement>(null);

    const categoryMap = useMemo(() => {
        const map = new Map<string, string>();
        categories.forEach(cat => {
            map.set(cat.id, cat.name);
        });
        return map;
    }, [categories]);

    useEffect(() => {
        if (bikeNumber) {
            const customer = customers.find(c => c.id === bikeNumber.replace(/\s+/g, '').toUpperCase());
            setCustomerForCheckout(customer || null);
            if(customer && !customerName) {
                setCustomerName(customer.name);
            }
        } else {
            setCustomerForCheckout(null);
        }
    }, [bikeNumber, customers, customerName]);


    const addToCart = (product: Product) => {
        setCart(prevCart => {
            const existingItem = prevCart.find(item => item.id === product.id);
            if (existingItem) {
                if (existingItem.cartQuantity < product.quantity) {
                    return prevCart.map(item =>
                        item.id === product.id ? { ...item, cartQuantity: item.cartQuantity + 1 } : item
                    );
                } else {
                    toast.error(`Maximum stock for ${product.name} reached.`);
                    return prevCart;
                }
            }
            return [...prevCart, { ...product, cartQuantity: 1, discount: 0, discountType: 'fixed' }];
        });
    };

    const toggleProductSelection = (productId: string) => {
        setSelectedProductIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(productId)) {
                newSet.delete(productId);
            } else {
                newSet.add(productId);
            }
            return newSet;
        });
    };
    
    const handleAddSelectedToCart = () => {
        const cartProductIds = new Set(cart.map(item => item.id));
        let newItemsAdded = 0;
        let itemsSkipped = 0;
    
        const itemsToAdd: CartItem[] = [];
    
        selectedProductIds.forEach(productId => {
            if (cartProductIds.has(productId)) {
                itemsSkipped++;
            } else {
                const product = inventory.find(p => p.id === productId);
                if (product && product.quantity > 0) {
                    itemsToAdd.push({ ...product, cartQuantity: 1, discount: 0, discountType: 'fixed' });
                    newItemsAdded++;
                }
            }
        });
    
        if (newItemsAdded > 0) {
            setCart(prevCart => [...prevCart, ...itemsToAdd]);
            toast.success(`${newItemsAdded} item(s) added to cart.`);
        }
        
        if (itemsSkipped > 0) {
            // FIX: Replaced `toast.info` with the generic `toast()` function call, as `react-hot-toast` does not have a dedicated `info` method. This resolves the TypeScript error.
            toast(`${itemsSkipped} selected item(s) were already in the cart.`);
        }
        
        if (newItemsAdded === 0 && itemsSkipped === 0 && selectedProductIds.size > 0) {
             toast.error(`Could not add selected items. They may be out of stock.`);
        }
    
        setSelectedProductIds(new Set());
    };

    const updateCartQuantity = (productId: string, newQuantity: number) => {
        const cartItem = cart.find(item => item.id === productId);
        if (!cartItem) return;
    
        if (newQuantity <= 0) {
            setCart(cart.filter(item => item.id !== productId));
            return;
        }
    
        // For manual items, stock is not tracked from inventory
        if (cartItem.id.startsWith('manual-')) {
            setCart(cart.map(item => item.id === productId ? { ...item, cartQuantity: newQuantity } : item));
            return;
        }
        
        const product = inventory.find(p => p.id === productId);
        if(product && newQuantity > product.quantity) {
            toast.error(`Only ${product.quantity} of ${product.name} in stock.`);
            setCart(cart.map(item => item.id === productId ? { ...item, cartQuantity: product.quantity } : item));
            return;
        }
    
        setCart(cart.map(item => item.id === productId ? { ...item, cartQuantity: newQuantity } : item));
    };

    const updateItemDiscount = (productId: string, value: string, type?: 'fixed' | 'percentage') => {
        const discountValue = parseFloat(value) || 0;
        setCart(cart.map(item => {
            if (item.id === productId) {
                const newType = type || item.discountType;

                if (discountValue < 0) {
                    toast.error("Discount cannot be negative.");
                    return item;
                }
                if (newType === 'fixed' && discountValue > item.salePrice) {
                    toast.error("Fixed discount cannot be greater than item price.");
                    return { ...item, discount: item.salePrice, discountType: newType };
                }
                if (newType === 'percentage' && (discountValue < 0 || discountValue > 100)) {
                    toast.error("Percentage discount must be between 0 and 100.");
                    return { ...item, discount: Math.max(0, Math.min(100, discountValue)), discountType: newType };
                }
                
                return { ...item, discount: discountValue, discountType: newType };
            }
            return item;
        }));
    };

    const { cartSubtotal, totalItemDiscounts, parsedOverallDiscountValue, totalOverallDiscount, cartTotal } = useMemo(() => {
        const subtotal = cart.reduce((total, item) => total + item.salePrice * item.cartQuantity, 0);
        
        const itemDiscounts = cart.reduce((total, item) => {
            let discountAmount = 0;
            if (item.discountType === 'fixed') {
                discountAmount = item.discount;
            } else { // percentage
                discountAmount = (item.salePrice * item.discount) / 100;
            }
            return total + (discountAmount * item.cartQuantity);
        }, 0);

        const subtotalAfterItemDiscounts = subtotal - itemDiscounts;
        const overallDiscValue = parseFloat(overallDiscount) || 0;

        let overallDiscountAmount = 0;
        if (overallDiscountType === 'fixed') {
            overallDiscountAmount = overallDiscValue;
        } else { // percentage
            overallDiscountAmount = (subtotalAfterItemDiscounts * overallDiscValue) / 100;
        }
        
        const total = subtotalAfterItemDiscounts - overallDiscountAmount;

        return {
            cartSubtotal: subtotal,
            totalItemDiscounts: itemDiscounts,
            parsedOverallDiscountValue: overallDiscValue,
            totalOverallDiscount: overallDiscountAmount,
            cartTotal: total,
        };
    }, [cart, overallDiscount, overallDiscountType]);

    const loyaltyDiscount = useMemo(() => {
        const points = parseInt(pointsToRedeem, 10) || 0;
        if (!customerForCheckout || points <= 0) return 0;

        const availablePoints = customerForCheckout.loyaltyPoints;
        const pointsToUse = Math.min(points, availablePoints);
        
        let discount = 0;
        if (redemptionRule.method === 'fixedValue') {
            discount = (pointsToUse / redemptionRule.points) * redemptionRule.value;
        } else { // percentage
            const percentage = (pointsToUse / redemptionRule.points) * redemptionRule.value;
            discount = (cartTotal * percentage) / 100;
        }

        return Math.min(discount, cartTotal); // Cannot discount more than the total

    }, [pointsToRedeem, customerForCheckout, redemptionRule, cartTotal]);


    const handleScanSuccess = (decodedText: string) => {
        const product = findProductByBarcode(decodedText);
        if (product) {
            addToCart(product);
            toast.success(`${product.name} added to cart!`);
        } else {
            toast.error("Product not found for this barcode.");
        }
        setScannerOpen(false);
    };
    
    const handleInitiateCheckout = () => {
        if (cart.length === 0) {
            toast.error("Cart is empty.");
            return;
        }
        if (cartTotal < 0) {
            toast.error("Total amount cannot be negative.");
            return;
        }
        setCheckoutModalOpen(true);
    };

    const handleConfirmCheckout = () => {
        if (!bikeNumber.trim()) {
            toast.error("Bike number is required to generate a sale ID.");
            return;
        }
        
        const sale = createSale(
            cart,
            parsedOverallDiscountValue,
            overallDiscountType,
            { 
                customerName, 
                bikeNumber,
                contactNumber,
                serviceFrequencyValue: serviceFrequencyValue ? Number(serviceFrequencyValue) : undefined,
                serviceFrequencyUnit: serviceFrequencyValue ? serviceFrequencyUnit : undefined,
            },
            parseInt(pointsToRedeem, 10) || 0
        );
    
        if (sale) {
            setCompletedSale(sale);
            setCart([]);
            setOverallDiscount('');
            setOverallDiscountType('fixed');
            setCheckoutModalOpen(false);
            // Reset checkout form
            setCustomerName('');
            setBikeNumber('');
            setContactNumber('');
            setServiceFrequencyValue('');
            setServiceFrequencyUnit('months');
            setPointsToRedeem('');
            setCustomerForCheckout(null);
        }
    };

    const handlePrintReceipt = () => {
        const printWindow = window.open('', '_blank');
        if (printWindow && receiptRef.current) {
            printWindow.document.write('<html><head><title>Print Receipt</title>');
            printWindow.document.write('<style>body { font-family: monospace; } table { width: 100%; border-collapse: collapse; } td, th { padding: 4px; } .text-center { text-align: center; } .text-right { text-align: right; } hr { border: 0; border-top: 1px dashed #8c8c8c; } </style>');
            printWindow.document.write('</head><body>');
            printWindow.document.write(receiptRef.current.innerHTML);
            printWindow.document.write('</body></html>');
            printWindow.document.close();
            printWindow.print();
        }
    };

    const handleSaveReceiptAsImage = () => {
        if(receiptRef.current) {
            html2canvas(receiptRef.current).then((canvas: any) => {
                const link = document.createElement('a');
                link.download = `receipt-${completedSale?.id}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
            });
        }
    };

    const handleAddManualItem = () => {
        const name = manualItemName.trim();
        const price = parseFloat(manualItemPrice);
        const quantity = parseInt(manualItemQuantity, 10);
    
        if (!name || !(price > 0) || !(quantity > 0)) {
            toast.error("Please provide a valid name, price, and quantity.");
            return;
        }
    
        const newManualItem: CartItem = {
            id: `manual-${uuidv4()}`,
            name,
            salePrice: price,
            cartQuantity: quantity,
            quantity: 9999, // Effectively infinite stock for manual items
            purchasePrice: 0, // Assume no cost/profit for manual items unless specified
            categoryId: 'manual',
            subCategoryId: null,
            manufacturer: 'Manual Entry',
            location: '',
            discount: 0,
            discountType: 'fixed'
        };
    
        setCart(prevCart => [...prevCart, newManualItem]);
        toast.success(`${name} added to cart.`);
        
        // Reset and close
        setManualItemModalOpen(false);
        setManualItemName('');
        setManualItemPrice('');
        setManualItemQuantity('1');
    };

    const filteredInventory = useMemo(() => {
        return inventory.filter(product => {
            const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                product.manufacturer.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (product.barcode && product.barcode.includes(searchTerm));
            const matchesCategory = selectedCategory === 'all' || product.categoryId === selectedCategory;
            return matchesSearch && matchesCategory;
        });
    }, [inventory, searchTerm, selectedCategory]);

    return (
        <div className="flex flex-col lg:flex-row h-[calc(100vh-4rem)] gap-4">
            {/* Products Section */}
            <div className="lg:w-2/3 flex flex-col bg-white p-4 rounded-lg shadow-md">
                <div className="flex flex-col md:flex-row gap-4 mb-4">
                    <div className="flex-grow">
                         <Input
                            type="text"
                            placeholder="Search products..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            icon={<Search className="w-5 h-5 text-gray-400"/>}
                        />
                    </div>
                    <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    >
                        <option value="all">All Categories</option>
                        {categories.filter(c => c.parentId === null).map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                    </select>
                     <Button onClick={() => setScannerOpen(true)} className="flex items-center justify-center gap-2">
                        <ScanLine className="w-5 h-5" /> Scan
                    </Button>
                    <Button onClick={() => setManualItemModalOpen(true)} variant="secondary" className="flex items-center justify-center gap-2">
                        <PlusCircle className="w-5 h-5" /> Add Manual Item
                    </Button>
                </div>
                <div className="flex-grow overflow-y-auto pr-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {filteredInventory.map(product => (
                        <ProductCard 
                            key={product.id} 
                            product={product} 
                            onSelect={toggleProductSelection}
                            isSelected={selectedProductIds.has(product.id)}
                            categoryName={categoryMap.get(product.categoryId)}
                        />
                    ))}
                </div>
                {selectedProductIds.size > 0 && (
                    <div className="mt-4 flex-shrink-0">
                        <Button onClick={handleAddSelectedToCart} className="w-full text-lg justify-center">
                            Add {selectedProductIds.size} Selected Item(s) to Cart
                        </Button>
                    </div>
                )}
            </div>

            {/* Cart Section */}
            <div className="lg:w-1/3 flex flex-col bg-white p-4 rounded-lg shadow-md">
                <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2"><ShoppingCart /> Cart</h2>
                <div className="flex-grow overflow-y-auto border-t">
                    {cart.length === 0 ? (
                        <p className="text-gray-500 text-center mt-8">Your cart is empty.</p>
                    ) : (
                        <div className="divide-y divide-gray-200">
                            {cart.map(item => (
                                <div key={item.id} className="py-3 flex flex-col gap-2">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-grow">
                                            <p className="font-semibold text-sm">{item.name}</p>
                                            <p className="text-xs text-gray-500">{formatCurrency(item.salePrice)}</p>
                                        </div>
                                        <p className="font-semibold text-right">{formatCurrency((item.salePrice - (item.discountType === 'fixed' ? item.discount : (item.salePrice * item.discount / 100))) * item.cartQuantity)}</p>
                                         <button onClick={() => updateCartQuantity(item.id, 0)} className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-100 ml-1">
                                            <X size={18} />
                                        </button>
                                    </div>
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <label className="text-xs">Qty:</label>
                                            <input
                                                type="number"
                                                value={item.cartQuantity}
                                                onChange={(e) => updateCartQuantity(item.id, parseInt(e.target.value, 10) || 1)}
                                                className="w-16 p-1 border rounded-md text-center"
                                                min="1"
                                                max={item.quantity}
                                            />
                                        </div>
                                         <div className="flex items-center gap-1">
                                            <label className="text-xs text-gray-600">Disc:</label>
                                            <div className="flex items-center border border-gray-300 rounded-md shadow-sm">
                                                <input
                                                    type="number"
                                                    placeholder="0"
                                                    value={item.discount > 0 ? item.discount : ''}
                                                    onChange={(e) => updateItemDiscount(item.id, e.target.value)}
                                                    className="w-16 p-1 border-0 rounded-l-md text-right focus:ring-0"
                                                    min="0"
                                                />
                                                <select
                                                    value={item.discountType}
                                                    onChange={(e) => updateItemDiscount(item.id, String(item.discount), e.target.value as 'fixed' | 'percentage')}
                                                    className="text-xs bg-gray-50 border-0 border-l border-gray-300 rounded-r-md py-1 pl-1 pr-2 focus:ring-0"
                                                >
                                                    <option value="fixed">Rs</option>
                                                    <option value="percentage">%</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="mt-auto pt-4 border-t space-y-2">
                     <div className="flex justify-between text-md">
                        <span>Subtotal:</span>
                        <span>{formatCurrency(cartSubtotal)}</span>
                    </div>
                    <div className="flex justify-between text-md text-red-600">
                        <span>Item Discounts:</span>
                        <span>- {formatCurrency(totalItemDiscounts)}</span>
                    </div>
                    <div className="flex justify-between text-md text-red-600">
                        <span>Overall Discount:</span>
                        <span>- {formatCurrency(totalOverallDiscount)}</span>
                    </div>
                     <div className="flex justify-between items-center text-md">
                        <span className="text-gray-700">Apply Discount:</span>
                        <div className="flex items-center border border-gray-300 rounded-md shadow-sm">
                            <Input
                                type="number"
                                placeholder="0"
                                className="w-24 text-right font-semibold !py-1 !border-0 !rounded-r-none !shadow-none !ring-0"
                                value={overallDiscount}
                                onChange={(e) => setOverallDiscount(e.target.value)}
                            />
                            <select
                                value={overallDiscountType}
                                onChange={(e) => setOverallDiscountType(e.target.value as 'fixed' | 'percentage')}
                                className="text-sm bg-gray-50 focus:outline-none rounded-r-md p-2 border-l border-gray-300"
                            >
                                <option value="fixed">Rs</option>
                                <option value="percentage">%</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex justify-between text-xl font-bold pt-2 border-t">
                        <span>Total:</span>
                        <span>{formatCurrency(cartTotal)}</span>
                    </div>
                    <Button onClick={handleInitiateCheckout} disabled={cart.length === 0} className="w-full text-lg justify-center">
                        Checkout
                    </Button>
                </div>
            </div>

            <Modal isOpen={isScannerOpen} onClose={() => setScannerOpen(false)} title="Scan Barcode/QR Code">
                <BarcodeScanner onScanSuccess={handleScanSuccess} />
            </Modal>
            
            <Modal isOpen={!!completedSale} onClose={() => setCompletedSale(null)} title="Sale Complete">
                {completedSale && <Receipt sale={completedSale} ref={receiptRef} />}
                <div className="flex justify-end gap-2 mt-4 flex-wrap">
                    <Button variant="secondary" onClick={() => setCompletedSale(null)}>Close</Button>
                    <Button onClick={handlePrintReceipt} className="flex items-center gap-2"><Printer size={18}/> Print</Button>
                    <Button onClick={handleSaveReceiptAsImage} className="flex items-center gap-2"><ImageDown size={18}/> Save</Button>
                </div>
            </Modal>
            
            <Modal isOpen={isCheckoutModalOpen} onClose={() => setCheckoutModalOpen(false)} title="Customer & Checkout" footer={
                <div className="flex justify-end gap-2">
                    <Button variant="secondary" onClick={() => setCheckoutModalOpen(false)}>Cancel</Button>
                    <Button onClick={handleConfirmCheckout}>Confirm Sale</Button>
                </div>
            }>
                <div className="space-y-4">
                     <Input
                        label="Bike Number"
                        placeholder="e.g., RIP555"
                        value={bikeNumber}
                        onChange={(e) => setBikeNumber(e.target.value.replace(/\s+/g, '').toUpperCase())}
                        required
                    />
                    <Input
                        label="Customer Name"
                        placeholder="e.g., Jack (Optional)"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                    />
                     <Input
                        label="Contact Number (Optional)"
                        type="tel"
                        placeholder="e.g., 03001234567"
                        value={contactNumber}
                        onChange={(e) => setContactNumber(e.target.value)}
                    />
                     {customerForCheckout && (
                         <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-md space-y-3">
                             <div className="flex justify-between items-center">
                                 <h4 className="font-semibold text-indigo-800 flex items-center gap-2"><Star size={16}/> Loyalty Points</h4>
                                 <span className="font-bold text-indigo-800">{customerForCheckout.loyaltyPoints} pts</span>
                            </div>
                            {customerForCheckout.loyaltyPoints > 0 && (
                                <div className="flex items-end gap-2">
                                <Input
                                    label="Redeem Points"
                                    type="number"
                                    placeholder="0"
                                    min="0"
                                    max={customerForCheckout.loyaltyPoints}
                                    value={pointsToRedeem}
                                    onChange={(e) => {
                                        const val = parseInt(e.target.value, 10);
                                        if (val > customerForCheckout.loyaltyPoints) {
                                            setPointsToRedeem(String(customerForCheckout.loyaltyPoints));
                                            toast.error(`Max ${customerForCheckout.loyaltyPoints} points can be redeemed.`);
                                        } else {
                                            setPointsToRedeem(e.target.value);
                                        }
                                    }}
                                />
                                <Button size="sm" variant="ghost" onClick={() => setPointsToRedeem(String(customerForCheckout.loyaltyPoints))}>Max</Button>
                               </div>
                            )}
                         </div>
                    )}

                    <div className="p-4 border-t space-y-2 mt-4">
                        <div className="flex justify-between text-md">
                            <span>Total</span>
                            <span>{formatCurrency(cartTotal)}</span>
                        </div>
                        {loyaltyDiscount > 0 && (
                            <div className="flex justify-between text-md text-green-600">
                                <span>Loyalty Discount:</span>
                                <span>- {formatCurrency(loyaltyDiscount)}</span>
                            </div>
                        )}
                        <div className="flex justify-between text-xl font-bold pt-2 border-t">
                            <span>To Pay:</span>
                            <span>{formatCurrency(cartTotal - loyaltyDiscount)}</span>
                        </div>
                    </div>


                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Service Frequency (Optional)</label>
                        <div className="flex items-center gap-2">
                            <Input
                                type="number"
                                placeholder="e.g., 3"
                                min="1"
                                value={serviceFrequencyValue}
                                onChange={(e) => setServiceFrequencyValue(e.target.value)}
                                className="w-1/3"
                            />
                            <select
                                value={serviceFrequencyUnit}
                                onChange={(e) => setServiceFrequencyUnit(e.target.value as 'days' | 'months' | 'years')}
                                className="flex-grow p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                            >
                                <option value="days">Days</option>
                                <option value="months">Months</option>
                                <option value="years">Years</option>
                            </select>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Set a recurring service reminder for this customer.</p>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={isManualItemModalOpen} onClose={() => setManualItemModalOpen(false)} title="Add Manual Item to Cart" footer={
                <div className="flex justify-end gap-2">
                    <Button variant="secondary" onClick={() => setManualItemModalOpen(false)}>Cancel</Button>
                    <Button onClick={handleAddManualItem}>Add Item</Button>
                </div>
            }>
                <div className="space-y-4">
                    <Input
                        label="Item Name"
                        value={manualItemName}
                        onChange={e => setManualItemName(e.target.value)}
                        required
                        placeholder="e.g., Bike Wash, Service Charge"
                    />
                    <Input
                        label="Sale Price (per item)"
                        type="number"
                        value={manualItemPrice}
                        onChange={e => setManualItemPrice(e.target.value)}
                        required
                        min="0.01"
                        placeholder="e.g., 500"
                    />
                    <Input
                        label="Quantity"
                        type="number"
                        value={manualItemQuantity}
                        onChange={e => setManualItemQuantity(e.target.value)}
                        required
                        min="1"
                    />
                </div>
            </Modal>

        </div>
    );
};

export default POS;