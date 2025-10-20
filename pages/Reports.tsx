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
            const date = new Date(sale.date).toLocaleDateString('en-CA'); // YYYY-MM-DD for sorting
            dailySales[date] = (dailySales[date] || 0) + sale.total;
        });
        return Object.keys(dailySales).map(date => ({ date, sales: dailySales[date] })).sort((a,b) => a.date.localeCompare(b.date));
    }, [filteredSales]);

    const itemSalesData = useMemo(() => {
        const itemSales: { [key: string]: { name: string, quantity: number, revenue: number, profit: number } } = {};
        inventory.forEach(p => {
             itemSales[p.id] = { name: p.name, quantity: 0, revenue: 0, profit: 0 };
        });

        filteredSales.forEach(sale => {
            sale.items.forEach(item => {
                if (itemSales[item.productId]) {
                    const cost = item.purchasePrice || 0; // Handle old data
                    itemSales[item.productId].quantity += item.quantity;
                    itemSales[item.productId].revenue += item.price * item.quantity;
                    itemSales[item.productId].profit += (item.price - cost) * item.quantity;
                }
            });
        });
        
        return Object.values(itemSales);
    }, [filteredSales, inventory]);

    const mostProfitable = useMemo(() => [...itemSalesData].sort((a,b) => b.profit - a.profit).slice(0, 5), [itemSalesData]);
    const mostSelling = useMemo(() => [...itemSalesData].sort((a,b) => b.quantity - a.quantity).slice(0, 5), [itemSalesData]);
    const leastSelling = useMemo(() => itemSalesData.filter(i => i.quantity > 0).sort((a, b) => a.quantity - b.quantity).slice(0, 5), [itemSalesData]);

    const totalInvestment = inventory.reduce((acc, p) => acc + p.purchasePrice * p.quantity, 0);
    const totalRevenue = filteredSales.reduce((acc, s) => acc + s.total, 0);
    const totalCostOfGoodsSold = filteredSales.reduce((acc, sale) => {
        return acc + sale.items.reduce((itemAcc, item) => itemAcc + ((item.purchasePrice || 0) * item.quantity), 0);
    }, 0);
    const totalProfit = totalRevenue - totalCostOfGoodsSold;


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
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <div className="bg-white p-6 rounded-lg shadow-md">
                     <h2 className="text-xl font-semibold text-gray-700 mb-2">Total Investment</h2>
                     <p className="text-3xl font-bold text-blue-600">{formatCurrency(totalInvestment)}</p>
                 </div>
                 <div className="bg-white p-6 rounded-lg shadow-md">
                     <h2 className="text-xl font-semibold text-gray-700 mb-2">Total Sales (Filtered)</h2>
                     <p className="text-3xl font-bold text-green-600">{formatCurrency(totalRevenue)}</p>
                 </div>
                  <div className="bg-white p-6 rounded-lg shadow-md">
                     <h2 className="text-xl font-semibold text-gray-700 mb-2">Total Profit (Filtered)</h2>
                     <p className="text-3xl font-bold text-indigo-600">{formatCurrency(totalProfit)}</p>
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                 <div className="bg-white p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold mb-4">Most Profitable Items</h2>
                    <ul className="space-y-2">
                        {mostProfitable.map(item => (
                            <li key={item.name} className="flex justify-between items-center text-sm">
                                <span>{item.name}</span>
                                <span className="font-semibold bg-indigo-100 text-indigo-800 px-2 py-1 rounded-full">{formatCurrency(item.profit)}</span>
                            </li>
                        ))}
                    </ul>
                </div>
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
