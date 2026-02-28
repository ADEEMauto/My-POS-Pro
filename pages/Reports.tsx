
import React, { useState, useMemo } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { formatCurrency } from '../utils/helpers';
// @ts-ignore
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Product, Sale } from '../types';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { FileText, Wrench, Hammer, DollarSign, ShoppingBag, TrendingUp, Bike, Search, X } from 'lucide-react';
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
            {title && <p className="text-sm text-gray-500">{title}</p>}
            <p className="text-2xl font-bold text-gray-800">{value}</p>
        </div>
    </div>
);

const VerticalTopLabel = (props: any) => {
    const { x, y, width, value } = props;
    if (!value) return null;
    return (
        <text
            x={x + width / 2}
            y={y}
            dy={-5}
            fill="#374151"
            fontSize={12}
            textAnchor="start"
            transform={`rotate(-90 ${x + width / 2} ${y})`}
        >
            {value}
        </text>
    );
};

const VerticalCenterLabel = (props: any) => {
    const { x, y, width, height, value } = props;
    if (!value) return null;
    return (
        <text
            x={x + width / 2}
            y={y + height / 2}
            fill="#fff"
            fontSize={10}
            textAnchor="middle"
            dominantBaseline="middle"
            transform={`rotate(-90 ${x + width / 2} ${y + height / 2})`}
        >
            {value}
        </text>
    );
};

// Helper to calculate revenue strictly from items (excluding services and allocating discounts)
const calculateNetItemRevenue = (sale: Sale) => {
    // 1. Calculate Item Subtotal (Sum of price * qty). 
    // Note: item.price already includes item-level discounts.
    const netItemSubtotal = sale.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    // 2. Calculate Charges (needed to calculate percentage-based overall discount amount)
    const charges = (sale.laborCharges || 0) + (sale.tuningCharges || 0);
    const subtotalWithCharges = netItemSubtotal + charges;

    // 3. Calculate Overall Discount Value
    const overallDiscountAmount = sale.overallDiscountType === 'fixed'
        ? sale.overallDiscount
        : (subtotalWithCharges * sale.overallDiscount) / 100;

    const totalGlobalDiscounts = overallDiscountAmount + (sale.loyaltyDiscount || 0);

    // 4. Calculate Net Revenue strictly from Items.
    // Logic: Item Subtotal - Full Global Discount.
    const netItemRevenue = netItemSubtotal - totalGlobalDiscounts;
    
    // Allow negative values for consistent aggregation
    return Math.round(netItemRevenue);
};

const ProductSalesDetailModal: React.FC<{ product: Product; sales: Sale[]; onClose: () => void }> = ({ product, sales, onClose }) => {
    const productSales = useMemo(() => {
        const logs: { 
            saleId: string, 
            date: string, 
            customerName: string, 
            quantity: number, 
            price: number,
            total: number
        }[] = [];

        sales.forEach(sale => {
            sale.items.forEach(item => {
                if (item.productId === product.id) {
                    logs.push({
                        saleId: sale.id,
                        date: sale.date,
                        customerName: sale.customerName,
                        quantity: item.quantity,
                        price: item.price,
                        total: item.price * item.quantity
                    });
                }
            });
        });

        return logs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [sales, product.id]);

    return (
        <Modal isOpen={true} onClose={onClose} title={`Sales History: ${product.name}`} size="xl">
            <div className="space-y-4">
                <div className="bg-gray-50 p-3 rounded-md flex justify-between items-center">
                    <div>
                        <p className="text-sm text-gray-500">Total Quantity Sold</p>
                        <p className="text-xl font-bold">{productSales.reduce((sum, log) => sum + log.quantity, 0)}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-sm text-gray-500">Total Revenue</p>
                        <p className="text-xl font-bold text-green-600">{formatCurrency(productSales.reduce((sum, log) => sum + log.total, 0))}</p>
                    </div>
                </div>

                <div className="max-h-96 overflow-y-auto border rounded-md">
                    <table className="w-full text-sm text-left text-gray-500">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0">
                            <tr>
                                <th className="px-4 py-3">Date</th>
                                <th className="px-4 py-3">Customer</th>
                                <th className="px-4 py-3 text-right">Qty</th>
                                <th className="px-4 py-3 text-right">Price</th>
                                <th className="px-4 py-3 text-right">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {productSales.length > 0 ? (
                                productSales.map((log, idx) => (
                                    <tr key={`${log.saleId}-${idx}`} className="hover:bg-gray-50">
                                        <td className="px-4 py-2 whitespace-nowrap">{new Date(log.date).toLocaleDateString()}</td>
                                        <td className="px-4 py-2">{log.customerName}</td>
                                        <td className="px-4 py-2 text-right">{log.quantity}</td>
                                        <td className="px-4 py-2 text-right">{formatCurrency(log.price)}</td>
                                        <td className="px-4 py-2 text-right font-semibold">{formatCurrency(log.total)}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">No sales recorded for this item.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="flex justify-end pt-2">
                    <Button variant="secondary" onClick={onClose}>Close</Button>
                </div>
            </div>
        </Modal>
    );
};

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
            // Use net item revenue instead of total sale amount
            dailySales[date] = (dailySales[date] || 0) + calculateNetItemRevenue(sale);
        });
        return Object.keys(dailySales).map(date => ({ date, sales: dailySales[date] })).sort((a,b) => a.date.localeCompare(b.date));
    }, [filteredSales]);

    const bikesVisitedData = useMemo(() => {
        const dailyVisits: { [key: string]: number } = {};
        filteredSales.forEach(sale => {
            const date = new Date(sale.date).toLocaleDateString('en-CA');
            dailyVisits[date] = (dailyVisits[date] || 0) + 1;
        });
        return Object.keys(dailyVisits).map(date => ({ date, visits: dailyVisits[date] })).sort((a,b) => a.date.localeCompare(b.date));
    }, [filteredSales]);

    const serviceMetrics = useMemo(() => {
        let totalTuning = 0;
        let totalLabor = 0;
        const dailyServices: { [key: string]: { tuning: number, labor: number } } = {};

        filteredSales.forEach(sale => {
            const t = sale.tuningCharges || 0;
            const l = sale.laborCharges || 0;
            totalTuning += t;
            totalLabor += l;

            if (t > 0 || l > 0) {
                const date = new Date(sale.date).toLocaleDateString('en-CA');
                if (!dailyServices[date]) dailyServices[date] = { tuning: 0, labor: 0 };
                dailyServices[date].tuning += t;
                dailyServices[date].labor += l;
            }
        });

        const chartData = Object.keys(dailyServices).map(date => ({
            date,
            tuning: dailyServices[date].tuning,
            labor: dailyServices[date].labor,
            total: dailyServices[date].tuning + dailyServices[date].labor
        })).sort((a, b) => a.date.localeCompare(b.date));

        return { totalTuning, totalLabor, chartData };
    }, [filteredSales]);

    const itemSalesRevenue = useMemo(() => {
        let total = 0;
        filteredSales.forEach(sale => {
            total += calculateNetItemRevenue(sale);
        });
        return total;
    }, [filteredSales]);

    const { todaysProfit, overallProfit } = useMemo(() => {
        const calculateProfit = (salesList: Sale[]) => {
            return salesList.reduce((acc, sale) => {
                // 1. Calculate Net Item Revenue
                const itemRevenue = calculateNetItemRevenue(sale);

                // 2. Calculate Cost of Goods Sold (COGS)
                const cogs = sale.items.reduce((sum, item) => sum + ((item.purchasePrice || 0) * item.quantity), 0);
                
                // 3. Profit = Net Item Revenue - COGS
                return acc + (itemRevenue - cogs);
            }, 0);
        };

        const todayStr = new Date().toLocaleDateString('en-CA');
        const todaySales = sales.filter(s => new Date(s.date).toLocaleDateString('en-CA') === todayStr);
        
        return {
            todaysProfit: calculateProfit(todaySales),
            overallProfit: calculateProfit(sales)
        };
    }, [sales]);

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


    const [itemSearchTerm, setItemSearchTerm] = useState('');
    const [summarySearchTerm, setSummarySearchTerm] = useState('');
    const [selectedProductForLog, setSelectedProductForLog] = useState<Product | null>(null);

    const soldItemsLog = useMemo(() => {
        const logs: { 
            saleId: string, 
            date: string, 
            customerName: string, 
            itemName: string, 
            quantity: number, 
            price: number,
            total: number
        }[] = [];

        filteredSales.forEach(sale => {
            sale.items.forEach(item => {
                logs.push({
                    saleId: sale.id,
                    date: sale.date,
                    customerName: sale.customerName,
                    itemName: item.name,
                    quantity: item.quantity,
                    price: item.price,
                    total: item.price * item.quantity
                });
            });
        });

        return logs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [filteredSales]);

    const filteredSoldItemsLog = useMemo(() => {
        if (!itemSearchTerm) return soldItemsLog;
        const lower = itemSearchTerm.toLowerCase();
        return soldItemsLog.filter(log => 
            log.itemName.toLowerCase().includes(lower) || 
            log.customerName.toLowerCase().includes(lower) ||
            log.saleId.toLowerCase().includes(lower)
        );
    }, [soldItemsLog, itemSearchTerm]);

    const filteredItemSummary = useMemo(() => {
        const summary = itemSalesData.filter(item => item.quantity > 0);
        if (!summarySearchTerm) return summary.sort((a, b) => b.quantity - a.quantity);
        const lower = summarySearchTerm.toLowerCase();
        return summary.filter(item => item.product.name.toLowerCase().includes(lower)).sort((a, b) => b.quantity - a.quantity);
    }, [itemSalesData, summarySearchTerm]);

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

            {/* Item Revenue Stat & Profits */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <StatCard 
                    title="Net Revenue from Items (Excl. Services)" 
                    value={formatCurrency(itemSalesRevenue)} 
                    icon={<ShoppingBag className="w-6 h-6 text-white" />} 
                    color="bg-purple-600" 
                />
                 <StatCard 
                    title="" 
                    value={formatCurrency(todaysProfit)} 
                    icon={<TrendingUp className="w-6 h-6 text-white" />} 
                    color="bg-green-500" 
                />
                 <StatCard 
                    title="" 
                    value={formatCurrency(overallProfit)} 
                    icon={<DollarSign className="w-6 h-6 text-white" />} 
                    color="bg-blue-600" 
                />
            </div>

            {/* Total Sales Chart */}
            <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold mb-4">Total Inventory Sales Overview</h2>
                 <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={salesDataForChart} margin={{ top: 50, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis tickFormatter={(value) => `Rs.${value / 1000}k`} />
                        <Tooltip formatter={(value: number) => [formatCurrency(value), 'Item Sales']} />
                        <Legend />
                        <Bar dataKey="sales" name="Inventory Sales" fill="#ff4747" label={<VerticalTopLabel />} />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* Service Revenue Analysis Section */}
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <StatCard 
                        title="Total Tuning Revenue" 
                        value={formatCurrency(serviceMetrics.totalTuning)} 
                        icon={<Wrench className="w-6 h-6 text-white" />} 
                        color="bg-blue-500" 
                    />
                    <StatCard 
                        title="Total Labor Revenue" 
                        value={formatCurrency(serviceMetrics.totalLabor)} 
                        icon={<Hammer className="w-6 h-6 text-white" />} 
                        color="bg-cyan-500" 
                    />
                    <StatCard 
                        title="Total Service Revenue" 
                        value={formatCurrency(serviceMetrics.totalTuning + serviceMetrics.totalLabor)} 
                        icon={<DollarSign className="w-6 h-6 text-white" />} 
                        color="bg-green-500" 
                    />
                </div>

                <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold mb-4">Service Revenue Analysis (Tuning & Labor)</h2>
                    {serviceMetrics.chartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={serviceMetrics.chartData} margin={{ top: 50, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" />
                                <YAxis tickFormatter={(value) => `Rs.${value}`} />
                                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                                <Legend />
                                <Bar dataKey="tuning" name="Tuning Charges" stackId="a" fill="#3b82f6" label={<VerticalCenterLabel />} />
                                <Bar dataKey="labor" name="Labor Charges" stackId="a" fill="#06b6d4" label={<VerticalTopLabel />} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <p className="text-center text-gray-500 py-10">No service revenue data for the selected period.</p>
                    )}
                </div>

                <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2"><Bike size={24} className="text-purple-600"/> Bikes Visited Overview</h2>
                    {bikesVisitedData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={bikesVisitedData} margin={{ top: 50, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" />
                                <YAxis />
                                <Tooltip formatter={(value: number) => [value, 'Bikes Visited']} />
                                <Legend />
                                <Bar dataKey="visits" name="Number of Bikes" fill="#8884d8" label={<VerticalTopLabel />} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <p className="text-center text-gray-500 py-10">No visit data available for the selected period.</p>
                    )}
                </div>
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

            <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md col-span-1 lg:col-span-3">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                    <h2 className="text-xl font-semibold">Item Sales Summary (Click for Details)</h2>
                    <div className="w-full sm:w-64">
                        <input 
                            type="text" 
                            placeholder="Search items..." 
                            value={summarySearchTerm}
                            onChange={e => setSummarySearchTerm(e.target.value)}
                            className="w-full p-2 border rounded-md text-sm"
                        />
                    </div>
                </div>
                <div className="max-h-96 overflow-y-auto">
                    <table className="w-full text-sm text-left text-gray-500">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0">
                            <tr>
                                <th scope="col" className="px-4 py-3">Item Name</th>
                                <th scope="col" className="px-4 py-3 text-right">Total Quantity Sold</th>
                                <th scope="col" className="px-4 py-3 text-right">Total Revenue</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredItemSummary.length > 0 ? (
                                filteredItemSummary.map((item) => (
                                    <tr 
                                        key={item.product.id} 
                                        className="bg-white border-b hover:bg-blue-50 cursor-pointer transition-colors"
                                        onClick={() => setSelectedProductForLog(item.product)}
                                    >
                                        <td className="px-4 py-3 font-medium text-gray-900">{item.product.name}</td>
                                        <td className="px-4 py-3 text-right font-semibold text-blue-600">{item.quantity}</td>
                                        <td className="px-4 py-3 text-right">{formatCurrency(item.revenue)}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={3} className="px-4 py-8 text-center text-gray-500">No items found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md col-span-1 lg:col-span-3">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                    <h2 className="text-xl font-semibold">Sold Items Detailed Log</h2>
                    <div className="w-full sm:w-64">
                        <input 
                            type="text" 
                            placeholder="Search items, customers..." 
                            value={itemSearchTerm}
                            onChange={e => setItemSearchTerm(e.target.value)}
                            className="w-full p-2 border rounded-md text-sm"
                        />
                    </div>
                </div>
                <div className="max-h-96 overflow-y-auto">
                    <table className="w-full text-sm text-left text-gray-500">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0">
                            <tr>
                                <th scope="col" className="px-4 py-3">Date</th>
                                <th scope="col" className="px-4 py-3">Item Name</th>
                                <th scope="col" className="px-4 py-3">Customer</th>
                                <th scope="col" className="px-4 py-3 text-right">Qty</th>
                                <th scope="col" className="px-4 py-3 text-right">Price</th>
                                <th scope="col" className="px-4 py-3 text-right">Total</th>
                                <th scope="col" className="px-4 py-3">Sale ID</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredSoldItemsLog.length > 0 ? (
                                filteredSoldItemsLog.map((log, idx) => (
                                    <tr key={`${log.saleId}-${idx}`} className="bg-white border-b hover:bg-gray-50">
                                        <td className="px-4 py-2 whitespace-nowrap">{new Date(log.date).toLocaleDateString()}</td>
                                        <td className="px-4 py-2 font-medium text-gray-900">{log.itemName}</td>
                                        <td className="px-4 py-2">{log.customerName}</td>
                                        <td className="px-4 py-2 text-right">{log.quantity}</td>
                                        <td className="px-4 py-2 text-right">{formatCurrency(log.price)}</td>
                                        <td className="px-4 py-2 text-right font-semibold">{formatCurrency(log.total)}</td>
                                        <td className="px-4 py-2 font-mono text-xs">{log.saleId.slice(0, 8)}...</td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">No sold items found.</td>
                                </tr>
                            )}
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

            {selectedProductForLog && (
                <ProductSalesDetailModal 
                    product={selectedProductForLog} 
                    sales={sales} 
                    onClose={() => setSelectedProductForLog(null)} 
                />
            )}
        </div>
    );
};

export default Reports;
