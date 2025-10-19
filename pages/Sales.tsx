import React, { useState } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { Sale } from '../types';
import { formatCurrency, formatDate } from '../utils/helpers';
import { Eye, Trash2, XCircle } from 'lucide-react';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';

const SaleDetailsModal: React.FC<{ sale: Sale; onClose: () => void }> = ({ sale, onClose }) => {
    return (
        <Modal isOpen={true} onClose={onClose} title={`Sale Details - ID: ...${sale.id.slice(-6)}`} size="lg">
            <div className="space-y-4">
                <div>
                    <p><strong>Date:</strong> {formatDate(sale.date)}</p>
                    <p><strong>Total Amount:</strong> <span className="font-bold text-lg text-primary-600">{formatCurrency(sale.total)}</span></p>
                </div>
                <div className="max-h-80 overflow-y-auto pr-2">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0">
                            <tr>
                                <th className="px-4 py-2">Product Name</th>
                                <th className="px-4 py-2 text-center">Quantity</th>
                                <th className="px-4 py-2 text-right">Price/Item</th>
                                <th className="px-4 py-2 text-right">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {sale.items.map((item, index) => (
                                <tr key={`${item.productId}-${index}`}>
                                    <td className="px-4 py-2 font-medium text-gray-900">{item.name}</td>
                                    <td className="px-4 py-2 text-center">{item.quantity}</td>
                                    <td className="px-4 py-2 text-right">{formatCurrency(item.price)}</td>
                                    <td className="px-4 py-2 text-right font-semibold">{formatCurrency(item.price * item.quantity)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
             <div className="flex justify-end gap-2 pt-4">
                <Button variant="secondary" onClick={onClose}>Close</Button>
            </div>
        </Modal>
    );
};


const Sales: React.FC = () => {
    const { sales, reverseSale, currentUser } = useAppContext();
    const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
    const [saleToReverse, setSaleToReverse] = useState<Sale | null>(null);

    const isMaster = currentUser?.role === 'master';

    const handleReverseSale = () => {
        if (saleToReverse) {
            reverseSale(saleToReverse.id);
            setSaleToReverse(null);
        }
    };

    if (!isMaster) {
        return (
            <div className="text-center p-8 bg-white rounded-lg shadow-md">
                <h2 className="text-2xl font-bold text-red-600">Access Denied</h2>
                <p className="mt-2 text-gray-600">You do not have permission to view this page.</p>
            </div>
        );
    }
    
    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-gray-800">Sales History</h1>
            
            {sales.length === 0 ? (
                 <div className="text-center py-10 bg-white rounded-lg shadow">
                    <p className="text-gray-500">No sales have been recorded yet.</p>
                </div>
            ) : (
                <>
                {/* Table for medium screens and up */}
                <div className="hidden md:block bg-white rounded-lg shadow-md overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-500">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3">Sale ID</th>
                                <th scope="col" className="px-6 py-3">Date</th>
                                <th scope="col" className="px-6 py-3 text-center">Items</th>
                                <th scope="col" className="px-6 py-3 text-right">Total Amount</th>
                                <th scope="col" className="px-6 py-3 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sales.map(sale => (
                                <tr key={sale.id} className="bg-white border-b hover:bg-gray-50">
                                    <td className="px-6 py-4 font-mono text-xs text-gray-700">...{sale.id.slice(-12)}</td>
                                    <td className="px-6 py-4">{formatDate(sale.date)}</td>
                                    <td className="px-6 py-4 text-center">{sale.items.reduce((acc, item) => acc + item.quantity, 0)}</td>
                                    <td className="px-6 py-4 text-right font-semibold">{formatCurrency(sale.total)}</td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex justify-center space-x-3">
                                            <button onClick={() => setSelectedSale(sale)} className="text-blue-600 hover:text-blue-800" title="View Details"><Eye size={18}/></button>
                                            <button onClick={() => setSaleToReverse(sale)} className="text-red-600 hover:text-red-800" title="Reverse Sale"><Trash2 size={18}/></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Cards for small screens */}
                <div className="md:hidden grid grid-cols-1 gap-4">
                     {sales.map(sale => (
                         <div key={sale.id} className="bg-white rounded-lg shadow-md p-4 space-y-3">
                             <div className="flex justify-between items-start">
                                 <div>
                                    <p className="text-sm font-semibold">Sale ID: <span className="font-mono text-xs">...{sale.id.slice(-12)}</span></p>
                                    <p className="text-xs text-gray-500">{formatDate(sale.date)}</p>
                                 </div>
                                 <p className="text-lg font-bold text-primary-600">{formatCurrency(sale.total)}</p>
                             </div>
                             <div className="flex justify-between items-center text-sm border-t pt-3">
                                <div>
                                    <strong>Total Items:</strong> {sale.items.reduce((acc, item) => acc + item.quantity, 0)}
                                </div>
                                <div className="flex items-center space-x-3">
                                    <Button onClick={() => setSelectedSale(sale)} variant="ghost" size="sm" className="flex items-center gap-1"><Eye size={16}/> View</Button>
                                    <Button onClick={() => setSaleToReverse(sale)} variant="ghost" size="sm" className="text-red-600 hover:text-red-700 flex items-center gap-1"><Trash2 size={16}/> Reverse</Button>
                                </div>
                             </div>
                         </div>
                     ))}
                </div>
                </>
            )}

            {selectedSale && <SaleDetailsModal sale={selectedSale} onClose={() => setSelectedSale(null)} />}

            <Modal isOpen={!!saleToReverse} onClose={() => setSaleToReverse(null)} title="Confirm Sale Reversal" size="md">
                <div className="text-center">
                    <XCircle className="mx-auto h-12 w-12 text-red-500" />
                    <p className="mt-4 text-gray-700">Are you sure you want to reverse this sale?</p>
                    <p className="text-sm text-gray-500">This action will return all sold items to the inventory and permanently delete the sale record. This cannot be undone.</p>
                </div>
                <div className="flex justify-center gap-4 mt-6">
                    <Button variant="secondary" onClick={() => setSaleToReverse(null)}>Cancel</Button>
                    <Button variant="danger" onClick={handleReverseSale}>Yes, Reverse Sale</Button>
                </div>
            </Modal>
        </div>
    );
};

export default Sales;