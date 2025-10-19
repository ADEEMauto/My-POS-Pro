
import React, { useState, useMemo } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { formatCurrency } from '../utils/helpers';
// @ts-ignore
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const Reports: React.FC = () => {
    const { sales, inventory, currentUser } = useAppContext();
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const isMaster = currentUser?.role === 'master';

    const filteredSales = useMemo(() => {
        if (!startDate && !endDate) return sales;
        return sales.filter(sale => {
            const saleDate = new Date(sale.date);
            const start = startDate ? new Date(startDate) : null;
            const end = endDate ? new Date(endDate) : null;
            if (start) start.setHours(0, 0, 0, 0);
            if (end) end.setHours(23, 59, 59, 999);
            
            if (start && saleDate < start) return false;
            if (end && saleDate > end) return false;
            return true;
        });
    }, [sales, startDate, endDate]);

    const salesDataForChart = useMemo(() => {
        const dailySales: { [key: string]: number } = {};
        filteredSales.forEach(sale => {
            const date = new Date(sale.date).toLocaleDateString();
            dailySales[date] = (dailySales[date] || 0) + sale.total;
        });
        return Object.keys(dailySales).map(date => ({ date, sales: dailySales[date] })).reverse();
    }, [filteredSales]);

    const itemSalesData = useMemo(() => {
        const itemSales: { [key: string]: { name: string, quantity: number, revenue: number } } = {};
        inventory.forEach(p => {
             itemSales[p.id] = { name: p.name, quantity: 0, revenue: 0 };
        });

        filteredSales.forEach(sale => {
            sale.items.forEach(item => {
                if (itemSales[item.productId]) {
                    itemSales[item.productId].quantity += item.quantity;
                    itemSales[item.productId].revenue += item.price * item.quantity;
                }
            });
        });
        
        return Object.values(itemSales).sort((a,b) => b.quantity - a.quantity);
    }, [filteredSales, inventory]);

    const mostSelling = itemSalesData.slice(0, 5);
    const leastSelling = itemSalesData.filter(i => i.quantity > 0).slice(-5).reverse();

    const totalInvestment = inventory.reduce((acc, p) => acc + p.purchasePrice * p.quantity, 0);
    const totalRevenue = filteredSales.reduce((acc, s) => acc + s.total, 0);


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
            <h1 className="text-3xl font-bold text-gray-800">Sales Reports</h1>

            <div className="bg-white p-4 rounded-lg shadow-md flex flex-wrap items-center gap-4">
                <h3 className="font-semibold">Filter by Date:</h3>
                <div>
                    <label htmlFor="start-date" className="text-sm mr-2">From:</label>
                    <input type="date" id="start-date" value={startDate} onChange={e => setStartDate(e.target.value)} className="p-2 border rounded-md"/>
                </div>
                 <div>
                    <label htmlFor="end-date" className="text-sm mr-2">To:</label>
                    <input type="date" id="end-date" value={endDate} onChange={e => setEndDate(e.target.value)} className="p-2 border rounded-md"/>
                </div>
                 <button onClick={() => {setStartDate(''); setEndDate('');}} className="text-sm text-primary-600 hover:underline">Reset</button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="bg-white p-6 rounded-lg shadow-md">
                     <h2 className="text-xl font-semibold text-gray-700 mb-2">Total Investment</h2>
                     <p className="text-3xl font-bold text-blue-600">{formatCurrency(totalInvestment)}</p>
                 </div>
                 <div className="bg-white p-6 rounded-lg shadow-md">
                     <h2 className="text-xl font-semibold text-gray-700 mb-2">Total Sales (Filtered)</h2>
                     <p className="text-3xl font-bold text-green-600">{formatCurrency(totalRevenue)}</p>
                 </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold mb-4">Sales Overview</h2>
                 <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={salesDataForChart}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis tickFormatter={(value) => `Rs.${value / 1000}k`} />
                        <Tooltip formatter={(value: number) => [formatCurrency(value), 'Sales']} />
                        <Legend />
                        <Bar dataKey="sales" fill="#ff4747" />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold mb-4">Most Selling Items</h2>
                    <ul className="space-y-2">
                        {mostSelling.map(item => (
                            <li key={item.name} className="flex justify-between items-center text-sm">
                                <span>{item.name}</span>
                                <span className="font-semibold bg-green-100 text-green-800 px-2 py-1 rounded-full">{item.quantity} sold</span>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold mb-4">Least Selling Items</h2>
                     <ul className="space-y-2">
                        {leastSelling.map(item => (
                            <li key={item.name} className="flex justify-between items-center text-sm">
                                <span>{item.name}</span>
                                <span className="font-semibold bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">{item.quantity} sold</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default Reports;
