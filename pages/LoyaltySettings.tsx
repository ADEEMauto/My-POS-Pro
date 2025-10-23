import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useAppContext } from '../contexts/AppContext';
import { EarningRule, Promotion, RedemptionRule, LoyaltyExpirySettings, CustomerTier } from '../types';
import { Plus, Edit, Trash2, Save, X, ArrowRight, Gift, Download, Award } from 'lucide-react';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import toast from 'react-hot-toast';
import { downloadFile } from '../utils/helpers';

const LoyaltySettings: React.FC = () => {
    const { 
        currentUser, 
        earningRules, updateEarningRules, 
        redemptionRule, updateRedemptionRule,
        promotions, addPromotion, updatePromotion, deletePromotion,
        customers,
        loyaltyExpirySettings, updateLoyaltyExpirySettings,
        customerTiers, updateCustomerTiers
    } = useAppContext();
    
    const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
    const [editingRule, setEditingRule] = useState<EarningRule | null>(null);

    const [isPromotionModalOpen, setIsPromotionModalOpen] = useState(false);
    const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);
    
    const [currentRedemptionRule, setCurrentRedemptionRule] = useState<RedemptionRule>(redemptionRule);
    const [currentExpirySettings, setCurrentExpirySettings] = useState<LoyaltyExpirySettings>(loyaltyExpirySettings);

    const [isTierModalOpen, setIsTierModalOpen] = useState(false);
    const [editingTier, setEditingTier] = useState<CustomerTier | null>(null);

    const isMaster = currentUser?.role === 'master';

    const sortedRules = [...earningRules].sort((a, b) => a.minSpend - b.minSpend);
    const sortedPromotions = [...promotions].sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
    const sortedTiers = [...customerTiers].sort((a, b) => a.rank - b.rank);

    // --- Earning Rules Logic ---
    const handleEditRule = (rule: EarningRule) => {
        setEditingRule(rule);
        setIsRuleModalOpen(true);
    };

    const handleAddNewRule = () => {
        setEditingRule(null);
        setIsRuleModalOpen(true);
    };

    const handleSaveRule = (ruleToSave: EarningRule) => {
        let updatedRules;
        if (earningRules.some(r => r.id === ruleToSave.id)) {
            updatedRules = earningRules.map(r => r.id === ruleToSave.id ? ruleToSave : r);
        } else {
            updatedRules = [...earningRules, ruleToSave];
        }
        updateEarningRules(updatedRules);
        setIsRuleModalOpen(false);
    };
    
    const handleDeleteRule = (id: string) => {
        if (window.confirm("Are you sure you want to delete this earning rule?")) {
            const updatedRules = earningRules.filter(r => r.id !== id);
            updateEarningRules(updatedRules);
        }
    };
    
    // --- Redemption Rule Logic ---
    const handleSaveRedemption = (e: React.FormEvent) => {
        e.preventDefault();
        updateRedemptionRule(currentRedemptionRule);
    };

    // --- Promotions Logic ---
    const handleAddNewPromotion = () => {
        setEditingPromotion(null);
        setIsPromotionModalOpen(true);
    };

    const handleEditPromotion = (promotion: Promotion) => {
        setEditingPromotion(promotion);
        setIsPromotionModalOpen(true);
    };

    const handleSavePromotion = (promoToSave: Omit<Promotion, 'id'> | Promotion) => {
        if ('id' in promoToSave) {
            updatePromotion(promoToSave);
        } else {
            addPromotion(promoToSave);
        }
        setIsPromotionModalOpen(false);
    };

    const handleDeletePromotion = (id: string) => {
        if (window.confirm("Are you sure you want to delete this promotion?")) {
            deletePromotion(id);
        }
    };
    
    const getPromotionStatus = (promo: Promotion): { text: string, color: string } => {
        const now = new Date();
        const start = new Date(promo.startDate);
        const end = new Date(promo.endDate);
        now.setHours(0,0,0,0);
        start.setHours(0,0,0,0);
        end.setHours(23,59,59,999);

        if (now < start) return { text: "Upcoming", color: "bg-blue-100 text-blue-800" };
        if (now > end) return { text: "Expired", color: "bg-gray-100 text-gray-800" };
        return { text: "Active", color: "bg-green-100 text-green-800" };
    };

    // --- Tier Logic ---
    const handleAddNewTier = () => {
        setEditingTier(null);
        setIsTierModalOpen(true);
    };

    const handleEditTier = (tier: CustomerTier) => {
        setEditingTier(tier);
        setIsTierModalOpen(true);
    };

    const handleSaveTier = (tierToSave: CustomerTier) => {
        let updatedTiers;
        if (customerTiers.some(t => t.id === tierToSave.id)) {
            updatedTiers = customerTiers.map(t => t.id === tierToSave.id ? tierToSave : t);
        } else {
            updatedTiers = [...customerTiers, tierToSave];
        }
        updateCustomerTiers(updatedTiers);
        setIsTierModalOpen(false);
    };

    const handleDeleteTier = (id: string) => {
        if (customerTiers.length <= 1) {
            toast.error("You must have at least one tier.");
            return;
        }
        if (window.confirm("Are you sure? Customers in this tier will be re-evaluated.")) {
            updateCustomerTiers(customerTiers.filter(t => t.id !== id));
        }
    };

    // --- Export Logic ---
    const handleExportPointsSummary = () => {
        if (customers.length === 0) {
            toast.error("No customer data to export.");
            return;
        }
    
        const headers = ["Customer Name", "Bike Number", "Loyalty Points"];
        const csvRows = [
            headers.join(','),
            ...customers.map(c => [
                `"${c.name.replace(/"/g, '""')}"`, // Handle quotes in names
                c.id,
                c.loyaltyPoints
            ].join(','))
        ];
        
        const csvContent = csvRows.join('\n');
        const dataUri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent);
        
        downloadFile(dataUri, `customer_points_summary_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
        toast.success("Customer points summary exported!");
    };

     // --- Expiry Settings Logic ---
    const handleExpirySettingsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        if (type === 'checkbox') {
            const { checked } = e.target as HTMLInputElement;
            setCurrentExpirySettings(s => ({ ...s, [name]: checked }));
        } else {
            setCurrentExpirySettings(s => ({ ...s, [name]: type === 'number' ? Number(value) : value }));
        }
    };

    const handleSaveExpirySettings = (e: React.FormEvent) => {
        e.preventDefault();
        updateLoyaltyExpirySettings(currentExpirySettings);
    };


    if (!isMaster) {
        return (
            <div className="text-center p-8 bg-white rounded-lg shadow-md">
                <h2 className="text-2xl font-bold text-red-600">Access Denied</h2>
                <p className="mt-2 text-gray-600">You do not have permission to view this page.</p>
            </div>
        );
    }
    
    // --- Form Components ---
    const RuleForm: React.FC<{ rule: EarningRule | null; onSave: (rule: EarningRule) => void; onCancel: () => void; }> = ({ rule, onSave, onCancel }) => {
        const [formData, setFormData] = useState({
            id: rule?.id || uuidv4(),
            minSpend: rule?.minSpend || 0,
            maxSpend: rule?.maxSpend === null ? '' : (rule?.maxSpend || ''),
            pointsPerHundred: rule?.pointsPerHundred || 1,
        });

        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            setFormData({ ...formData, [e.target.name]: e.target.value });
        };
        
        const handleSubmit = (e: React.FormEvent) => {
            e.preventDefault();
            const min = Number(formData.minSpend);
            const max = formData.maxSpend === '' ? null : Number(formData.maxSpend);
            const points = Number(formData.pointsPerHundred);
            
            if (max !== null && min >= max) {
                toast.error("Min spend must be less than max spend.");
                return;
            }
             if (points <= 0) {
                toast.error("Points must be a positive number.");
                return;
            }

            onSave({ ...formData, minSpend: min, maxSpend: max, pointsPerHundred: points });
        };

        return (
            <form onSubmit={handleSubmit} className="space-y-4">
                <Input label="Min Spend (Rs)" type="number" name="minSpend" value={formData.minSpend} onChange={handleChange} required min="0"/>
                <Input label="Max Spend (Rs) - Leave empty for no upper limit" type="number" name="maxSpend" value={formData.maxSpend} onChange={handleChange} min={(Number(formData.minSpend) || 0) + 1} />
                <Input label="Points per 100 Rs" type="number" name="pointsPerHundred" value={formData.pointsPerHundred} onChange={handleChange} required step="0.1" min="0.1"/>
                 <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
                    <Button type="submit">Save Rule</Button>
                </div>
            </form>
        )
    };

    const PromotionForm: React.FC<{ promotion: Promotion | null; onSave: (promo: Omit<Promotion, 'id'> | Promotion) => void; onCancel: () => void; }> = ({ promotion, onSave, onCancel }) => {
        const [formData, setFormData] = useState({
            id: promotion?.id || uuidv4(),
            name: promotion?.name || '',
            startDate: promotion?.startDate || '',
            endDate: promotion?.endDate || '',
            multiplier: promotion?.multiplier || 2,
        });

        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            setFormData({ ...formData, [e.target.name]: e.target.value });
        };
        
        const handleSubmit = (e: React.FormEvent) => {
            e.preventDefault();
            if (new Date(formData.endDate) < new Date(formData.startDate)) {
                toast.error("End date cannot be before start date.");
                return;
            }
            if (Number(formData.multiplier) <= 1) {
                toast.error("Multiplier must be greater than 1.");
                return;
            }

            const dataToSave = {
                ...formData,
                multiplier: Number(formData.multiplier)
            };
            
            onSave(promotion ? dataToSave : { name: dataToSave.name, startDate: dataToSave.startDate, endDate: dataToSave.endDate, multiplier: dataToSave.multiplier });
        };

        return (
            <form onSubmit={handleSubmit} className="space-y-4">
                <Input label="Promotion Name" name="name" value={formData.name} onChange={handleChange} required placeholder="e.g., Double Points Weekend"/>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <Input label="Start Date" type="date" name="startDate" value={formData.startDate} onChange={handleChange} required />
                     <Input label="End Date" type="date" name="endDate" value={formData.endDate} onChange={handleChange} required />
                </div>
                <Input label="Points Multiplier" type="number" name="multiplier" value={formData.multiplier} onChange={handleChange} required step="0.1" min="1.1" placeholder="e.g., 2 for double points"/>
                 <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
                    <Button type="submit">Save Promotion</Button>
                </div>
            </form>
        )
    };

    const TierForm: React.FC<{ tier: CustomerTier | null; onSave: (tier: CustomerTier) => void; onCancel: () => void; allTiers: CustomerTier[] }> = ({ tier, onSave, onCancel, allTiers }) => {
        const [formData, setFormData] = useState({
            id: tier?.id || uuidv4(),
            name: tier?.name || '',
            minVisits: tier?.minVisits || 0,
            minSpend: tier?.minSpend || 0,
            periodValue: tier?.periodValue || 12,
            periodUnit: tier?.periodUnit || 'months',
            pointsMultiplier: tier?.pointsMultiplier || 1,
            rank: tier?.rank ?? (allTiers.length > 0 ? Math.max(...allTiers.map(t => t.rank)) + 1 : 0)
        });
    
        const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
            const { name, value, type } = e.target;
            setFormData({ ...formData, [name]: type === 'number' ? Number(value) : value });
        };
    
        const handleSubmit = (e: React.FormEvent) => {
            e.preventDefault();
            if (!formData.name.trim()) {
                toast.error("Tier name is required.");
                return;
            }
            if (tier?.rank === 0 && (formData.minVisits > 0 || formData.minSpend > 0)) {
                toast.error("The base tier (rank 0) must have 0 visits and 0 spend requirement.");
                return;
            }
            onSave(formData);
        };
    
        return (
            <form onSubmit={handleSubmit} className="space-y-4">
                <Input label="Tier Name" name="name" value={formData.name} onChange={handleChange} required />
                <Input label="Points Multiplier" type="number" name="pointsMultiplier" value={formData.pointsMultiplier} onChange={handleChange} required step="0.01" min="1" />
                <h3 className="text-md font-semibold pt-2 border-t">Qualification Rules</h3>
                <p className="text-xs text-gray-500 -mt-3">Customer must meet these criteria in the chosen time period to qualify.</p>
                <Input label="Minimum Visits (Sales)" type="number" name="minVisits" value={formData.minVisits} onChange={handleChange} required min="0" disabled={tier?.rank === 0}/>
                <Input label="Minimum Spend (Rs)" type="number" name="minSpend" value={formData.minSpend} onChange={handleChange} required min="0" disabled={tier?.rank === 0}/>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Time Period (Rolling)</label>
                    <div className="flex items-center gap-2 mt-1">
                        <Input type="number" name="periodValue" value={formData.periodValue} onChange={handleChange} required min="1" className="w-24" />
                        <select name="periodUnit" value={formData.periodUnit} onChange={handleChange} className="p-2 border border-gray-300 rounded-md">
                            <option value="days">Days</option>
                            <option value="months">Months</option>
                            <option value="years">Years</option>
                        </select>
                    </div>
                </div>
                <Input label="Rank (for ordering, lower is worse)" type="number" name="rank" value={formData.rank} onChange={handleChange} required min="0" />

                <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
                    <Button type="submit">Save Tier</Button>
                </div>
            </form>
        );
    };


    return (
        <div className="space-y-8 max-w-4xl mx-auto">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Loyalty Program Settings</h1>

            <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold flex items-center gap-2"><Award/> Customer Tiers</h2>
                    <Button onClick={handleAddNewTier} className="flex items-center gap-2"><Plus size={18}/> Add Tier</Button>
                </div>
                <p className="text-sm text-gray-600 mb-4">Reward loyal customers. Tiers are automatically assigned based on their visit frequency and spending over a rolling period.</p>
                <div className="space-y-2">
                    {sortedTiers.map(tier => (
                        <div key={tier.id} className="p-3 bg-gray-50 rounded-md flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                            <div>
                                <p className="font-bold text-lg">{tier.name}</p>
                                <p className="text-xs text-gray-500">
                                    {tier.rank === 0 ? "Base Tier" : `Requires ${tier.minVisits} visits & ${formatCurrency(tier.minSpend)} spend in last ${tier.periodValue} ${tier.periodUnit}`}
                                </p>
                            </div>
                             <div className="flex items-center justify-between sm:justify-start gap-4">
                                <span className="font-semibold text-primary-600 text-lg">{tier.pointsMultiplier}x Points</span>
                                <div className="flex items-center gap-3">
                                    <button onClick={() => handleEditTier(tier)} className="text-blue-600 hover:text-blue-800" title="Edit"><Edit size={18}/></button>
                                    {tier.rank > 0 && <button onClick={() => handleDeleteTier(tier.id)} className="text-red-600 hover:text-red-800" title="Delete"><Trash2 size={18}/></button>}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold">Earning Rules</h2>
                    <Button onClick={handleAddNewRule} className="flex items-center gap-2"><Plus size={18}/> Add Tier</Button>
                </div>
                <p className="text-sm text-gray-600 mb-4">Define how customers earn points based on their spending in a single transaction.</p>
                <div className="space-y-2">
                    {sortedRules.map(rule => (
                        <div key={rule.id} className="p-3 bg-gray-50 rounded-md flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                            <div className="flex items-center gap-2 font-medium">
                               <span>{`Rs. ${rule.minSpend}`}</span>
                               <ArrowRight size={16} className="text-gray-400"/>
                               <span>{rule.maxSpend === null ? 'and above' : `Rs. ${rule.maxSpend}`}</span>
                            </div>
                            <div className="flex items-center justify-between sm:justify-start gap-4">
                                <span className="font-semibold text-primary-600">{rule.pointsPerHundred} pts / 100 Rs</span>
                                <div className="flex items-center gap-3">
                                    <button onClick={() => handleEditRule(rule)} className="text-blue-600 hover:text-blue-800" title="Edit"><Edit size={18}/></button>
                                    <button onClick={() => handleDeleteRule(rule.id)} className="text-red-600 hover:text-red-800" title="Delete"><Trash2 size={18}/></button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
                 <h2 className="text-xl font-semibold mb-4">Redemption Rule</h2>
                 <p className="text-sm text-gray-600 mb-4">Define how customers can redeem their points for discounts. Only one rule can be active at a time.</p>
                 <form onSubmit={handleSaveRedemption} className="space-y-4">
                    <div>
                         <label className="block text-sm font-medium text-gray-700 mb-1">Redemption Method</label>
                         <select 
                            value={currentRedemptionRule.method} 
                            onChange={e => setCurrentRedemptionRule({...currentRedemptionRule, method: e.target.value as RedemptionRule['method']})}
                            className="w-full p-2 border border-gray-300 rounded-md shadow-sm"
                         >
                            <option value="fixedValue">Fixed Value (e.g., 1 point = 1 Rupee)</option>
                            <option value="percentage">Percentage Discount (e.g., 100 points = 1%)</option>
                         </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Input 
                            label="Points Required" 
                            type="number"
                            min="1"
                            value={currentRedemptionRule.points}
                            onChange={e => setCurrentRedemptionRule({...currentRedemptionRule, points: Number(e.target.value)})}
                        />
                         <Input 
                            label={currentRedemptionRule.method === 'fixedValue' ? 'Value (Rs)' : 'Value (%)'}
                            type="number"
                            min="1"
                            value={currentRedemptionRule.value}
                            onChange={e => setCurrentRedemptionRule({...currentRedemptionRule, value: Number(e.target.value)})}
                        />
                    </div>
                    
                    <div className="p-3 bg-blue-50 text-blue-800 rounded-md text-center">
                        <strong>Current Rule: </strong> 
                        {currentRedemptionRule.method === 'fixedValue' 
                            ? `${currentRedemptionRule.points} point(s) = ${formatCurrency(currentRedemptionRule.value)} discount.`
                            : `${currentRedemptionRule.points} point(s) = ${currentRedemptionRule.value}% discount on total.`
                        }
                    </div>

                    <div className="flex justify-end pt-2">
                        <Button type="submit" className="flex items-center gap-2"><Save size={18}/> Save Redemption Rule</Button>
                    </div>
                 </form>
            </div>
             
             <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold flex items-center gap-2"><Gift/> Limited-Time Promotions</h2>
                    <Button onClick={handleAddNewPromotion} className="flex items-center gap-2"><Plus size={18}/> Add Promotion</Button>
                </div>
                <p className="text-sm text-gray-600 mb-4">Create special events with bonus point multipliers for a specific date range.</p>
                <div className="space-y-2">
                    {sortedPromotions.map(promo => {
                        const status = getPromotionStatus(promo);
                        return (
                        <div key={promo.id} className="p-3 bg-gray-50 rounded-md flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                            <div>
                                <p className="font-bold">{promo.name}</p>
                                <p className="text-sm text-gray-500">
                                    {new Date(promo.startDate).toLocaleDateString()} - {new Date(promo.endDate).toLocaleDateString()}
                                </p>
                            </div>
                            <div className="flex items-center justify-between sm:justify-start gap-4">
                                <span className="font-semibold text-primary-600 text-lg">{promo.multiplier}x Points</span>
                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${status.color}`}>{status.text}</span>
                                <div className="flex items-center gap-3">
                                    <button onClick={() => handleEditPromotion(promo)} className="text-blue-600 hover:text-blue-800" title="Edit"><Edit size={18}/></button>
                                    <button onClick={() => handleDeletePromotion(promo.id)} className="text-red-600 hover:text-red-800" title="Delete"><Trash2 size={18}/></button>
                                </div>
                            </div>
                        </div>
                    )})}
                     {sortedPromotions.length === 0 && <p className="text-center text-gray-500 py-4">No promotions created yet.</p>}
                </div>
            </div>

            <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold mb-4">Points Expiry System</h2>
                <form onSubmit={handleSaveExpirySettings} className="space-y-6">
                    <div className="flex items-center">
                        <input
                            type="checkbox"
                            id="expiry-enabled"
                            name="enabled"
                            checked={currentExpirySettings.enabled}
                            onChange={handleExpirySettingsChange}
                            className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                        />
                        <label htmlFor="expiry-enabled" className="ml-2 block text-sm font-medium text-gray-900">
                            Enable Points Expiry
                        </label>
                    </div>

                    {currentExpirySettings.enabled && (
                        <div className="space-y-4 pt-4 border-t">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Inactivity Rule</label>
                                <p className="text-xs text-gray-500 mb-2">Expire all points if a customer has no sales for this duration.</p>
                                <div className="flex items-center gap-2">
                                    <Input type="number" min="1" name="inactivityPeriodValue" value={currentExpirySettings.inactivityPeriodValue} onChange={handleExpirySettingsChange} className="w-24" />
                                    <select name="inactivityPeriodUnit" value={currentExpirySettings.inactivityPeriodUnit} onChange={handleExpirySettingsChange} className="p-2 border border-gray-300 rounded-md">
                                        <option value="days">Days</option>
                                        <option value="months">Months</option>
                                        <option value="years">Years</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Points Lifespan (for active customers)</label>
                                <p className="text-xs text-gray-500 mb-2">Points older than this duration will expire, even for active customers.</p>
                                <div className="flex items-center gap-2">
                                    <Input type="number" min="1" name="pointsLifespanValue" value={currentExpirySettings.pointsLifespanValue} onChange={handleExpirySettingsChange} className="w-24" />
                                    <select name="pointsLifespanUnit" value={currentExpirySettings.pointsLifespanUnit} onChange={handleExpirySettingsChange} className="p-2 border border-gray-300 rounded-md">
                                        <option value="days">Days</option>
                                        <option value="months">Months</option>
                                        <option value="years">Years</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Expiry Reminder</label>
                                <p className="text-xs text-gray-500 mb-2">Show a reminder on the customer page when their points are due to expire within this period.</p>
                                <div className="flex items-center gap-2">
                                    <Input type="number" min="1" name="reminderPeriodValue" value={currentExpirySettings.reminderPeriodValue} onChange={handleExpirySettingsChange} className="w-24" />
                                    <select name="reminderPeriodUnit" value={currentExpirySettings.reminderPeriodUnit} onChange={handleExpirySettingsChange} className="p-2 border border-gray-300 rounded-md">
                                        <option value="days">Days</option>
                                        <option value="months">Months</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}
                    <div className="flex justify-end pt-2">
                        <Button type="submit">Save Expiry Settings</Button>
                    </div>
                </form>
            </div>

            <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold mb-4">Data Export</h2>
                <p className="text-sm text-gray-600 mb-4">Download a CSV file containing a summary of all customers and their current loyalty points.</p>
                <Button onClick={handleExportPointsSummary} variant="secondary" className="flex items-center gap-2">
                    <Download size={18} /> Export Points Summary (CSV)
                </Button>
            </div>
            
            <Modal isOpen={isRuleModalOpen} onClose={() => setIsRuleModalOpen(false)} title={editingRule ? "Edit Earning Rule" : "Add Earning Rule"}>
                <RuleForm rule={editingRule} onSave={handleSaveRule} onCancel={() => setIsRuleModalOpen(false)} />
            </Modal>

            <Modal isOpen={isPromotionModalOpen} onClose={() => setIsPromotionModalOpen(false)} title={editingPromotion ? "Edit Promotion" : "Add New Promotion"}>
                <PromotionForm promotion={editingPromotion} onSave={handleSavePromotion} onCancel={() => setIsPromotionModalOpen(false)} />
            </Modal>

            <Modal isOpen={isTierModalOpen} onClose={() => setIsTierModalOpen(false)} title={editingTier ? "Edit Tier" : "Add New Tier"}>
                <TierForm tier={editingTier} onSave={handleSaveTier} onCancel={() => setIsTierModalOpen(false)} allTiers={customerTiers} />
            </Modal>
        </div>
    );
};

export default LoyaltySettings;

// Helper to format currency, assuming it's not available here directly
const formatCurrency = (amount: number) => {
    return `Rs. ${Math.round(amount).toLocaleString('en-IN')}`;
};