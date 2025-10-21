import React, { useState, useMemo } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { Customer, Sale } from '../types';
import { formatDate, formatCurrency } from '../utils/helpers';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import { Search, User, ShoppingCart, Calendar, Eye, Bell, MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';

const isServiceDue = (customer: Customer): { due: boolean; message: string } => {
    const now = new Date();
    now.setHours(0, 0, 0, 0); // Compare dates only

    // 1. Manual override date
    if (customer.nextServiceDate) {
        const nextService = new Date(customer.nextServiceDate);
        if (nextService <= now) {
            return { due: true, message: `Service was due on ${nextService.toLocaleDateString()}` };
        }
    }

    // 2. Recurring frequency from last visit
    if (customer.serviceFrequencyValue && customer.serviceFrequencyUnit) {
        const lastSeenDate = new Date(customer.lastSeen);
        const dueDate = new Date(lastSeenDate);

        switch (customer.serviceFrequencyUnit) {
            case 'days':
                dueDate.setDate(lastSeenDate.getDate() + customer.serviceFrequencyValue);
                break;
            case 'months':
                dueDate.setMonth(lastSeenDate.getMonth() + customer.serviceFrequencyValue);
                break;
            case 'years':
                dueDate.setFullYear(lastSeenDate.getFullYear() + customer.serviceFrequencyValue);
                break;
        }

        if (dueDate <= now) {
            return { due: true, message: `Service was due around ${dueDate.toLocaleDateString()}` };
        }
    }

    return { due: false, message: '' };
};

const CustomerDetailsModal: React.FC<{
    customer: Customer,
    sales: Sale[],
    onClose: () => void,
    onSave: (details: {
        contactNumber?: string,
        servicingNotes?: string,
        nextServiceDate?: string,
        serviceFrequencyValue?: number,
        serviceFrequencyUnit?: 'days' | 'months' | 'years',
    }) => void
}> = ({ customer, sales, onClose, onSave }) => {

    const [contactNumber, setContactNumber] = useState(customer.contactNumber || '');
    const [servicingNotes, setServicingNotes] = useState(customer.servicingNotes || '');
    const [nextServiceDate, setNextServiceDate] = useState(customer.nextServiceDate ? customer.nextServiceDate.split('T')[0] : '');
    const [serviceFrequencyValue, setServiceFrequencyValue] = useState<number | string>(customer.serviceFrequencyValue || '');
    const [serviceFrequencyUnit, setServiceFrequencyUnit] = useState<'days' | 'months' | 'years'>(customer.serviceFrequencyUnit || 'months');

    const totalSpent = useMemo(() => sales.reduce((acc, s) => acc + s.total, 0), [sales]);
    const serviceStatus = isServiceDue(customer);

    const handleSave = () => {
        onSave({
            contactNumber: contactNumber.trim() || undefined,
            servicingNotes: servicingNotes.trim() || undefined,
            nextServiceDate: nextServiceDate || undefined,
            serviceFrequencyValue: serviceFrequencyValue ? Number(serviceFrequencyValue) : undefined,
            serviceFrequencyUnit: serviceFrequencyValue ? serviceFrequencyUnit : undefined,
        });
        onClose();
    };

    const modalFooter = (
        <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave}>Save Details</Button>
        </div>
    );

    return (
        <Modal isOpen={true} onClose={onClose} title={`Customer Profile: ${customer.name}`} size="2xl" footer={modalFooter}>
            <div className="space-y-6">
                {serviceStatus.due && (
                    <div className="p-3 bg-red-100 border-l-4 border-red-500 text-red-700 rounded-md">
                        <p className="font-bold animate-pulse flex items-center gap-2"><Bell size={16}/> Service Due</p>
                        <p className="text-sm">{serviceStatus.message}</p>
                    </div>
                )}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div className="bg-gray-100 p-3 rounded-lg">
                        <p className="text-sm text-gray-500">Bike Number</p>
                        <p className="font-bold text-primary-600">{customer.id}</p>
                    </div>
                    <div className="bg-gray-100 p-3 rounded-lg">
                        <p className="text-sm text-gray-500">Total Visits</p>
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

                <div className="pt-4 border-t">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Contact & Servicing Notes</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                            label="Contact Number"
                            type="tel"
                            placeholder="e.g., 03001234567"
                            value={contactNumber}
                            onChange={(e) => setContactNumber(e.target.value)}
                        />
                         <div className="md:col-span-1">
                            <label htmlFor="servicing-notes" className="block text-sm font-medium text-gray-700 mb-1">Servicing Notes</label>
                            <textarea
                                id="servicing-notes"
                                rows={3}
                                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                                placeholder="e.g., Every 3 months, check oil, due next on Jan 2025..."
                                value={servicingNotes}
                                onChange={(e) => setServicingNotes(e.target.value)}
                            ></textarea>
                        </div>
                    </div>
                </div>

                <div className="pt-4 border-t">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Service Reminders</h3>
                    <div className="space-y-4">
                        <div>
                            <Input
                                label="Next Service Date (Manual Override)"
                                type="date"
                                value={nextServiceDate}
                                onChange={(e) => setNextServiceDate(e.target.value)}
                            />
                            <p className="text-xs text-gray-500 mt-1">Set a specific date for the next service. This overrides the recurring frequency.</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Recurring Frequency (from last visit)</label>
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
                            <p className="text-xs text-gray-500 mt-1">Automatically calculates the next due date based on the customer's last visit.</p>
                        </div>
                    </div>
                </div>

                <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">Sales History</h3>
                    <div className="max-h-64 overflow-y-auto space-y-3 pr-2">
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
                </div>
            </div>
        </Modal>
    );
};


const Customers: React.FC = () => {
    const { customers, sales, currentUser, updateCustomerDetails, shopInfo } = useAppContext();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

    const isMaster = currentUser?.role === 'master';

    const salesMap = useMemo(() => {
        const map = new Map<string, Sale>();
        sales.forEach(sale => map.set(sale.id, sale));
        return map;
    }, [sales]);

    const filteredCustomers = useMemo(() => {
        const customersToSort = searchTerm
            ? customers.filter(c =>
                c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                c.id.toLowerCase().includes(searchTerm.toLowerCase())
              )
            : [...customers];

        return customersToSort.sort((a, b) => {
            const aIsDue = isServiceDue(a).due;
            const bIsDue = isServiceDue(b).due;

            // Rule 1: Service due customers come first.
            if (aIsDue && !bIsDue) return -1;
            if (!aIsDue && bIsDue) return 1;

            // Rule 2: If both are due, sort by number of visits (descending).
            if (aIsDue && bIsDue) {
                return b.saleIds.length - a.saleIds.length;
            }

            // Rule 3: For non-due customers, sort by last visit date (descending).
            return new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime();
        });
    }, [customers, searchTerm]);

    const handleViewDetails = (customer: Customer) => {
        setSelectedCustomer(customer);
    };

    const getCustomerSales = (customer: Customer | null): Sale[] => {
        if (!customer) return [];
        return customer.saleIds.map(id => salesMap.get(id)).filter((s): s is Sale => !!s);
    };

    const handleSaveCustomerDetails = (customerId: string, details: Parameters<typeof updateCustomerDetails>[1]) => {
        updateCustomerDetails(customerId, details);
    };

    const handleSendWhatsAppReminder = (customer: Customer) => {
        if (!customer.contactNumber) {
            toast.error("No contact number available for this customer.");
            return;
        }

        // Simple phone number formatting (assumes Pakistan country code '92')
        let formattedNumber = customer.contactNumber.replace(/\D/g, ''); // Remove all non-digit characters
        if (formattedNumber.startsWith('0')) {
            formattedNumber = '92' + formattedNumber.substring(1);
        } else if (!formattedNumber.startsWith('92')) {
            formattedNumber = '92' + formattedNumber;
        }

        const shopName = shopInfo?.name || "our bike shop";
        const message = `Hello ${customer.name}, this is a friendly reminder from ${shopName} that your bike service is due. Please contact us to schedule an appointment. Thank you!`;
        const encodedMessage = encodeURIComponent(message);
        const whatsappUrl = `https://wa.me/${formattedNumber}?text=${encodedMessage}`;

        window.open(whatsappUrl, '_blank');
        toast.success("Opening WhatsApp to send reminder...");
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
                    {filteredCustomers.map(customer => {
                        const serviceStatus = isServiceDue(customer);
                        return (
                        <div key={customer.id} className="bg-white rounded-lg shadow-md p-4 flex flex-col justify-between">
                            <div>
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="bg-primary-100 p-3 rounded-full">
                                        <User className="w-6 h-6 text-primary-700" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg text-gray-800 truncate">{customer.name}</h3>
                                        <p className="text-sm text-gray-500 font-mono flex items-center gap-1">{customer.id}</p>
                                    </div>
                                </div>
                                <div className="text-sm space-y-2 text-gray-600">
                                    <p className="flex items-center gap-2"><ShoppingCart size={16} /> <strong>Total Visits:</strong> {customer.saleIds.length}</p>
                                    <p className="flex items-center gap-2"><Calendar size={16} /> <strong>Last Visit:</strong> {formatDate(customer.lastSeen)}</p>
                                </div>
                                {serviceStatus.due && (
                                    <div className="mt-3 p-2 bg-red-100 border border-red-300 rounded-md text-center">
                                        <p className="animate-pulse text-red-600 font-bold text-sm flex items-center justify-center gap-1"><Bell size={14}/> Service Due</p>
                                    </div>
                                )}
                            </div>
                            <div className="mt-4 pt-3 border-t space-y-2">
                                <Button onClick={() => handleViewDetails(customer)} variant="secondary" className="w-full flex items-center justify-center gap-2">
                                    <Eye size={16} /> View Details
                                </Button>
                                {serviceStatus.due && customer.contactNumber && (
                                     <Button 
                                        onClick={() => handleSendWhatsAppReminder(customer)}
                                        size="sm"
                                        className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white focus:ring-green-500"
                                    >
                                        <MessageSquare size={16} /> Send WhatsApp Reminder
                                    </Button>
                                )}
                            </div>
                        </div>
                    )})}
                </div>
            )}

            {selectedCustomer && (
                <CustomerDetailsModal
                    customer={selectedCustomer}
                    sales={getCustomerSales(selectedCustomer)}
                    onClose={() => setSelectedCustomer(null)}
                    onSave={(details) => handleSaveCustomerDetails(selectedCustomer.id, details)}
                />
            )}
        </div>
    );
};

export default Customers;
