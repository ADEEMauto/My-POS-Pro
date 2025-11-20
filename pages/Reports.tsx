
import React, { useState, useMemo } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { formatCurrency } from '../utils/helpers';
// @ts-ignore
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Product } from '../types';
import Button from '../components/ui/Button';
import { FileText } from 'lucide-react';
import toast from 'react-hot-toast';
// @ts-ignore
import jsPDF from 'jspdf';
// @ts-ignore
import html2canvas from 'html2canvas';

const Reports: React.FC = () => {
    const { sales, inventory, currentUser, categories, shopInfo } = useAppContext();
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const isMaster = currentUser?.role === 'master';

    const categoryMap = useMemo(() => {
        const map = new Map<string, string>();
        categories.forEach(cat => {
            map.set(cat.id, cat.name);
        });
        return map;
    }, [categories]);

    const outOfStockProducts = useMemo(() => {
        return inventory.filter(p => p.quantity === 0);
    }, [inventory]);

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
        const itemSales: { [key: string]: { product: Product, quantity: number, revenue: number, profit: number, profitPercentage: number } } = {};
        inventory.forEach(p => {
             const purchasePrice = p.purchasePrice;
             const salePrice = p.salePrice;
             let profitPercentage = 0;
             if (purchasePrice > 0 && salePrice > purchasePrice) {
                 profitPercentage = ((salePrice - purchasePrice) / purchasePrice) * 100;
             }
             itemSales[p.id] = { product: p, quantity: 0, revenue: 0, profit: 0, profitPercentage };
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

    const mostProfitable = useMemo(() => [...itemSalesData].filter(i => i.profitPercentage > 0).sort((a,b) => b.profitPercentage - a.profitPercentage).slice(0, 5), [itemSalesData]);
    const mostSelling = useMemo(() => [...itemSalesData].sort((a,b) => b.quantity - a.quantity).slice(0, 5), [itemSalesData]);
    const leastSelling = useMemo(() => itemSalesData.filter(i => i.quantity > 0).sort((a, b) => a.quantity - b.quantity).slice(0, 5), [itemSalesData]);

    // Calculations retained but not rendered as per request
    const totalInvestment = inventory.reduce((acc, p) => acc + p.purchasePrice * p.quantity, 0);
    const totalRevenue = filteredSales.reduce((acc, s) => acc + s.total, 0);
    const totalCostOfGoodsSold = filteredSales.reduce((acc, sale) => {
        return acc + sale.items.reduce((itemAcc, item) => itemAcc + ((item.purchasePrice || 0) * item.quantity), 0);
    }, 0);
    const totalProfit = totalRevenue - totalCostOfGoodsSold;

    const handleDownloadReportPdf = async (reportData: (Product | { product: Product, quantity: number })[], reportTitle: string, filenamePrefix: string) => {
        if (reportData.length === 0) {
            toast.error(`No items to include in the ${reportTitle}.`);
            return;
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

            const tableHeaderHtml = `
                <tr style="background-color: #f2f2f2;">
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Sr. No.</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Name of Item</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Manufacturing</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Category</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Remaining Quantity</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Quantity Sold</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Bar Code</th>
                </tr>
            `;

            const tableRows = reportData.map((item, index) => {
                const product = 'product' in item ? item.product : item;
                const salesInfo = itemSalesData.find(d => d.product.id === product.id);
                const soldQuantity = salesInfo ? salesInfo.quantity : 0;

                return `
                    <tr>
                        <td style="border: 1px solid #ddd; padding: 6px; text-align: center; vertical-align: top;">${index + 1}</td>
                        <td style="border: 1px solid #ddd; padding: 6px; vertical-align: top;"><strong>${product.name}</strong></td>
                        <td style="border: 1px solid #ddd; padding: 6px; vertical-align: top;">${product.manufacturer}</td>
                        <td style="border: 1px solid #ddd; padding: 6px; vertical-align: top;">
                            ${categoryMap.get(product.categoryId) || product.categoryId}
                            ${product.subCategoryId && categoryMap.get(product.subCategoryId) ? `<br><small style="color: #555;">↳ ${categoryMap.get(product.subCategoryId)}</small>` : ''}
                        </td>
                        <td style="border: 1px solid #ddd; padding: 6px; text-align: center; vertical-align: top;">${product.quantity}</td>
                        <td style="border: 1px solid #ddd; padding: 6px; text-align: center; vertical-align: top;">${soldQuantity}</td>
                        <td style="border: 1px solid #ddd; padding: 6px; vertical-align: top;">${product.barcode || 'N/A'}</td>
                    </tr>
                `;
            }).join('');
            
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
                        <thead>
                            ${tableHeaderHtml}
                        </thead>
                        <tbody>
                            ${tableRows}
                        </tbody>
                    </table>
                </div>
            `;

            document.body.appendChild(pdfContainer);

            const canvas = await html2canvas(pdfContainer, { scale: 2, useCORS: true });
            
            document.body.removeChild(pdfContainer);

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            const imgProps = pdf.getImageProperties(imgData);
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
            
            let heightLeft = pdfHeight;
            let position = 0;
            const margin = 10;
            const pageHeightWithMargin = pdf.internal.pageSize.getHeight() - (2 * margin);

            pdf.addImage(imgData, 'PNG', margin, margin, pdfWidth - (2 * margin), pdfHeight);
            heightLeft -= pageHeightWithMargin;

            while (heightLeft > 0) {
                position -= pageHeightWithMargin;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', margin, position + margin, pdfWidth - (2*margin), pdfHeight);
                heightLeft -= pageHeightWithMargin;
            }

            const filename = `${filenamePrefix}_report_${new Date().toISOString().split('T')[0]}.pdf`;
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
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Sales Reports</h1>

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

            <div className="bg-white p-4 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold mb-4">Download Reports</h2>
                <div className="flex flex-wrap items-center gap-4">
                    <Button
                        onClick={() => handleDownloadReportPdf(outOfStockProducts, 'Out of Stock Items Report', 'out_of_stock')}
                        variant="secondary"
                        className="flex items-center gap-2"
                    >
                        <FileText size={18} /> Out of Stock Items
                    </Button>
                    <Button
                        onClick={() => handleDownloadReportPdf(mostSelling, 'Most Selling Items Report', 'most_selling')}
                        variant="secondary"
                        className="flex items-center gap-2"
                    >
                        <FileText size={18} /> Most Selling Items
                    </Button>
                    <Button
                        onClick={() => handleDownloadReportPdf(leastSelling, 'Least Selling Items Report', 'least_selling')}
                        variant="secondary"
                        className="flex items-center gap-2"
                    >
                        <FileText size={18} /> Least Selling Items
                    </Button>
                </div>
            </div>

            <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
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

            <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md col-span-1 lg:col-span-3">
                <h2 className="text-xl font-semibold mb-4">Item Profitability Analysis</h2>
                <div className="max-h-96 overflow-y-auto">
                    <table className="w-full text-sm text-left text-gray-500">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0">
                            <tr>
                                <th scope="col" className="px-4 py-3">Product</th>
                                <th scope="col" className="px-4 py-3 text-right">Purchase Price</th>
                                <th scope="col" className="px-4 py-3 text-right">Sale Price</th>
                                <th scope="col" className="px-4 py-3 text-right">Profit Margin</th>
                                <th scope="col" className="px-4 py-3 text-right">Profit %</th>
                            </tr>
                        </thead>
                        <tbody>
                            {itemSalesData
                                .sort((a, b) => b.profitPercentage - a.profitPercentage)
                                .map(item => {
                                    const profitMargin = item.product.salePrice - item.product.purchasePrice;
                                    const hasProfit = item.product.purchasePrice > 0 && item.product.salePrice > item.product.purchasePrice;
                                    return (
                                        <tr key={item.product.id} className="bg-white border-b hover:bg-gray-50">
                                            <td className="px-4 py-2 font-medium text-gray-900">{item.product.name}</td>
                                            <td className="px-4 py-2 text-right">{formatCurrency(item.product.purchasePrice)}</td>
                                            <td className="px-4 py-2 text-right">{formatCurrency(item.product.salePrice)}</td>
                                            <td className={`px-4 py-2 text-right font-semibold ${hasProfit ? 'text-green-600' : 'text-red-500'}`}>
                                                {formatCurrency(profitMargin)}
                                            </td>
                                            <td className="px-4 py-2 text-right">
                                                {hasProfit ? (
                                                    <span className="font-semibold bg-indigo-100 text-indigo-800 px-2 py-1 rounded-full">
                                                        {item.profitPercentage.toFixed(2)}%
                                                    </span>
                                                ) : (
                                                    <span className="font-semibold bg-red-100 text-red-800 px-2 py-1 rounded-full">
                                                        Loss
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                 <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold mb-4">Most Profitable Items</h2>
                    <ul className="space-y-2">
                        {mostProfitable.map(item => (
                            <li key={item.product.id} className="flex justify-between items-center text-sm">
                                <span>{item.product.name}</span>
                                <span className="font-semibold bg-indigo-100 text-indigo-800 px-2 py-1 rounded-full">{item.profitPercentage.toFixed(2)}%</span>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold mb-4">Most Selling Items</h2>
                    <ul className="space-y-2">
                        {mostSelling.map(item => (
                            <li key={item.product.id} className="flex justify-between items-center text-sm">
                                <span>{item.product.name}</span>
                                <span className="font-semibold bg-green-100 text-green-800 px-2 py-1 rounded-full">{item.quantity} sold</span>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold mb-4">Least Selling Items</h2>
                     <ul className="space-y-2">
                        {leastSelling.map(item => (
                            <li key={item.product.id} className="flex justify-between items-center text-sm">
                                <span>{item.product.name}</span>
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
