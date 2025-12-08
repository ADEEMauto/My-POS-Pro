
import React, { useState, useMemo } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { Sale, SaleItem } from '../types';
import { formatCurrency, formatDate } from '../utils/helpers';
import { Search, RotateCcw, FileText, Eye, AlertCircle } from 'lucide-react';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Receipt from '../components/Receipt';

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
    const { sales, reverseSale, currentUser } = useAppContext();
    const [searchTerm, setSearchTerm] = useState('');
    const [viewingSale, setViewingSale] = useState<Sale | null>(null);
    const [saleToReverse, setSaleToReverse] = useState<Sale | null>(null);

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
                            <th scope="col" className="px-6 py-3 text-right">Total</th>
                            <th scope="col" className="px-6 py-3 text-center">Status</th>
                            <th scope="col" className="px-6 py-3 text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedSales.length > 0 ? (
                            sortedSales.map(sale => (
                                <tr key={sale.id} className="bg-white border-b hover:bg-gray-50">
                                    <td className="px-6 py-4">
                                        <div className="font-mono font-medium text-gray-900">{sale.id.slice(0, 8)}...</div>
                                        <div className="text-xs text-gray-500">{formatDate(sale.date)}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="font-semibold text-gray-800">{sale.customerName}</div>
                                        <div className="text-xs text-gray-500 font-mono">{sale.bikeNumber || 'No Bike Info'}</div>
                                    </td>
                                    <td className="px-6 py-4 text-right font-bold text-gray-900">
                                        {formatCurrency(sale.total)}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                            sale.paymentStatus === 'Paid' ? 'bg-green-100 text-green-800' :
                                            sale.paymentStatus === 'Partial' ? 'bg-yellow-100 text-yellow-800' :
                                            'bg-red-100 text-red-800'
                                        }`}>
                                            {sale.paymentStatus}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex justify-center gap-2">
                                            <Button variant="secondary" size="sm" onClick={() => setViewingSale(sale)} title="View Receipt">
                                                <Eye size={16}/>
                                            </Button>
                                            {isMaster && (
                                                <Button variant="secondary" size="sm" onClick={() => setSaleToReverse(sale)} title="Return / Reverse" className="text-red-600 hover:text-red-700">
                                                    <RotateCcw size={16}/>
                                                </Button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
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
