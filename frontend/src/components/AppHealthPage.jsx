import React, { useEffect, useState } from 'react';
import { Activity, Cloud, Database, Loader2, Phone, Server, ShieldCheck, Wifi } from 'lucide-react';
import api from '../services/api';
import { getSocket } from '../services/socket';

const StatusCard = ({ icon: Icon, title, status, helper, good = true }) => (
  <div className="rounded-[1.2rem] border border-slate-200 bg-white/92 p-4 shadow-sm shadow-slate-200/45 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/20">
    <div className="flex items-start justify-between gap-3">
      <span className={`grid h-11 w-11 place-items-center rounded-2xl ring-1 ${good ? 'bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-200 dark:ring-emerald-900/50' : 'bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-950/30 dark:text-amber-200 dark:ring-amber-900/50'}`}>
        <Icon size={20} />
      </span>
      <span className={`h-2.5 w-2.5 rounded-full ${good ? 'bg-emerald-500' : 'bg-amber-500'}`} />
    </div>
    <p className="mt-4 text-sm font-black text-slate-500 dark:text-slate-400">{title}</p>
    <p className="mt-1 text-2xl font-black text-slate-950 dark:text-white">{status}</p>
    <p className="mt-1 text-xs font-semibold leading-5 text-slate-500 dark:text-slate-400">{helper}</p>
  </div>
);

export default function AppHealthPage() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [socketConnected, setSocketConnected] = useState(false);

  useEffect(() => {
    const socket = getSocket();
    const updateSocket = () => setSocketConnected(socket.connected);
    updateSocket();
    socket.on('connect', updateSocket);
    socket.on('disconnect', updateSocket);
    return () => {
      socket.off('connect', updateSocket);
      socket.off('disconnect', updateSocket);
    };
  }, []);

  const loadHealth = async () => {
    setLoading(true);
    try {
      const res = await api.get('/health');
      setHealth(res.data);
    } catch {
      setHealth(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHealth();
  }, []);

  const dbGood = health?.database?.status === 'connected';
  const apiGood = Boolean(health?.ok);
  const turnGood = Boolean(health?.calls?.turnConfigured);
  const liveKitGood = Boolean(health?.calls?.livekitConfigured);
  const callGood = liveKitGood || turnGood;
  const callStatus = liveKitGood ? 'LiveKit ready' : turnGood ? 'TURN ready' : 'Relay missing';
  const callHelper = liveKitGood
    ? `Cloud calling enabled, mode ${health?.calls?.relayMode || 'livekit'}`
    : turnGood
      ? `${health?.calls?.turnCount || 0} relay URL(s), mode ${health?.calls?.relayMode}`
      : 'Calls may fail across different networks without LiveKit or TURN';

  return (
    <div className="mobile-page app-health-page mx-auto max-w-6xl space-y-4 px-0 py-1 sm:px-6 sm:py-4 lg:px-8">
      <section className="rounded-[1.45rem] border border-slate-200 bg-white/92 p-5 shadow-sm shadow-slate-200/55 dark:border-slate-800 dark:bg-slate-900/92 dark:shadow-black/25">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase text-[#0b57d0] dark:text-sky-300">System health</p>
            <h1 className="mt-1 text-3xl font-black text-slate-950 dark:text-white">App Health</h1>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-500 dark:text-slate-400">
              Quick diagnostics for API, database, socket, media storage, and call relay readiness.
            </p>
          </div>
          <button onClick={loadHealth} type="button" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#07036f] px-4 py-3 text-sm font-black text-white">
            {loading ? <Loader2 size={17} className="animate-spin" /> : <Activity size={17} />}
            Refresh
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <StatusCard icon={Server} title="API" status={apiGood ? 'Online' : 'Offline'} helper={health?.api?.nodeEnv ? `Environment: ${health.api.nodeEnv}` : 'Backend did not respond'} good={apiGood} />
        <StatusCard icon={Database} title="Database" status={health?.database?.status || 'Unknown'} helper={`Ready state: ${health?.database?.readyState ?? '-'}`} good={dbGood} />
        <StatusCard icon={Wifi} title="Realtime socket" status={socketConnected ? 'Connected' : health?.socket?.status || 'Disconnected'} helper={`${health?.socket?.connectedClients ?? 0} backend clients, browser ${socketConnected ? 'connected' : 'not connected'}`} good={socketConnected || health?.socket?.status === 'online'} />
        <StatusCard icon={Cloud} title="Storage" status={health?.storage?.provider || 'Unknown'} helper={health?.storage?.status || 'Upload provider unavailable'} good={Boolean(health?.storage)} />
        <StatusCard icon={Phone} title="Calls" status={callStatus} helper={callHelper} good={callGood} />
        <StatusCard icon={ShieldCheck} title="Release updater" status="Ready" helper={health?.app?.releaseUrl || '/releases/syncrova-latest.apk'} good />
      </section>

      <section className="rounded-[1.25rem] border border-blue-100 bg-blue-50/80 p-5 text-sm font-semibold leading-6 text-slate-600 shadow-sm shadow-blue-200/35 dark:border-blue-900/50 dark:bg-blue-950/25 dark:text-slate-300">
        <p className="font-black text-slate-950 dark:text-white">Developer note</p>
        <p className="mt-1">
          This page never exposes secrets. It only confirms whether services are configured and reachable, so it is safe to show while debugging.
        </p>
      </section>
    </div>
  );
}
