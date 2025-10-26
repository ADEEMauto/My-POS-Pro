import React, { useState, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useAppContext } from '../contexts/AppContext';
import { Expense } from '../types';
import { formatCurrency } from '../utils/helpers';
import { Plus, Edit, Trash2, FileText, CreditCard, XCircle } from 'lucide-react';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import toast from 'react-hot-toast';
// @ts-ignore
import jsPDF from 'jspdf';
// @ts-ignore
import html2canvas from 'html2canvas';

const StatCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode; color: string }> = ({ title, value, icon, color }) => (
    <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md flex items-center space-x-4">
        <div className={`p-3 rounded-full ${color}`}>
            {icon}
        </div>
        <div>
            <p className="text-sm text-gray-500">{title}</p>
            <p className="text-2xl font-bold text-gray-800">{value}</p>
        </div>
    </div>
);

const ExpenseForm: React.FC<{
    expense?: Expense;
    onSave: (expense: Omit<Expense, 'id'> | Expense) => void;
    onCancel: () => void;
    existingCategories: string[];
}> = ({ expense, onSave, onCancel, existingCategories }) => {
    const [formData, setFormData] = useState({
        description: expense?.description || '',
        category: expense?.category || '',
        amount: expense?.amount || '',
        date: expense?.date ? new Date(expense.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.description.trim() || !formData.category.trim()) {
            toast.error("Description and category are required.");
            return;
        }
        const amount = parseFloat(String(formData.amount));
        if (isNaN(amount) || amount <= 0) {
            toast.error("Please enter a valid, positive amount.");
            return;
        }

        const dataToSave = {
            ...formData,
            amount: amount,
            date: new Date(formData.date).toISOString(),
            category: formData.category.trim(),
            description: formData.description.trim(),
        };

        onSave(expense ? { ...dataToSave, id: expense.id } : dataToSave);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Description" name="description" value={formData.description} onChange={handleChange} required placeholder="e.g., Electricity Bill" />
            <div>
                 <Input 
                    label="Category" 
                    name="category" 
                    value={formData.category} 
                    onChange={handleChange} 
                    required 
                    placeholder="e.g., Utilities"
                    list="expense-categories"
                />
                <datalist id="expense-categories">
                    {existingCategories.map(cat => <option key={cat} value={cat} />)}
                </datalist>
            </div>
            <Input label="Amount (Rs.)" name="amount" type="number" value={formData.amount} onChange={handleChange} required min="0.01" step="0.01" />
            <Input label="Date" name="date" type="date" value={formData.date} onChange={handleChange} required />
            <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
                <Button type="submit">Save Expense</Button>
            </div>
        </form>
    );
};

const Expenses: React.FC = () => {
    const { expenses, addExpense, updateExpense, deleteExpense, currentUser, shopInfo } = useAppContext();
    const [isModalOpen, setModalOpen] = useState(false);
    const [editingExpense, setEditingExpense] = useState<Expense | undefined>(undefined);
    const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);
    const [filterType, setFilterType] = useState<'month' | 'dateRange'>('month');
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const isMaster = currentUser?.role === 'master';

    const existingCategories = useMemo(() => {
        return [...new Set(expenses.map(e => e.category))].sort();
    }, [expenses]);
    
    const filteredExpenses = useMemo(() => {
        return expenses.filter(expense => {
            const expenseDate = new Date(expense.date);
            if (filterType === 'month') {
                return expense.date.startsWith(selectedMonth);
            }
            if (filterType === 'dateRange') {
                const start = startDate ? new Date(startDate) : null;
                const end = endDate ? new Date(endDate) : null;
                if(start) start.setHours(0,0,0,0);
                if(end) end.setHours(23,59,59,999);
                if (start && expenseDate < start) return false;
                if (end && expenseDate > end) return false;
                return true;
            }
            return true;
        });
    }, [expenses, filterType, selectedMonth, startDate, endDate]);
    
    const currentMonthExpensesTotal = useMemo(() => {
        const now = new Date();
        const currentMonth = now.toISOString().slice(0, 7);
        return expenses
            .filter(e => e.date.startsWith(currentMonth))
            .reduce((sum, e) => sum + e.amount, 0);
    }, [expenses]);

    const handleSaveExpense = (expenseData: Omit<Expense, 'id'> | Expense) => {
        if ('id' in expenseData) {
            updateExpense(expenseData);
        } else {
            addExpense(expenseData);
        }
        setModalOpen(false);
        setEditingExpense(undefined);
    };

    const handleEdit = (expense: Expense) => {
        setEditingExpense(expense);
        setModalOpen(true);
    };

    const handleDelete = (expense: Expense) => {
        setExpenseToDelete(expense);
    };

    const handleConfirmDelete = () => {
        if (expenseToDelete) {
            deleteExpense(expenseToDelete.id);
            setExpenseToDelete(null);
        }
    };
    
    const handleDownloadPdf = async () => {
        if (filteredExpenses.length === 0) {
            toast.error("No expenses in the selected range to download.");
            return;
        }

        let reportTitle: string;
        if(filterType === 'month') {
            const date = new Date(selectedMonth + '-02');
            const monthName = date.toLocaleString('default', { month: 'long' });
            const year = date.getFullYear();
            reportTitle = `Expense Report for ${monthName} ${year}`;
        } else {
            reportTitle = `Expense Report (${startDate || 'Start'} to ${endDate || 'End'})`;
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

            const totalFilteredAmount = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

            const tableRows = filteredExpenses.map(expense => `
                <tr>
                    <td style="border: 1px solid #ddd; padding: 6px;">${new Date(expense.date).toLocaleDateString()}</td>
                    <td style="border: 1px solid #ddd; padding: 6px;">${expense.category}</td>
                    <td style="border: 1px solid #ddd; padding: 6px;">${expense.description}</td>
                    <td style="border: 1px solid #ddd; padding: 6px; text-align: right;">${formatCurrency(expense.amount)}</td>
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
                    <h2 style="font-size: 20px; text-align: center; border-bottom: 1px solid #ddd; padding-bottom: 10px; margin-bottom: 20px;">${reportTitle}</h2>
                    <p style="font-size: 12px; margin-bottom: 20px; text-align: right;">Generated: ${new Date().toLocaleString()}</p>
                    <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
                        <thead style="background-color: #f2f2f2;">
                            <tr>
                                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Date</th>
                                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Category</th>
                                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Description</th>
                                <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Amount</th>
                            </tr>
                        </thead>
                        <tbody>${tableRows}</tbody>
                        <tfoot style="background-color: #f2f2f2; font-weight: bold;">
                             <tr>
                                <td colspan="3" style="border: 1px solid #ddd; padding: 8px; text-align: right;">Total:</td>
                                <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${formatCurrency(totalFilteredAmount)}</td>
                             </tr>
                        </tfoot>
                    </table>
                </div>
            `;
            document.body.appendChild(pdfContainer);
            const canvas = await html2canvas(pdfContainer, { scale: 2, useCORS: true });
            document.body.removeChild(pdfContainer);

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const imgProps = pdf.getImageProperties(imgData);
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
            pdf.addImage(imgData, 'PNG', 10, 10, pdfWidth - 20, pdfHeight - 20);
            
            const filename = `expense_report_${new Date().toISOString().split('T')[0]}.pdf`;
            pdf.save(filename);
            
            toast.success("PDF downloaded successfully!", { id: toastId });
        } catch (error) {
            console.error("Failed to generate PDF:", error);
            toast.error("Failed to generate PDF.", { id: toastId });
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
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Expenses</h1>
            
            <StatCard 
                title="Current Month's Expenses" 
                value={formatCurrency(currentMonthExpensesTotal)} 
                icon={<CreditCard className="w-6 h-6 text-white" />} 
                color="bg-orange-500" 
            />

            <div className="bg-white p-4 rounded-lg shadow-md flex flex-col md:flex-row justify-between items-center gap-4">
                 <Button onClick={() => { setEditingExpense(undefined); setModalOpen(true); }} className='gap-2 w-full md:w-auto'><Plus size={18}/> Add Expense</Button>
                <div className="flex items-center gap-4 flex-wrap justify-center w-full md:w-auto">
                    <div className="flex items-center gap-2">
                         <input type="radio" id="monthFilter" name="filterType" value="month" checked={filterType === 'month'} onChange={() => setFilterType('month')} />
                         <label htmlFor="monthFilter">By Month:</label>
                         <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="p-2 border rounded-md" disabled={filterType !== 'month'}/>
                    </div>
                     <div className="flex items-center gap-2">
                        <input type="radio" id="dateRangeFilter" name="filterType" value="dateRange" checked={filterType === 'dateRange'} onChange={() => setFilterType('dateRange')} />
                        <label htmlFor="dateRangeFilter">Date Range:</label>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="p-2 border rounded-md" disabled={filterType !== 'dateRange'}/>
                        <span>-</span>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="p-2 border rounded-md" disabled={filterType !== 'dateRange'}/>
                    </div>
                    <Button onClick={handleDownloadPdf} variant="secondary" className='gap-2'><FileText size={18}/> Download PDF</Button>
                </div>
            </div>

            {/* Table for medium screens and up */}
            <div className="hidden md:block bg-white rounded-lg shadow-md overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-500">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                        <tr>
                            <th scope="col" className="px-6 py-3">Date</th>
                            <th scope="col" className="px-6 py-3">Category</th>
                            <th scope="col" className="px-6 py-3">Description</th>
                            <th scope="col" className="px-6 py-3 text-right">Amount</th>
                            <th scope="col" className="px-6 py-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredExpenses.map(expense => (
                            <tr key={expense.id} className="bg-white border-b hover:bg-gray-50">
                                <td className="px-6 py-4">{new Date(expense.date).toLocaleDateString()}</td>
                                <td className="px-6 py-4"><span className="px-2 py-1 bg-gray-200 text-gray-800 rounded-full text-xs font-medium">{expense.category}</span></td>
                                <td className="px-6 py-4 font-medium text-gray-900">{expense.description}</td>
                                <td className="px-6 py-4 text-right font-semibold">{formatCurrency(expense.amount)}</td>
                                <td className="px-6 py-4">
                                    <div className="flex space-x-2">
                                        <button onClick={() => handleEdit(expense)} className="text-blue-600 hover:text-blue-800"><Edit size={18}/></button>
                                        <button onClick={() => handleDelete(expense)} className="text-red-600 hover:text-red-800"><Trash2 size={18}/></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            
            {/* Cards for small screens */}
            <div className="md:hidden grid grid-cols-1 gap-4">
                {filteredExpenses.map(expense => (
                     <div key={expense.id} className="bg-white rounded-lg shadow-md p-4 space-y-3">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="font-bold text-gray-800">{expense.description}</h3>
                                <p className="text-sm text-gray-500">{new Date(expense.date).toLocaleDateString()}</p>
                            </div>
                            <span className="font-bold text-lg text-primary-600">{formatCurrency(expense.amount)}</span>
                        </div>
                         <div className="flex justify-between items-center pt-2 border-t">
                             <span className="px-2 py-1 bg-gray-200 text-gray-800 rounded-full text-xs font-medium">{expense.category}</span>
                             <div className="flex items-center space-x-3">
                                <button onClick={() => handleEdit(expense)} className="text-blue-600 hover:text-blue-800" title="Edit"><Edit size={18}/></button>
                                <button onClick={() => handleDelete(expense)} className="text-red-600 hover:text-red-800" title="Delete"><Trash2 size={18}/></button>
                            </div>
                         </div>
                    </div>
                ))}
            </div>
             {filteredExpenses.length === 0 && (
                <div className="text-center py-10 bg-white rounded-lg shadow">
                    <p className="text-gray-500">No expenses found for the selected period.</p>
                </div>
            )}


            <Modal isOpen={isModalOpen} onClose={() => { setModalOpen(false); setEditingExpense(undefined); }} title={editingExpense ? 'Edit Expense' : 'Add New Expense'}>
                <ExpenseForm 
                    expense={editingExpense} 
                    onSave={handleSaveExpense} 
                    onCancel={() => { setModalOpen(false); setEditingExpense(undefined); }}
                    existingCategories={existingCategories}
                />
            </Modal>
            
            <Modal isOpen={!!expenseToDelete} onClose={() => setExpenseToDelete(null)} title="Confirm Expense Deletion" size="md">
                <div className="text-center">
                    <XCircle className="mx-auto h-12 w-12 text-red-500" />
                    <p className="mt-4 text-gray-700">Are you sure you want to delete this expense: <br/><strong className="text-gray-900">{expenseToDelete?.description}</strong>?</p>
                    <p className="text-sm text-gray-500">This action cannot be undone.</p>
                </div>
                <div className="flex justify-center gap-4 mt-6">
                    <Button variant="secondary" onClick={() => setExpenseToDelete(null)}>Cancel</Button>
                    <Button variant="danger" onClick={handleConfirmDelete}>Yes, Delete</Button>
                </div>
            </Modal>
        </div>
    );
};

export default Expenses;