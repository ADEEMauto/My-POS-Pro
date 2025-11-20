
import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { Sale, SaleItem, Product, OutsideServiceItem } from '../types';
import { formatCurrency, formatDate } from '../utils/helpers';
import { Eye, Trash2, FileText, Star, ShoppingBag, Pencil, PlusCircle, X, Hammer } from 'lucide-react';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import toast from 'react-hot-toast';
import { v4 as uuidv4 } from 'uuid';
// @ts-ignore
import jsPDF from 'jspdf';
// @ts-ignore
import html2canvas from 'html2canvas';


const SaleDetailsModal: React.FC<{ sale: Sale; onClose: () => void }> = ({ sale, onClose }) => {
    
    const estimatedProfit = sale.items.reduce((acc, item) => {
        const cost = item.purchasePrice || 0; // Handle old sales data without purchasePrice
        return acc + (item.price - cost) * item.quantity;
    }, 0);
    
    const hasDiscounts = (sale.totalItemDiscounts || 0) > 0 || (sale.overallDiscount || 0) > 0 || (sale.loyaltyDiscount || 0) > 0;
    const revenueBase = (sale.subtotal - (sale.totalItemDiscounts || 0)) + (sale.tuningCharges || 0) + (sale.laborCharges || 0);
    const calculatedOverallDiscount = sale.overallDiscountType === 'fixed'
        ? sale.overallDiscount
        : (revenueBase * sale.overallDiscount) / 100;

    return (
        <Modal isOpen={true} onClose={onClose} title={`Sale Details - ID: ${sale.id}`} size="lg">
            <div className="space-y-4">
                <div>
                    <p><strong>Date:</strong> {formatDate(sale.date)}</p>
                    {sale.customerName && <p><strong>Customer:</strong> {sale.customerName}</p>}
                    {sale.customerId && <p><strong>Bike No:</strong> {sale.customerId}</p>}
                </div>
                <div className="max-h-80 overflow-y-auto pr-2">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0">
                            <tr>
                                <th className="px-4 py-2">Product Name</th>
                                <th className="px-4 py-2 text-center">Qty</th>
                                <th className="px-4 py-2 text-right">Price/Item</th>
                                <th className="px-4 py-2 text-right">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {sale.items.map((item, index) => (
                                <tr key={`${item.productId}-${index}`}>
                                    <td className="px-4 py-2 font-medium text-gray-900">
                                        {item.name}
                                        {item.discount > 0 && (
                                            <span className="block text-xs text-red-500">
                                                (-{item.discountType === 'fixed' ? formatCurrency(item.discount) : `${item.discount}%`}/item)
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-2 text-center">{item.quantity}</td>
                                    <td className="px-4 py-2 text-right">
                                         {item.discount > 0 ? (
                                            <del className="text-xs text-gray-400">{formatCurrency(item.originalPrice)}</del>
                                         ) : null}
                                         {' '}
                                         {formatCurrency(item.price)}
                                    </td>
                                    <td className="px-4 py-2 text-right font-semibold">{formatCurrency(item.price * item.quantity)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="pt-2 border-t space-y-1">
                     {hasDiscounts && (
                        <div className="flex justify-between items-baseline text-sm">
                            <p><strong>Subtotal:</strong></p>
                            <p>{formatCurrency(sale.subtotal)}</p>
                        </div>
                    )}
                    {(sale.totalItemDiscounts || 0) > 0 && (
                         <div className="flex justify-between items-baseline text-sm text-red-600">
                            <p><strong>Item Discounts:</strong></p>
                            <p>- {formatCurrency(sale.totalItemDiscounts)}</p>
                        </div>
                    )}
                    {(sale.tuningCharges || 0) > 0 && (
                        <div className="flex justify-between items-baseline text-sm text-blue-600">
                            <p><strong>Tuning:</strong></p>
                            <p>+ {formatCurrency(sale.tuningCharges!)}</p>
                        </div>
                    )}
                    {(sale.laborCharges || 0) > 0 && (
                        <div className="flex justify-between items-baseline text-sm text-blue-600">
                            <p><strong>Labor Charges:</strong></p>
                            <p>+ {formatCurrency(sale.laborCharges!)}</p>
                        </div>
                    )}
                    {(sale.outsideServices && sale.outsideServices.length > 0) && (
                        <div className="flex justify-between items-baseline text-sm text-cyan-600">
                           <p><strong>Outside Services:</strong></p>
                           <p>+ {formatCurrency(sale.totalOutsideServices || 0)}</p>
                        </div>
                    )}
                    {(sale.overallDiscount || 0) > 0 && (
                         <div className="flex justify-between items-baseline text-sm text-red-600">
                            <p><strong>Overall Discount {sale.overallDiscountType === 'percentage' && `(${sale.overallDiscount}%)`}</strong></p>
                            <p>- {formatCurrency(calculatedOverallDiscount)}</p>
                        </div>
                    )}
                     {(sale.loyaltyDiscount || 0) > 0 && (
                         <div className="flex justify-between items-baseline text-sm text-green-600">
                            <p><strong>Loyalty Discount:</strong></p>
                            <p>- {formatCurrency(sale.loyaltyDiscount!)}</p>
                        </div>
                    )}
                    <div className="flex justify-between items-baseline pt-1 border-t">
                        <p><strong>Total Amount:</strong></p> 
                        <p><span className="font-bold text-lg text-primary-600">{formatCurrency(sale.total)}</span></p>
                    </div>
                     <div className="flex justify-between items-baseline">
                        <p><strong>Est. Profit:</strong></p> 
                        <p><span className="font-bold text-base text-green-600">{formatCurrency(estimatedProfit)}</span></p>
                    </div>
                </div>
                {(sale.pointsEarned !== undefined) && (
                    <div className="pt-2 border-t space-y-1 text-sm">
                         <h4 className="font-semibold flex items-center gap-1"><Star size={14}/> Loyalty Summary</h4>
                         {sale.promotionApplied && (
                            <p className="p-2 bg-green-50 text-green-700 rounded-md text-center font-semibold">
                                ✨ Promotion Applied: {sale.promotionApplied.name} ({sale.promotionApplied.multiplier}x Points!) ✨
                            </p>
                         )}
                         <div className="flex justify-between"><span>Points Earned:</span> <span>{sale.pointsEarned}</span></div>
                         <div className="flex justify-between"><span>Points Redeemed:</span> <span>{sale.redeemedPoints || 0}</span></div>
                         <div className="flex justify-between font-bold"><span>Final Balance:</span> <span>{sale.finalLoyaltyPoints}</span></div>
                    </div>
                )}
            </div>
             <div className="flex justify-end gap-2 pt-4">
                <Button variant="secondary" onClick={onClose}>Close</Button>
            </div>
        </Modal>
    );
};

const ReverseSaleModal: React.FC<{ sale: Sale; onClose: () => void; onConfirm: (itemsToReturn: SaleItem[]) => void }> = ({ sale, onClose, onConfirm }) => {
    const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());

    const handleToggleItem = (productId: string) => {
        const newSet = new Set(selectedProductIds);
        if (newSet.has(productId)) {
            newSet.delete(productId);
        } else {
            newSet.add(productId);
        }
        setSelectedProductIds(newSet);
    };
    
    const handleToggleAll = () => {
        if (selectedProductIds.size === sale.items.length) {
            setSelectedProductIds(new Set());
        } else {
            setSelectedProductIds(new Set(sale.items.map(item => item.productId)));
        }
    };

    const handleConfirmClick = () => {
        const itemsToReturn = sale.items.filter(item => selectedProductIds.has(item.productId));
        onConfirm(itemsToReturn);
    };

    const allSelected = selectedProductIds.size === sale.items.length && sale.items.length > 0;

    return (
        <Modal isOpen={true} onClose={onClose} title="Select Items to Return to Inventory" size="lg">
            <p className="text-sm text-gray-600 mb-4">
                Select which items from sale <span className="font-mono bg-gray-100 p-1 rounded">{sale.id}</span> you want to return to stock. This will update the sale record. If all items are returned, the sale will be deleted.
            </p>

            <div className="border rounded-md">
                <div className="flex items-center p-3 bg-gray-50 border-b">
                    <input
                        id="select-all-checkbox"
                        type="checkbox"
                        checked={allSelected}
                        onChange={handleToggleAll}
                        className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                    />
                    <label htmlFor="select-all-checkbox" className="ml-3 text-sm font-medium text-gray-700 cursor-pointer">
                       {allSelected ? 'Deselect All' : 'Select All'}
                    </label>
                </div>
                <ul className="max-h-80 overflow-y-auto divide-y divide-gray-200">
                    {sale.items.map(item => (
                        <li key={item.productId} className="p-3 flex items-center hover:bg-gray-50">
                            <input
                                id={`item-checkbox-${item.productId}`}
                                type="checkbox"
                                checked={selectedProductIds.has(item.productId)}
                                onChange={() => handleToggleItem(item.productId)}
                                className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                            />
                            <label htmlFor={`item-checkbox-${item.productId}`} className="ml-3 flex-grow cursor-pointer">
                                <p className="font-medium text-gray-800">{item.name}</p>
                                <p className="text-xs text-gray-500">Qty: {item.quantity} @ {formatCurrency(item.price)}</p>
                            </label>
                        </li>
                    ))}
                </ul>
            </div>
            <div className="flex justify-end gap-2 pt-4 mt-4 border-t">
                <Button variant="secondary" onClick={onClose}>Cancel</Button>
                <Button variant="danger" onClick={handleConfirmClick} disabled={selectedProductIds.size === 0}>
                    Confirm Reversal
                </Button>
            </div>
        </Modal>
    );
};

const EditSaleModal: React.FC<{ sale: Sale; onClose: () => void; }> = ({ sale, onClose }) => {
    const { updateSale } = useAppContext();
    
    // Deep copy items to avoid direct mutation
    const [items, setItems] = useState<SaleItem[]>(() => JSON.parse(JSON.stringify(sale.items)));
    const [overallDiscount, setOverallDiscount] = useState<number | string>(sale.overallDiscount || '');
    const [overallDiscountType, setOverallDiscountType] = useState<'fixed' | 'percentage'>(sale.overallDiscountType || 'fixed');
    const [tuningCharges, setTuningCharges] = useState<number | string>(sale.tuningCharges || '');
    const [laborCharges, setLaborCharges] = useState<number | string>(sale.laborCharges || '');
    const [outsideServices, setOutsideServices] = useState<OutsideServiceItem[]>(() => JSON.parse(JSON.stringify(sale.outsideServices || [])));
    const [customerName, setCustomerName] = useState(sale.customerName);
    const [bikeNumber, setBikeNumber] = useState(sale.customerId);
    
    const handleItemDiscountChange = (productId: string, value: string) => {
        const numericValue = parseFloat(value);
        setItems(items.map(item => 
            item.productId === productId 
            ? { ...item, discount: isNaN(numericValue) ? 0 : numericValue } 
            : item
        ));
    };

    const handleItemDiscountTypeChange = (productId: string, type: 'fixed' | 'percentage') => {
        setItems(items.map(item => 
            item.productId === productId 
            ? { ...item, discountType: type } 
            : item
        ));
    };

    // Outside Services handlers
    const handleAddService = () => setOutsideServices([...outsideServices, { id: uuidv4(), name: '', amount: 0 }]);
    const handleUpdateService = (id: string, field: 'name' | 'amount', value: string) => {
        setOutsideServices(outsideServices.map(s => s.id === id ? { ...s, [field]: field === 'amount' ? Number(value) || 0 : value } : s));
    };
    const handleRemoveService = (id: string) => {
        setOutsideServices(outsideServices.filter(s => s.id !== id));
    };


    const { newTotal, newBalanceDue } = useMemo(() => {
        const subtotal = items.reduce((acc, item) => acc + item.originalPrice * item.quantity, 0);
        const totalItemDiscounts = items.reduce((acc, item) => {
            const discountAmount = item.discountType === 'fixed' ? item.discount : (item.originalPrice * item.discount) / 100;
            return acc + (discountAmount * item.quantity);
        }, 0);
        
        const subtotalAfterItemDiscounts = subtotal - totalItemDiscounts;
        const numTuningCharges = Number(tuningCharges) || 0;
        const numLaborCharges = Number(laborCharges) || 0;
        const totalWithCharges = subtotalAfterItemDiscounts + numTuningCharges + numLaborCharges;

        const numOverallDiscount = Number(overallDiscount) || 0;
        const overallDiscountAmount = overallDiscountType === 'fixed' 
            ? numOverallDiscount 
            : (totalWithCharges * numOverallDiscount) / 100;
        
        const totalOutsideServicesAmount = outsideServices.reduce((sum, s) => sum + s.amount, 0);
        const cartTotal = (totalWithCharges - overallDiscountAmount) + totalOutsideServicesAmount;
        
        // Use the original previous balance for calculation display
        const totalBeforeLoyalty = cartTotal + (sale.previousBalanceBroughtForward || 0);
        const calculatedNewTotal = totalBeforeLoyalty - (sale.loyaltyDiscount || 0);
        
        const roundedNewTotal = Math.round(calculatedNewTotal);
        const calculatedNewBalanceDue = roundedNewTotal - sale.amountPaid;

        return { newTotal: roundedNewTotal, newBalanceDue: calculatedNewBalanceDue };
    }, [items, overallDiscount, overallDiscountType, tuningCharges, laborCharges, outsideServices, sale]);

    const handleSaveChanges = () => {
        if (!bikeNumber.trim() || !customerName.trim()) {
            toast.error("Bike Number and Customer Name cannot be empty.");
            return;
        }

        updateSale(sale.id, {
            items: items,
            overallDiscount: Number(overallDiscount) || 0,
            overallDiscountType: overallDiscountType,
            tuningCharges: Number(tuningCharges) || 0,
            laborCharges: Number(laborCharges) || 0,
            outsideServices: outsideServices,
            customerName: customerName,
            customerId: bikeNumber.replace(/\s+/g, '').toUpperCase(),
        });
        onClose();
    };

    return (
        <Modal isOpen={true} onClose={onClose} title={`Edit Sale - ID: ${sale.id}`} size="xl">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <div>
                        <h3 className="font-semibold text-lg border-b pb-2">Customer Details</h3>
                        <div className="mt-3 space-y-3">
                            <Input label="Bike Number (Unique ID)" value={bikeNumber} onChange={e => setBikeNumber(e.target.value)} />
                            <Input label="Customer Name" value={customerName} onChange={e => setCustomerName(e.target.value)} />
                        </div>
                    </div>
                    <div className="pt-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Items & Discounts</h3>
                        <div className="max-h-96 overflow-y-auto space-y-3 pr-2">
                            {items.map(item => (
                                <div key={item.productId} className="p-3 bg-gray-50 rounded-md">
                                    <p className="font-semibold">{item.name}</p>
                                    <p className="text-xs text-gray-500">{item.quantity} x {formatCurrency(item.originalPrice)}</p>
                                    <div className="flex items-center gap-2 mt-2">
                                        <label htmlFor={`discount-${item.productId}`} className="text-xs text-gray-500">Discount:</label>
                                        <Input 
                                            id={`discount-${item.productId}`}
                                            type="number"
                                            value={item.discount || ''}
                                            onChange={e => handleItemDiscountChange(item.productId, e.target.value)}
                                            className="w-20 h-8 text-xs p-1"
                                            placeholder="0"
                                        />
                                        <select
                                            value={item.discountType}
                                            onChange={e => handleItemDiscountTypeChange(item.productId, e.target.value as 'fixed' | 'percentage')}
                                            className="h-8 text-xs p-1 border border-gray-300 rounded-md bg-white"
                                        >
                                            <option value="fixed">Rs.</option>
                                            <option value="percentage">%</option>
                                        </select>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="space-y-4">
                    <h3 className="font-semibold text-lg border-b pb-2">Overall Adjustments</h3>
                    <Input label="Tuning (Rs)" type="number" value={tuningCharges} onChange={e => setTuningCharges(e.target.value)} />
                    <Input label="Labor Charges (Rs)" type="number" value={laborCharges} onChange={e => setLaborCharges(e.target.value)} />
                     <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Overall Discount</label>
                        <div className="flex items-center gap-2">
                            <Input type="number" value={overallDiscount} onChange={e => setOverallDiscount(e.target.value)} />
                            <select value={overallDiscountType} onChange={e => setOverallDiscountType(e.target.value as 'fixed' | 'percentage')} className="p-2 border border-gray-300 rounded-md">
                                <option value="fixed">Rs.</option>
                                <option value="percentage">%</option>
                            </select>
                        </div>
                    </div>
                    <div className="pt-4 border-t">
                        <h3 className="font-semibold text-lg flex items-center justify-between">
                            <span className="flex items-center gap-2"><Hammer size={16}/> Outside Services</span>
                            <Button size="sm" variant="ghost" onClick={handleAddService}><PlusCircle size={16}/></Button>
                        </h3>
                        <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                            {outsideServices.map(service => (
                                <div key={service.id} className="flex items-center gap-2">
                                    <Input placeholder="Service Name" value={service.name} onChange={e => handleUpdateService(service.id, 'name', e.target.value)} className="flex-grow"/>
                                    <Input placeholder="Amount" type="number" value={service.amount || ''} onChange={e => handleUpdateService(service.id, 'amount', e.target.value)} className="w-28"/>
                                    <Button size="sm" variant="danger" onClick={() => handleRemoveService(service.id)} className="p-2"><X size={16}/></Button>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="mt-4 p-4 bg-blue-50 rounded-lg space-y-2 border border-blue-200">
                        <div className="flex justify-between text-sm">
                            <span>Original Total:</span>
                            <span className="font-semibold">{formatCurrency(sale.total)}</span>
                        </div>
                         <div className="flex justify-between text-lg font-bold">
                            <span>New Total:</span>
                            <span className="text-primary-600">{formatCurrency(newTotal)}</span>
                        </div>
                        <div className="flex justify-between text-sm pt-2 border-t">
                            <span>Amount Paid:</span>
                            <span className="font-semibold">{formatCurrency(sale.amountPaid)}</span>
                        </div>
                        <div className="flex justify-between font-bold text-lg text-red-600">
                            <span>New Balance Due:</span>
                            <span>{formatCurrency(newBalanceDue)}</span>
                        </div>
                    </div>
                </div>
            </div>
             <div className="flex justify-end gap-2 pt-6 mt-4 border-t">
                <Button variant="secondary" onClick={onClose}>Cancel</Button>
                <Button onClick={handleSaveChanges}>Save Changes</Button>
            </div>
        </Modal>
    );
};

interface SoldItemSummary {
    productId: string;
    name: string;
    quantity: number;
    total: number;
    isService?: boolean;
}

const Sales: React.FC = () => {
    const { sales, reverseSale, currentUser, shopInfo, updateSale } = useAppContext();
    const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
    const [saleToReverse, setSaleToReverse] = useState<Sale | null>(null);
    const [saleToEdit, setSaleToEdit] = useState<Sale | null>(null);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [sortBy, setSortBy] = useState('name');

    const isMaster = currentUser?.role === 'master';

    const filteredSales = useMemo(() => {
        let result = [...sales];
        if (!isMaster) {
            const today = new Date().toLocaleDateString();
            result = result.filter(s => new Date(s.date).toLocaleDateString() === today);
        }

        if (startDate || endDate) {
             result = result.filter(sale => {
                const saleDate = new Date(sale.date);
                const start = startDate ? new Date(startDate) : null;
                const end = endDate ? new Date(endDate) : null;
                if (start) start.setHours(0, 0, 0, 0);
                if (end) end.setHours(23, 59, 59, 999);
                
                if (start && saleDate < start) return false;
                if (end && saleDate > end) return false;
                return true;
            });
        }
        
        // Sort by date descending (newest first)
        return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [sales, startDate, endDate, isMaster]);

    const soldItemsSummary = useMemo(() => {
        const summary: { [key: string]: SoldItemSummary } = {};
        filteredSales.forEach(sale => {
            sale.items.forEach(item => {
                if (summary[item.productId]) {
                    summary[item.productId].quantity += item.quantity;
                    summary[item.productId].total += item.price * item.quantity;
                } else {
                    summary[item.productId] = {
                        productId: item.productId,
                        name: item.name,
                        quantity: item.quantity,
                        total: item.price * item.quantity,
                    };
                }
            });
            
            if (sale.laborCharges && sale.laborCharges > 0) {
                if (summary['__labor__']) {
                    summary['__labor__'].quantity += 1;
                    summary['__labor__'].total += sale.laborCharges;
                } else {
                    summary['__labor__'] = {
                        productId: '__labor__',
                        name: 'Labor Charges',
                        quantity: 1,
                        total: sale.laborCharges,
                        isService: true,
                    };
                }
            }
            if (sale.tuningCharges && sale.tuningCharges > 0) {
                if (summary['__tuning__']) {
                    summary['__tuning__'].quantity += 1;
                    summary['__tuning__'].total += sale.tuningCharges;
                } else {
                    summary['__tuning__'] = {
                        productId: '__tuning__',
                        name: 'Tuning',
                        quantity: 1,
                        total: sale.tuningCharges,
                        isService: true,
                    };
                }
            }
        });
        
        const sortedSummary = Object.values(summary).sort((a, b) => {
            if (sortBy === 'quantity') {
                return b.quantity - a.quantity;
            }
            if (sortBy === 'revenue') {
                return b.total - a.total;
            }
            // Default sort: services first, then by name
            if (a.isService && !b.isService) return -1;
            if (!a.isService && b.isService) return 1;
            return a.name.localeCompare(b.name);
        });

        return sortedSummary;
    }, [filteredSales, sortBy]);
    

    const handleReverseSaleConfirm = (itemsToReturn: SaleItem[]) => {
        if (saleToReverse) {
            reverseSale(saleToReverse.id, itemsToReturn);
            setSaleToReverse(null);
        }
    };
    
    const handleDownloadPdf = async () => {
        if (filteredSales.length === 0) {
            toast.error("No sales in the selected range to download.");
            return;
        }

        const toastId = toast.loading("Generating PDF...", { duration: Infinity });

        try {
            const pdfContainer = document.createElement('div');
            // Styling for off-screen rendering
            pdfContainer.style.position = 'absolute';
            pdfContainer.style.left = '-9999px';
            pdfContainer.style.width = '1000px'; // A bit wider for better quality
            pdfContainer.style.padding = '20px';
            pdfContainer.style.fontFamily = 'Arial, sans-serif';
            pdfContainer.style.background = 'white';
            pdfContainer.style.color = 'black';

            const totalAmount = filteredSales.reduce((sum, sale) => sum + sale.total, 0);

            const tableRows = filteredSales.map(sale => `
                <tr>
                    <td style="border: 1px solid #ddd; padding: 6px;">${new Date(sale.date).toLocaleDateString()}</td>
                    <td style="border: 1px solid #ddd; padding: 6px;">${sale.id}</td>
                    <td style="border: 1px solid #ddd; padding: 6px;">${sale.customerName}<br/><small style="color: #555;">${sale.customerId}</small></td>
                    <td style="border: 1px solid #ddd; padding: 6px; text-align: right;">${formatCurrency(sale.total)}</td>
                </tr>
            `).join('');
            
            const logoSize = shopInfo?.pdfLogoSize ?? 50;
            const logoHtml = shopInfo?.logoUrl 
                ? `<img src="${shopInfo.logoUrl}" alt="Shop Logo" style="height: ${logoSize}px; width: auto; margin: 0 auto 10px auto; display: block; object-fit: contain;" />`
                : '';

            pdfContainer.innerHTML = `
                <div>
                    <div style="text-align: center; margin-bottom: 20px;">
                        ${logoHtml}
                    </div>
                    <h2 style="font-size: 20px; text-align: center; border-bottom: 1px solid #ddd; padding-bottom: 10px; margin-bottom: 20px;">Sales Report</h2>
                    <p style="font-size: 12px; margin-bottom: 20px; text-align: right;">Generated: ${new Date().toLocaleString()}</p>
                    <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
                        <thead style="background-color: #f2f2f2;">
                            <tr>
                                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Date</th>
                                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Sale ID</th>
                                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Customer</th>
                                <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Total</th>
                            </tr>
                        </thead>
                        <tbody>${tableRows}</tbody>
                        <tfoot style="background-color: #f2f2f2; font-weight: bold;">
                             <tr>
                                <td colspan="3" style="border: 1px solid #ddd; padding: 8px; text-align: right;">Total Sales:</td>
                                <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${formatCurrency(totalAmount)}</td>
                             </tr>
                        </tfoot>
                    </table>
                </div>
            `;
            document.body.appendChild(pdfContainer);

            const canvas = await html2canvas(pdfContainer, { scale: 2, useCORS: true });
            
            document.body.removeChild(pdfContainer);

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });
            const imgProps = pdf.getImageProperties(imgData);
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

            pdf.addImage(imgData, 'PNG', 10, 10, pdfWidth - 20, pdfHeight > 277 ? 277 : pdfHeight); // A4 height is ~297mm, with margins
            
            const filename = `sales_report_${new Date().toISOString().split('T')[0]}.pdf`;
            pdf.save(filename);
            
            toast.success("PDF downloaded successfully!", { id: toastId });
        } catch (error) {
            console.error("Failed to generate PDF:", error);
            toast.error("Failed to generate PDF.", { id: toastId });
        }
    };

    const handleDownloadSummaryPdf = async () => {
        if (soldItemsSummary.length === 0) {
            toast.error("No items in the summary to download.");
            return;
        }
    
        const toastId = toast.loading("Generating PDF...", { duration: Infinity });
    
        try {
            const pdfContainer = document.createElement('div');
            pdfContainer.style.position = 'absolute';
            pdfContainer.style.left = '-9999px';
            pdfContainer.style.width = '1000px';
            pdfContainer.style.padding = '20px';
            pdfContainer.style.fontFamily = 'Arial, sans-serif';
            pdfContainer.style.background = 'white';
            pdfContainer.style.color = 'black';
    
            const totalQuantity = soldItemsSummary.reduce((sum, item) => sum + item.quantity, 0);
            const totalRevenue = soldItemsSummary.reduce((sum, item) => sum + item.total, 0);
    
            const tableRows = soldItemsSummary.map(item => `
                <tr>
                    <td style="border: 1px solid #ddd; padding: 6px;">${item.name}</td>
                    <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${item.quantity}</td>
                    <td style="border: 1px solid #ddd; padding: 6px; text-align: right;">${formatCurrency(item.total)}</td>
                </tr>
            `).join('');
            
            const logoSize = shopInfo?.pdfLogoSize ?? 50;
            const logoHtml = shopInfo?.logoUrl 
                ? `<img src="${shopInfo.logoUrl}" alt="Shop Logo" style="height: ${logoSize}px; width: auto; margin: 0 auto 10px auto; display: block; object-fit: contain;" />`
                : '';
    
            pdfContainer.innerHTML = `
                <div>
                    <div style="text-align: center; margin-bottom: 20px;">
                        ${logoHtml}
                    </div>
                    <h2 style="font-size: 20px; text-align: center; border-bottom: 1px solid #ddd; padding-bottom: 10px; margin-bottom: 20px;">Sold Items Summary</h2>
                    <p style="font-size: 12px; margin-bottom: 20px; text-align: right;">Generated: ${new Date().toLocaleString()}</p>
                    <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
                        <thead style="background-color: #f2f2f2;">
                            <tr>
                                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Item</th>
                                <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Total Quantity Sold</th>
                                <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Total Revenue</th>
                            </tr>
                        </thead>
                        <tbody>${tableRows}</tbody>
                        <tfoot style="background-color: #f2f2f2; font-weight: bold;">
                             <tr>
                                <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">Grand Total:</td>
                                <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${totalQuantity}</td>
                                <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${formatCurrency(totalRevenue)}</td>
                             </tr>
                        </tfoot>
                    </table>
                </div>
            `;
            document.body.appendChild(pdfContainer);
    
            const canvas = await html2canvas(pdfContainer, { scale: 2, useCORS: true });
            
            document.body.removeChild(pdfContainer);
    
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });
            const imgProps = pdf.getImageProperties(imgData);
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    
            let heightLeft = pdfHeight;
            let position = 0;
            const margin = 10;
            const pageHeightWithMargin = pdf.internal.pageSize.getHeight() - (2 * margin);
    
            pdf.addImage(imgData, 'PNG', margin, margin, pdfWidth - (2 * margin), pdfHeight);
            heightLeft -= pageHeightWithMargin;
    
            while (heightLeft > 0) {
                position -= pageHeightWithMargin;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', margin, position + margin, pdfWidth - (2*margin), pdfHeight);
                heightLeft -= pageHeightWithMargin;
            }
    
            const filename = `sold_items_summary_${new Date().toISOString().split('T')[0]}.pdf`;
            pdf.save(filename);
            
            toast.success("PDF downloaded successfully!", { id: toastId });
        } catch (error) {
            console.error("Failed to generate PDF:", error);
            toast.error("Failed to generate PDF.", { id: toastId });
        }
    };


    return (
        <div className="space-y-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Sales History</h1>

            {isMaster && (
                <div className="bg-white p-4 rounded-lg shadow-md flex flex-wrap items-center gap-4">
                    <h3 className="font-semibold">Filter by Date:</h3>
                    <div>
                        <label htmlFor="start-date" className="text-sm mr-2">From:</label>
                        <input type="date" id="start-date" value={startDate} onChange={e => setStartDate(e.target.value)} className="p-2 border rounded-md"/>
                    </div>
                     <div>
                        <label htmlFor="end-date" className="text-sm mr-2">To:</label>
                        <input type="date" id="end-date" value={endDate} onChange={e => setEndDate(e.target.value)} className="p-2 border rounded-md"/>
                    </div>
                     <button onClick={() => {setStartDate(''); setEndDate('');}} className="text-sm text-primary-600 hover:underline">Reset</button>
                     <Button onClick={handleDownloadPdf} variant="secondary" className='gap-2'><FileText size={18}/> Download PDF</Button>
                </div>
            )}
            
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white rounded-lg shadow-md overflow-hidden">
                    <h2 className="text-xl font-semibold p-4 border-b">All Sales</h2>
                    <div className="max-h-[70vh] overflow-y-auto">
                        <table className="w-full text-sm text-left text-gray-500">
                             <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0">
                                <tr>
                                    <th scope="col" className="px-6 py-3">Date</th>
                                    <th scope="col" className="px-6 py-3">Customer</th>
                                    <th scope="col" className="px-6 py-3 text-right">Total</th>
                                    <th scope="col" className="px-6 py-3 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredSales.map(sale => (
                                    <tr key={sale.id} className="bg-white border-b hover:bg-gray-50">
                                        <td className="px-6 py-4">{formatDate(sale.date)}</td>
                                        <td className="px-6 py-4 font-medium text-gray-900">{sale.customerName || sale.customerId}</td>
                                        <td className="px-6 py-4 text-right font-semibold">{formatCurrency(sale.total)}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex justify-center space-x-2">
                                                <button onClick={() => setSelectedSale(sale)} className="text-blue-600 hover:text-blue-800" title="View Details"><Eye size={18}/></button>
                                                {isMaster && (
                                                    <>
                                                        <button onClick={() => setSaleToEdit(sale)} className="text-yellow-600 hover:text-yellow-800" title="Edit Sale"><Pencil size={18}/></button>
                                                        <button onClick={() => setSaleToReverse(sale)} className="text-red-600 hover:text-red-800" title="Reverse Sale"><Trash2 size={18}/></button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                         {filteredSales.length === 0 && <p className="text-center p-6 text-gray-500">No sales found for the selected period.</p>}
                    </div>
                </div>

                 <div className="bg-white rounded-lg shadow-md overflow-hidden">
                     <div className="p-4 border-b flex flex-col sm:flex-row justify-between items-center gap-2">
                        <h2 className="text-xl font-semibold flex items-center gap-2 shrink-0"><ShoppingBag/> Sold Items Summary</h2>
                        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                            <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="p-1 text-sm border rounded-md">
                                <option value="name">Sort by Name</option>
                                <option value="quantity">Sort by Quantity</option>
                                <option value="revenue">Sort by Revenue</option>
                            </select>
                            <Button onClick={handleDownloadSummaryPdf} variant="ghost" size="sm" className="shrink-0 p-2" title="Download Summary PDF">
                                <FileText size={18} />
                            </Button>
                        </div>
                     </div>
                    <div className="max-h-[70vh] overflow-y-auto">
                        <table className="w-full text-sm text-left text-gray-500">
                             <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0">
                                <tr>
                                    <th className="px-4 py-2">Item</th>
                                    <th className="px-4 py-2 text-center">Qty</th>
                                    <th className="px-4 py-2 text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                               {soldItemsSummary.map(item => (
                                   <tr key={item.productId} className="hover:bg-gray-50">
                                       <td className="px-4 py-2 font-medium">{item.name}</td>
                                       <td className="px-4 py-2 text-center">{item.quantity}</td>
                                       <td className="px-4 py-2 text-right">{formatCurrency(item.total)}</td>
                                   </tr>
                               ))}
                            </tbody>
                        </table>
                        {soldItemsSummary.length === 0 && <p className="text-center p-6 text-gray-500">No items sold in this period.</p>}
                    </div>
                 </div>
             </div>

            {selectedSale && <SaleDetailsModal sale={selectedSale} onClose={() => setSelectedSale(null)} />}
            {saleToReverse && <ReverseSaleModal sale={saleToReverse} onClose={() => setSaleToReverse(null)} onConfirm={handleReverseSaleConfirm} />}
            {saleToEdit && <EditSaleModal sale={saleToEdit} onClose={() => setSaleToEdit(null)} />}
        </div>
    );
};

export default Sales;
