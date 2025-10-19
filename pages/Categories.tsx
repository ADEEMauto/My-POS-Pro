
import React, { useState, useMemo } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { Category } from '../types';
import { Plus, Edit, Trash2 } from 'lucide-react';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';

const CategoryItem: React.FC<{ category: Category, onEdit: (cat: Category) => void, onDelete: (id: string) => void }> = ({ category, onEdit, onDelete }) => (
    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-md">
        <span>{category.name}</span>
        <div className="space-x-3">
            <button onClick={() => onEdit(category)} className="text-blue-600 hover:text-blue-800"><Edit size={18} /></button>
            <button onClick={() => onDelete(category.id)} className="text-red-600 hover:text-red-800"><Trash2 size={18} /></button>
        </div>
    </div>
);


const Categories: React.FC = () => {
    const { categories, addCategory, updateCategory, deleteCategory, currentUser } = useAppContext();
    const [newCategoryName, setNewCategoryName] = useState('');
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);

    const isMaster = currentUser?.role === 'master';

    const mainCategories = useMemo(() => categories.filter(c => c.parentId === null), [categories]);

    const handleAddCategory = (parentId: string | null) => {
        if (newCategoryName.trim()) {
            addCategory(newCategoryName, parentId);
            setNewCategoryName('');
        }
    };
    
    const handleUpdateCategory = () => {
        if (editingCategory && newCategoryName.trim()) {
            updateCategory(editingCategory.id, newCategoryName);
            setNewCategoryName('');
            setEditingCategory(null);
        }
    };

    const startEditing = (category: Category) => {
        setEditingCategory(category);
        setNewCategoryName(category.name);
    };

    const cancelEditing = () => {
        setEditingCategory(null);
        setNewCategoryName('');
    }

    const handleDelete = (id: string) => {
        if(window.confirm("Are you sure? This will also delete all sub-categories and un-categorize associated products.")) {
            deleteCategory(id);
        }
    }
    
    if (!isMaster) {
        return (
            <div className="text-center p-8 bg-white rounded-lg shadow-md">
                <h2 className="text-2xl font-bold text-red-600">Access Denied</h2>
                <p className="mt-2 text-gray-600">You do not have permission to view this page.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold text-gray-800">Manage Categories</h1>

            <div className="bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold mb-4">{editingCategory ? `Editing "${editingCategory.name}"` : 'Add New Category'}</h2>
                <div className="flex items-center gap-4">
                    <Input
                        placeholder="Category Name"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                    />
                     {editingCategory && (
                        <select
                            value={editingCategory.parentId || ''}
                            onChange={(e) => setEditingCategory({...editingCategory, parentId: e.target.value || null})}
                            className="p-2 border rounded-md"
                        >
                            <option value="">(Main Category)</option>
                            {mainCategories.filter(c => c.id !== editingCategory.id).map(cat => (
                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                        </select>
                    )}
                    {editingCategory ? (
                        <>
                         <Button onClick={handleUpdateCategory}>Save</Button>
                         <Button variant="secondary" onClick={cancelEditing}>Cancel</Button>
                        </>
                    ) : (
                        <Button onClick={() => handleAddCategory(null)} className="gap-2"><Plus size={18} /> Add Main</Button>
                    )}
                </div>
            </div>

            <div className="space-y-4">
                {mainCategories.map(mainCat => (
                    <div key={mainCat.id} className="bg-white p-6 rounded-lg shadow-md">
                        <div className="flex justify-between items-center pb-3 border-b mb-3">
                            <h3 className="text-lg font-semibold">{mainCat.name}</h3>
                            <div className="space-x-3">
                                <button onClick={() => startEditing(mainCat)} className="text-blue-600 hover:text-blue-800"><Edit size={18} /></button>
                                <button onClick={() => handleDelete(mainCat.id)} className="text-red-600 hover:text-red-800"><Trash2 size={18} /></button>
                            </div>
                        </div>
                        <div className="pl-6 space-y-2">
                             {categories.filter(c => c.parentId === mainCat.id).map(subCat => (
                                <CategoryItem key={subCat.id} category={subCat} onEdit={startEditing} onDelete={handleDelete} />
                             ))}
                             <div className="flex items-center gap-2 pt-2">
                                <Input
                                    placeholder="Add sub-category..."
                                    onKeyDown={(e) => { if(e.key === 'Enter') handleAddCategory(mainCat.id) }}
                                    onChange={(e) => setNewCategoryName(e.target.value)}
                                />
                                <Button size="sm" onClick={() => handleAddCategory(mainCat.id)}><Plus size={16} /></Button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Categories;
