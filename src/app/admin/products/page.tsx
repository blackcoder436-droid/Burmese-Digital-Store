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
  const { tr } = useLanguage();
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
      toast.error(tr('Failed to fetch products', 'ပစ္စည်းများရယူရန် မအောင်မြင်ပါ'));
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!form.name || !form.description || form.price <= 0) {
      toast.error(tr('Please fill in all required fields', 'လိုအပ်သောအကွက်များအားလုံးဖြည့်ပါ'));
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
        toast.success(editing ? tr('Product updated!', 'ပစ္စည်းပြင်ဆင်ပြီးပါပြီ!') : tr('Product created!', 'ပစ္စည်းအသစ်ဖန်တီးပြီးပါပြီ!'));
        setShowForm(false);
        setEditing(null);
        setForm(defaultProduct);
        setBulkKeys('');
        fetchProducts();
      } else {
        toast.error(data.error || tr('Failed to save', 'သိမ်းဆည်းမှု မအောင်မြင်ပါ'));
      }
    } catch {
      toast.error(tr('Something went wrong', 'တစ်ခုခုမှားယွင်းနေပါသည်'));
    } finally {
      setSaving(false);
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error(tr('Image too large. Max 5MB', 'ပုံကြီးလွန်းပါသည်။ အများဆုံး 5MB'));
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
        toast.success(tr('Image uploaded!', 'ပုံတင်ပြီးပါပြီ!'));
      } else {
        toast.error(data.error || tr('Upload failed', 'ပုံတင်ခြင်း မအောင်မြင်ပါ'));
      }
    } catch {
      toast.error(tr('Something went wrong', 'တစ်ခုခုမှားယွင်းနေပါသည်'));
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(tr('Are you sure you want to delete this product?', 'ဤပစ္စည်းကိုဖျက်လိုသည်မှာသေချာပါသလား?'))) return;

    try {
      const res = await fetch(`/api/admin/products/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        toast.success(tr('Product deleted', 'ပစ္စည်းဖျက်ပြီးပါပြီ'));
        fetchProducts();
      } else {
        toast.error(data.error || tr('Failed to delete', 'ဖျက်မရပါ'));
      }
    } catch {
      toast.error(tr('Something went wrong', 'တစ်ခုခုမှားယွင်းနေပါသည်'));
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
        <h1 className="heading-lg">{tr('Products', 'ပစ္စည်းများ')}</h1>
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
          <span>{tr('Add Product', 'ပစ္စည်းထည့်မည်')}</span>
        </button>
      </div>

      {/* Product Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="game-card w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 sm:p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="heading-sm">
                {editing ? tr('Edit Product', 'ပစ္စည်းပြင်ဆင်မည်') : tr('Add New Product', 'ပစ္စည်းအသစ်ထည့်မည်')}
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
                    {tr('Product Name *', 'ပစ္စည်းအမည် *')}
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
                    {tr('Category *', 'အမျိုးအစား *')}
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
                    {tr('Description *', 'ဖော်ပြချက် *')}
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
                  {tr('Product Image', 'ပစ္စည်းပုံ')}
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
                      {tr('Upload Image', 'ပုံတင်မည်')}
                    </span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-300 block mb-2">
                    {tr('Price (MMK) *', 'စျေးနှုန်း (MMK) *')}
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
                      {tr('⭐ Featured Product', '⭐ အထူးအကြံပြု ပစ္စည်း')}
                    </span>
                  </label>
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-300 block mb-2">
                  {tr('Stock Keys (one per line: serialKey|email|password|info)', 'Stock Keys (တစ်ကြောင်းချင်း: serialKey|email|password|info)')}
                </label>
                <textarea
                  rows={5}
                  value={bulkKeys}
                  onChange={(e) => setBulkKeys(e.target.value)}
                  placeholder={`ABC-123-DEF|user@email.com|password123|Valid until 2027\nXYZ-456-GHI|||Serial key only`}
                  className="input-field resize-none font-mono text-xs"
                />
                <p className="text-xs text-gray-500 mt-2">
                  {tr('Separate fields with | (pipe). Leave empty fields blank.', '| (pipe) ဖြင့်ခွဲပါ။ မရှိသောအကွက်များကိုလွတ်ထားပါ။')}
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
                  {tr('Cancel', 'မလုပ်တော့ပါ')}
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
                  <span>{editing ? tr('Update', 'ပြင်ဆင်မည်') : tr('Create', 'ဖန်တီးမည်')}</span>
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
          <h3 className="text-xl text-gray-300 font-medium mb-2">{tr('No products yet', 'ပစ္စည်းမရှိသေးပါ')}</h3>
          <p className="text-sm text-gray-500">
            {tr('Click "Add Product" to create your first product.', 'ပထမဆုံးပစ္စည်းဖန်တီးရန် "Add Product" ကိုနှိပ်ပါ။')}
          </p>
        </div>
      ) : (
        <div className="game-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 uppercase border-b border-dark-700 bg-dark-800/50">
                  <th className="p-4 font-semibold">{tr('Product', 'ပစ္စည်း')}</th>
                  <th className="p-4 font-semibold">{tr('Category', 'အမျိုးအစား')}</th>
                  <th className="p-4 font-semibold">{tr('Price', 'စျေးနှုန်း')}</th>
                  <th className="p-4 font-semibold">{tr('Stock', 'လက်ကျန်')}</th>
                  <th className="p-4 font-semibold">{tr('Status', 'အခြေအနေ')}</th>
                  <th className="p-4 font-semibold text-right">{tr('Actions', 'လုပ်ဆောင်ရန်')}</th>
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
