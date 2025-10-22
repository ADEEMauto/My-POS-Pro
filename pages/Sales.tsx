import React, { useState, useMemo } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { Sale, SaleItem } from '../types';
import { formatCurrency, formatDate } from '../utils/helpers';
import { Eye, Trash2, FileText } from 'lucide-react';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import toast from 'react-hot-toast';
// @ts-ignore
import jsPDF from 'jspdf';
// @ts-ignore
import html2canvas from 'html2canvas';


const SaleDetailsModal: React.FC<{ sale: Sale; onClose: () => void }> = ({ sale, onClose }) => {
    
    const estimatedProfit = sale.items.reduce((acc, item) => {
        const cost = item.purchasePrice || 0; // Handle old sales data without purchasePrice
        return acc + (item.price - cost) * item.quantity;
    }, 0);

    return (
        <Modal isOpen={true} onClose={onClose} title={`Sale Details - ID: ${sale.id}`} size="lg">
            <div className="space-y-4">
                <div>
                    <p><strong>Date:</strong> {formatDate(sale.date)}</p>
                    {sale.customerName && <p><strong>Customer:</strong> {sale.customerName}</p>}
                    {sale.customerId && <p><strong>Bike No:</strong> {sale.customerId}</p>}
                    <div className="flex justify-between items-baseline mt-2">
                        <p><strong>Total Amount:</strong> <span className="font-bold text-lg text-primary-600">{formatCurrency(sale.total)}</span></p>
                        <p><strong>Est. Profit:</strong> <span className="font-bold text-base text-green-600">{formatCurrency(estimatedProfit)}</span></p>
                    </div>
                </div>
                <div className="max-h-80 overflow-y-auto pr-2">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0">
                            <tr>
                                <th className="px-4 py-2">Product Name</th>
                                <th className="px-4 py-2 text-center">Quantity</th>
                                <th className="px-4 py-2 text-right">Price/Item</th>
                                <th className="px-4 py-2 text-right">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {sale.items.map((item, index) => (
                                <tr key={`${item.productId}-${index}`}>
                                    <td className="px-4 py-2 font-medium text-gray-900">{item.name}</td>
                                    <td className="px-4 py-2 text-center">{item.quantity}</td>
                                    <td className="px-4 py-2 text-right">{formatCurrency(item.price)}</td>
                                    <td className="px-4 py-2 text-right font-semibold">{formatCurrency(item.price * item.quantity)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
             <div className="flex justify-end gap-2 pt-4">
                <Button variant="secondary" onClick={onClose}>Close</Button>
            </div>
        </Modal>
    );
};

const ReverseSaleModal: React.FC<{ sale: Sale; onClose: () => void; onConfirm: (itemsToReturn: SaleItem[]) => void }> = ({ sale, onClose, onConfirm }) => {
    const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());

    const handleToggleItem = (productId: string) => {
        const newSet = new Set(selectedProductIds);
        if (newSet.has(productId)) {
            newSet.delete(productId);
        } else {
            newSet.add(productId);
        }
        setSelectedProductIds(newSet);
    };
    
    const handleToggleAll = () => {
        if (selectedProductIds.size === sale.items.length) {
            setSelectedProductIds(new Set());
        } else {
            setSelectedProductIds(new Set(sale.items.map(item => item.productId)));
        }
    };

    const handleConfirmClick = () => {
        const itemsToReturn = sale.items.filter(item => selectedProductIds.has(item.productId));
        onConfirm(itemsToReturn);
    };

    const allSelected = selectedProductIds.size === sale.items.length && sale.items.length > 0;

    return (
        <Modal isOpen={true} onClose={onClose} title="Select Items to Return to Inventory" size="lg">
            <p className="text-sm text-gray-600 mb-4">
                Select which items from sale <span className="font-mono bg-gray-100 p-1 rounded">{sale.id}</span> you want to return to stock. This will update the sale record. If all items are returned, the sale will be deleted.
            </p>

            <div className="border rounded-md">
                <div className="flex items-center p-3 bg-gray-50 border-b">
                    <input
                        id="select-all-checkbox"
                        type="checkbox"
                        checked={allSelected}
                        onChange={handleToggleAll}
                        className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                    />
                    <label htmlFor="select-all-checkbox" className="ml-3 text-sm font-medium text-gray-700 cursor-pointer">
                       {allSelected ? 'Deselect All' : 'Select All'}
                    </label>
                </div>
                <ul className="max-h-80 overflow-y-auto divide-y divide-gray-200">
                    {sale.items.map(item => (
                        <li key={item.productId} className="p-3 flex items-center hover:bg-gray-50">
                            <input
                                id={`item-checkbox-${item.productId}`}
                                type="checkbox"
                                checked={selectedProductIds.has(item.productId)}
                                onChange={() => handleToggleItem(item.productId)}
                                className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                            />
                            <label htmlFor={`item-checkbox-${item.productId}`} className="ml-3 flex-grow cursor-pointer">
                                <p className="font-semibold text-gray-800">{item.name}</p>
                                <p className="text-xs text-gray-500">
                                    {item.quantity} x {formatCurrency(item.price)} = {formatCurrency(item.quantity * item.price)}
                                </p>
                            </label>
                        </li>
                    ))}
                </ul>
            </div>
            
            <div className="flex justify-end gap-2 pt-4 mt-2 border-t">
                <Button variant="secondary" onClick={onClose}>Cancel</Button>
                <Button variant="danger" onClick={handleConfirmClick} disabled={selectedProductIds.size === 0}>
                    Reverse Selected ({selectedProductIds.size})
                </Button>
            </div>
        </Modal>
    );
};


const Sales: React.FC = () => {
    const { sales, reverseSale, currentUser, inventory, categories, shopInfo } = useAppContext();
    const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
    const [saleToReverse, setSaleToReverse] = useState<Sale | null>(null);

    const isMaster = currentUser?.role === 'master';

    const categoryMap = useMemo(() => {
        const map = new Map<string, string>();
        categories.forEach(cat => {
            map.set(cat.id, cat.name);
        });
        return map;
    }, [categories]);

    const handleConfirmReversal = (itemsToReturn: SaleItem[]) => {
        if (saleToReverse) {
            reverseSale(saleToReverse.id, itemsToReturn);
            setSaleToReverse(null);
        }
    };
    
    const handleDownloadPdf = async () => {
        if (sales.length === 0) {
            toast.error("No sales data to download.");
            return;
        }

        const toastId = toast.loading("Generating Sales Report PDF...", { duration: Infinity });

        try {
            const aggregatedSales = new Map<string, { productId: string; soldQuantity: number }>();
            sales.forEach(sale => {
                sale.items.forEach(item => {
                    const existing = aggregatedSales.get(item.productId);
                    if (existing) {
                        existing.soldQuantity += item.quantity;
                    } else {
                        aggregatedSales.set(item.productId, {
                            productId: item.productId,
                            soldQuantity: item.quantity,
                        });
                    }
                });
            });

            const reportData = Array.from(aggregatedSales.values())
                .map(soldItem => ({
                    ...soldItem,
                    product: inventory.find(p => p.id === soldItem.productId),
                }))
                .filter(item => !!item.product);

            if (reportData.length === 0) {
                toast.error("No valid product data for the sales report.", { id: toastId });
                return;
            }

            const pdfContainer = document.createElement('div');
            pdfContainer.style.position = 'absolute';
            pdfContainer.style.left = '-9999px';
            pdfContainer.style.width = '1000px';
            pdfContainer.style.padding = '20px';
            pdfContainer.style.fontFamily = 'Arial, sans-serif';
            pdfContainer.style.background = 'white';
            pdfContainer.style.color = 'black';

            const tableRows = reportData.map((item, index) => {
                const product = item.product!;
                const categoryName = categoryMap.get(product.categoryId) || product.categoryId;

                return `
                    <tr>
                        <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${index + 1}</td>
                        <td style="border: 1px solid #ddd; padding: 6px;">${product.name}</td>
                        <td style="border: 1px solid #ddd; padding: 6px;">${product.manufacturer}</td>
                        <td style="border: 1px solid #ddd; padding: 6px;">${categoryName}</td>
                        <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${item.soldQuantity}</td>
                        <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${product.quantity}</td>
                    </tr>
                `;
            }).join('');

            pdfContainer.innerHTML = `
                <div>
                    <div style="text-align: center; margin-bottom: 20px;">
                        <h1 style="font-size: 24px; margin: 0;">${shopInfo?.name || 'Sales Report'}</h1>
                        <p style="font-size: 12px; margin: 0;">${shopInfo?.address || ''}</p>
                    </div>
                    <h2 style="font-size: 20px; text-align: center; border-bottom: 1px solid #ddd; padding-bottom: 10px; margin-bottom: 20px;">Sales Summary Report</h2>
                    <p style="font-size: 12px; margin-bottom: 20px; text-align: right;">Generated: ${new Date().toLocaleString()}</p>
                    <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
                        <thead>
                            <tr style="background-color: #f2f2f2;">
                                <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Serial Number</th>
                                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Name of Item</th>
                                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Manufacturing</th>
                                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Category</th>
                                <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Sold Quantity</th>
                                <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Quantity Remaining in Stock</th>
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
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
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

            const filename = `sales_report_${new Date().toISOString().split('T')[0]}.pdf`;
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
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Sales History</h1>
                <Button onClick={handleDownloadPdf} className="flex items-center gap-2" disabled={sales.length === 0}>
                    <FileText size={18} /> Download Sales Report
                </Button>
            </div>
            
            {sales.length === 0 ? (
                 <div className="text-center py-10 bg-white rounded-lg shadow">
                    <p className="text-gray-500">No sales have been recorded yet.</p>
                </div>
            ) : (
                <>
                {/* Table for medium screens and up */}
                <div className="hidden md:block bg-white rounded-lg shadow-md overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-500">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3">Sale ID</th>
                                <th scope="col" className="px-6 py-3">Date</th>
                                <th scope="col" className="px-6 py-3 text-center">Items</th>
                                <th scope="col" className="px-6 py-3 text-right">Total Amount</th>
                                <th scope="col" className="px-6 py-3 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sales.map(sale => (
                                <tr key={sale.id} className="bg-white border-b hover:bg-gray-50">
                                    <td className="px-6 py-4 font-mono text-xs text-gray-700">{sale.id}</td>
                                    <td className="px-6 py-4">{formatDate(sale.date)}</td>
                                    <td className="px-6 py-4 text-center">{sale.items.reduce((acc, item) => acc + item.quantity, 0)}</td>
                                    <td className="px-6 py-4 text-right font-semibold">{formatCurrency(sale.total)}</td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex justify-center space-x-3">
                                            <button onClick={() => setSelectedSale(sale)} className="text-blue-600 hover:text-blue-800" title="View Details"><Eye size={18}/></button>
                                            <button onClick={() => setSaleToReverse(sale)} className="text-red-600 hover:text-red-800" title="Reverse Sale"><Trash2 size={18}/></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Cards for small screens */}
                <div className="md:hidden grid grid-cols-1 gap-4">
                     {sales.map(sale => (
                         <div key={sale.id} className="bg-white rounded-lg shadow-md p-4 space-y-3">
                             <div className="flex justify-between items-start">
                                 <div>
                                    <p className="text-sm font-semibold">Sale ID: <span className="font-mono text-xs">{sale.id}</span></p>
                                    <p className="text-xs text-gray-500">{formatDate(sale.date)}</p>
                                 </div>
                                 <p className="text-lg font-bold text-primary-600">{formatCurrency(sale.total)}</p>
                             </div>
                             <div className="flex justify-between items-center text-sm border-t pt-3">
                                <div>
                                    <strong>Total Items:</strong> {sale.items.reduce((acc, item) => acc + item.quantity, 0)}
                                </div>
                                <div className="flex items-center space-x-3">
                                    <Button onClick={() => setSelectedSale(sale)} variant="ghost" size="sm" className="flex items-center gap-1"><Eye size={16}/> View</Button>
                                    <Button onClick={() => setSaleToReverse(sale)} variant="ghost" size="sm" className="text-red-600 hover:text-red-700 flex items-center gap-1"><Trash2 size={16}/> Reverse</Button>
                                </div>
                             </div>
                         </div>
                     ))}
                </div>
                </>
            )}

            {selectedSale && <SaleDetailsModal sale={selectedSale} onClose={() => setSelectedSale(null)} />}

            {saleToReverse && (
                <ReverseSaleModal
                    sale={saleToReverse}
                    onClose={() => setSaleToReverse(null)}
                    onConfirm={handleConfirmReversal}
                />
            )}
        </div>
    );
};

export default Sales;
