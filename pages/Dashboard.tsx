import React, { useState, useMemo } from 'react';
import { useAppContext } from '../contexts/AppContext';
// FIX: Changed react-router-dom import to use namespace import to resolve module export error.
import * as ReactRouterDOM from 'react-router-dom';
import { ShoppingCart, Archive, Layers, Users, BarChart2, DollarSign, Package, AlertTriangle, FileText } from 'lucide-react';
import { formatCurrency } from '../utils/helpers';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { Product } from '../types';
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

const QuickLink: React.FC<{ to: string; label: string; icon: React.ReactNode }> = ({ to, label, icon }) => (
    <ReactRouterDOM.Link to={to} className="flex flex-col items-center justify-center bg-white p-4 sm:p-6 rounded-lg shadow-md hover:shadow-lg hover:bg-primary-50 transition-all text-center">
        <div className="mb-2 text-primary-600">{icon}</div>
        <span className="font-semibold text-gray-700">{label}</span>
    </ReactRouterDOM.Link>
);


const Dashboard: React.FC = () => {
    const { currentUser, inventory, sales, shopInfo, categories } = useAppContext();
    const isMaster = currentUser?.role === 'master';

    const [isLowStockModalOpen, setLowStockModalOpen] = useState(false);
    const [isOutOfStockModalOpen, setOutOfStockModalOpen] = useState(false);

    const { todaysSalesTotal, todaysLaborCharges } = useMemo(() => {
        const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD format, safe from timezone issues
        let salesTotal = 0;
        let laborCharges = 0;
        sales.forEach(sale => {
            if (new Date(sale.date).toLocaleDateString('en-CA') === todayStr) {
                const subtotalAfterItemDiscounts = sale.subtotal - (sale.totalItemDiscounts || 0);
                const labor = sale.laborCharges || 0;
                const totalWithLabor = subtotalAfterItemDiscounts + labor;

                if (totalWithLabor > 0) {
                    const itemRatio = subtotalAfterItemDiscounts / totalWithLabor;
                    salesTotal += sale.total * itemRatio;
                } else if (labor === 0) {
                    salesTotal += sale.total;
                }
                
                laborCharges += labor;
            }
        });
        return { todaysSalesTotal: salesTotal, todaysLaborCharges: laborCharges };
    }, [sales]);

    const soldProductIds = useMemo(() => {
        const ids = new Set<string>();
        sales.forEach(sale => {
            sale.items.forEach(item => {
                ids.add(item.productId);
            });
        });
        return ids;
    }, [sales]);

    const lowStockProducts = useMemo(() => {
        return inventory.filter(p => p.quantity === 1 && soldProductIds.has(p.id));
    }, [inventory, soldProductIds]);

    const outOfStockProducts = useMemo(() => {
        return inventory.filter(p => p.quantity === 0);
    }, [inventory]);

    const categoryMap = useMemo(() => {
        const map = new Map<string, string>();
        categories.forEach(cat => {
            map.set(cat.id, cat.name);
        });
        return map;
    }, [categories]);

    const handleDownloadLowStockPdf = async () => {
        if (lowStockProducts.length === 0) {
            toast.error("No low stock items to download.");
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

            const tableRows = lowStockProducts.map(product => `
                <tr>
                    <td style="border: 1px solid #ddd; padding: 6px; vertical-align: top;">
                        <strong>${product.name}</strong><br>
                        <small style="color: #555;">${product.manufacturer}</small>
                    </td>
                    <td style="border: 1px solid #ddd; padding: 6px; vertical-align: top;">
                        ${categoryMap.get(product.categoryId) || product.categoryId}
                        ${product.subCategoryId && categoryMap.get(product.subCategoryId) ? `<br><small style="color: #555;">↳ ${categoryMap.get(product.subCategoryId)}</small>` : ''}
                    </td>
                    <td style="border: 1px solid #ddd; padding: 6px; text-align: center; vertical-align: top;">${product.quantity}</td>
                    <td style="border: 1px solid #ddd; padding: 6px; vertical-align: top;">${product.location || 'N/A'}</td>
                    <td style="border: 1px solid #ddd; padding: 6px; vertical-align: top;">${product.barcode || 'N/A'}</td>
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
                    <h2 style="font-size: 20px; text-align: center; border-bottom: 1px solid #ddd; padding-bottom: 10px; margin-bottom: 20px;">Low Stock Report</h2>
                    <p style="font-size: 12px; margin-bottom: 20px; text-align: right;">Generated: ${new Date().toLocaleString()}</p>
                    <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
                        <thead>
                            <tr style="background-color: #f2f2f2;">
                                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Product</th>
                                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Category</th>
                                <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Qty</th>
                                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Location</th>
                                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Barcode</th>
                            </tr>
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

            const filename = `low_stock_report_${new Date().toISOString().split('T')[0]}.pdf`;
            pdf.save(filename);
            
            toast.success("PDF downloaded successfully!", { id: toastId });
        } catch (error) {
            console.error("Failed to generate PDF:", error);
            toast.error("Failed to generate PDF.", { id: toastId });
        }
    };

    const handleDownloadOutOfStockPdf = async () => {
        if (outOfStockProducts.length === 0) {
            toast.error("No out of stock items to download.");
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

            const tableRows = outOfStockProducts.map(product => `
                <tr>
                    <td style="border: 1px solid #ddd; padding: 6px; vertical-align: top;">
                        <strong>${product.name}</strong><br>
                        <small style="color: #555;">${product.manufacturer}</small>
                    </td>
                    <td style="border: 1px solid #ddd; padding: 6px; vertical-align: top;">
                        ${categoryMap.get(product.categoryId) || product.categoryId}
                        ${product.subCategoryId && categoryMap.get(product.subCategoryId) ? `<br><small style="color: #555;">↳ ${categoryMap.get(product.subCategoryId)}</small>` : ''}
                    </td>
                    <td style="border: 1px solid #ddd; padding: 6px; text-align: center; vertical-align: top;">${product.quantity}</td>
                    <td style="border: 1px solid #ddd; padding: 6px; vertical-align: top;">${product.location || 'N/A'}</td>
                    <td style="border: 1px solid #ddd; padding: 6px; vertical-align: top;">${product.barcode || 'N/A'}</td>
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
                    <h2 style="font-size: 20px; text-align: center; border-bottom: 1px solid #ddd; padding-bottom: 10px; margin-bottom: 20px;">Out of Stock Report</h2>
                    <p style="font-size: 12px; margin-bottom: 20px; text-align: right;">Generated: ${new Date().toLocaleString()}</p>
                    <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
                        <thead>
                            <tr style="background-color: #f2f2f2;">
                                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Product</th>
                                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Category</th>
                                <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Qty</th>
                                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Location</th>
                                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Barcode</th>
                            </tr>
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

            const filename = `out_of_stock_report_${new Date().toISOString().split('T')[0]}.pdf`;
            pdf.save(filename);
            
            toast.success("PDF downloaded successfully!", { id: toastId });
        } catch (error) {
            console.error("Failed to generate PDF:", error);
            toast.error("Failed to generate PDF.", { id: toastId });
        }
    };


    const totalInvestment = inventory.reduce((acc, p) => acc + p.purchasePrice * p.quantity, 0);
    const totalSales = useMemo(() => {
        return sales.reduce((acc, sale) => {
            const subtotalAfterItemDiscounts = sale.subtotal - (sale.totalItemDiscounts || 0);
            const labor = sale.laborCharges || 0;
            const totalWithLabor = subtotalAfterItemDiscounts + labor;

            if (totalWithLabor > 0) {
                const itemRatio = subtotalAfterItemDiscounts / totalWithLabor;
                return acc + (sale.total * itemRatio);
            }
            if (labor === 0) {
                return acc + sale.total;
            }
            return acc;
        }, 0);
    }, [sales]);
    const totalLaborCharges = sales.reduce((total, sale) => total + (sale.laborCharges || 0), 0);

    return (
        <div className="space-y-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Welcome, {currentUser?.username}!</h1>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <StatCard title="Today's Sale" value={formatCurrency(todaysSalesTotal)} icon={<DollarSign className="w-6 h-6 text-white" />} color="bg-green-500" />
                <StatCard title="Today's Labor Charges" value={formatCurrency(todaysLaborCharges)} icon={<FileText className="w-6 h-6 text-white" />} color="bg-cyan-500" />
            </div>

            {isMaster && (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        <StatCard title="Total Investment" value={formatCurrency(totalInvestment)} icon={<DollarSign className="w-6 h-6 text-white" />} color="bg-blue-500" />
                        <StatCard title="Total Sales" value={formatCurrency(totalSales)} icon={<ShoppingCart className="w-6 h-6 text-white" />} color="bg-green-500" />
                        <StatCard title="Total Labor Charges" value={formatCurrency(totalLaborCharges)} icon={<FileText className="w-6 h-6 text-white" />} color="bg-cyan-500" />
                        <StatCard title="Total Products" value={inventory.length} icon={<Package className="w-6 h-6 text-white" />} color="bg-purple-500" />
                        <StatCard title="Low Stock Items" value={lowStockProducts.length} icon={<AlertTriangle className="w-6 h-6 text-white" />} color="bg-yellow-500" />
                    </div>
                </>
            )}

            <div>
                <h2 className="text-xl sm:text-2xl font-semibold text-gray-700 mb-4">Quick Actions</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
                    <QuickLink to="/pos" label="Start Selling" icon={<ShoppingCart size={32} />} />
                    {isMaster && (
                        <>
                            <QuickLink to="/inventory" label="Manage Inventory" icon={<Archive size={32} />} />
                            <QuickLink to="/categories" label="Manage Categories" icon={<Layers size={32} />} />
                            <QuickLink to="/users" label="Manage Users" icon={<Users size={32} />} />
                            <QuickLink to="/reports" label="View Reports" icon={<BarChart2 size={32} />} />
                        </>
                    )}
                </div>
            </div>

            <div className="space-y-4">
                 {isMaster && lowStockProducts.length > 0 && (
                    <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded-md flex flex-col sm:flex-row justify-between sm:items-center gap-2" role="alert">
                        <div>
                            <p className="font-bold">Low Stock Alert</p>
                            <p>You have {lowStockProducts.length} popular item(s) with only 1 unit left in stock.</p>
                        </div>
                        <Button onClick={() => setLowStockModalOpen(true)} variant="secondary" size="sm" className="self-start sm:self-center">View Details</Button>
                    </div>
                )}

                {isMaster && outOfStockProducts.length > 0 && (
                    <div className="bg-gray-200 border-l-4 border-gray-500 text-gray-800 p-4 rounded-md flex flex-col sm:flex-row justify-between sm:items-center gap-2" role="alert">
                        <div>
                            <p className="font-bold">Out of Stock Items</p>
                            <p>You have {outOfStockProducts.length} item(s) that are currently out of stock.</p>
                        </div>
                        <div className="flex items-center gap-2 self-start sm:self-center">
                            <Button onClick={() => setOutOfStockModalOpen(true)} variant="secondary" size="sm">View Details</Button>
                            <Button onClick={handleDownloadOutOfStockPdf} variant="secondary" size="sm" className="flex items-center gap-1">
                                <FileText size={16}/> Download PDF
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            <Modal
                isOpen={isLowStockModalOpen}
                onClose={() => setLowStockModalOpen(false)}
                title="Low Stock Items (1 Unit Left)"
                size="lg"
                footer={
                    <div className="flex justify-end gap-2">
                        <Button variant="secondary" onClick={() => setLowStockModalOpen(false)}>Close</Button>
                        <Button onClick={handleDownloadLowStockPdf} className="flex items-center gap-2" disabled={lowStockProducts.length === 0}><FileText size={18}/> Download PDF</Button>
                    </div>
                }
            >
                <div className="max-h-96 overflow-y-auto">
                    {lowStockProducts.length > 0 ? (
                        <ul className="divide-y divide-gray-200">
                            {lowStockProducts.map(product => (
                                <li key={product.id} className="py-3 flex justify-between items-center">
                                    <div>
                                        <p className="font-semibold text-gray-800">{product.name}</p>
                                        <p className="text-sm text-gray-500">{product.manufacturer}</p>
                                    </div>
                                    <span className="text-lg font-bold text-primary-600">{formatCurrency(product.salePrice)}</span>
                                </li>
                            ))}
                        </ul>
                    ) : <p className="text-gray-500 text-center">No items are currently low on stock.</p>}
                </div>
            </Modal>

            <Modal
                isOpen={isOutOfStockModalOpen}
                onClose={() => setOutOfStockModalOpen(false)}
                title="Out of Stock Items"
                size="lg"
                footer={
                     <div className="flex justify-end gap-2">
                        <Button variant="secondary" onClick={() => setOutOfStockModalOpen(false)}>Close</Button>
                        <Button onClick={handleDownloadOutOfStockPdf} className="flex items-center gap-2" disabled={outOfStockProducts.length === 0}><FileText size={18}/> Download PDF</Button>
                    </div>
                }
            >
                <div className="max-h-96 overflow-y-auto">
                     {outOfStockProducts.length > 0 ? (
                        <ul className="divide-y divide-gray-200">
                            {outOfStockProducts.map(product => (
                                <li key={product.id} className="py-3 flex justify-between items-center">
                                    <div>
                                        <p className="font-semibold text-gray-800">{product.name}</p>
                                        <p className="text-sm text-gray-500">{product.manufacturer}</p>
                                    </div>
                                    <span className="text-sm text-gray-600">Purchase Price: {formatCurrency(product.purchasePrice)}</span>
                                </li>
                            ))}
                        </ul>
                    ) : <p className="text-gray-500 text-center">No items are currently out of stock.</p>}
                </div>
            </Modal>
        </div>
    );
};

export default Dashboard;