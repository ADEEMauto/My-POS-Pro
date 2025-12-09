
import React, { useState, useMemo } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { Sale, SaleItem } from '../types';
import { formatCurrency, formatDate } from '../utils/helpers';
import { Search, RotateCcw, FileText, Eye, AlertCircle, Edit, Trash2 } from 'lucide-react';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Receipt from '../components/Receipt';
import toast from 'react-hot-toast';

// --- Edit Sale Modal ---
const EditSaleModal: React.FC<{ sale: Sale; onClose: () => void; onSave: (updatedSale: Sale) => void }> = ({ sale, onClose, onSave }) => {
    const [customerName, setCustomerName] = useState(sale.customerName);
    const [bikeNumber, setBikeNumber] = useState(sale.bikeNumber || '');
    const [items, setItems] = useState<SaleItem[]>(JSON.parse(JSON.stringify(sale.items))); // Deep copy
    const [tuningCharges, setTuningCharges] = useState(sale.tuningCharges || 0);
    const [laborCharges, setLaborCharges] = useState(sale.laborCharges || 0);
    const [overallDiscount, setOverallDiscount] = useState(sale.overallDiscount || 0);
    const [overallDiscountType, setOverallDiscountType] = useState<'fixed' | 'percentage'>(sale.overallDiscountType);
    const [amountPaid, setAmountPaid] = useState(sale.amountPaid);
    
    // Derived Calculations (Replicating logic from POS/CreateSale)
    const subtotal = items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const subtotalWithCharges = subtotal + tuningCharges + laborCharges;
    const overallDiscountAmount = overallDiscountType === 'fixed' 
        ? overallDiscount 
        : (subtotalWithCharges * overallDiscount / 100);
    
    const loyaltyDiscount = sale.loyaltyDiscount || 0; // Not editable currently
    const totalOutsideServices = sale.totalOutsideServices || 0; // Not editable currently for simplicity
    
    const total = Math.round(Math.max(0, (subtotalWithCharges - overallDiscountAmount) - loyaltyDiscount) + totalOutsideServices);
    const balanceDue = Math.round(Math.max(0, (total + (sale.previousBalanceBroughtForward || 0)) - amountPaid));

    const handleItemChange = (index: number, field: keyof SaleItem, value: any) => {
        const newItems = [...items];
        const item = { ...newItems[index] };

        if (field === 'quantity') {
            item.quantity = Number(value);
        } else if (field === 'price') {
             item.price = Number(value);
             // When price is manually edited, we treat it as final price. 
             // Ideally we should adjust discount, but for editing, just setting price is often enough.
             item.originalPrice = Number(value); // Reset original to avoid confusion? Or keep logic?
             item.discount = 0; // Reset discount if manual price set directly
        }

        // Recalculate price if needed (e.g. if we exposed discount field editing)
        // For now, simpler to edit Quantity and Final Price directly.
        newItems[index] = item;
        setItems(newItems);
    };

    const handleDeleteItem = (index: number) => {
        if(window.confirm("Remove item from sale?")) {
            const newItems = items.filter((_, i) => i !== index);
            setItems(newItems);
        }
    };

    const handleSave = () => {
        if (!customerName.trim()) {
            toast.error("Customer name is required");
            return;
        }

        const updatedSale: Sale = {
            ...sale,
            customerName,
            bikeNumber,
            items,
            tuningCharges,
            laborCharges,
            subtotal,
            overallDiscount,
            overallDiscountType,
            total,
            amountPaid,
            balanceDue,
            // Note: pointsEarned will be recalculated in AppContext based on new total
        };
        onSave(updatedSale);
        onClose();
    };

    return (
        <Modal isOpen={true} onClose={onClose} title="Edit Sale" size="2xl">
            <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-3 rounded-md">
                     <Input label="Customer Name" value={customerName} onChange={e => setCustomerName(e.target.value)} />
                     <Input label="Bike Number" value={bikeNumber} onChange={e => setBikeNumber(e.target.value)} />
                </div>

                <div className="border rounded-md overflow-hidden">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-100 text-gray-700">
                            <tr>
                                <th className="p-2">Item</th>
                                <th className="p-2 w-20">Qty</th>
                                <th className="p-2 w-24">Price</th>
                                <th className="p-2 text-right">Total</th>
                                <th className="p-2 w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {items.map((item, index) => (
                                <tr key={index}>
                                    <td className="p-2">{item.name}</td>
                                    <td className="p-2">
                                        <input 
                                            type="number" 
                                            value={item.quantity} 
                                            onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                                            className="w-full border rounded p-1"
                                            min="0"
                                        />
                                    </td>
                                    <td className="p-2">
                                         <input 
                                            type="number" 
                                            value={item.price} 
                                            onChange={(e) => handleItemChange(index, 'price', e.target.value)}
                                            className="w-full border rounded p-1"
                                            min="0"
                                        />
                                    </td>
                                    <td className="p-2 text-right">{formatCurrency(item.price * item.quantity)}</td>
                                    <td className="p-2 text-center">
                                        <button onClick={() => handleDeleteItem(index)} className="text-red-500 hover:text-red-700">
                                            <Trash2 size={16}/>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <Input label="Tuning Charges" type="number" value={tuningCharges} onChange={e => setTuningCharges(Number(e.target.value))} />
                     <Input label="Labor Charges" type="number" value={laborCharges} onChange={e => setLaborCharges(Number(e.target.value))} />
                </div>

                <div className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-grow">
                         <label className="block text-sm font-medium text-gray-700 mb-1">Overall Discount</label>
                         <div className="flex gap-2">
                             <Input type="number" value={overallDiscount} onChange={e => setOverallDiscount(Number(e.target.value))} />
                             <select 
                                value={overallDiscountType} 
                                onChange={e => setOverallDiscountType(e.target.value as 'fixed' | 'percentage')}
                                className="p-2 border rounded-md"
                             >
                                 <option value="fixed">Rs</option>
                                 <option value="percentage">%</option>
                             </select>
                         </div>
                    </div>
                     <div className="flex-grow">
                        <Input label="Amount Paid" type="number" value={amountPaid} onChange={e => setAmountPaid(Number(e.target.value))} />
                     </div>
                </div>
                
                <div className="bg-gray-100 p-4 rounded-md space-y-1 text-right">
                    <p>Subtotal: {formatCurrency(subtotal)}</p>
                    <p>Charges: {formatCurrency(tuningCharges + laborCharges)}</p>
                    <p className="text-red-600">Discount: -{formatCurrency(overallDiscountAmount + loyaltyDiscount)}</p>
                    {totalOutsideServices > 0 && <p className="text-cyan-600">Outside Services: +{formatCurrency(totalOutsideServices)}</p>}
                    <p className="font-bold text-lg">Total: {formatCurrency(total)}</p>
                    <p>Previous Balance: {formatCurrency(sale.previousBalanceBroughtForward || 0)}</p>
                    <p className="font-bold text-lg border-t pt-1 mt-1">Balance Due: {formatCurrency(balanceDue)}</p>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSave}>Save Changes</Button>
                </div>
            </div>
        </Modal>
    );
};

// --- Reverse Sale Modal ---
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
                Select which items from sale <span className="font-mono bg-gray-100 p-1 rounded">{sale.id}</span> you want to return to stock. This will update the sale record. If all items are returned (or if there are no items), the sale will be deleted completely.
            </p>

            <div className="border rounded-md">
                <div className="flex items-center p-3 bg-gray-50 border-b">
                    <input
                        id="select-all-checkbox"
                        type="checkbox"
                        checked={allSelected}
                        onChange={handleToggleAll}
                        disabled={sale.items.length === 0}
                        className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                    />
                    <label htmlFor="select-all-checkbox" className="ml-3 text-sm font-medium text-gray-700 cursor-pointer">
                       {allSelected ? 'Deselect All' : 'Select All'}
                    </label>
                </div>
                <ul className="max-h-80 overflow-y-auto divide-y divide-gray-200">
                    {sale.items.length > 0 ? (
                        sale.items.map(item => (
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
                        ))
                    ) : (
                        <li className="p-4 text-center text-gray-500">No items in this sale (Services only). Click Confirm to delete.</li>
                    )}
                </ul>
            </div>
            <div className="flex justify-end gap-2 pt-4 mt-4 border-t">
                <Button variant="secondary" onClick={onClose}>Cancel</Button>
                <Button variant="danger" onClick={handleConfirmClick} disabled={sale.items.length > 0 && selectedProductIds.size === 0}>
                    Confirm Reversal / Delete
                </Button>
            </div>
        </Modal>
    );
};

// --- Main Sales Component ---
const Sales: React.FC = () => {
    const { sales, reverseSale, updateSale, currentUser } = useAppContext();
    const [searchTerm, setSearchTerm] = useState('');
    const [viewingSale, setViewingSale] = useState<Sale | null>(null);
    const [saleToReverse, setSaleToReverse] = useState<Sale | null>(null);
    const [saleToEdit, setSaleToEdit] = useState<Sale | null>(null);

    const isMaster = currentUser?.role === 'master';

    const filteredSales = useMemo(() => {
        if (!searchTerm) return sales;
        const lowercasedSearch = searchTerm.toLowerCase();
        return sales.filter(sale => 
            sale.id.toLowerCase().includes(lowercasedSearch) ||
            sale.customerName.toLowerCase().includes(lowercasedSearch) ||
            (sale.bikeNumber && sale.bikeNumber.toLowerCase().includes(lowercasedSearch))
        );
    }, [sales, searchTerm]);

    const sortedSales = useMemo(() => {
        return [...filteredSales].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [filteredSales]);

    const handleReverseConfirm = (itemsToReturn: SaleItem[]) => {
        if (saleToReverse) {
            reverseSale(saleToReverse.id, itemsToReturn);
            setSaleToReverse(null);
            if (viewingSale?.id === saleToReverse.id) {
                setViewingSale(null); // Close view if deleted/modified
            }
        }
    };
    
    const handleUpdateSale = (updatedSale: Sale) => {
        updateSale(updatedSale);
    }
    
    // Helper to calculate revenue split
    const getSaleBreakdown = (sale: Sale) => {
        const itemsGross = sale.subtotal; // Items total after item-level discounts
        const tuning = sale.tuningCharges || 0;
        const labor = sale.laborCharges || 0;
        const internalServicesGross = tuning + labor;
        const basis = itemsGross + internalServicesGross;

        // Calculate global discount amount applied
        const overallDiscAmount = sale.overallDiscountType === 'fixed'
            ? sale.overallDiscount
            : (basis * sale.overallDiscount / 100);
        
        const totalGlobalDiscount = overallDiscAmount + (sale.loyaltyDiscount || 0);

        let netItems = itemsGross;
        let netInternalServices = internalServicesGross;

        // Distribute global discount proportionally
        if (basis > 0 && totalGlobalDiscount > 0) {
            const itemRatio = itemsGross / basis;
            // Subtract allocated discount from gross
            netItems = itemsGross - (totalGlobalDiscount * itemRatio);
            netInternalServices = internalServicesGross - (totalGlobalDiscount * (1 - itemRatio));
        }

        const externalServices = sale.totalOutsideServices || 0;
        
        return {
            netItems: Math.max(0, netItems),
            netInternalServices: Math.max(0, netInternalServices),
            externalServices
        };
    };

    return (
        <div className="space-y-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Sales History</h1>

            <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-md">
                 <div className="w-full md:w-96">
                    <Input
                        placeholder="Search by Sale ID, Name or Bike..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        icon={<Search className="w-5 h-5 text-gray-400" />}
                    />
                </div>
                <div className="text-sm text-gray-500">
                    Showing {sortedSales.length} records
                </div>
            </div>

            <div className="bg-white rounded-lg shadow-md overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-500">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                        <tr>
                            <th scope="col" className="px-6 py-3">Sale ID / Date</th>
                            <th scope="col" className="px-6 py-3">Customer</th>
                            <th scope="col" className="px-6 py-3 text-right">Items (Net)</th>
                            <th scope="col" className="px-6 py-3 text-right">Services (Net)</th>
                            <th scope="col" className="px-6 py-3 text-right">Ext. Services</th>
                            <th scope="col" className="px-6 py-3 text-right">Total Bill</th>
                            <th scope="col" className="px-6 py-3 text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedSales.length > 0 ? (
                            sortedSales.map(sale => {
                                const { netItems, netInternalServices, externalServices } = getSaleBreakdown(sale);
                                return (
                                <tr key={sale.id} className="bg-white border-b hover:bg-gray-50">
                                    <td className="px-6 py-4">
                                        <div className="font-mono font-medium text-gray-900">{sale.id.slice(0, 8)}...</div>
                                        <div className="text-xs text-gray-500">{formatDate(sale.date)}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="font-semibold text-gray-800">{sale.customerName}</div>
                                        <div className="text-xs text-gray-500 font-mono">{sale.bikeNumber || 'No Bike Info'}</div>
                                    </td>
                                    <td className="px-6 py-4 text-right text-gray-700">
                                        {formatCurrency(netItems)}
                                    </td>
                                    <td className="px-6 py-4 text-right text-gray-700">
                                        {formatCurrency(netInternalServices)}
                                    </td>
                                    <td className="px-6 py-4 text-right text-gray-700">
                                        {externalServices > 0 ? formatCurrency(externalServices) : '-'}
                                    </td>
                                    <td className="px-6 py-4 text-right font-bold text-gray-900">
                                        {formatCurrency(sale.total)}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex justify-center gap-2">
                                            <Button variant="secondary" size="sm" onClick={() => setViewingSale(sale)} title="View Receipt">
                                                <Eye size={16}/>
                                            </Button>
                                            <Button variant="secondary" size="sm" onClick={() => setSaleToEdit(sale)} title="Edit Sale" className="text-blue-600 hover:text-blue-700">
                                                <Edit size={16}/>
                                            </Button>
                                            {isMaster && (
                                                <Button variant="secondary" size="sm" onClick={() => setSaleToReverse(sale)} title="Return / Delete" className="text-red-600 hover:text-red-700">
                                                    <Trash2 size={16}/>
                                                </Button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            )})
                        ) : (
                            <tr>
                                <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                                    No sales found matching your criteria.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {viewingSale && (
                <Modal isOpen={true} onClose={() => setViewingSale(null)} title="Sale Receipt" size="md">
                    <div className="bg-gray-100 p-2 rounded border">
                        <Receipt sale={viewingSale} />
                    </div>
                    <div className="flex justify-end mt-4">
                        <Button variant="secondary" onClick={() => setViewingSale(null)}>Close</Button>
                    </div>
                </Modal>
            )}

            {saleToEdit && (
                <EditSaleModal 
                    sale={saleToEdit}
                    onClose={() => setSaleToEdit(null)}
                    onSave={handleUpdateSale}
                />
            )}

            {saleToReverse && (
                <ReverseSaleModal 
                    sale={saleToReverse} 
                    onClose={() => setSaleToReverse(null)} 
                    onConfirm={handleReverseConfirm} 
                />
            )}
        </div>
    );
};

export default Sales;
