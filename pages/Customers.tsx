
import React, { useState, useMemo } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { Customer, Sale, LoyaltyTransaction, LoyaltyExpirySettings, CustomerTier, Payment } from '../types';
import { formatDate, formatCurrency, downloadFile } from '../utils/helpers';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import { Search, User, ShoppingCart, Calendar, Eye, Bell, MessageSquare, Star, ChevronsRight, Download, Flame, Award, AlertCircle, DollarSign } from 'lucide-react';
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

const calculatePointsExpiringSoon = (
    customer: Customer,
    allTransactions: LoyaltyTransaction[],
    settings: LoyaltyExpirySettings
): number => {
    if (!settings.enabled || customer.loyaltyPoints <= 0) {
        return 0;
    }

    const now = new Date();
    const modifyDate = (date: Date, value: number, unit: 'days' | 'months' | 'years', direction: 'add' | 'subtract'): Date => {
        const newDate = new Date(date);
        const multiplier = direction === 'add' ? 1 : -1;
        if (unit === 'days') newDate.setDate(newDate.getDate() + (value * multiplier));
        if (unit === 'months') newDate.setMonth(newDate.getMonth() + (value * multiplier));
        if (unit === 'years') newDate.setFullYear(newDate.getFullYear() + (value * multiplier));
        return newDate;
    };

    const inactivityThresholdDate = modifyDate(now, settings.inactivityPeriodValue, settings.inactivityPeriodUnit, 'subtract');
    if (new Date(customer.lastSeen) < inactivityThresholdDate) {
        return 0; // Inactive users lose all points; no "soon" warning needed.
    }

    const reminderEndDate = modifyDate(now, settings.reminderPeriodValue, settings.reminderPeriodUnit, 'add');

    const customerTransactions = allTransactions.filter(t => t.customerId === customer.id);
    const credits = customerTransactions
        .filter(t => t.type === 'earned' || t.type === 'manual_add')
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    const debits = customerTransactions
        .filter(t => t.type === 'redeemed' || t.type === 'manual_subtract');
    
    let debitsToApply = debits.reduce((sum, t) => sum + t.points, 0);
    let pointsExpiringSoon = 0;

    for (const credit of credits) {
        let unspentPoints = credit.points;
        if (debitsToApply > 0) {
            const deduction = Math.min(unspentPoints, debitsToApply);
            unspentPoints -= deduction;
            debitsToApply -= deduction;
        }
        
        const expiryDateForCredit = modifyDate(new Date(credit.date), settings.pointsLifespanValue, settings.pointsLifespanUnit, 'add');

        if (unspentPoints > 0 && expiryDateForCredit > now && expiryDateForCredit <= reminderEndDate) {
            pointsExpiringSoon += unspentPoints;
        }
    }

    return Math.round(pointsExpiringSoon);
};

const CustomerDetailsModal: React.FC<{
    customer: Customer,
    sales: Sale[],
    tier: CustomerTier | null,
    onClose: () => void,
    onSave: (details: Partial<Customer>) => boolean
}> = ({ customer, sales, tier, onClose, onSave }) => {
    const { currentUser, loyaltyTransactions, adjustCustomerPoints, payments, recordCustomerPayment } = useAppContext();
    const isMaster = currentUser?.role === 'master';

    const [activeTab, setActiveTab] = useState('details');
    const [viewingSale, setViewingSale] = useState<Sale | null>(null);

    // Details Tab State
    const [name, setName] = useState(customer.name);
    const [bikeNumber, setBikeNumber] = useState(customer.id);
    const [contactNumber, setContactNumber] = useState(customer.contactNumber || '');
    const [servicingNotes, setServicingNotes] = useState(customer.servicingNotes || '');
    const [nextServiceDate, setNextServiceDate] = useState(customer.nextServiceDate ? customer.nextServiceDate.split('T')[0] : '');
    const [serviceFrequencyValue, setServiceFrequencyValue] = useState<number | string>(customer.serviceFrequencyValue || '');
    const [serviceFrequencyUnit, setServiceFrequencyUnit] = useState<'days' | 'months' | 'years'>(customer.serviceFrequencyUnit || 'months');
    const [manualVisitAdjustment, setManualVisitAdjustment] = useState<number | string>(customer.manualVisitAdjustment || 0);

    // Points Adjustment State
    const [adjustmentPoints, setAdjustmentPoints] = useState('');
    const [adjustmentReason, setAdjustmentReason] = useState('');
    
    // Payment State
    const [paymentAmount, setPaymentAmount] = useState<number | string>('');

    const customerTransactions = useMemo(() => {
        return loyaltyTransactions.filter(t => t.customerId === customer.id).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [loyaltyTransactions, customer.id]);

    const customerPayments = useMemo(() => {
        return payments.filter(p => p.customerId === customer.id);
    }, [payments, customer.id]);

    const combinedHistory = useMemo(() => {
        const salesHistory = sales.map(s => ({ type: 'sale', data: s, date: new Date(s.date) }));
        const paymentsHistory = customerPayments.map(p => ({ type: 'payment', data: p, date: new Date(p.date) }));
        return [...salesHistory, ...paymentsHistory].sort((a, b) => b.date.getTime() - a.date.getTime());
    }, [sales, customerPayments]);
    
    const totalSpent = useMemo(() => sales.reduce((acc, s) => acc + s.amountPaid, 0), [sales]);
    const totalVisits = useMemo(() => sales.length + (customer.manualVisitAdjustment || 0), [sales, customer]);
    const serviceStatus = isServiceDue(customer);

    const handleSave = () => {
         if (!name.trim() || !bikeNumber.trim()) {
            toast.error("Customer Name and Bike Number are required.");
            return;
        }
        const success = onSave({
            id: bikeNumber,
            name: name,
            contactNumber: contactNumber.trim() || undefined,
            servicingNotes: servicingNotes.trim() || undefined,
            nextServiceDate: nextServiceDate || undefined,
            serviceFrequencyValue: serviceFrequencyValue ? Number(serviceFrequencyValue) : undefined,
            serviceFrequencyUnit: serviceFrequencyValue ? serviceFrequencyUnit : undefined,
            manualVisitAdjustment: Number(manualVisitAdjustment) || 0,
        });
        
        if (success) {
            onClose();
        }
    };
    
    const handleAdjustPoints = () => {
        const points = parseInt(adjustmentPoints, 10);
        if (isNaN(points)) {
            toast.error("Please enter a valid number for points.");
            return;
        }
        const success = adjustCustomerPoints(customer.id, points, adjustmentReason);
        if (success) {
            setAdjustmentPoints('');
            setAdjustmentReason('');
        }
    };
    
    const handleRecordPayment = (e: React.FormEvent) => {
        e.preventDefault();
        const amount = Number(paymentAmount);
        if (!amount || amount <= 0) {
            toast.error("Please enter a valid amount.");
            return;
        }
        const success = recordCustomerPayment(customer.id, amount);
        if (success) {
            setPaymentAmount('');
        }
    };

    const handleDownloadLedger = () => {
        if(customerTransactions.length === 0) {
            toast.error("No transactions to download.");
            return;
        }
        const headers = ["Date", "Type", "Points Change", "Reason/Sale ID", "Balance Before", "Balance After"];
        const csvRows = [
            headers.join(','),
            ...customerTransactions.map(t => {
                const pointsChange = (t.type === 'earned' || t.type === 'manual_add') ? `+${t.points}` : `-${t.points}`;
                const reason = t.relatedSaleId ? `Sale: ${t.relatedSaleId}` : t.reason || '';
                return [
                    `"${formatDate(t.date)}"`,
                    t.type.replace('_', ' ').toUpperCase(),
                    pointsChange,
                    `"${reason.replace(/"/g, '""')}"`,
                    t.pointsBefore,
                    t.pointsAfter
                ].join(',');
            })
        ];
        
        const csvContent = csvRows.join('\n');
        const dataUri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent);
        downloadFile(dataUri, `loyalty_ledger_${customer.id}_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
        toast.success("Ledger downloaded!");
    };

    const modalFooter = (
        <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>Close</Button>
            {activeTab === 'details' && <Button onClick={handleSave}>Save Details</Button>}
        </div>
    );

    const getTransactionTypeStyle = (type: LoyaltyTransaction['type']) => {
        switch (type) {
            case 'earned':
            case 'manual_add':
                return 'text-green-600';
            case 'redeemed':
            case 'manual_subtract':
                return 'text-red-600';
            default:
                return 'text-gray-600';
        }
    };

    const tierColors: { [key: string]: string } = {
        bronze: 'bg-yellow-700 text-white',
        silver: 'bg-gray-400 text-white',
        gold: 'bg-amber-400 text-black',
        platinum: 'bg-indigo-600 text-white'
    };
    const tierColor = tier ? tierColors[tier.name.toLowerCase()] || 'bg-gray-200' : 'bg-gray-200';

    const estimatedProfit = useMemo(() => {
        if (!viewingSale) return 0;
        return viewingSale.items.reduce((acc, item) => {
            const cost = item.purchasePrice || 0;
            return acc + (item.price - cost) * item.quantity;
        }, 0);
    }, [viewingSale]);
    
    const hasDiscounts = useMemo(() => {
        if (!viewingSale) return false;
        return (viewingSale.totalItemDiscounts || 0) > 0 || (viewingSale.overallDiscount || 0) > 0 || (viewingSale.loyaltyDiscount || 0) > 0;
    }, [viewingSale]);
    
    const calculatedOverallDiscount = useMemo(() => {
        if (!viewingSale) return 0;
        return Math.max(0, viewingSale.subtotal - (viewingSale.totalItemDiscounts || 0) + (viewingSale.tuningCharges || 0) + (viewingSale.laborCharges || 0) - (viewingSale.loyaltyDiscount || 0) - viewingSale.total);
    }, [viewingSale]);

    return (
        <Modal isOpen={true} onClose={onClose} title={`Customer: ${customer.name}`} size="2xl" footer={modalFooter}>
            <div className="space-y-6">
                 {customer.balance > 0 && (
                    <div className="p-3 mb-2 bg-red-100 border-l-4 border-red-500 text-red-800 rounded-md text-center">
                        <p className="font-bold text-lg animate-pulse flex items-center justify-center gap-2">
                            <AlertCircle size={20}/> Outstanding Balance: {formatCurrency(customer.balance)}
                        </p>
                    </div>
                )}
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                    <div className="flex-grow space-y-2">
                        {tier && (
                            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold ${tierColor}`}>
                                <Award size={16} /> {tier.name} Tier
                            </div>
                        )}
                        {serviceStatus.due && (
                            <div className="p-2 bg-red-100 border-l-4 border-red-500 text-red-700 rounded-md">
                                <p className="font-bold flex items-center gap-2"><Bell size={16}/> Service Due</p>
                                <p className="text-sm">{serviceStatus.message}</p>
                            </div>
                        )}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center">
                            <div className="bg-gray-100 p-2 rounded-lg">
                                <p className="text-xs text-gray-500">Bike Number</p>
                                <p className="font-bold text-primary-600 text-sm">{customer.id}</p>
                            </div>
                            <div className="bg-gray-100 p-2 rounded-lg">
                                <p className="text-xs text-gray-500">Total Visits</p>
                                <p className="font-bold text-primary-600 text-sm">{totalVisits}</p>
                            </div>
                            <div className="bg-gray-100 p-2 rounded-lg">
                                <p className="text-xs text-gray-500">Total Paid</p>
                                <p className="font-bold text-primary-600 text-sm">{formatCurrency(totalSpent)}</p>
                            </div>
                            <div className="bg-gray-100 p-2 rounded-lg">
                                <p className="text-xs text-gray-500">Last Visit</p>
                                <p className="font-bold text-primary-600 text-sm">{new Date(customer.lastSeen).toLocaleDateString()}</p>
                            </div>
                        </div>
                    </div>
                     <div className="bg-indigo-50 p-3 rounded-lg text-center shrink-0 w-full sm:w-auto">
                        <p className="text-sm text-indigo-700">Loyalty Points</p>
                        <p className="text-3xl font-bold text-indigo-600">{customer.loyaltyPoints || 0}</p>
                    </div>
                </div>
                
                 {isMaster && customer.balance > 0 && (
                    <form onSubmit={handleRecordPayment} className="p-4 bg-green-50 rounded-lg border border-green-200">
                        <h4 className="font-semibold text-green-800 mb-2 flex items-center gap-2"><DollarSign size={18}/> Settle Balance</h4>
                        <div className="flex items-end gap-2">
                            <div className="flex-grow">
                                <Input 
                                    label="Amount Paid"
                                    type="number"
                                    value={paymentAmount}
                                    onChange={e => setPaymentAmount(e.target.value)}
                                    max={customer.balance}
                                    min="1"
                                    placeholder={`Max: ${formatCurrency(customer.balance)}`}
                                    required
                                />
                            </div>
                            <Button type="submit">Record Payment</Button>
                        </div>
                    </form>
                )}

                <div className="border-b border-gray-200">
                    <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                        <button onClick={() => setActiveTab('details')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'details' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                            Customer Details
                        </button>
                        <button onClick={() => setActiveTab('history')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'history' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                            Account History
                        </button>
                         <button onClick={() => setActiveTab('loyalty')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'loyalty' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                            Points Ledger
                        </button>
                    </nav>
                </div>
                
                {activeTab === 'details' && (
                     <div className="space-y-4">
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input label="Customer Name" value={name} onChange={(e) => setName(e.target.value)} required />
                            <Input label="Bike Number (ID)" value={bikeNumber} onChange={(e) => setBikeNumber(e.target.value.replace(/\s+/g, '').toUpperCase())} required />
                            <Input label="Contact Number" type="tel" placeholder="e.g., 03001234567" value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} />
                             {isMaster && (
                                <div>
                                    <Input label="Manual Visit Adjustment" type="number" placeholder="e.g., 1 or -2" value={manualVisitAdjustment} onChange={(e) => setManualVisitAdjustment(e.target.value)} />
                                    <p className="text-xs text-gray-500 mt-1">Adjusts total visits for tier calculation.</p>
                                </div>
                             )}
                            <div className="md:col-span-2">
                                <label htmlFor="servicing-notes" className="block text-sm font-medium text-gray-700 mb-1">Servicing Notes</label>
                                <textarea id="servicing-notes" rows={3} className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" placeholder="e.g., Every 3 months, check oil..." value={servicingNotes} onChange={(e) => setServicingNotes(e.target.value)}></textarea>
                            </div>
                        </div>

                         <div className="pt-4 border-t">
                            <h3 className="text-lg font-semibold text-gray-800 mb-2">Service Reminders</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <Input label="Next Service Date (Manual Override)" type="date" value={nextServiceDate} onChange={(e) => setNextServiceDate(e.target.value)} />
                                    <p className="text-xs text-gray-500 mt-1">Overrides recurring frequency.</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Recurring Frequency</label>
                                    <div className="flex items-center gap-2">
                                        <Input type="number" placeholder="e.g., 3" min="1" value={serviceFrequencyValue} onChange={(e) => setServiceFrequencyValue(e.target.value)} className="w-1/3" />
                                        <select value={serviceFrequencyUnit} onChange={(e) => setServiceFrequencyUnit(e.target.value as 'days' | 'months' | 'years')} className="flex-grow p-2 border border-gray-300 rounded-md">
                                            <option value="days">Days</option>
                                            <option value="months">Months</option>
                                            <option value="years">Years</option>
                                        </select>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">Calculates from the last visit.</p>
                                </div>
                            </div>
                        </div>
                     </div>
                )}
                
                {activeTab === 'history' && (
                    viewingSale ? (
                        <div>
                            <div className="flex justify-between items-center mb-4">
                                <h4 className="font-semibold text-lg">Sale Details - ID: {viewingSale.id}</h4>
                                <Button variant="secondary" size="sm" onClick={() => setViewingSale(null)}>
                                    &larr; Back to History
                                </Button>
                            </div>
                            <div className="space-y-4">
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
                                            {viewingSale.items.map((item, index) => (
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
                                            <p>{formatCurrency(viewingSale.subtotal)}</p>
                                        </div>
                                    )}
                                    {(viewingSale.totalItemDiscounts || 0) > 0 && (
                                         <div className="flex justify-between items-baseline text-sm text-red-600">
                                            <p><strong>Item Discounts:</strong></p>
                                            <p>- {formatCurrency(viewingSale.totalItemDiscounts)}</p>
                                        </div>
                                    )}
                                    {(viewingSale.tuningCharges || 0) > 0 && (
                                        <div className="flex justify-between items-baseline text-sm text-blue-600">
                                            <p><strong>Tuning:</strong></p>
                                            <p>+ {formatCurrency(viewingSale.tuningCharges!)}</p>
                                        </div>
                                    )}
                                    {(viewingSale.laborCharges || 0) > 0 && (
                                        <div className="flex justify-between items-baseline text-sm text-blue-600">
                                            <p><strong>Labor Charges:</strong></p>
                                            <p>+ {formatCurrency(viewingSale.laborCharges!)}</p>
                                        </div>
                                    )}
                                    {(viewingSale.overallDiscount || 0) > 0 && (
                                         <div className="flex justify-between items-baseline text-sm text-red-600">
                                            <p><strong>Overall Discount {viewingSale.overallDiscountType === 'percentage' && `(${viewingSale.overallDiscount}%)`}</strong></p>
                                            <p>- {formatCurrency(calculatedOverallDiscount)}</p>
                                        </div>
                                    )}
                                     {(viewingSale.loyaltyDiscount || 0) > 0 && (
                                         <div className="flex justify-between items-baseline text-sm text-green-600">
                                            <p><strong>Loyalty Discount:</strong></p>
                                            <p>- {formatCurrency(viewingSale.loyaltyDiscount!)}</p>
                                        </div>
                                    )}
                                    <div className="flex justify-between items-baseline pt-1 border-t">
                                        <p><strong>Total Amount:</strong></p> 
                                        <p><span className="font-bold text-lg text-primary-600">{formatCurrency(viewingSale.total)}</span></p>
                                    </div>
                                     <div className="flex justify-between items-baseline">
                                        <p><strong>Est. Profit:</strong></p> 
                                        <p><span className="font-bold text-base text-green-600">{formatCurrency(estimatedProfit)}</span></p>
                                    </div>
                                </div>
                                {(viewingSale.pointsEarned !== undefined) && (
                                    <div className="pt-2 border-t space-y-1 text-sm">
                                         <h4 className="font-semibold flex items-center gap-1"><Star size={14}/> Loyalty Summary</h4>
                                         {viewingSale.promotionApplied && (
                                            <p className="p-2 bg-green-50 text-green-700 rounded-md text-center font-semibold">
                                                ✨ Promotion Applied: {viewingSale.promotionApplied.name} ({viewingSale.promotionApplied.multiplier}x Points!) ✨
                                            </p>
                                         )}
                                         <div className="flex justify-between"><span>Points Earned:</span> <span>{viewingSale.pointsEarned}</span></div>
                                         <div className="flex justify-between"><span>Points Redeemed:</span> <span>{viewingSale.redeemedPoints || 0}</span></div>
                                         <div className="flex justify-between font-bold"><span>Final Balance:</span> <span>{viewingSale.finalLoyaltyPoints}</span></div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="max-h-96 overflow-y-auto space-y-3 pr-2">
                             <table className="w-full text-sm text-left">
                                <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0">
                                    <tr>
                                        <th className="px-2 py-2">Date</th>
                                        <th className="px-2 py-2">Details</th>
                                        <th className="px-2 py-2 text-right">Bill</th>
                                        <th className="px-2 py-2 text-right">Paid</th>
                                        <th className="px-2 py-2 text-right">Balance</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                {combinedHistory.length > 0 ? (
                                    combinedHistory.map((item, index) => {
                                        if(item.type === 'sale') {
                                            const sale = item.data as Sale;
                                            return (
                                                <tr key={`sale-${sale.id}-${index}`}>
                                                    <td className="px-2 py-2 text-xs">{new Date(sale.date).toLocaleDateString()}</td>
                                                    <td className="px-2 py-2">
                                                        Sale{' '}
                                                        <button 
                                                            onClick={() => setViewingSale(sale)}
                                                            className="font-mono text-xs bg-gray-100 p-1 rounded text-primary-600 hover:bg-primary-100 hover:underline"
                                                        >
                                                            {sale.id}
                                                        </button>
                                                    </td>
                                                    <td className="px-2 py-2 text-right">{formatCurrency(sale.total)}</td>
                                                    <td className="px-2 py-2 text-right text-green-600">{formatCurrency(sale.amountPaid)}</td>
                                                    <td className="px-2 py-2 text-right font-semibold">{formatCurrency(sale.balanceDue)}</td>
                                                </tr>
                                            )
                                        } else {
                                            const payment = item.data as Payment;
                                            return (
                                                 <tr key={`payment-${payment.id}-${index}`} className="bg-green-50 hover:bg-green-100">
                                                    <td className="px-2 py-2 text-xs">{new Date(payment.date).toLocaleDateString()}</td>
                                                    <td className="px-2 py-2 font-semibold text-green-800">{payment.notes || 'Payment Received'}</td>
                                                    <td className="px-2 py-2 text-right">-</td>
                                                    <td className="px-2 py-2 text-right font-semibold text-green-800">{formatCurrency(payment.amount)}</td>
                                                    <td className="px-2 py-2 text-right">-</td>
                                                </tr>
                                            )
                                        }
                                    })
                                ) : <tr><td colSpan={5} className="text-gray-500 text-center py-4">No account history.</td></tr>}
                                </tbody>
                             </table>
                        </div>
                    )
                )}
                
                {activeTab === 'loyalty' && (
                    <div>
                        {isMaster && (
                            <div className="p-4 bg-gray-50 border rounded-lg mb-4">
                                <h4 className="font-semibold text-gray-800 mb-2">Manual Point Adjustment</h4>
                                <div className="flex flex-col sm:flex-row items-end gap-2">
                                    <Input label="Points (+/-)" type="number" placeholder="e.g., 50 or -20" value={adjustmentPoints} onChange={e => setAdjustmentPoints(e.target.value)} />
                                    <Input label="Reason" placeholder="e.g., Birthday gift" value={adjustmentReason} onChange={e => setAdjustmentReason(e.target.value)} />
                                    <Button onClick={handleAdjustPoints} className="shrink-0" disabled={!adjustmentPoints || !adjustmentReason}>Adjust</Button>
                                </div>
                            </div>
                        )}
                        <div className="flex justify-between items-center mb-2">
                            <h4 className="font-semibold text-gray-800">Transaction History</h4>
                            <Button onClick={handleDownloadLedger} variant="ghost" size="sm" className="flex items-center gap-2"><Download size={16}/> Download Ledger</Button>
                        </div>
                        <div className="max-h-80 overflow-y-auto pr-2 border rounded-md">
                             {customerTransactions.length > 0 ? (
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 sticky top-0"><tr>
                                        <th className="p-2 text-left font-medium">Date</th>
                                        <th className="p-2 text-left font-medium">Details</th>
                                        <th className="p-2 text-right font-medium">Change</th>
                                        <th className="p-2 text-right font-medium">Balance</th>
                                    </tr></thead>
                                    <tbody>
                                    {customerTransactions.map(t => (
                                        <tr key={t.id} className="border-b hover:bg-gray-50">
                                            <td className="p-2 text-xs text-gray-500 align-top">{new Date(t.date).toLocaleDateString()}</td>
                                            <td className="p-2 align-top">
                                                <p className="font-semibold capitalize">{t.type.replace(/_/g, ' ')}</p>
                                                <p className="text-xs text-gray-500">{t.reason || (t.relatedSaleId ? `Sale #${t.relatedSaleId}` : '')}</p>
                                            </td>
                                            <td className={`p-2 text-right font-bold align-top ${getTransactionTypeStyle(t.type)}`}>
                                                {(t.type === 'earned' || t.type === 'manual_add') ? '+' : '-'}{t.points}
                                            </td>
                                            <td className="p-2 text-right text-gray-500 align-top">
                                                <div className="flex items-center justify-end gap-1">
                                                    <span>{t.pointsBefore}</span>
                                                    <ChevronsRight size={14} className="text-gray-400"/>
                                                    <span className="font-semibold text-gray-800">{t.pointsAfter}</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    </tbody>
                                </table>
                             ) : <p className="text-center text-gray-500 p-6">No loyalty point transactions found.</p>}
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};


const Customers: React.FC = () => {
    const { customers, sales, currentUser, updateCustomer, shopInfo, loyaltyTransactions, loyaltyExpirySettings, customerTiers } = useAppContext();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [sortBy, setSortBy] = useState('balance_desc');

    const isMaster = currentUser?.role === 'master';

    const salesMap = useMemo(() => {
        const map = new Map<string, Sale>();
        sales.forEach(sale => map.set(sale.id, sale));
        return map;
    }, [sales]);
    
    const tierMap = useMemo(() => {
        const map = new Map<string, CustomerTier>();
        customerTiers.forEach(tier => map.set(tier.id, tier));
        return map;
    }, [customerTiers]);

    const customerMetrics = useMemo(() => {
        const metrics = new Map<string, { totalSpent: number; totalProfit: number }>();
        const localSalesMap = new Map<string, Sale>();
        sales.forEach(sale => localSalesMap.set(sale.id, sale));

        customers.forEach(customer => {
            const customerSales = customer.saleIds
                .map(id => localSalesMap.get(id))
                .filter((s): s is Sale => !!s);
            
            const totalSpent = customerSales.reduce((acc, s) => acc + s.amountPaid, 0);
            const totalProfit = customerSales.reduce((acc, sale) => {
                return acc + sale.items.reduce((itemAcc, item) => {
                    return itemAcc + (item.price - (item.purchasePrice || 0)) * item.quantity;
                }, 0);
            }, 0);

            metrics.set(customer.id, { totalSpent, totalProfit });
        });
        return metrics;
    }, [customers, sales]);

    const filteredCustomers = useMemo(() => {
        const customersToFilter = searchTerm
            ? customers.filter(c =>
                c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                c.id.toLowerCase().includes(searchTerm.toLowerCase())
              )
            : [...customers];

        customersToFilter.sort((a, b) => {
            const [sortKey, sortDir] = sortBy.split('_');
            const dir = sortDir === 'asc' ? 1 : -1;

            if (sortKey === 'serviceDue') {
                const aIsDue = isServiceDue(a).due;
                const bIsDue = isServiceDue(b).due;
                if (aIsDue && !bIsDue) return -1 * dir;
                if (!aIsDue && bIsDue) return 1 * dir;
                return (new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime()) * dir;
            }

            switch (sortKey) {
                case 'balance':
                    return ((a.balance || 0) - (b.balance || 0)) * dir;
                case 'visits':
                    const visitsA = a.saleIds.length + (a.manualVisitAdjustment || 0);
                    const visitsB = b.saleIds.length + (b.manualVisitAdjustment || 0);
                    return (visitsA - visitsB) * dir;
                case 'profit': {
                    const profitA = customerMetrics.get(a.id)?.totalProfit || 0;
                    const profitB = customerMetrics.get(b.id)?.totalProfit || 0;
                    return (profitA - profitB) * dir;
                }
                case 'spent': {
                    const spentA = customerMetrics.get(a.id)?.totalSpent || 0;
                    const spentB = customerMetrics.get(b.id)?.totalSpent || 0;
                    return (spentA - spentB) * dir;
                }
                case 'lastSeen':
                    return (new Date(a.lastSeen).getTime() - new Date(b.lastSeen).getTime()) * dir;
                case 'points':
                    return (a.loyaltyPoints - b.loyaltyPoints) * dir;
                case 'name':
                    return a.name.localeCompare(b.name) * dir;
                default:
                    return 0;
            }
        });

        return customersToFilter;
    }, [customers, searchTerm, sortBy, customerMetrics]);

    const handleViewDetails = (customer: Customer) => {
        setSelectedCustomer(customer);
    };

    const getCustomerSales = (customer: Customer | null): Sale[] => {
        if (!customer) return [];
        return customer.saleIds.map(id => salesMap.get(id)).filter((s): s is Sale => !!s);
    };

    const handleSendWhatsAppReminder = (customer: Customer) => {
        if (!customer.contactNumber) {
            toast.error("No contact number available for this customer.");
            return;
        }

        let formattedNumber = customer.contactNumber.replace(/\D/g, '');
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

    const tierColors: { [key: string]: string } = {
        bronze: 'bg-yellow-700 text-white',
        silver: 'bg-gray-400 text-white',
        gold: 'bg-amber-400 text-black',
        platinum: 'bg-indigo-600 text-white'
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Customer Profiles</h1>
                <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto">
                    <div className="w-full sm:w-auto flex-grow">
                        <Input
                            placeholder="Search by name or bike no..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            icon={<Search className="w-5 h-5 text-gray-400" />}
                        />
                    </div>
                    <div className="w-full sm:w-auto">
                        <select
                            value={sortBy}
                            onChange={e => setSortBy(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                            aria-label="Sort customers by"
                        >
                            <option value="balance_desc">Sort by: Balance Due</option>
                            <option value="serviceDue_desc">Sort by: Service Due First</option>
                            <option value="lastSeen_desc">Sort by: Most Recent Visit</option>
                            <option value="lastSeen_asc">Sort by: Oldest Visit</option>
                            <option value="visits_desc">Sort by: Most Visits</option>
                            <option value="visits_asc">Sort by: Least Visits</option>
                            <option value="spent_desc">Sort by: Highest Spending</option>
                            <option value="spent_asc">Sort by: Lowest Spending</option>
                            <option value="profit_desc">Sort by: Most Profitable</option>
                            <option value="profit_asc">Sort by: Least Profitable</option>
                            <option value="points_desc">Sort by: Points (High to Low)</option>
                            <option value="points_asc">Sort by: Points (Low to High)</option>
                            <option value="name_asc">Sort by: Name (A-Z)</option>
                            <option value="name_desc">Sort by: Name (Z-A)</option>
                        </select>
                    </div>
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
                        const pointsExpiring = calculatePointsExpiringSoon(customer, loyaltyTransactions, loyaltyExpirySettings);
                        const tier = customer.tierId ? tierMap.get(customer.tierId) : null;
                        const tierColor = tier ? tierColors[tier.name.toLowerCase()] || 'bg-gray-200' : 'bg-gray-200';
                        const hasBalance = (customer.balance || 0) > 0;
                        const totalVisits = customer.saleIds.length + (customer.manualVisitAdjustment || 0);

                        return (
                        <div key={customer.id} className={`bg-white rounded-lg shadow-md p-4 flex flex-col justify-between border-t-4 ${hasBalance ? 'border-red-500' : 'border-transparent'}`}>
                            <div>
                                {hasBalance && (
                                    <div className="p-2 mb-3 bg-red-100 text-red-800 rounded-md text-center font-bold">
                                        Outstanding: {formatCurrency(customer.balance)}
                                    </div>
                                )}
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="bg-primary-100 p-3 rounded-full">
                                            <User className="w-6 h-6 text-primary-700" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-lg text-gray-800 truncate">{customer.name}</h3>
                                            <p className="text-sm text-gray-500 font-mono flex items-center gap-1">{customer.id}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        {tier && (
                                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${tierColor}`}>{tier.name}</span>
                                        )}
                                        <p className="text-xs text-indigo-600 mt-1">Loyalty Points</p>
                                        <p className="font-bold text-indigo-600 text-lg">{customer.loyaltyPoints || 0}</p>
                                    </div>
                                </div>
                                <div className="text-sm space-y-2 text-gray-600">
                                    <p className="flex items-center gap-2"><ShoppingCart size={16} /> <strong>Total Visits:</strong> {totalVisits}</p>
                                    <p className="flex items-center gap-2"><Calendar size={16} /> <strong>Last Visit:</strong> {formatDate(customer.lastSeen)}</p>
                                </div>
                                {serviceStatus.due && (
                                    <div className="mt-3 p-2 bg-red-100 border border-red-300 rounded-md text-center">
                                        <p className="animate-pulse text-red-600 font-bold text-sm flex items-center justify-center gap-1"><Bell size={14}/> Service Due</p>
                                    </div>
                                )}
                                {pointsExpiring > 0 && (
                                    <div className="mt-3 p-2 bg-amber-100 border border-amber-300 rounded-md text-center">
                                        <p className="text-amber-700 font-bold text-sm flex items-center justify-center gap-1"><Flame size={14}/> {pointsExpiring} points expiring soon!</p>
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
                    tier={selectedCustomer.tierId ? tierMap.get(selectedCustomer.tierId) ?? null : null}
                    onClose={() => setSelectedCustomer(null)}
                    onSave={(details) => updateCustomer(selectedCustomer.id, details)}
                />
            )}
        </div>
    );
};

export default Customers;
