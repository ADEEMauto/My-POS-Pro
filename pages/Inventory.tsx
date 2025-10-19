import React, { useState, useMemo, useRef } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { Product } from '../types';
import { formatCurrency, downloadFile, compressImage } from '../utils/helpers';
import { Plus, Edit, Trash2, Search, ScanLine, Upload, Download, Camera, RefreshCw } from 'lucide-react';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import BarcodeScanner from '../components/BarcodeScanner';
import CameraCapture from '../components/CameraCapture';
import toast from 'react-hot-toast';
import { SAMPLE_XLSX_BASE64 } from '../constants';

// Declare XLSX for typescript
declare const XLSX: any;

const ProductForm: React.FC<{ product?: Product; onSave: (product: Omit<Product, 'id'> | Product) => void; onCancel: () => void }> = ({ product, onSave, onCancel }) => {
    const { categories, inventory } = useAppContext();
    const [formData, setFormData] = useState({
        name: product?.name || '',
        categoryId: product?.categoryId || '',
        subCategoryId: product?.subCategoryId || '',
        manufacturer: product?.manufacturer || '',
        location: product?.location || '',
        quantity: product?.quantity || 0,
        purchasePrice: product?.purchasePrice || 0,
        salePrice: product?.salePrice || 0,
        barcode: product?.barcode || '',
        imageUrl: product?.imageUrl || ''
    });
    const [isScannerOpenForForm, setScannerOpenForForm] = useState(false);
    const [isCameraOpen, setCameraOpen] = useState(false);

    const mainCategories = useMemo(() => categories.filter(c => c.parentId === null), [categories]);
    const subCategories = useMemo(() => {
        if (!formData.categoryId) return [];
        return categories.filter(c => c.parentId === formData.categoryId);
    }, [categories, formData.categoryId]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        
        // Reset subcategory if main category changes
        if (name === 'categoryId') {
            setFormData({ ...formData, [name]: value, subCategoryId: '' });
        } else {
            setFormData({ ...formData, [name]: value });
        }
    };
    
    const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const toastId = toast.loading('Compressing image...');
            try {
                const compressedBase64 = await compressImage(file);
                setFormData({ ...formData, imageUrl: compressedBase64 });
                toast.success('Image added!', { id: toastId });
            } catch (error) {
                toast.error('Failed to process image.', { id: toastId });
                console.error(error);
            }
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const dataToSave = {
            ...formData,
            quantity: Number(formData.quantity),
            purchasePrice: Number(formData.purchasePrice),
            salePrice: Number(formData.salePrice),
        };
        onSave(product ? { ...dataToSave, id: product.id } : dataToSave);
    };

    const handleBarcodeScanned = (decodedText: string) => {
        setFormData(prev => ({ ...prev, barcode: decodedText }));
        setScannerOpenForForm(false);
        toast.success("Barcode captured!");
    };
    
    const handlePhotoCaptured = (imageDataUrl: string) => {
        setFormData({ ...formData, imageUrl: imageDataUrl });
        setCameraOpen(false);
        toast.success('Photo captured and added!');
    };

    const generateBarcode = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        
        const generate = () => {
            let result = '';
            for (let i = 0; i < 3; i++) {
                result += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return result;
        }

        let newBarcode;
        let attempt = 0;
        const maxAttempts = 100;

        do {
            newBarcode = generate();
            attempt++;
            if(attempt >= maxAttempts) {
                toast.error("Could not generate a unique 3-letter barcode. Please enter one manually.");
                return;
            }
        } while (inventory.some(p => p.barcode === newBarcode && p.id !== product?.id));
        
        setFormData(prev => ({ ...prev, barcode: newBarcode }));
        toast.success(`Generated barcode: ${newBarcode}`);
    };

    return (
        <>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input label="Product Name" name="name" value={formData.name} onChange={handleChange} required />
                    <Input label="Manufacturer" name="manufacturer" value={formData.manufacturer} onChange={handleChange} required />
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                        <select name="categoryId" value={formData.categoryId} onChange={handleChange} required className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500">
                            <option value="">Select Category</option>
                            {mainCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Sub-Category</label>
                        <select name="subCategoryId" value={formData.subCategoryId || ''} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500" disabled={subCategories.length === 0}>
                            <option value="">Select Sub-Category (Optional)</option>
                            {subCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <Input label="Location (Rack/Drawer)" name="location" value={formData.location} onChange={handleChange} />
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Barcode</label>
                        <div className="flex items-center gap-2">
                            <Input name="barcode" value={formData.barcode} onChange={handleChange} className="flex-grow" />
                            <Button type="button" variant="secondary" size="sm" onClick={generateBarcode} className="shrink-0" title="Generate Barcode">
                                <RefreshCw className="w-4 h-4" />
                            </Button>
                            <Button type="button" variant="secondary" size="sm" onClick={() => setScannerOpenForForm(true)} className="shrink-0 px-2" aria-label="Scan barcode" title="Scan Barcode">
                                <ScanLine className="w-5 h-5"/>
                            </Button>
                        </div>
                    </div>

                    <Input label="Quantity" name="quantity" type="number" value={formData.quantity} onChange={handleChange} required min="0"/>
                    <Input label="Purchase Price (Rs.)" name="purchasePrice" type="number" value={formData.purchasePrice} onChange={handleChange} required min="0"/>
                    <Input label="Sale Price (Rs.)" name="salePrice" type="number" value={formData.salePrice} onChange={handleChange} required min="0"/>
                    
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Product Image</label>
                        <div className="flex flex-col sm:flex-row gap-2 items-center">
                             <div className="flex-grow w-full">
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageChange}
                                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 border border-gray-300 rounded-lg cursor-pointer"
                                />
                             </div>
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={() => setCameraOpen(true)}
                                className="flex w-full sm:w-auto items-center justify-center gap-2"
                            >
                                <Camera size={18} /> Take Photo
                            </Button>
                        </div>
                        {formData.imageUrl && <img src={formData.imageUrl} alt="preview" className="mt-2 h-24 w-24 object-cover rounded-lg shadow-md" />}
                    </div>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
                    <Button type="submit">Save Product</Button>
                </div>
            </form>
             <Modal isOpen={isScannerOpenForForm} onClose={() => setScannerOpenForForm(false)} title="Scan Product Barcode">
                <BarcodeScanner onScanSuccess={handleBarcodeScanned} />
            </Modal>
             <Modal isOpen={isCameraOpen} onClose={() => setCameraOpen(false)} title="Take Product Photo">
                <CameraCapture
                    onCapture={handlePhotoCaptured}
                    onClose={() => setCameraOpen(false)}
                />
            </Modal>
        </>
    );
};


const Inventory: React.FC = () => {
    const { inventory, categories, deleteProduct, addProduct, updateProduct, currentUser, addSampleData, importFromExcel } = useAppContext();
    const [isModalOpen, setModalOpen] = useState(false);
    const [isScannerOpen, setScannerOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | undefined>(undefined);
    const [searchTerm, setSearchTerm] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const isMaster = currentUser?.role === 'master';

    const categoryMap = useMemo(() => {
        const map = new Map<string, string>();
        categories.forEach(cat => {
            map.set(cat.id, cat.name);
        });
        return map;
    }, [categories]);

    const handleSaveProduct = (productData: Omit<Product, 'id'> | Product) => {
        if ('id' in productData) {
            updateProduct(productData);
        } else {
            addProduct(productData);
        }
        setModalOpen(false);
        setEditingProduct(undefined);
    };

    const handleEdit = (product: Product) => {
        setEditingProduct(product);
        setModalOpen(true);
    };
    
    const handleDelete = (productId: string) => {
        if(window.confirm("Are you sure you want to delete this product?")) {
            deleteProduct(productId);
        }
    };
    
    const handleScanSuccess = (decodedText: string) => {
        setEditingProduct({ barcode: decodedText } as Product); // Partial product
        setScannerOpen(false);
        setModalOpen(true);
    };

    const handleExcelUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json(worksheet);
                importFromExcel(json);
            };
            reader.readAsArrayBuffer(file);
            event.target.value = '';
        }
    };

    const filteredInventory = useMemo(() => {
        return inventory.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [inventory, searchTerm]);

    if (!isMaster) {
        return (
            <div className="text-center p-8 bg-white rounded-lg shadow-md">
                <h2 className="text-2xl font-bold text-red-600">Access Denied</h2>
                <p className="mt-2 text-gray-600">You do not have permission to view this page.</p>
            </div>
        );
    }
    
    const downloadSampleExcel = () => {
        const data = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${SAMPLE_XLSX_BASE64}`;
        downloadFile(data, 'sample-inventory.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h1 className="text-3xl font-bold text-gray-800">Inventory</h1>
                <div className="flex items-center gap-2 flex-wrap justify-center">
                    <div className="w-full sm:w-auto">
                      <Input placeholder="Search inventory..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} icon={<Search className="w-5 h-5 text-gray-400" />} />
                    </div>
                    <Button onClick={() => setScannerOpen(true)} variant="secondary" className='gap-2'><ScanLine size={18}/> Scan</Button>
                    <input type="file" ref={fileInputRef} onChange={handleExcelUpload} accept=".xlsx, .xls" className="hidden" />
                    <Button onClick={() => fileInputRef.current?.click()} variant="secondary" className='gap-2'><Upload size={18}/> Import</Button>
                    <Button onClick={() => { setEditingProduct(undefined); setModalOpen(true); }} className='gap-2'><Plus size={18}/> Add Product</Button>
                </div>
            </div>
             <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-blue-50 p-3 rounded-md">
                <p className="text-sm text-blue-700 text-center md:text-left">Need help with bulk import? Download our sample Excel template.</p>
                <Button onClick={downloadSampleExcel} variant="ghost" size="sm" className="flex items-center gap-2 shrink-0"><Download size={16}/> Download Template</Button>
             </div>
             {inventory.length === 0 && (
                <div className="text-center py-10 bg-white rounded-lg shadow">
                    <p className="text-gray-500 mb-4">Your inventory is empty. Add some products to get started.</p>
                    <Button onClick={addSampleData}>Add Sample Data</Button>
                </div>
            )}

            {/* Table for medium screens and up */}
            <div className="hidden md:block bg-white rounded-lg shadow-md overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-500">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                        <tr>
                            <th scope="col" className="px-6 py-3">Product</th>
                            <th scope="col" className="px-6 py-3">Category</th>
                            <th scope="col" className="px-6 py-3">Stock</th>
                            <th scope="col" className="px-6 py-3">Sale Price</th>
                            <th scope="col" className="px-6 py-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredInventory.map(product => (
                            <tr key={product.id} className="bg-white border-b hover:bg-gray-50">
                                <td className="px-6 py-4 font-medium text-gray-900 flex items-center gap-3">
                                    <img src={product.imageUrl || 'https://picsum.photos/200'} alt={product.name} className="w-10 h-10 object-cover rounded-md"/>
                                    <div>
                                        <span>{product.name}</span>
                                        <p className="text-xs text-gray-400">{product.manufacturer}</p>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    {categoryMap.get(product.categoryId) || product.categoryId}
                                    {product.subCategoryId && categoryMap.get(product.subCategoryId) && (
                                        <span className="block text-xs text-gray-500">
                                            ↳ {categoryMap.get(product.subCategoryId)}
                                        </span>
                                    )}
                                </td>
                                <td className={`px-6 py-4 font-semibold ${product.quantity <= 5 ? 'text-red-500' : 'text-green-600'}`}>{product.quantity}</td>
                                <td className="px-6 py-4">{formatCurrency(product.salePrice)}</td>
                                <td className="px-6 py-4">
                                    <div className="flex space-x-2">
                                        <button onClick={() => handleEdit(product)} className="text-blue-600 hover:text-blue-800"><Edit size={18}/></button>
                                        <button onClick={() => handleDelete(product.id)} className="text-red-600 hover:text-red-800"><Trash2 size={18}/></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            
            {/* Cards for small screens */}
            <div className="md:hidden grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredInventory.map(product => (
                     <div key={product.id} className="bg-white rounded-lg shadow-md p-4 flex flex-col">
                        <div className="flex items-center gap-3 mb-3">
                            <img src={product.imageUrl || 'https://picsum.photos/200'} alt={product.name} className="w-16 h-16 object-cover rounded-md"/>
                            <div className="flex-grow">
                                <span className="font-medium text-gray-900 leading-tight">{product.name}</span>
                                <p className="text-sm text-gray-500">{product.manufacturer}</p>
                            </div>
                        </div>
                        <div className="text-sm space-y-2 flex-grow">
                            <div>
                                <strong className="text-gray-600">Category: </strong> 
                                {categoryMap.get(product.categoryId) || product.categoryId}
                                {product.subCategoryId && categoryMap.get(product.subCategoryId) && (
                                    <span className="block text-xs text-gray-500 ml-2">↳ {categoryMap.get(product.subCategoryId)}</span>
                                )}
                            </div>
                            <div className="flex justify-between items-center">
                                <span><strong className="text-gray-600">Stock: </strong><span className={`font-semibold ${product.quantity <= 5 ? 'text-red-500' : 'text-green-600'}`}>{product.quantity}</span></span>
                                <span><strong className="text-gray-600">Price: </strong><span className="font-semibold">{formatCurrency(product.salePrice)}</span></span>
                            </div>
                        </div>
                        <div className="flex justify-end space-x-2 border-t mt-3 pt-3">
                             <Button onClick={() => handleEdit(product)} variant="ghost" size="sm" className="flex items-center gap-1"><Edit size={16}/> Edit</Button>
                             <Button onClick={() => handleDelete(product.id)} variant="ghost" size="sm" className="text-red-600 hover:text-red-700 flex items-center gap-1"><Trash2 size={16}/> Delete</Button>
                        </div>
                    </div>
                ))}
            </div>


            <Modal isOpen={isModalOpen} onClose={() => { setModalOpen(false); setEditingProduct(undefined); }} title={editingProduct?.id ? 'Edit Product' : 'Add New Product'} size="2xl">
                <ProductForm product={editingProduct} onSave={handleSaveProduct} onCancel={() => { setModalOpen(false); setEditingProduct(undefined); }} />
            </Modal>
            
            <Modal isOpen={isScannerOpen} onClose={() => setScannerOpen(false)} title="Scan Barcode to Add Product">
                <p className="text-center text-gray-600 mb-4">Scan a product's barcode. It will be added to a new product form.</p>
                <BarcodeScanner onScanSuccess={handleScanSuccess} />
            </Modal>
        </div>
    );
};

export default Inventory;