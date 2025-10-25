import React, { useState, useMemo } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { Sale, SaleItem, Product } from '../types';
import { formatCurrency, formatDate } from '../utils/helpers';
import { Eye, Trash2, FileText, Star, ShoppingBag } from 'lucide-react';
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
    
    const hasDiscounts = (sale.totalItemDiscounts || 0) > 0 || (sale.overallDiscount || 0) > 0 || (sale.loyaltyDiscount || 0) > 0;
    const calculatedOverallDiscount = Math.max(0, sale.subtotal - sale.totalItemDiscounts + (sale.laborCharges || 0) - (sale.loyaltyDiscount || 0) - sale.total);

    return (
        <Modal isOpen={true} onClose={onClose} title={`Sale Details - ID: ${sale.id}`} size="lg">
            <div className="space-y-4">
                <div>
                    <p><strong>Date:</strong> {formatDate(sale.date)}</p>
                    {sale.customerName && <p><strong>Customer:</strong> {sale.customerName}</p>}
                    {sale.customerId && <p><strong>Bike No:</strong> {sale.customerId}</p>}
                </div>
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
                            {sale.items.map((item, index) => (
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
                            <p>{formatCurrency(sale.subtotal)}</p>
                        </div>
                    )}
                    {(sale.totalItemDiscounts || 0) > 0 && (
                         <div className="flex justify-between items-baseline text-sm text-red-600">
                            <p><strong>Item Discounts:</strong></p>
                            <p>- {formatCurrency(sale.totalItemDiscounts)}</p>
                        </div>
                    )}
                    {(sale.laborCharges || 0) > 0 && (
                        <div className="flex justify-between items-baseline text-sm text-blue-600">
                            <p><strong>Labor Charges:</strong></p>
                            <p>+ {formatCurrency(sale.laborCharges!)}</p>
                        </div>
                    )}
                    {(sale.overallDiscount || 0) > 0 && (
                         <div className="flex justify-between items-baseline text-sm text-red-600">
                            <p><strong>Overall Discount {sale.overallDiscountType === 'percentage' && `(${sale.overallDiscount}%)`}</strong></p>
                            <p>- {formatCurrency(calculatedOverallDiscount)}</p>
                        </div>
                    )}
                     {(sale.loyaltyDiscount || 0) > 0 && (
                         <div className="flex justify-between items-baseline text-sm text-green-600">
                            <p><strong>Loyalty Discount:</strong></p>
                            <p>- {formatCurrency(sale.loyaltyDiscount!)}</p>
                        </div>
                    )}
                    <div className="flex justify-between items-baseline pt-1 border-t">
                        <p><strong>Total Amount:</strong></p> 
                        <p><span className="font-bold text-lg text-primary-600">{formatCurrency(sale.total)}</span></p>
                    </div>
                     <div className="flex justify-between items-baseline">
                        <p><strong>Est. Profit:</strong></p> 
                        <p><span className="font-bold text-base text-green-600">{formatCurrency(estimatedProfit)}</span></p>
                    </div>
                </div>
                {(sale.pointsEarned !== undefined) && (
                    <div className="pt-2 border-t space-y-1 text-sm">
                         <h4 className="font-semibold flex items-center gap-1"><Star size={14}/> Loyalty Summary</h4>
                         {sale.promotionApplied && (
                            <p className="p-2 bg-green-50 text-green-700 rounded-md text-center font-semibold">
                                ✨ Promotion Applied: {sale.promotionApplied.name} ({sale.promotionApplied.multiplier}x Points!) ✨
                            </p>
                         )}
                         <div className="flex justify-between"><span>Points Earned:</span> <span>{sale.pointsEarned}</span></div>
                         <div className="flex justify-between"><span>Points Redeemed:</span> <span>{sale.redeemedPoints || 0}</span></div>
                         <div className="flex justify-between font-bold"><span>Final Balance:</span> <span>{sale.finalLoyaltyPoints}</span></div>
                    </div>
                )}
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
    const [sortBy, setSortBy] = useState('date_desc');
    const [soldItemsSortBy, setSoldItemsSortBy] = useState('most_selling');

    const isMaster = currentUser?.role === 'master';

    const categoryMap = useMemo(() => {
        const map = new Map<string, string>();
        categories.forEach(cat => {
            map.set(cat.id, cat.name);
        });
        return map;
    }, [categories]);

    const productMap = useMemo(() => {
        const map = new Map<string, Product>();
        inventory.forEach(p => map.set(p.id, p));
        return map;
    }, [inventory]);

    const aggregatedSoldItems = useMemo(() => {
        const itemsMap = new Map<string, { product: Product, quantity: number, totalRevenue: number }>();
        
        sales.forEach(sale => {
            sale.items.forEach(item => {
                const product = productMap.get(item.productId);
                if (product) {
                    const existing = itemsMap.get(item.productId);
                    if (existing) {
                        existing.quantity += item.quantity;
                        existing.totalRevenue += item.price * item.quantity;
                    } else {
                        itemsMap.set(item.productId, { 
                            product, 
                            quantity: item.quantity,
                            totalRevenue: item.price * item.quantity
                        });
                    }
                }
            });
        });

        const sortedItems = Array.from(itemsMap.values());

        const totalLaborCharges = sales.reduce((acc, sale) => acc + (sale.laborCharges || 0), 0);
        const totalLaborCount = sales.filter(sale => (sale.laborCharges || 0) > 0).length;

        if (totalLaborCharges > 0) {
            sortedItems.push({
                product: {
                    id: 'LABOR_CHARGES', name: 'Labor Charges', manufacturer: 'Shop Service',
                    categoryId: 'Service', subCategoryId: null, location: '', quantity: 0,
                    purchasePrice: 0, salePrice: 0,
                } as Product,
                quantity: totalLaborCount,
                totalRevenue: totalLaborCharges,
            });
        }

        sortedItems.sort((a, b) => {
            switch (soldItemsSortBy) {
                case 'most_selling':
                    return b.quantity - a.quantity;
                case 'least_selling':
                    return a.quantity - b.quantity;
                case 'price_desc':
                    return b.totalRevenue - a.totalRevenue;
                case 'price_asc':
                    return a.totalRevenue - b.totalRevenue;
                case 'name_asc':
                    return a.product.name.localeCompare(b.product.name);
                case 'name_desc':
                    return b.product.name.localeCompare(a.product.name);
                case 'manufacturer_asc':
                    return a.product.manufacturer.localeCompare(b.product.manufacturer);
                case 'category_asc':
                    const catA = a.product.id === 'LABOR_CHARGES' ? 'Service' : (categoryMap.get(a.product.categoryId) || '');
                    const catB = b.product.id === 'LABOR_CHARGES' ? 'Service' : (categoryMap.get(b.product.categoryId) || '');
                    return catA.localeCompare(catB);
                default:
                    return 0;
            }
        });

        return sortedItems;
    }, [sales, productMap, categoryMap, soldItemsSortBy]);

    const getDominantProperty = (sale: Sale, property: 'manufacturer' | 'categoryId'): string => {
        const propertyValues: { [key: string]: number } = {};
        sale.items.forEach(item => {
            const product = productMap.get(item.productId);
            if (product) {
                const value = property === 'categoryId'
                    ? (categoryMap.get(product.categoryId) || 'Uncategorized')
                    : product[property];
                propertyValues[value] = (propertyValues[value] || 0) + item.price * item.quantity;
            }
        });

        if (Object.keys(propertyValues).length === 0) return '';

        return Object.entries(propertyValues).reduce((a, b) => a[1] > b[1] ? a : b)[0];
    };

    const sortedSales = useMemo(() => {
        const salesToSort = [...sales];
        salesToSort.sort((a, b) => {
            const [key, dir] = sortBy.split('_');
            const direction = dir === 'asc' ? 1 : -1;
            switch (key) {
                case 'date':
                    return (new Date(a.date).getTime() - new Date(b.date).getTime()) * direction;
                case 'total':
                    return (a.total - b.total) * direction;
                case 'name': {
                    const nameA = a.items[0]?.name || '';
                    const nameB = b.items[0]?.name || '';
                    return nameA.localeCompare(nameB) * direction;
                }
                case 'manufacturer': {
                    const manufA = getDominantProperty(a, 'manufacturer');
                    const manufB = getDominantProperty(b, 'manufacturer');
                    return manufA.localeCompare(manufB) * direction;
                }
                case 'category': {
                    const catA = getDominantProperty(a, 'categoryId');
                    const catB = getDominantProperty(b, 'categoryId');
                    return catA.localeCompare(catB) * direction;
                }
                case 'price': {
                    const maxPriceA = Math.max(0, ...a.items.map(i => i.price));
                    const maxPriceB = Math.max(0, ...b.items.map(i => i.price));
                    return (maxPriceA - maxPriceB) * direction;
                }
                default:
                    return 0;
            }
        });
        return salesToSort;
    }, [sales, sortBy, productMap, categoryMap]);
    
    const groupedSales = useMemo(() => {
        return sortedSales.reduce((acc, sale) => {
            const saleDate = new Date(sale.date).toLocaleDateString('en-CA'); // YYYY-MM-DD format
            if (!acc[saleDate]) {
                acc[saleDate] = { sales: [], dailyTotal: 0 };
            }
            acc[saleDate].sales.push(sale);
            acc[saleDate].dailyTotal += sale.total;
            return acc;
        }, {} as Record<string, { sales: Sale[], dailyTotal: number }>);
    }, [sortedSales]);


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

            const logoHtml = shopInfo?.logoUrl 
                ? `<img src="${shopInfo.logoUrl}" alt="Shop Logo" style="height: 50px; width: auto; margin: 0 auto 10px auto; display: block; object-fit: contain;" />`
                : '';

            pdfContainer.innerHTML = `
                <div>
                    <div style="text-align: center; margin-bottom: 20px;">
                        ${logoHtml}
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
        <div className="space-y-8">
             <div className="space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Sold Items Summary</h1>
                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <label htmlFor="sort-sold-items" className="text-sm font-medium text-gray-600 shrink-0">Sort by:</label>
                        <select
                            id="sort-sold-items"
                            value={soldItemsSortBy}
                            onChange={e => setSoldItemsSortBy(e.target.value)}
                            className="w-full sm:w-auto p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                        >
                            <option value="most_selling">Most Selling</option>
                            <option value="least_selling">Least Selling</option>
                            <option value="price_desc">Total Price (High to Low)</option>
                            <option value="price_asc">Total Price (Low to High)</option>
                            <option value="name_asc">Name (A-Z)</option>
                            <option value="name_desc">Name (Z-A)</option>
                            <option value="manufacturer_asc">Manufacturer (A-Z)</option>
                            <option value="category_asc">Category (A-Z)</option>
                        </select>
                    </div>
                </div>
                 {aggregatedSoldItems.length === 0 ? (
                    <div className="text-center py-6 bg-white rounded-lg shadow">
                        <p className="text-gray-500">No items have been sold yet.</p>
                    </div>
                 ) : (
                    <>
                    <div className="hidden md:block bg-white rounded-lg shadow-md overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-500">
                            <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                                <tr>
                                    <th scope="col" className="px-6 py-3">Product</th>
                                    <th scope="col" className="px-6 py-3">Category</th>
                                    <th scope="col" className="px-6 py-3">Manufacturer</th>
                                    <th scope="col" className="px-6 py-3 text-center">Total Sold</th>
                                    <th scope="col" className="px-6 py-3 text-right">Total Price</th>
                                </tr>
                            </thead>
                            <tbody>
                                {aggregatedSoldItems.map(({ product, quantity, totalRevenue }) => (
                                    <tr key={product.id} className="bg-white border-b hover:bg-gray-50">
                                        <td className="px-6 py-4 font-medium text-gray-900">{product.name}</td>
                                        <td className="px-6 py-4">{product.id === 'LABOR_CHARGES' ? 'Service' : categoryMap.get(product.categoryId)}</td>
                                        <td className="px-6 py-4">{product.manufacturer}</td>
                                        <td className="px-6 py-4 text-center font-bold text-lg text-primary-600">{quantity}</td>
                                        <td className="px-6 py-4 text-right font-semibold text-green-600">{formatCurrency(totalRevenue)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                     <div className="md:hidden grid grid-cols-1 gap-4">
                        {aggregatedSoldItems.map(({ product, quantity, totalRevenue }) => (
                            <div key={product.id} className="bg-white rounded-lg shadow-md p-4 space-y-2">
                                <h3 className="font-bold text-gray-800">{product.name}</h3>
                                <p className="text-sm text-gray-600"><strong>Category:</strong> {product.id === 'LABOR_CHARGES' ? 'Service' : categoryMap.get(product.categoryId)}</p>
                                <p className="text-sm text-gray-600"><strong>Manufacturer:</strong> {product.manufacturer}</p>
                                <div className="flex justify-between items-center pt-2 border-t mt-2">
                                    <div className="text-left">
                                        <p className="text-xs text-gray-500">Total Sold</p>
                                        <p className="font-bold text-xl text-primary-600">{quantity}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-gray-500">Total Revenue</p>
                                        <p className="font-bold text-lg text-green-600">{formatCurrency(totalRevenue)}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    </>
                 )}
            </div>

            <div className="space-y-6 pt-8 border-t">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Sales History</h1>
                    <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                        <div className="flex items-center gap-2 w-full">
                            <label htmlFor="sort-sales" className="text-sm font-medium text-gray-600 shrink-0">Sort by:</label>
                            <select
                                id="sort-sales"
                                value={sortBy}
                                onChange={e => setSortBy(e.target.value)}
                                className="w-full sm:w-auto p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                            >
                                <option value="date_desc">Date (Newest First)</option>
                                <option value="date_asc">Date (Oldest First)</option>
                                <option value="total_desc">Total (High to Low)</option>
                                <option value="total_asc">Total (Low to High)</option>
                                <option value="name_asc">Item Name (A-Z)</option>
                                <option value="manufacturer_asc">Manufacturer (A-Z)</option>
                                <option value="category_asc">Category (A-Z)</option>
                                <option value="price_desc">Item Price (High to Low)</option>
                            </select>
                        </div>
                        <Button onClick={handleDownloadPdf} className="flex items-center gap-2 w-full sm:w-auto justify-center" disabled={sales.length === 0}>
                            <FileText size={18} /> Download Sales Report
                        </Button>
                    </div>
                </div>
                
                {sales.length === 0 ? (
                    <div className="text-center py-10 bg-white rounded-lg shadow">
                        <ShoppingBag className="mx-auto h-12 w-12 text-gray-300" />
                        <p className="mt-2 text-gray-500">No sales have been recorded yet.</p>
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
                                    <th scope="col" className="px-6 py-3">Customer</th>
                                    <th scope="col" className="px-6 py-3 text-center">Items</th>
                                    <th scope="col" className="px-6 py-3 text-right">Total Amount</th>
                                    <th scope="col" className="px-6 py-3 text-center">Actions</th>
                                </tr>
                            </thead>
                             {Object.entries(groupedSales).map(([date, data]) => (
                                <tbody key={date}>
                                    <tr className="bg-gray-100 border-b">
                                        <td colSpan={6} className="px-6 py-2 font-bold text-gray-800">
                                            <div className="flex justify-between items-center">
                                                 <span>{new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                                                <span>Daily Total: {formatCurrency(data.dailyTotal)}</span>
                                            </div>
                                        </td>
                                    </tr>
                                    {data.sales.map(sale => (
                                        <tr key={sale.id} className="bg-white border-b hover:bg-gray-50">
                                            <td className="px-6 py-4 font-mono text-xs text-gray-700">{sale.id}</td>
                                            <td className="px-6 py-4">{formatDate(sale.date)}</td>
                                            <td className="px-6 py-4">{sale.customerName} ({sale.customerId})</td>
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
                            ))}
                        </table>
                    </div>

                    {/* Cards for small screens */}
                     <div className="md:hidden grid grid-cols-1 gap-6">
                        {Object.entries(groupedSales).map(([date, data]) => (
                            <div key={date} className="space-y-4">
                                <div className="bg-gray-200 p-2 rounded-lg flex justify-between items-center sticky top-[64px] z-10 shadow">
                                    <h3 className="font-bold text-gray-800">{new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</h3>
                                    <span className="font-semibold text-sm text-gray-700">Total: {formatCurrency(data.dailyTotal)}</span>
                                </div>
                                {data.sales.map(sale => (
                                    <div key={sale.id} className="bg-white rounded-lg shadow-md p-4 space-y-3">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="text-sm font-semibold">Sale ID: <span className="font-mono text-xs">{sale.id}</span></p>
                                                <p className="text-xs text-gray-500">{formatDate(sale.date)}</p>
                                                <p className="text-sm text-gray-700">{sale.customerName} ({sale.customerId})</p>
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
                        ))}
                    </div>
                    </>
                )}
            </div>

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