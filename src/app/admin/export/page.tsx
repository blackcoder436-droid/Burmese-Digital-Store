'use client';

import { useState } from 'react';
import {
  Download,
  ShoppingCart,
  Users,
  Package,
  FileSpreadsheet,
  Loader2,
  CheckCircle,
} from 'lucide-react';
import { useLanguage } from '@/lib/language';

export default function ExportPage() {
  const { tr } = useLanguage();
  const [exporting, setExporting] = useState<string | null>(null);
  const [lastExport, setLastExport] = useState<string | null>(null);

  async function handleExport(type: 'orders' | 'users' | 'products') {
    setExporting(type);
    try {
      const res = await fetch(`/api/admin/export?type=${type}`);
      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.headers.get('content-disposition')?.match(/filename="(.+)"/)?.[1] || `${type}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setLastExport(type);
      setTimeout(() => setLastExport(null), 3000);
    } catch {
      // silent
    } finally {
      setExporting(null);
    }
  }

  const exports = [
    {
      type: 'orders' as const,
      icon: ShoppingCart,
      color: 'from-emerald-500 to-green-500',
      bg: 'bg-emerald-500/20',
      text: 'text-emerald-400',
      title: tr('Orders', 'အော်ဒါများ'),
      desc: tr(
        'Export all orders with user info, product, amount, status, and dates.',
        'အော်ဒါအားလုံး — အသုံးပြုသူ၊ ပစ္စည်း၊ ပမာဏ၊ အခြေအနေ၊ ရက်စွဲ'
      ),
      fields: 'ID, User, Email, Product, Category, Qty, Amount, Payment, Status, OCR, Date',
    },
    {
      type: 'users' as const,
      icon: Users,
      color: 'from-cyan-500 to-blue-500',
      bg: 'bg-cyan-500/20',
      text: 'text-cyan-400',
      title: tr('Users', 'အသုံးပြုသူများ'),
      desc: tr(
        'Export all users with name, email, role, balance, and join date.',
        'အသုံးပြုသူအားလုံး — အမည်၊ အီးမေးလ်၊ ရာထူး၊ လက်ကျန်၊ ရက်စွဲ'
      ),
      fields: 'ID, Name, Email, Role, Balance, Joined',
    },
    {
      type: 'products' as const,
      icon: Package,
      color: 'from-purple-500 to-violet-500',
      bg: 'bg-purple-500/20',
      text: 'text-purple-400',
      title: tr('Products', 'ပစ္စည်းများ'),
      desc: tr(
        'Export all products with name, category, price, stock, and status.',
        'ပစ္စည်းအားလုံး — အမည်၊ အမျိုးအစား၊ စျေးနှုန်း၊ stock၊ အခြေအနေ'
      ),
      fields: 'ID, Name, Category, Price, Stock, Total Keys, Status, Created',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center">
          <Download className="w-5 h-5 text-purple-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">{tr('Export Data', 'Data Export')}</h1>
          <p className="text-xs text-gray-500">{tr('Download data as CSV files', 'CSV ဖိုင်အဖြစ် ဒေတာဒေါင်းလုဒ်လုပ်ပါ')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {exports.map((exp) => {
          const Icon = exp.icon;
          const isExporting = exporting === exp.type;
          const justExported = lastExport === exp.type;

          return (
            <div key={exp.type} className="game-card p-6 flex flex-col">
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-12 h-12 ${exp.bg} rounded-xl flex items-center justify-center`}>
                  <Icon className={`w-6 h-6 ${exp.text}`} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{exp.title}</h3>
                  <p className="text-xs text-gray-500">CSV</p>
                </div>
              </div>

              <p className="text-sm text-gray-400 mb-3">{exp.desc}</p>

              <div className="flex items-center gap-2 mb-5 text-xs text-gray-600">
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span className="truncate">{exp.fields}</span>
              </div>

              <div className="mt-auto">
                <button
                  onClick={() => handleExport(exp.type)}
                  disabled={isExporting}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                    justExported
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : `bg-gradient-to-r ${exp.color} text-white hover:opacity-90`
                  } disabled:opacity-50`}
                >
                  {isExporting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {tr('Exporting...', 'ထုတ်နေသည်...')}
                    </>
                  ) : justExported ? (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      {tr('Downloaded!', 'ဒေါင်းပြီး!')}
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      {tr('Download CSV', 'CSV ဒေါင်းလုဒ်')}
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
