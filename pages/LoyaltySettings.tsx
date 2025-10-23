import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useAppContext } from '../contexts/AppContext';
import { EarningRule, RedemptionRule } from '../types';
import { Plus, Edit, Trash2, Save, X, ArrowRight } from 'lucide-react';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';

const LoyaltySettings: React.FC = () => {
    const { currentUser, earningRules, updateEarningRules, redemptionRule, updateRedemptionRule } = useAppContext();
    const [isEditingRule, setIsEditingRule] = useState<EarningRule | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    const [currentRedemptionRule, setCurrentRedemptionRule] = useState<RedemptionRule>(redemptionRule);

    const isMaster = currentUser?.role === 'master';

    const sortedRules = [...earningRules].sort((a, b) => a.minSpend - b.minSpend);

    const handleEditRule = (rule: EarningRule) => {
        setIsEditingRule(rule);
        setIsModalOpen(true);
    };

    const handleAddNewRule = () => {
        setIsEditingRule(null);
        setIsModalOpen(true);
    };

    const handleSaveRule = (ruleToSave: EarningRule) => {
        let updatedRules;
        if (earningRules.some(r => r.id === ruleToSave.id)) {
            updatedRules = earningRules.map(r => r.id === ruleToSave.id ? ruleToSave : r);
        } else {
            updatedRules = [...earningRules, ruleToSave];
        }
        updateEarningRules(updatedRules);
        setIsModalOpen(false);
    };
    
    const handleDeleteRule = (id: string) => {
        if (window.confirm("Are you sure you want to delete this earning rule?")) {
            const updatedRules = earningRules.filter(r => r.id !== id);
            updateEarningRules(updatedRules);
        }
    };
    
    const handleSaveRedemption = (e: React.FormEvent) => {
        e.preventDefault();
        updateRedemptionRule(currentRedemptionRule);
    };

    if (!isMaster) {
        return (
            <div className="text-center p-8 bg-white rounded-lg shadow-md">
                <h2 className="text-2xl font-bold text-red-600">Access Denied</h2>
                <p className="mt-2 text-gray-600">You do not have permission to view this page.</p>
            </div>
        );
    }
    
    const RuleForm: React.FC<{ rule: EarningRule | null; onSave: (rule: EarningRule) => void; onCancel: () => void; existingRules: EarningRule[] }> = ({ rule, onSave, onCancel, existingRules }) => {
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
                alert("Min spend must be less than max spend.");
                return;
            }
             if (points <= 0) {
                alert("Points must be a positive number.");
                return;
            }

            onSave({ ...formData, minSpend: min, maxSpend: max, pointsPerHundred: points });
        };

        return (
            <form onSubmit={handleSubmit} className="space-y-4">
                <Input label="Min Spend (Rs)" type="number" name="minSpend" value={formData.minSpend} onChange={handleChange} required min="0"/>
                <Input label="Max Spend (Rs) - Leave empty for no upper limit" type="number" name="maxSpend" value={formData.maxSpend} onChange={handleChange} min={formData.minSpend + 1} />
                <Input label="Points per 100 Rs" type="number" name="pointsPerHundred" value={formData.pointsPerHundred} onChange={handleChange} required step="0.1" min="0.1"/>
                 <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
                    <Button type="submit">Save Rule</Button>
                </div>
            </form>
        )
    };

    return (
        <div className="space-y-8 max-w-4xl mx-auto">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Loyalty Program Settings</h1>

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
            
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={isEditingRule ? "Edit Earning Rule" : "Add Earning Rule"}>
                <RuleForm rule={isEditingRule} onSave={handleSaveRule} onCancel={() => setIsModalOpen(false)} existingRules={earningRules} />
            </Modal>
        </div>
    );
};

export default LoyaltySettings;

// Helper to format currency, assuming it's not available here directly
const formatCurrency = (amount: number) => {
    return `Rs. ${Math.round(amount).toLocaleString('en-IN')}`;
};
