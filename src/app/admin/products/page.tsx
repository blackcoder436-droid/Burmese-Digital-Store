'use client';

import { useEffect, useState } from 'react';
import {
  Plus,
  Edit,
  Trash2,
  X,
  Save,
  Package,
  Loader2,
  ImagePlus,
} from 'lucide-react';
import Image from 'next/image';
import toast from 'react-hot-toast';
import { useLanguage } from '@/lib/language';

interface Product {
  _id: string;
  name: string;
  category: string;
  description: string;
  price: number;
  stock: number;
  image?: string;
  featured: boolean;
  active: boolean;
  details: any[];
}

const defaultProduct = {
  name: '',
  category: 'vpn',
  description: '',
  price: 0,
  image: '',
  featured: false,
  details: [] as { serialKey: string; loginEmail: string; loginPassword: string; additionalInfo: string }[],
};

export default function AdminProductsPage() {
  const { t } = useLanguage();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(defaultProduct);
  const [saving, setSaving] = useState(false);
  const [bulkKeys, setBulkKeys] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    try {
      const res = await fetch('/api/admin/products?limit=100');
      const data = await res.json();
      if (data.success) setProducts(data.data.products);
    } catch (error) {
      toast.error(t('admin.productsPage.fetchFailed'));
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!form.name || !form.description || form.price <= 0) {
      toast.error(t('admin.productsPage.fillRequired'));
      return;
    }

    setSaving(true);
    try {
      // Parse bulk keys into details array
      let details = form.details;
      if (bulkKeys.trim()) {
        const lines = bulkKeys.trim().split('\n');
        details = lines.map((line) => {
          const parts = line.split('|').map((p) => p.trim());
          return {
            serialKey: parts[0] || '',
            loginEmail: parts[1] || '',
            loginPassword: parts[2] || '',
            additionalInfo: parts[3] || '',
            sold: false,
          };
        });
      }

      const url = editing
        ? `/api/admin/products/${editing}`
        : '/api/admin/products';
      const method = editing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, details }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(editing ? t('admin.productsPage.productUpdated') : t('admin.productsPage.productCreated'));
        setShowForm(false);
        setEditing(null);
        setForm(defaultProduct);
        setBulkKeys('');
        fetchProducts();
      } else {
        toast.error(data.error || t('admin.productsPage.saveFailed'));
      }
    } catch {
      toast.error(t('admin.productsPage.somethingWrong'));
    } finally {
      setSaving(false);
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('admin.productsPage.imageTooLarge'));
      return;
    }
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await fetch('/api/admin/products/image', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success) {
        setForm((prev) => ({ ...prev, image: data.data.image }));
        toast.success(t('admin.productsPage.imageUploaded'));
      } else {
        toast.error(data.error || t('admin.productsPage.uploadFailed'));
      }
    } catch {
      toast.error(t('admin.productsPage.somethingWrong'));
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(t('admin.productsPage.confirmDelete'))) return;

    try {
      const res = await fetch(`/api/admin/products/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        toast.success(t('admin.productsPage.productDeleted'));
        fetchProducts();
      } else {
        toast.error(data.error || t('admin.productsPage.deleteFailed'));
      }
    } catch {
      toast.error(t('admin.productsPage.somethingWrong'));
    }
  }

  function startEdit(product: Product) {
    setForm({
      name: product.name,
      category: product.category,
      description: product.description,
      price: product.price,
      image: product.image || '',
      featured: product.featured,
      details: product.details || [],
    });
    setEditing(product._id);
    setShowForm(true);
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="heading-lg">{t('admin.productsPage.title')}</h1>
        <button
          onClick={() => {
            setShowForm(true);
            setEditing(null);
            setForm(defaultProduct);
            setBulkKeys('');
          }}
          className="btn-electric text-sm flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>{t('admin.productsPage.addProduct')}</span>
        </button>
      </div>

      {/* Product Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="game-card w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 sm:p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="heading-sm">
                {editing ? t('admin.productsPage.editProduct') : t('admin.productsPage.addNewProduct')}
              </h2>
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditing(null);
                }}
                className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-dark-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-300 block mb-2">
                    {t('admin.productsPage.productName')}
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="NordVPN 1 Month"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-300 block mb-2">
                    {t('admin.productsPage.categoryLabel')}
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) =>
                      setForm({ ...form, category: e.target.value })
                    }
                    className="input-field"
                  >
                    <option value="vpn">🛡️ VPN</option>
                    <option value="streaming">📺 Streaming</option>
                    <option value="gaming">🎮 Gaming</option>
                    <option value="software">💻 Software</option>
                    <option value="gift-card">🎁 Gift Card</option>
                    <option value="other">📦 Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-300 block mb-2">
                    {t('admin.productsPage.description')}
                </label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  placeholder="Product description..."
                  className="input-field resize-none"
                />
              </div>

              {/* Product Image Upload */}
              <div>
                <label className="text-sm text-gray-300 block mb-2">
                  {t('admin.productsPage.productImage')}
                </label>
                <div className="flex items-center gap-4">
                  {form.image && form.image !== '/images/default-product.png' ? (
                    <div className="relative w-24 h-16 rounded-lg overflow-hidden border border-dark-600 shrink-0">
                      <Image
                        src={form.image}
                        alt="Product"
                        fill
                        className="object-cover"
                        unoptimized
                      />
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, image: '' })}
                        className="absolute top-0.5 right-0.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-24 h-16 rounded-lg border-2 border-dashed border-dark-600 flex items-center justify-center text-gray-500 shrink-0">
                      <ImagePlus className="w-5 h-5" />
                    </div>
                  )}
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                    <span className="btn-primary text-xs flex items-center gap-1.5">
                      {uploadingImage ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <ImagePlus className="w-3 h-3" />
                      )}
                      {t('admin.productsPage.uploadImage')}
                    </span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-300 block mb-2">
                    {t('admin.productsPage.price')}
                  </label>
                  <input
                    type="number"
                    value={form.price}
                    onChange={(e) =>
                      setForm({ ...form, price: Number(e.target.value) })
                    }
                    min={0}
                    className="input-field"
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.featured}
                      onChange={(e) =>
                        setForm({ ...form, featured: e.target.checked })
                      }
                      className="w-5 h-5 rounded-lg border-purple-500/30 bg-[#12122a] text-purple-500 focus:ring-purple-500"
                    />
                    <span className="text-sm text-gray-300">
                      {t('admin.productsPage.featuredProduct')}
                    </span>
                  </label>
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-300 block mb-2">
                  {t('admin.productsPage.stockKeysLabel')}
                </label>
                <textarea
                  rows={5}
                  value={bulkKeys}
                  onChange={(e) => setBulkKeys(e.target.value)}
                  placeholder={`ABC-123-DEF|user@email.com|password123|Valid until 2027\nXYZ-456-GHI|||Serial key only`}
                  className="input-field resize-none font-mono text-xs"
                />
                <p className="text-xs text-gray-500 mt-2">
                  {t('admin.productsPage.stockKeysHint')}
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-5 border-t border-dark-700">
                <button
                  onClick={() => {
                    setShowForm(false);
                    setEditing(null);
                  }}
                  className="btn-primary text-sm"
                >
                  {t('admin.productsPage.cancel')}
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="btn-electric text-sm flex items-center space-x-2"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span>{editing ? t('admin.productsPage.update') : t('admin.productsPage.create')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Products Table */}
      {loading ? (
        <div className="game-card p-12 text-center">
          <Loader2 className="w-10 h-10 text-purple-500 animate-spin mx-auto" />
        </div>
      ) : products.length === 0 ? (
        <div className="game-card p-16 text-center">
          <Package className="w-16 h-16 text-dark-600 mx-auto mb-4" />
          <h3 className="text-xl text-gray-300 font-medium mb-2">{t('admin.productsPage.noProductsYet')}</h3>
          <p className="text-sm text-gray-500">
            {t('admin.productsPage.createFirstHint')}
          </p>
        </div>
      ) : (
        <div className="game-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 uppercase border-b border-dark-700 bg-dark-800/50">
                  <th className="p-4 font-semibold">{t('admin.productsPage.product')}</th>
                  <th className="p-4 font-semibold">{t('admin.productsPage.category')}</th>
                  <th className="p-4 font-semibold">{t('admin.productsPage.priceCol')}</th>
                  <th className="p-4 font-semibold">{t('admin.productsPage.stock')}</th>
                  <th className="p-4 font-semibold">{t('admin.productsPage.status')}</th>
                  <th className="p-4 font-semibold text-right">{t('admin.productsPage.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700">
                {products.map((product) => (
                  <tr
                    key={product._id}
                    className="text-gray-200 hover:bg-purple-500/5 transition-colors"
                  >
                    <td className="p-4">
                      <div className="flex items-center space-x-3">
                        <div className="text-xl">
                          {product.category === 'vpn'
                            ? '🛡️'
                            : product.category === 'streaming'
                            ? '📺'
                            : '📦'}
                        </div>
                        <div>
                          <p className="font-medium text-white">{product.name}</p>
                          {product.featured && (
                            <span className="text-xs text-amber-400 font-medium">
                              ⭐ Featured
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-4 capitalize">{product.category}</td>
                    <td className="p-4 font-bold text-purple-400">
                      {product.price.toLocaleString()} MMK
                    </td>
                    <td className="p-4">
                      <span
                        className={`font-semibold ${
                          product.stock > 0
                            ? 'text-green-400'
                            : 'text-red-400'
                        }`}
                      >
                        {product.stock}
                      </span>
                    </td>
                    <td className="p-4">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-semibold ${
                          product.active
                            ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                            : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}
                      >
                        {product.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => startEdit(product)}
                          className="p-2 text-gray-400 hover:text-purple-400 hover:bg-purple-500/10 rounded-lg transition-all"
                          title="Edit"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(product._id)}
                          className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                          title="Delete"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
