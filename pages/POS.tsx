import React, { useState, useRef, useMemo } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { Product, CartItem, Sale } from '../types';
import { formatCurrency } from '../utils/helpers';
import { Search, X, ShoppingCart, ScanLine, Printer, ImageDown } from 'lucide-react';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import BarcodeScanner from '../components/BarcodeScanner';
import Receipt from '../components/Receipt';
import toast from 'react-hot-toast';
// @ts-ignore
import html2canvas from 'html2canvas';

const ProductCard: React.FC<{ product: Product; onAddToCart: (product: Product) => void; categoryName?: string; }> = ({ product, onAddToCart, categoryName }) => {
    const isOutOfStock = product.quantity <= 0;
    return (
        <div
            className={`bg-white rounded-lg shadow-md p-4 flex flex-col justify-between transition-all relative overflow-hidden ${
                isOutOfStock ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-lg hover:-translate-y-1 cursor-pointer'
            }`}
            onClick={() => !isOutOfStock && onAddToCart(product)}
        >
            {isOutOfStock && (
                <div className="absolute inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center">
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
    const { inventory, categories, findProductByBarcode, createSale } = useAppContext();
    const [cart, setCart] = useState<CartItem[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [isScannerOpen, setScannerOpen] = useState(false);
    const [completedSale, setCompletedSale] = useState<Sale | null>(null);
    const [isCheckoutModalOpen, setCheckoutModalOpen] = useState(false);
    const [customerName, setCustomerName] = useState('');
    const [bikeNumber, setBikeNumber] = useState('');


    const receiptRef = useRef<HTMLDivElement>(null);

    const categoryMap = useMemo(() => {
        const map = new Map<string, string>();
        categories.forEach(cat => {
            map.set(cat.id, cat.name);
        });
        return map;
    }, [categories]);

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
            return [...prevCart, { ...product, cartQuantity: 1 }];
        });
    };

    const updateCartQuantity = (productId: string, newQuantity: number) => {
        const product = inventory.find(p => p.id === productId);
        
        if (newQuantity <= 0) {
            setCart(cart.filter(item => item.id !== productId));
            return;
        }

        if(product && newQuantity > product.quantity) {
            toast.error(`Only ${product.quantity} of ${product.name} in stock.`);
            setCart(cart.map(item => item.id === productId ? { ...item, cartQuantity: product.quantity } : item));
            return;
        }

        setCart(cart.map(item => item.id === productId ? { ...item, cartQuantity: newQuantity } : item));
    };

    const cartTotal = useMemo(() => cart.reduce((total, item) => total + item.salePrice * item.cartQuantity, 0), [cart]);

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
        setCheckoutModalOpen(true);
    };

    const handleConfirmCheckout = () => {
        if (!bikeNumber.trim()) {
            toast.error("Bike number is required to generate a sale ID.");
            return;
        }
        
        const sale = createSale(
            cart.map(item => ({ product: item, quantity: item.cartQuantity })),
            { customerName, bikeNumber }
        );
    
        if (sale) {
            setCompletedSale(sale);
            setCart([]);
            setCheckoutModalOpen(false);
            setCustomerName('');
            setBikeNumber('');
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
                </div>
                <div className="flex-grow overflow-y-auto pr-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {filteredInventory.map(product => (
                        <ProductCard 
                            key={product.id} 
                            product={product} 
                            onAddToCart={addToCart}
                            categoryName={categoryMap.get(product.categoryId)}
                        />
                    ))}
                </div>
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
                                <div key={item.id} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                    <div className="flex-grow">
                                        <p className="font-semibold text-sm">{item.name}</p>
                                        <p className="text-xs text-gray-500">{formatCurrency(item.salePrice)}</p>
                                    </div>
                                    <div className="flex items-center justify-between sm:justify-end gap-2">
                                        <input
                                            type="number"
                                            value={item.cartQuantity}
                                            onChange={(e) => updateCartQuantity(item.id, parseInt(e.target.value, 10) || 1)}
                                            className="w-16 p-1 border rounded-md text-center"
                                            min="1"
                                            max={item.quantity}
                                        />
                                        <p className="w-24 text-right font-semibold">{formatCurrency(item.salePrice * item.cartQuantity)}</p>
                                        <button onClick={() => updateCartQuantity(item.id, 0)} className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-100">
                                            <X size={18} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="mt-auto pt-4 border-t">
                    <div className="flex justify-between text-xl font-bold mb-4">
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
            
            <Modal isOpen={isCheckoutModalOpen} onClose={() => setCheckoutModalOpen(false)} title="Customer Information" footer={
                <div className="flex justify-end gap-2">
                    <Button variant="secondary" onClick={() => setCheckoutModalOpen(false)}>Cancel</Button>
                    <Button onClick={handleConfirmCheckout}>Confirm Sale</Button>
                </div>
            }>
                <div className="space-y-4">
                    <Input
                        label="Customer Name"
                        placeholder="e.g., Jack (Optional)"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                    />
                    <Input
                        label="Bike Number"
                        placeholder="e.g., RIP555"
                        value={bikeNumber}
                        onChange={(e) => setBikeNumber(e.target.value.replace(/\s+/g, '').toUpperCase())}
                        required
                    />
                </div>
            </Modal>

        </div>
    );
};

export default POS;