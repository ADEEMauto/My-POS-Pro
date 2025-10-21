import React, { useState, useMemo } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { Customer, Sale } from '../types';
import { formatDate, formatCurrency } from '../utils/helpers';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import { Search, User, Hash, ShoppingCart, Calendar, DollarSign, Eye } from 'lucide-react';

const CustomerDetailsModal: React.FC<{ customer: Customer, sales: Sale[], onClose: () => void }> = ({ customer, sales, onClose }) => {
    
    const totalSpent = useMemo(() => sales.reduce((acc, s) => acc + s.total, 0), [sales]);

    return (
        <Modal isOpen={true} onClose={onClose} title={`Customer Profile: ${customer.name}`} size="2xl">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 text-center">
                <div className="bg-gray-100 p-3 rounded-lg">
                    <p className="text-sm text-gray-500">Bike Number</p>
                    <p className="font-bold text-primary-600">{customer.id}</p>
                </div>
                <div className="bg-gray-100 p-3 rounded-lg">
                    <p className="text-sm text-gray-500">Total Sales</p>
                    <p className="font-bold text-primary-600">{sales.length}</p>
                </div>
                <div className="bg-gray-100 p-3 rounded-lg">
                    <p className="text-sm text-gray-500">Total Spent</p>
                    <p className="font-bold text-primary-600">{formatCurrency(totalSpent)}</p>
                </div>
                <div className="bg-gray-100 p-3 rounded-lg">
                    <p className="text-sm text-gray-500">Last Visit</p>
                    <p className="font-bold text-primary-600">{new Date(customer.lastSeen).toLocaleDateString()}</p>
                </div>
            </div>
            
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Sales History</h3>
            <div className="max-h-80 overflow-y-auto space-y-3 pr-2">
                {sales.length > 0 ? (
                    sales
                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                        .map(sale => (
                            <div key={sale.id} className="p-3 border border-gray-200 rounded-lg bg-white">
                                <div className="flex justify-between items-center mb-2 pb-2 border-b">
                                    <div>
                                        <p className="font-semibold text-gray-700">{formatDate(sale.date)}</p>
                                        <p className="text-xs text-gray-500">Sale ID: {sale.id}</p>
                                    </div>
                                    <p className="font-bold text-lg text-primary-600">{formatCurrency(sale.total)}</p>
                                </div>
                                <ul className="text-sm space-y-1">
                                    {sale.items.map((item, index) => (
                                        <li key={index} className="flex justify-between items-center text-gray-600">
                                            <span>{item.quantity}x {item.name}</span>
                                            <span className="text-xs">{formatCurrency(item.price)} each</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))
                ) : (
                    <p className="text-gray-500 text-center py-4">No sales history found for this customer.</p>
                )}
            </div>
             <div className="flex justify-end gap-2 pt-4 mt-2 border-t">
                <Button variant="secondary" onClick={onClose}>Close</Button>
            </div>
        </Modal>
    );
};


const Customers: React.FC = () => {
    const { customers, sales, currentUser } = useAppContext();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

    const isMaster = currentUser?.role === 'master';

    const salesMap = useMemo(() => {
        const map = new Map<string, Sale>();
        sales.forEach(sale => map.set(sale.id, sale));
        return map;
    }, [sales]);

    const filteredCustomers = useMemo(() => {
        if (!searchTerm) {
            return [...customers].sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime());
        }
        return customers.filter(c => 
            c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
            c.id.toLowerCase().includes(searchTerm.toLowerCase())
        ).sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime());
    }, [customers, searchTerm]);

    const handleViewDetails = (customer: Customer) => {
        setSelectedCustomer(customer);
    };
    
    const getCustomerSales = (customer: Customer | null): Sale[] => {
        if (!customer) return [];
        return customer.saleIds.map(id => salesMap.get(id)).filter((s): s is Sale => !!s);
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
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Customer Profiles</h1>
                <div className="w-full md:w-auto md:max-w-xs">
                    <Input 
                        placeholder="Search by name or bike no..." 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        icon={<Search className="w-5 h-5 text-gray-400" />}
                    />
                </div>
            </div>

            {customers.length === 0 ? (
                 <div className="text-center py-10 bg-white rounded-lg shadow">
                    <p className="text-gray-500">No customers have been recorded yet.</p>
                    <p className="text-sm text-gray-400">Customers are automatically added when you complete a sale in the POS screen.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredCustomers.map(customer => (
                        <div key={customer.id} className="bg-white rounded-lg shadow-md p-4 flex flex-col justify-between">
                            <div>
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="bg-primary-100 p-3 rounded-full">
                                        <User className="w-6 h-6 text-primary-700" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg text-gray-800 truncate">{customer.name}</h3>
                                        <p className="text-sm text-gray-500 font-mono flex items-center gap-1"><Hash size={14}/> {customer.id}</p>
                                    </div>
                                </div>
                                <div className="text-sm space-y-2 text-gray-600">
                                    <p className="flex items-center gap-2"><ShoppingCart size={16}/> <strong>Total Sales:</strong> {customer.saleIds.length}</p>
                                    <p className="flex items-center gap-2"><Calendar size={16}/> <strong>Last Visit:</strong> {formatDate(customer.lastSeen)}</p>
                                </div>
                            </div>
                            <div className="mt-4 pt-3 border-t">
                                <Button onClick={() => handleViewDetails(customer)} variant="secondary" className="w-full flex items-center justify-center gap-2">
                                    <Eye size={16} /> View History
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {selectedCustomer && (
                <CustomerDetailsModal 
                    customer={selectedCustomer} 
                    sales={getCustomerSales(selectedCustomer)}
                    onClose={() => setSelectedCustomer(null)} 
                />
            )}
        </div>
    );
};

export default Customers;
