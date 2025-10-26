
import React, { useState, useMemo } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { Customer, Payment } from '../types';
import { formatCurrency, formatDate } from '../utils/helpers';
import { DollarSign, User, History, Search } from 'lucide-react';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import toast from 'react-hot-toast';

// Payment Modal Component
const SettlePaymentModal: React.FC<{
    customer: Customer;
    onClose: () => void;
    onSave: (customerId: string, amount: number, notes?: string) => void;
}> = ({ customer, onClose, onSave }) => {
    const [amount, setAmount] = useState<string>('');
    const [notes, setNotes] = useState<string>('');

    const handleSave = () => {
        const paymentAmount = parseFloat(amount);
        if (isNaN(paymentAmount) || paymentAmount <= 0) {
            toast.error("Please enter a valid positive amount.");
            return;
        }
        if (paymentAmount > customer.balance) {
            toast.error(`Payment cannot exceed the outstanding balance of ${formatCurrency(customer.balance)}.`);
            return;
        }
        onSave(customer.id, paymentAmount, notes.trim());
        onClose();
    };

    return (
        <Modal isOpen={true} onClose={onClose} title={`Settle Payment for ${customer.name}`}>
            <div className="space-y-4">
                <div className="p-4 bg-gray-100 rounded-lg text-center">
                    <p className="text-sm text-gray-600">Outstanding Balance</p>
                    <p className="text-3xl font-bold text-red-600">{formatCurrency(customer.balance)}</p>
                    <p className="text-xs text-gray-500">Bike No: {customer.id}</p>
                </div>
                <Input
                    label="Amount Being Paid"
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    max={customer.balance}
                    min="1"
                    placeholder={`Enter amount up to ${formatCurrency(customer.balance)}`}
                    required
                    autoFocus
                />
                <Input
                    label="Notes (Optional)"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g., Cash payment"
                />
            </div>
            <div className="flex justify-end gap-2 pt-6 mt-4 border-t">
                <Button variant="secondary" onClick={onClose}>Cancel</Button>
                <Button onClick={handleSave}>Record Payment</Button>
            </div>
        </Modal>
    );
};


const DuePayments: React.FC = () => {
    const { customers, payments, recordCustomerPayment, currentUser } = useAppContext();
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    
    const isMaster = currentUser?.role === 'master';

    const customersWithDues = useMemo(() => {
        const filtered = customers.filter(c => c.balance > 0);
        
        if (searchTerm) {
            const lowercasedSearch = searchTerm.toLowerCase();
            return filtered.filter(c => 
                c.name.toLowerCase().includes(lowercasedSearch) ||
                c.id.toLowerCase().includes(lowercasedSearch)
            );
        }

        return filtered.sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime());
    }, [customers, searchTerm]);

    const handleSettlePayment = (customerId: string, amount: number, notes?: string) => {
        recordCustomerPayment(customerId, amount, notes);
    };

    if (!isMaster) {
        return (
            <div className="text-center p-8 bg-white rounded-lg shadow-md">
                <h2 className="text-2xl font-bold text-red-600">Access Denied</h2>
                <p className="mt-2 text-gray-600">You do not have permission to view this page.</p>
            </div>
        );
    }
    
    const customerMap = useMemo(() => new Map(customers.map(c => [c.id, c.name])), [customers]);

    return (
        <div className="space-y-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Due Payments & Ledger</h1>

            {/* Customers with Dues Section */}
            <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-4">
                     <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                        <User className="text-red-500"/> Customers with Outstanding Balances
                    </h2>
                     <div className="w-full md:w-72">
                        <Input 
                            placeholder="Search customer..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            icon={<Search className="w-5 h-5 text-gray-400" />}
                        />
                    </div>
                </div>

                {customersWithDues.length === 0 ? (
                    <div className="text-center py-8">
                        <p className="text-gray-500">No customers have outstanding dues.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {customersWithDues.map(customer => (
                             <div key={customer.id} className="border border-gray-200 rounded-lg p-4 flex flex-col justify-between hover:shadow-lg transition-shadow">
                                <div>
                                    <h3 className="font-bold text-lg text-gray-800">{customer.name}</h3>
                                    <p className="text-sm text-gray-500 font-mono">{customer.id}</p>
                                    <p className="text-xs text-gray-400 mt-2">Last visit: {formatDate(customer.lastSeen)}</p>
                                </div>
                                 <div className="mt-4 pt-3 border-t">
                                    <p className="text-sm text-gray-600">Balance Due:</p>
                                    <p className="text-2xl font-bold text-red-600">{formatCurrency(customer.balance)}</p>
                                    <Button onClick={() => setSelectedCustomer(customer)} size="sm" className="w-full mt-3 flex items-center justify-center gap-2">
                                        <DollarSign size={16}/> Settle Payment
                                    </Button>
                                 </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Payments History Section */}
             <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <History className="text-primary-600"/> Payments Received History
                </h2>
                {payments.length === 0 ? (
                    <div className="text-center py-8">
                        <p className="text-gray-500">No payments have been recorded yet.</p>
                    </div>
                ) : (
                    <div className="max-h-96 overflow-y-auto">
                        <table className="w-full text-sm text-left text-gray-500">
                             <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0">
                                <tr>
                                    <th className="px-4 py-2">Date</th>
                                    <th className="px-4 py-2">Customer</th>
                                    <th className="px-4 py-2 hidden sm:table-cell">Notes</th>
                                    <th className="px-4 py-2 text-right">Amount Paid</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {payments.map(payment => (
                                    <tr key={payment.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-2 text-xs whitespace-nowrap">{new Date(payment.date).toLocaleDateString()}</td>
                                        <td className="px-4 py-2 font-medium text-gray-800">
                                            {customerMap.get(payment.customerId) || 'Unknown'}
                                            <span className="block text-xs font-normal text-gray-500 font-mono">{payment.customerId}</span>
                                        </td>
                                        <td className="px-4 py-2 text-xs text-gray-600 hidden sm:table-cell">{payment.notes}</td>
                                        <td className="px-4 py-2 text-right font-bold text-green-600">{formatCurrency(payment.amount)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            
            {selectedCustomer && (
                <SettlePaymentModal 
                    customer={selectedCustomer}
                    onClose={() => setSelectedCustomer(null)}
                    onSave={handleSettlePayment}
                />
            )}
        </div>
    );
};

export default DuePayments;