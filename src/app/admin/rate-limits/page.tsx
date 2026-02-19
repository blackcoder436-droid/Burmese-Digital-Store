'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  RefreshCw,
  AlertTriangle,
  Activity,
  Clock,
  Users,
  Lock,
  Server,
} from 'lucide-react';

interface TopIP {
  ip: string;
  count: number;
  remaining: number;
  ttl: number;
}

interface ConfigSummary {
  prefix: string;
  maxRequests: number;
  windowMs: number;
  activeIPs: number;
  blockedIPs: number;
  topIPs: TopIP[];
}

interface RecentEntry {
  key: string;
  ip: string;
  route: string;
  count: number;
  resetTime: number;
  remaining: number;
  maxRequests: number;
}

interface RateLimitData {
  backend: 'redis' | 'memory';
  totalTracked: number;
  configs: ConfigSummary[];
  recentEntries: RecentEntry[];
}

const PREFIX_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  api: { label: 'API General', icon: Activity, color: 'purple' },
  auth: { label: 'Authentication', icon: Lock, color: 'red' },
  upload: { label: 'File Upload', icon: Server, color: 'blue' },
  register: { label: 'Registration', icon: Users, color: 'amber' },
};

export default function RateLimitDashboard() {
  const [data, setData] = useState<RateLimitData | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/rate-limits', { cache: 'no-store' });
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    if (!autoRefresh) return;
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData, autoRefresh]);

  function formatWindow(ms: number) {
    if (ms >= 60000) return `${ms / 60000}m`;
    return `${ms / 1000}s`;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Shield className="w-7 h-7 text-purple-400" />
            Rate Limit Dashboard
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Monitor API rate limiting in real-time
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${
              autoRefresh
                ? 'bg-green-500/10 border-green-500/30 text-green-400'
                : 'bg-dark-800 border-dark-600 text-gray-500'
            }`}
          >
            {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
          </button>
          <button
            onClick={fetchData}
            className="p-2 rounded-lg bg-dark-800 border border-dark-600 hover:border-purple-500/50 transition-all"
          >
            <RefreshCw className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Backend info */}
      <div className="glass-panel p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${data?.backend === 'redis' ? 'bg-green-500/10' : 'bg-amber-500/10'}`}>
            <Server className={`w-5 h-5 ${data?.backend === 'redis' ? 'text-green-400' : 'text-amber-400'}`} />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">
              Backend: {data?.backend === 'redis' ? 'Upstash Redis' : 'In-Memory'}
            </p>
            <p className="text-xs text-gray-500">
              {data?.backend === 'redis'
                ? 'Production mode — distributed rate limiting via Upstash'
                : 'Development mode — single-instance in-memory tracking'}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-white">{data?.totalTracked ?? 0}</p>
          <p className="text-[10px] text-gray-500 uppercase tracking-wider">Tracked IPs</p>
        </div>
      </div>

      {/* Limiter Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data?.configs.map((config) => {
          const meta = PREFIX_META[config.prefix] || PREFIX_META.api;
          const Icon = meta.icon;
          const usagePercent = config.activeIPs > 0
            ? Math.round(
                (config.topIPs.reduce((sum, ip) => sum + ip.count, 0) /
                  (config.topIPs.length * config.maxRequests)) *
                  100
              )
            : 0;

          return (
            <div key={config.prefix} className="glass-panel p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg bg-${meta.color}-500/10`}>
                    <Icon className={`w-5 h-5 text-${meta.color}-400`} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">{meta.label}</h3>
                    <p className="text-[10px] text-gray-500">
                      {config.maxRequests} req / {formatWindow(config.windowMs)}
                    </p>
                  </div>
                </div>
                {config.blockedIPs > 0 && (
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-red-500/10 border border-red-500/20">
                    <AlertTriangle className="w-3 h-3 text-red-400" />
                    <span className="text-[10px] font-bold text-red-400">
                      {config.blockedIPs} blocked
                    </span>
                  </div>
                )}
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-2 rounded-lg bg-dark-800/50">
                  <p className="text-lg font-bold text-white">{config.activeIPs}</p>
                  <p className="text-[10px] text-gray-500">Active IPs</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-dark-800/50">
                  <p className="text-lg font-bold text-red-400">{config.blockedIPs}</p>
                  <p className="text-[10px] text-gray-500">Blocked</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-dark-800/50">
                  <p className="text-lg font-bold text-purple-400">{usagePercent}%</p>
                  <p className="text-[10px] text-gray-500">Avg Usage</p>
                </div>
              </div>

              {/* Top IPs */}
              {config.topIPs.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">
                    Top IPs
                  </p>
                  {config.topIPs.map((ip, i) => {
                    const pct = Math.round((ip.count / config.maxRequests) * 100);
                    const isBlocked = ip.remaining === 0;
                    return (
                      <div key={i} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className={`font-mono ${isBlocked ? 'text-red-400' : 'text-gray-400'}`}>
                            {ip.ip}
                          </span>
                          <span className="text-gray-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {ip.ttl}s
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-dark-800 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              pct >= 100
                                ? 'bg-red-500'
                                : pct >= 70
                                  ? 'bg-amber-500'
                                  : 'bg-purple-500'
                            }`}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-gray-600">
                          <span>{ip.count}/{config.maxRequests} requests</span>
                          <span>{ip.remaining} remaining</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {config.topIPs.length === 0 && (
                <p className="text-xs text-gray-600 text-center py-3">
                  No active rate limits
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Recent Entries Table */}
      {data?.recentEntries && data.recentEntries.length > 0 && (
        <div className="glass-panel overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5">
            <h3 className="text-sm font-bold text-white">Recent Rate Limit Entries</h3>
            <p className="text-[10px] text-gray-500 mt-0.5">
              Active entries sorted by request count
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left px-5 py-3 text-gray-500 font-semibold">IP</th>
                  <th className="text-left px-5 py-3 text-gray-500 font-semibold">Route</th>
                  <th className="text-center px-5 py-3 text-gray-500 font-semibold">Count</th>
                  <th className="text-center px-5 py-3 text-gray-500 font-semibold">Remaining</th>
                  <th className="text-center px-5 py-3 text-gray-500 font-semibold">TTL</th>
                  <th className="text-center px-5 py-3 text-gray-500 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.recentEntries.map((entry, i) => {
                  const isBlocked = entry.remaining === 0;
                  const ttl = Math.max(0, Math.ceil((entry.resetTime - Date.now()) / 1000));
                  return (
                    <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                      <td className="px-5 py-3 font-mono text-gray-400">{entry.ip}</td>
                      <td className="px-5 py-3 text-gray-400 truncate max-w-[200px]">{entry.route}</td>
                      <td className="px-5 py-3 text-center text-white font-semibold">{entry.count}</td>
                      <td className="px-5 py-3 text-center text-gray-400">{entry.remaining}</td>
                      <td className="px-5 py-3 text-center text-gray-500">{ttl}s</td>
                      <td className="px-5 py-3 text-center">
                        {isBlocked ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">
                            BLOCKED
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-500/10 text-green-400 border border-green-500/20">
                            OK
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
