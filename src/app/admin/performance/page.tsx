'use client';

import { useEffect, useState } from 'react';
import { Activity, Gauge, Clock, TrendingUp, TrendingDown, AlertTriangle, Loader2 } from 'lucide-react';
import { useLanguage } from '@/lib/language';

interface VitalMetric {
  name: string;
  count: number;
  avg: number;
  min: number;
  max: number;
  p50: number;
  p75: number;
  p95: number;
  good: number;
  needsImprovement: number;
  poor: number;
  goodPct: number;
}

interface SlowPage {
  url: string;
  avgLCP: number;
  visits: number;
}

interface VitalsData {
  period: string;
  metrics: VitalMetric[];
  slowPages: SlowPage[];
}

const VITAL_INFO: Record<string, { label: string; unit: string; goodThreshold: number; poorThreshold: number }> = {
  LCP: { label: 'Largest Contentful Paint', unit: 'ms', goodThreshold: 2500, poorThreshold: 4000 },
  FID: { label: 'First Input Delay', unit: 'ms', goodThreshold: 100, poorThreshold: 300 },
  CLS: { label: 'Cumulative Layout Shift', unit: '×10⁻³', goodThreshold: 100, poorThreshold: 250 },
  FCP: { label: 'First Contentful Paint', unit: 'ms', goodThreshold: 1800, poorThreshold: 3000 },
  TTFB: { label: 'Time to First Byte', unit: 'ms', goodThreshold: 800, poorThreshold: 1800 },
  INP: { label: 'Interaction to Next Paint', unit: 'ms', goodThreshold: 200, poorThreshold: 500 },
};

function getRatingColor(metric: VitalMetric) {
  const info = VITAL_INFO[metric.name];
  if (!info) return 'text-gray-400';
  if (metric.p75 <= info.goodThreshold) return 'text-green-400';
  if (metric.p75 <= info.poorThreshold) return 'text-amber-400';
  return 'text-red-400';
}

function getRatingBg(metric: VitalMetric) {
  const info = VITAL_INFO[metric.name];
  if (!info) return 'bg-gray-500/10 border-gray-500/20';
  if (metric.p75 <= info.goodThreshold) return 'bg-green-500/10 border-green-500/20';
  if (metric.p75 <= info.poorThreshold) return 'bg-amber-500/10 border-amber-500/20';
  return 'bg-red-500/10 border-red-500/20';
}

export default function AdminPerformancePage() {
  const { t } = useLanguage();
  const [data, setData] = useState<VitalsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);

  useEffect(() => {
    fetchVitals();
  }, [days]);

  async function fetchVitals() {
    setLoading(true);
    try {
      const res = await fetch(`/api/analytics/vitals?days=${days}`);
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Activity className="w-6 h-6 text-purple-400" />
          <h1 className="heading-lg">Performance</h1>
        </div>
        <div className="flex gap-2">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                days === d
                  ? 'bg-gradient-to-r from-purple-600 to-cyan-500 text-white'
                  : 'bg-[#12122a] text-gray-400 border border-purple-500/[0.15] hover:text-white'
              }`}
            >
              {d}D
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="game-card p-12 text-center">
          <Loader2 className="w-10 h-10 text-purple-500 animate-spin mx-auto" />
        </div>
      ) : !data || data.metrics.length === 0 ? (
        <div className="game-card p-16 text-center">
          <Gauge className="w-16 h-16 text-dark-600 mx-auto mb-4" />
          <h3 className="text-xl text-gray-300 font-medium">No vitals data yet</h3>
          <p className="text-gray-500 text-sm mt-2">Web vitals will appear here once users visit the site.</p>
        </div>
      ) : (
        <>
          {/* Core Web Vitals Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.metrics.map((metric) => {
              const info = VITAL_INFO[metric.name];
              if (!info) return null;
              return (
                <div key={metric.name} className={`game-card p-5 border ${getRatingBg(metric)}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-bold text-white">{metric.name}</h3>
                      <p className="text-xs text-gray-500">{info.label}</p>
                    </div>
                    <span className={`text-2xl font-bold ${getRatingColor(metric)}`}>
                      {metric.p75}
                      <span className="text-xs font-normal text-gray-500 ml-1">{info.unit}</span>
                    </span>
                  </div>

                  {/* Percentile bars */}
                  <div className="space-y-1.5 mb-3">
                    {[
                      { label: 'p50', value: metric.p50 },
                      { label: 'p75', value: metric.p75 },
                      { label: 'p95', value: metric.p95 },
                    ].map((p) => (
                      <div key={p.label} className="flex items-center gap-2 text-xs">
                        <span className="text-gray-500 w-6">{p.label}</span>
                        <div className="flex-1 h-1.5 bg-dark-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              p.value <= info.goodThreshold ? 'bg-green-500' :
                              p.value <= info.poorThreshold ? 'bg-amber-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${Math.min((p.value / info.poorThreshold) * 100, 100)}%` }}
                          />
                        </div>
                        <span className="text-gray-400 w-16 text-right">{p.value} {info.unit}</span>
                      </div>
                    ))}
                  </div>

                  {/* Rating distribution */}
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="text-green-400">{metric.goodPct}% good</span>
                    <span className="text-gray-600">·</span>
                    <span className="text-gray-400">{metric.count} samples</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Slow Pages */}
          {data.slowPages.length > 0 && (
            <div className="game-card overflow-hidden">
              <div className="p-4 border-b border-dark-700">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-semibold text-white">Slowest Pages (by LCP)</h3>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-400 uppercase border-b border-dark-700 bg-dark-800/50">
                      <th className="p-3 font-semibold">Page</th>
                      <th className="p-3 font-semibold text-right">Avg LCP</th>
                      <th className="p-3 font-semibold text-right">Visits</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-700">
                    {data.slowPages.map((page) => (
                      <tr key={page.url} className="text-gray-200 hover:bg-purple-500/5">
                        <td className="p-3 font-mono text-xs text-purple-300">{page.url || '/'}</td>
                        <td className="p-3 text-right">
                          <span className={`font-bold ${
                            page.avgLCP <= 2500 ? 'text-green-400' : page.avgLCP <= 4000 ? 'text-amber-400' : 'text-red-400'
                          }`}>
                            {page.avgLCP}ms
                          </span>
                        </td>
                        <td className="p-3 text-right text-gray-400">{page.visits}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
