import React from 'react';
import { useAppContext } from '../contexts/AppContext';
import { DemandItem } from '../types';
import { Plus, Edit, Trash2, FileText, PackageSearch, XCircle } from 'lucide-react';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import toast from 'react-hot-toast';
// @ts-ignore
import jsPDF from 'jspdf';
// @ts-ignore
import html2canvas from 'html2canvas';

// DemandForm Component for Add/Edit Modal
const DemandForm: React.FC<{
    item?: DemandItem;
    onSave: (item: Omit<DemandItem, 'id'> | DemandItem) => void;
    onCancel: () => void;
}> = ({ item, onSave, onCancel }) => {
    const [formData, setFormData] = React.useState({
        quantity: item?.quantity || '',
        name: item?.name || '',
        category: item?.category || '',
        manufacturer: item?.manufacturer || '',
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim() || !formData.category.trim() || !formData.manufacturer.trim()) {
            toast.error("All fields except quantity are required.");
            return;
        }
        const quantity = parseInt(String(formData.quantity), 10);
        if (isNaN(quantity) || quantity <= 0) {
            toast.error("Please enter a valid, positive quantity.");
            return;
        }

        const dataToSave = {
            ...formData,
            quantity: quantity,
            name: formData.name.trim(),
            category: formData.category.trim(),
            manufacturer: formData.manufacturer.trim(),
        };

        onSave(item ? { ...dataToSave, id: item.id } : dataToSave);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Quantity" name="quantity" type="number" value={formData.quantity} onChange={handleChange} required min="1" />
            <Input label="Name of Item" name="name" value={formData.name} onChange={handleChange} required placeholder="e.g., Engine Oil 20W-50" />
            <Input label="Category" name="category" value={formData.category} onChange={handleChange} required placeholder="e.g., Lubricants" />
            <Input label="Manufacturing (Brand)" name="manufacturer" value={formData.manufacturer} onChange={handleChange} required placeholder="e.g., Shell" />
            <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
                <Button type="submit">Save Item</Button>
            </div>
        </form>
    );
};


const Demand: React.FC = () => {
    const { demandItems, addDemandItem, updateDemandItem, deleteDemandItem, currentUser, shopInfo } = useAppContext();
    const [isModalOpen, setModalOpen] = React.useState(false);
    const [editingItem, setEditingItem] = React.useState<DemandItem | undefined>(undefined);
    const [itemToDelete, setItemToDelete] = React.useState<DemandItem | null>(null);

    const isMaster = currentUser?.role === 'master';

    const handleSaveItem = (itemData: Omit<DemandItem, 'id'> | DemandItem) => {
        if ('id' in itemData) {
            updateDemandItem(itemData);
        } else {
            addDemandItem(itemData);
        }
        setModalOpen(false);
        setEditingItem(undefined);
    };

    const handleEdit = (item: DemandItem) => {
        setEditingItem(item);
        setModalOpen(true);
    };

    const handleDelete = (item: DemandItem) => {
        setItemToDelete(item);
    };

    const handleConfirmDelete = () => {
        if (itemToDelete) {
            deleteDemandItem(itemToDelete.id);
            setItemToDelete(null);
        }
    };

    const handleDownloadPdf = async () => {
        if (demandItems.length === 0) {
            toast.error("Demand list is empty. Nothing to download.");
            return;
        }
        
        const toastId = toast.loading("Generating PDF...", { duration: Infinity });

        try {
            const pdfContainer = document.createElement('div');
            // Styling for off-screen rendering
            pdfContainer.style.position = 'absolute';
            pdfContainer.style.left = '-9999px';
            pdfContainer.style.width = '1000px';
            pdfContainer.style.padding = '20px';
            pdfContainer.style.fontFamily = 'Arial, sans-serif';
            pdfContainer.style.background = 'white';
            pdfContainer.style.color = 'black';

            const tableRows = demandItems.map((item, index) => `
                <tr>
                    <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${index + 1}</td>
                    <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${item.quantity}</td>
                    <td style="border: 1px solid #ddd; padding: 6px;">${item.name}</td>
                    <td style="border: 1px solid #ddd; padding: 6px;">${item.category}</td>
                    <td style="border: 1px solid #ddd; padding: 6px;">${item.manufacturer}</td>
                </tr>
            `).join('');
            
            const logoSize = shopInfo?.pdfLogoSize ?? 50;
            const logoHtml = shopInfo?.logoUrl 
                ? `<img src="${shopInfo.logoUrl}" alt="Shop Logo" style="height: ${logoSize}px; width: auto; margin: 0 auto 10px auto; display: block; object-fit: contain;" />`
                : '';
            
            const totalQuantity = demandItems.reduce((sum, item) => sum + item.quantity, 0);

            pdfContainer.innerHTML = `
                <div>
                    <div style="text-align: center; margin-bottom: 20px;">
                        ${logoHtml}
                    </div>
                    <h2 style="font-size: 20px; text-align: center; border-bottom: 1px solid #ddd; padding-bottom: 10px; margin-bottom: 20px;">Required Items Demand List</h2>
                    <p style="font-size: 12px; margin-bottom: 20px; text-align: right;">Generated: ${new Date().toLocaleString()}</p>
                    <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
                        <thead style="background-color: #f2f2f2;">
                            <tr>
                                <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Sr. No.</th>
                                <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Quantity</th>
                                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Name of Item</th>
                                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Category</th>
                                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Manufacturing</th>
                            </tr>
                        </thead>
                        <tbody>${tableRows}</tbody>
                        <tfoot style="background-color: #f2f2f2; font-weight: bold;">
                             <tr>
                                <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">Total:</td>
                                <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${totalQuantity}</td>
                                <td colspan="3" style="border: 1px solid #ddd; padding: 8px;"></td>
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
            pdf.addImage(imgData, 'PNG', 10, 10, pdfWidth - 20, pdfHeight > 277 ? 277 : pdfHeight); // A4 height is ~297mm, with margins
            
            const filename = `demand_list_${new Date().toISOString().split('T')[0]}.pdf`;
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
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Demand List</h1>
                <div className="flex items-center gap-2">
                    <Button onClick={handleDownloadPdf} variant="secondary" className='gap-2'><FileText size={18}/> Download PDF</Button>
                    <Button onClick={() => { setEditingItem(undefined); setModalOpen(true); }} className='gap-2'><Plus size={18}/> Add Item</Button>
                </div>
            </div>

            {demandItems.length === 0 ? (
                <div className="text-center py-10 bg-white rounded-lg shadow">
                    <PackageSearch className="mx-auto h-12 w-12 text-gray-300" />
                    <p className="mt-2 text-gray-500">The demand list is empty.</p>
                    <p className="text-sm text-gray-400">Add items that are required but not in stock.</p>
                </div>
            ) : (
                <>
                {/* Table for medium screens and up */}
                <div className="hidden md:block bg-white rounded-lg shadow-md overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-500">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3 w-24 text-center">Quantity</th>
                                <th scope="col" className="px-6 py-3">Name of Item</th>
                                <th scope="col" className="px-6 py-3">Category</th>
                                <th scope="col" className="px-6 py-3">Manufacturing</th>
                                <th scope="col" className="px-6 py-3 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {demandItems.map(item => (
                                <tr key={item.id} className="bg-white border-b hover:bg-gray-50">
                                    <td className="px-6 py-4 font-bold text-center">{item.quantity}</td>
                                    <td className="px-6 py-4 font-medium text-gray-900">{item.name}</td>
                                    <td className="px-6 py-4">{item.category}</td>
                                    <td className="px-6 py-4">{item.manufacturer}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex justify-center space-x-2">
                                            <button onClick={() => handleEdit(item)} className="text-blue-600 hover:text-blue-800"><Edit size={18}/></button>
                                            <button onClick={() => handleDelete(item)} className="text-red-600 hover:text-red-800"><Trash2 size={18}/></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                
                {/* Cards for small screens */}
                <div className="md:hidden grid grid-cols-1 gap-4">
                    {demandItems.map(item => (
                         <div key={item.id} className="bg-white rounded-lg shadow-md p-4 space-y-3">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="font-bold text-gray-800">{item.name}</h3>
                                    <p className="text-sm text-gray-500">{item.manufacturer}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-gray-500">Quantity</p>
                                    <p className="font-bold text-xl text-primary-600">{item.quantity}</p>
                                </div>
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t">
                                <span className="px-2 py-1 bg-gray-200 text-gray-800 rounded-full text-xs font-medium">{item.category}</span>
                                <div className="flex items-center space-x-3">
                                    <button onClick={() => handleEdit(item)} className="text-blue-600 hover:text-blue-800" title="Edit"><Edit size={18}/></button>
                                    <button onClick={() => handleDelete(item)} className="text-red-600 hover:text-red-800" title="Delete"><Trash2 size={18}/></button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                </>
            )}

            <Modal isOpen={isModalOpen} onClose={() => { setModalOpen(false); setEditingItem(undefined); }} title={editingItem ? 'Edit Demand Item' : 'Add New Demand Item'}>
                <DemandForm
                    item={editingItem} 
                    onSave={handleSaveItem} 
                    onCancel={() => { setModalOpen(false); setEditingItem(undefined); }}
                />
            </Modal>
            
            <Modal isOpen={!!itemToDelete} onClose={() => setItemToDelete(null)} title="Confirm Deletion" size="md">
                <div className="text-center">
                    <XCircle className="mx-auto h-12 w-12 text-red-500" />
                    <p className="mt-4 text-gray-700">Are you sure you want to remove this item from the demand list: <br/><strong className="text-gray-900">{itemToDelete?.name}</strong>?</p>
                </div>
                <div className="flex justify-center gap-4 mt-6">
                    <Button variant="secondary" onClick={() => setItemToDelete(null)}>Cancel</Button>
                    <Button variant="danger" onClick={handleConfirmDelete}>Yes, Delete</Button>
                </div>
            </Modal>
        </div>
    );
};

export default Demand;