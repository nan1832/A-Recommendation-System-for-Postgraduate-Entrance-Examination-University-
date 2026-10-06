"use client";

import {
  Activity,
  BarChart3,
  Building2,
  ChevronRight,
  Database,
  ExternalLink,
  GraduationCap,
  Layers3,
  MapPinned,
  Maximize2,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AdmissionUnit } from "@/lib/types";
import { ChinaMap, normalizeRegion } from "./china-map";
import { SubjectExplorer } from "./subject-explorer";

type CatalogResponse = {
  items: AdmissionUnit[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  syncedAt: string;
  source: string;
  sourceUrl: string;
  catalogCount: number;
  regions: string[];
  regionDistribution: Array<{ region: string; count: number }>;
  offerings408Count: number;
  offerings408SchoolCount: number;
  stats: {
    graduateSchool: number;
    selfMarking: number;
    doubleFirstClass: number;
    publishedMetrics: number;
  };
};

const NAV_ITEMS: Array<{ label: string; icon: LucideIcon }> = [
  { label: "考研概况", icon: Activity },
  { label: "院校地图", icon: MapPinned },
  { label: "院校库", icon: Building2 },
  { label: "专业分析", icon: BarChart3 },
  { label: "数据核验", icon: ShieldCheck },
];

export function Dashboard() {
  const [data, setData] = useState<CatalogResponse | null>(null);
  const [provinceUnits, setProvinceUnits] = useState<AdmissionUnit[]>([]);
  const [selectedProvince, setSelectedProvince] = useState("江苏");
  const [panelOpen, setPanelOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [provinceLoading, setProvinceLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [syncNotice, setSyncNotice] = useState("");
  const [now, setNow] = useState<Date | null>(null);
  const [keyword, setKeyword] = useState("");
  const [showAllUnits, setShowAllUnits] = useState(false);
  const [historyUnit, setHistoryUnit] = useState<AdmissionUnit | null>(null);
  const [subjectExplorerOpen, setSubjectExplorerOpen] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    setNow(new Date());
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetch("/api/schools?page=1&pageSize=100", { cache: "no-store", signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("招生单位数据加载失败");
        return response.json() as Promise<CatalogResponse>;
      })
      .then((nextData) => setData(nextData))
      .catch((requestError) => {
        if ((requestError as Error).name !== "AbortError") setError((requestError as Error).message);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setProvinceLoading(true);
    const params = new URLSearchParams({ region: selectedProvince, page: "1", pageSize: "100" });
    fetch(`/api/schools?${params}`, { cache: "no-store", signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("省份院校数据加载失败");
        return response.json() as Promise<CatalogResponse>;
      })
      .then((nextData) => setProvinceUnits(nextData.items))
      .catch((requestError) => {
        if ((requestError as Error).name !== "AbortError") setError((requestError as Error).message);
      })
      .finally(() => setProvinceLoading(false));
    return () => controller.abort();
  }, [selectedProvince]);

  useEffect(() => {
    setShowAllUnits(false);
    setHistoryUnit(null);
  }, [selectedProvince]);

  async function syncNow() {
    setSyncing(true);
    setError("");
    setSyncNotice("");
    try {
      const response = await fetch("/api/sync", { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "同步失败");
      setSyncNotice(result.message ?? "数据同步完成");
      const refreshed = await fetch("/api/schools?page=1&pageSize=100", { cache: "no-store" });
      if (!refreshed.ok) throw new Error("同步后数据刷新失败");
      setData((await refreshed.json()) as CatalogResponse);
    } catch (syncError) {
      setError((syncError as Error).message);
    } finally {
      setSyncing(false);
    }
  }

  const selectedCount = data?.regionDistribution.find(
    (item) => normalizeRegion(item.region) === normalizeRegion(selectedProvince),
  )?.count ?? 0;
  const topRegions = data?.regionDistribution.slice(0, 10) ?? [];
  const publishedRate = data?.catalogCount
    ? Math.round((data.stats.publishedMetrics / data.catalogCount) * 100)
    : 0;
  const selectedKnownCount = provinceUnits.filter((unit) => unit.dataStatus === "official-detail").length;
  const selectedKnownRate = selectedCount ? Math.round((selectedKnownCount / selectedCount) * 100) : 0;
  const filteredProvinceUnits = useMemo(
    () => provinceUnits.filter((unit) => !keyword || `${unit.name} ${unit.department}`.includes(keyword)),
    [keyword, provinceUnits],
  );
  const visibleProvinceUnits = showAllUnits ? filteredProvinceUnits : filteredProvinceUnits.slice(0, 6);

  function handleNav(label: string) {
    if (label === "专业分析") {
      setSubjectExplorerOpen(true);
      return;
    }
    const target = label === "院校地图" ? "map" : label === "院校库" ? "drawer" : label === "数据核验" ? "bottom" : "header";
    document.querySelector(`[data-layout-region="${target}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (label === "院校库") setPanelOpen(true);
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      // Fullscreen can be blocked by an embedded browser; the dashboard remains usable.
    }
  }

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header" data-layout-region="header">
        <div className="brand-lockup">
          <div className="brand-mark"><GraduationCap size={26} /></div>
          <div><div className="brand-title">研考数据可视化平台</div><div className="brand-subtitle">全国招生单位 · 官方快照 · 实时核验</div></div>
        </div>
        <div className="header-title"><span>GRADUATE ADMISSIONS DATA CENTER</span><h1>全国考研招生单位实时数据中心</h1><i /></div>
        <div className="header-actions">
          <div className="header-clock"><span>{now ? now.toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }) : "----/--/--"}</span><strong>{now ? now.toLocaleTimeString("zh-CN", { hour12: false }) : "--:--:--"}</strong></div>
          <button type="button" className="icon-button" aria-label="全屏展示" onClick={toggleFullscreen}><Maximize2 size={16} /></button>
          <button type="button" className="sync-button" onClick={syncNow} disabled={syncing}><RefreshCw size={15} className={syncing ? "spin" : ""} />{syncing ? "同步中" : "同步数据"}</button>
        </div>
      </header>

      <aside className="nav-rail" data-layout-region="nav">
        <div className="nav-rail__caption">DATA<br />CENTER</div>
        <nav>{NAV_ITEMS.map(({ label, icon: Icon }, index) => <button key={label} type="button" className={`nav-item${index === 0 || (label === "专业分析" && subjectExplorerOpen) ? " is-active" : ""}`} onClick={() => handleNav(label)}><Icon size={18} /><span>{label}</span></button>)}</nav>
        <div className="nav-rail__footer"><Sparkles size={16} /> 数据赋能研招</div>
      </aside>

      <div className="dashboard-main">
        {error && <div className="dashboard-alert is-error">{error}</div>}
        {syncNotice && <div className="dashboard-alert is-success">{syncNotice}</div>}

        <section className="kpi-grid" data-layout-region="kpi">
          <KpiCard icon={Database} label="招生单位总数" value={data ? `${data.catalogCount}` : "--"} suffix="所" note="研招网官方院校库" />
          <KpiCard icon={MapPinned} label="覆盖省份" value={data ? `${data.regions.length}` : "--"} suffix="个" note="点击地图查看省份" />
          <KpiCard icon={Layers3} label="408 专业记录" value={data ? `${data.offerings408Count}` : "--"} suffix="条" note={`${data?.offerings408SchoolCount ?? "--"} 个招生单位`} />
          <KpiCard icon={ShieldCheck} label="已解析详细指标" value={data ? `${data.stats.publishedMetrics}` : "--"} suffix="所" note={`当前公开率 ${publishedRate}%`} />
        </section>

        <section className="workspace-grid" data-layout-region="workspace">
          <section className="panel map-panel" data-layout-region="map">
            <div className="panel-heading"><div><div className="eyebrow"><span className="status-dot" /> 全国招生单位地区分布</div><h2>招生单位地区分布</h2><p>波点大小表示招生单位数量，点击省份查看院校明细</p></div><div className="map-heading-meta"><span>数据更新时间</span><strong>{data ? formatDate(data.syncedAt) : "--"}</strong></div></div>
            <ChinaMap regionDistribution={data?.regionDistribution ?? []} selectedProvince={selectedProvince} onSelectProvince={(province) => { setSelectedProvince(province); setPanelOpen(true); }} />
          </section>

          {panelOpen ? <aside className="panel school-drawer" data-layout-region="drawer">
            <div className="drawer-heading"><div><div className="eyebrow"><span className="status-dot status-dot--amber" /> 省份院校明细</div><h2>{selectedProvince}<em> · 招生单位 {selectedCount} 所</em></h2></div><button type="button" className="drawer-close" onClick={() => setPanelOpen(false)} aria-label="关闭院校浮层"><X size={18} /></button></div>
            <div className="drawer-summary"><SummaryStat label="研究生院" value={provinceUnits.filter((unit) => unit.graduateSchool).length} /><SummaryStat label="自划线" value={provinceUnits.filter((unit) => unit.selfMarking).length} /><SummaryStat label="双一流" value={provinceUnits.filter((unit) => unit.doubleFirstClass).length} /><SummaryStat label="指标公开率" value={`${selectedKnownRate}%`} /></div>
            <div className="drawer-tools"><label className="drawer-search"><Search size={14} /><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="筛选院校" /></label><span>{provinceLoading ? "正在载入" : `显示 ${filteredProvinceUnits.length} 所`}</span></div>
            <div className="school-table" role="table" aria-label={`${selectedProvince}招生单位列表`}>
              <div className="school-table__head" role="row"><span>院校</span><span>地区 / 主管部门</span><span>2026 招生人数</span><span>复试线</span><span>复录比</span><span>近年数据</span></div>
              {provinceLoading ? <div className="drawer-empty">省份院校数据载入中…</div> : visibleProvinceUnits.length ? visibleProvinceUnits.map((unit) => <SchoolRow key={unit.id} unit={unit} onHistory={() => setHistoryUnit(unit)} />) : <div className="drawer-empty">没有匹配的院校</div>}
            </div>
            <div className="drawer-footer"><div className="drawer-footer__links"><a href={data?.sourceUrl ?? "https://yz.chsi.com.cn/sch/"} target="_blank" rel="noreferrer">查看研招网官方目录 <ExternalLink size={14} /></a><button type="button" onClick={() => setShowAllUnits((value) => !value)}>{showAllUnits ? "收起列表" : `查看全部 ${filteredProvinceUnits.length} 所`} <ChevronRight size={14} /></button></div><span>数据缺失时显示“未公开”</span></div>
            {historyUnit && <HistoryOverlay unit={historyUnit} onClose={() => setHistoryUnit(null)} />}
          </aside> : <button type="button" className="drawer-reopen" onClick={() => setPanelOpen(true)}><ChevronRight size={18} /> 打开院校浮层</button>}
        </section>

        <section className="bottom-grid" data-layout-region="bottom">
          <section className="panel ranking-panel"><PanelTitle icon={BarChart3} title="各省份招生单位数量 TOP10" action="地区排行" /><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><BarChart data={topRegions} margin={{ top: 12, right: 14, left: -22, bottom: 0 }}><CartesianGrid stroke="#1c4568" strokeDasharray="3 4" vertical={false} /><XAxis dataKey="region" tick={{ fill: "#8ea9c4", fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: "#8ea9c4", fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ background: "#061a2b", border: "1px solid #1cc9e8", borderRadius: 8, color: "#e9fbff" }} formatter={(value) => [`${value} 所`, "招生单位"]} /><Bar dataKey="count" fill="#16c7ef" radius={[5, 5, 0, 0]} maxBarSize={28} /></BarChart></ResponsiveContainer></div></section>
          <section className="panel coverage-panel"><PanelTitle icon={Settings2} title="数据核验与公开情况" action="官方口径" /><div className="coverage-layout"><div className="coverage-ring" style={{ "--coverage": `${publishedRate}%` } as React.CSSProperties}><strong>{publishedRate}%</strong><span>详细指标公开率</span></div><div className="coverage-list"><CoverageRow label="全国目录字段" value={data ? "100%" : "--"} progress={100} color="cyan" /><CoverageRow label={`${selectedProvince}详细指标`} value={data ? `${selectedKnownRate}%` : "--"} progress={selectedKnownRate} color="amber" /><CoverageRow label="408 专业关联院校" value={data ? `${data.offerings408SchoolCount} 所` : "--"} progress={data ? Math.min(100, Math.round((data.offerings408SchoolCount / Math.max(data.catalogCount, 1)) * 100)) : 0} color="violet" /><div className="coverage-note"><ShieldCheck size={15} /> 数据来源：中国研究生招生信息网院校库；未公开字段不做估算。</div></div></div></section>
        </section>
        <footer className="dashboard-footer"><span>数据源：{data?.source ?? "中国研究生招生信息网院校库"}</span><span>快照时间：{data ? formatDate(data.syncedAt) : "--"}</span><span>研考数据可视化平台 · 数据透明 · 仅展示可核验字段</span></footer>
      </div>
      {subjectExplorerOpen && <div className="subject-modal" role="dialog" aria-modal="true" aria-label="专业分析"><div className="subject-modal__body"><div className="subject-modal__header"><div><span className="eyebrow"><span className="status-dot" /> 专业分析</span><h2>按考试科目选学校和专业</h2></div><button type="button" className="drawer-close" onClick={() => setSubjectExplorerOpen(false)} aria-label="关闭专业分析"><X size={18} /></button></div><SubjectExplorer regions={data?.regions ?? []} /></div></div>}
    </main>
  );
}

function KpiCard({ icon: Icon, label, value, suffix, note }: { icon: LucideIcon; label: string; value: string; suffix: string; note: string }) {
  return <article className="kpi-card"><div className="kpi-icon"><Icon size={20} /></div><div className="kpi-copy"><span>{label}</span><strong>{value}<small>{suffix}</small></strong><em>{note}</em></div></article>;
}

function SummaryStat({ label, value }: { label: string; value: number | string }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}

function SchoolRow({ unit, onHistory }: { unit: AdmissionUnit; onHistory: () => void }) {
  const current = unit.history.find((item) => item.year === 2026);
  return <div className="school-row" role="row"><div className="school-name-cell"><SchoolBadge name={unit.name} /><div><strong>{unit.name}</strong><div className="tag-list"><Tag visible={unit.graduateSchool}>研究生院</Tag><Tag visible={unit.selfMarking}>自划线</Tag><Tag visible={unit.doubleFirstClass}>双一流</Tag></div></div></div><div className="school-meta-cell"><strong>{unit.region}</strong><span>{unit.department}</span></div><Metric value={current?.enrollment ?? null} /><Metric value={current?.retestLine ?? null} /><Metric value={current?.retestAdmissionRatio === null || current?.retestAdmissionRatio === undefined ? null : `${current.retestAdmissionRatio}:1`} /><button type="button" className="school-action" onClick={onHistory} aria-label={`查看${unit.name}近年数据`}><BarChart3 size={12} /> 近年</button></div>;
}

function SchoolBadge({ name }: { name: string }) {
  const [failed, setFailed] = useState(false);
  const code = SCHOOL_LOGO_CODES[name];
  return <span className="school-badge" aria-label={`${name}校徽`}>{code && !failed ? <img src={`https://t1.chei.com.cn/common/xh/${code}.jpg`} alt={`${name}校徽`} onError={() => setFailed(true)} /> : <><span>{name.slice(0, 2)}</span><GraduationCap size={13} /></>}</span>;
}

const SCHOOL_LOGO_CODES: Record<string, string> = {
  "北京大学": "10001", "中国人民大学": "10002", "清华大学": "10003", "北京航空航天大学": "10006", "北京理工大学": "10007", "中国农业大学": "10019",
  "哈尔滨工业大学": "10213", "吉林大学": "10183", "复旦大学": "10246", "上海交通大学": "10248", "南京大学": "10284", "苏州大学": "10285", "东南大学": "10286", "南京航空航天大学": "10287", "南京理工大学": "10288", "中国矿业大学": "10290", "河海大学": "10294", "浙江大学": "10335", "山东大学": "10422", "武汉大学": "10486", "华中科技大学": "10487", "中山大学": "10558", "华南理工大学": "10561", "四川大学": "10610", "电子科技大学": "10614", "西安交通大学": "10698",
};

function Tag({ children, visible }: { children: ReactNode; visible: boolean }) {
  if (!visible) return null;
  return <span>{children}</span>;
}

function Metric({ value }: { value: number | string | null }) {
  return <span className={`table-metric${value === null ? " is-missing" : ""}`}>{value ?? "未公开"}</span>;
}

function PanelTitle({ icon: Icon, title, action }: { icon: LucideIcon; title: string; action: string }) {
  return <div className="panel-title"><div><Icon size={16} /><h3>{title}</h3></div><span>{action}<ChevronRight size={14} /></span></div>;
}

function CoverageRow({ label, value, progress, color }: { label: string; value: string; progress: number; color: "cyan" | "amber" | "violet" }) {
  return <div className="coverage-row"><div><span>{label}</span><strong>{value}</strong></div><div className="coverage-track"><i className={`is-${color}`} style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} /></div></div>;
}

function HistoryOverlay({ unit, onClose }: { unit: AdmissionUnit; onClose: () => void }) {
  return <div className="history-overlay" role="dialog" aria-modal="true" aria-label={`${unit.name}近年数据`}><div className="history-overlay__card"><div className="history-overlay__head"><div><span className="eyebrow"><span className="status-dot" /> 近年数据</span><h3>{unit.name} · 2023–2026</h3></div><button type="button" className="drawer-close" onClick={onClose} aria-label="关闭近年数据"><X size={16} /></button></div><div className="history-grid"><div className="history-grid__head"><span>年份</span><span>招生人数</span><span>复试线</span><span>复录比</span><span>数据来源</span></div>{unit.history.map((item) => <div className="history-grid__row" key={item.year}><strong>{item.year}</strong><Metric value={item.enrollment} /><Metric value={item.retestLine} /><Metric value={item.retestAdmissionRatio === null ? null : `${item.retestAdmissionRatio}:1`} />{item.sourceUrl ? <a href={item.sourceUrl} target="_blank" rel="noreferrer">官方公告 <ExternalLink size={11} /></a> : <span className="table-metric is-missing">{item.note}</span>}</div>)}</div></div></div>;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "--" : date.toLocaleString("zh-CN", { hour12: false });
}
