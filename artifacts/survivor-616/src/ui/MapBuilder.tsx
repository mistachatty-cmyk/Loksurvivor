import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Box,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Crosshair,
  Database,
  Grip,
  Layers3,
  MapPinned,
  Minus,
  Plus,
  Radio,
  Save,
  Search,
  Swords,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  CUSTOM_MAP_ASSETS,
  CUSTOM_MAP_ASSET_CATEGORIES,
  assetFromId,
  CUSTOM_MAP_GRID,
  MAX_CUSTOM_MAPS,
  CUSTOM_MAP_MAX_BOUNDS,
  CUSTOM_MAP_MIN_BOUNDS,
  MAX_CUSTOM_MAP_PLACEMENTS,
} from '@/game/data/customMaps';
import { AREAS } from '@/game/data/areas';
import { useMeta } from '@/game/state/metaStore';
import type { CustomMap, CustomMapPlacement } from '@/game/types';

interface MapBuilderProps {
  onBack: () => void;
  onLaunch: (mapId: string) => void;
}

type PlacementCategory = CustomMapPlacement['category'];

const CATEGORY_ICONS: Record<string, typeof Box> = {
  ground: Layers3,
  structure: Box,
  hazard: AlertTriangle,
  landmark: MapPinned,
  enemy: Swords,
  encounter: Radio,
};

const THREAT_OPTIONS: Array<{ value: CustomMap['threat']; label: string; detail: string }> = [
  { value: 'low', label: 'Low', detail: 'A quiet first pass' },
  { value: 'rising', label: 'Rising', detail: 'Pressure builds in waves' },
  { value: 'high', label: 'High', detail: 'The street pushes back' },
  { value: 'severe', label: 'Severe', detail: 'No room for a clean exit' },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function snap(value: number) {
  return Math.round(value / CUSTOM_MAP_GRID) * CUSTOM_MAP_GRID;
}

function formatAge(updatedAt: number) {
  const seconds = Math.max(0, Math.floor((Date.now() - updatedAt) / 1000));
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

function newPlacement(assetId: string, index: number, map: CustomMap): CustomMapPlacement {
  const asset = assetFromId(assetId);
  const w = asset?.w ?? 60;
  const h = asset?.h ?? 60;
  return {
    id: `placement-${Date.now().toString(36)}-${index}`,
    assetId,
    category: (asset?.category ?? 'structure') as PlacementCategory,
    x: snap(clamp(0, -map.bounds.w / 2 + w / 2, map.bounds.w / 2 - w / 2)),
    y: snap(clamp(0, -map.bounds.h / 2 + h / 2, map.bounds.h / 2 - h / 2)),
    w,
    h,
  };
}

function displayCoordinate(value: number) {
  return value > 0 ? `+${value}` : `${value}`;
}

export function MapBuilder({ onBack, onLaunch }: MapBuilderProps) {
  const {
    meta,
    createCustomMap,
    saveCustomMap,
    duplicateCustomMap,
    deleteCustomMap,
  } = useMeta();
  const maps = meta.customMaps;
  const [activeMapId, setActiveMapId] = useState<string | null>(maps[0]?.id ?? null);
  const [draft, setDraft] = useState<CustomMap | null>(maps[0] ?? null);
  const [search, setSearch] = useState('');
  const [selectedPlacementId, setSelectedPlacementId] = useState<string | null>(null);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({
    ground: true,
    structure: true,
    hazard: true,
    landmark: true,
    enemy: true,
    encounter: true,
  });
  const [notice, setNotice] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [dragging, setDragging] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const knownMapIds = useRef(new Set(maps.map((map) => map.id)));

  useEffect(() => {
    const newest = maps[0];
    if (!newest) {
      setActiveMapId(null);
      setDraft(null);
      return;
    }
    const mapStillExists = activeMapId ? maps.some((map) => map.id === activeMapId) : false;
    const createdMap = maps.find((map) => !knownMapIds.current.has(map.id));
    if (!mapStillExists || createdMap) {
      const next = createdMap ?? newest;
      setActiveMapId(next.id);
      setDraft(next);
      setSelectedPlacementId(null);
      setIsDirty(false);
    } else if (draft && !isDirty) {
      const fresh = maps.find((map) => map.id === activeMapId);
      if (fresh) setDraft(fresh);
    }
    knownMapIds.current = new Set(maps.map((map) => map.id));
  }, [activeMapId, draft, isDirty, maps]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const activeMap = draft;
  const selectedPlacement = activeMap?.placements.find((item) => item.id === selectedPlacementId) ?? null;
  const filteredAssets = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return CUSTOM_MAP_ASSETS;
    return CUSTOM_MAP_ASSETS.filter((asset) =>
      `${asset.name} ${asset.description} ${asset.category}`.toLowerCase().includes(query),
    );
  }, [search]);

  const validation = useMemo(() => {
    if (!activeMap) return [];
    const warnings: string[] = [];
    const threatPlacements = activeMap.placements.filter(
      (item) => item.category === 'enemy' || item.category === 'encounter',
    );
    if (threatPlacements.length === 0) warnings.push('No enemy pressure is scheduled. Add an enemy or encounter before launch.');
    if (activeMap.placements.length > MAX_CUSTOM_MAP_PLACEMENTS - 10) {
      warnings.push(`Placement count is almost full (${activeMap.placements.length}/${MAX_CUSTOM_MAP_PLACEMENTS}).`);
    }
    if (!activeMap.landmarkAssetId) warnings.push('No landmark selected. A route marker helps survivors orient themselves.');
    return warnings;
  }, [activeMap]);

  const updateDraft = (updates: Partial<CustomMap>) => {
    setDraft((current) => (current ? { ...current, ...updates, updatedAt: Date.now() } : current));
    setIsDirty(true);
  };

  const selectMap = (map: CustomMap) => {
    setActiveMapId(map.id);
    setDraft(map);
    setSelectedPlacementId(null);
    setIsDirty(false);
    setNotice('');
  };

  const handleCreate = () => {
    if (maps.length >= MAX_CUSTOM_MAPS) {
      setNotice('The computer archive is full. Delete a route before creating another.');
      return;
    }
    createCustomMap();
    setNotice('Blank route initialized.');
  };

  const handleSave = () => {
    if (!activeMap) return;
    const cleanedName = activeMap.name.trim() || 'Untitled night route';
    const next = { ...activeMap, name: cleanedName, updatedAt: Date.now() };
    setDraft(next);
    saveCustomMap(next);
    setIsDirty(false);
    setNotice('Route saved to the computer.');
  };

  const handleDuplicate = () => {
    if (!activeMap) return;
    duplicateCustomMap(activeMap.id);
    setNotice('Route copied. The duplicate is ready to edit.');
  };

  const handleDelete = () => {
    if (!activeMap) return;
    if (!isDeleting) {
      setIsDeleting(true);
      return;
    }
    deleteCustomMap(activeMap.id);
    setIsDeleting(false);
    setNotice('Route removed from the archive.');
  };

  const handleLaunch = () => {
    if (!activeMap || validation.some((warning) => warning.startsWith('No enemy pressure'))) {
      setNotice('Add at least one enemy or encounter before launch.');
      return;
    }
    const next = { ...activeMap, name: activeMap.name.trim() || 'Untitled night route', updatedAt: Date.now() };
    saveCustomMap(next);
    setDraft(next);
    setIsDirty(false);
    onLaunch(next.id);
  };

  const placeAsset = (assetId: string) => {
    if (!activeMap) return;
    const asset = assetFromId(assetId);
    if (!asset) return;
    if (asset.category === 'ground') {
      const backdrop = asset.areaId ? AREAS.find((area) => area.id === asset.areaId)?.backdrop : undefined;
      updateDraft({ groundAssetId: asset.id, ...(backdrop ? { backdrop } : {}) });
      setNotice(`${asset.name} ground loaded.`);
      return;
    }
    if (asset.category === 'landmark') {
      updateDraft({ landmarkAssetId: activeMap.landmarkAssetId === asset.id ? null : asset.id });
      setNotice(activeMap.landmarkAssetId === asset.id ? 'Landmark cleared.' : `${asset.name} marked as the route landmark.`);
      return;
    }
    if (activeMap.placements.length >= MAX_CUSTOM_MAP_PLACEMENTS) {
      setNotice('Placement limit reached. Remove an item before adding another.');
      return;
    }
    const placement = newPlacement(asset.id, activeMap.placements.length + 1, activeMap);
    updateDraft({ placements: [...activeMap.placements, placement] });
    setSelectedPlacementId(placement.id);
  };

  const updatePlacement = (id: string, updates: Partial<CustomMapPlacement>) => {
    if (!activeMap) return;
    updateDraft({
      placements: activeMap.placements.map((placement) =>
        placement.id === id ? { ...placement, ...updates } : placement,
      ),
    });
  };

  const updateBounds = (axis: 'w' | 'h', rawValue: string) => {
    if (!activeMap) return;
    const nextValue = Number(rawValue);
    if (!Number.isFinite(nextValue)) return;
    const nextBounds = {
      ...activeMap.bounds,
      [axis]: clamp(nextValue, CUSTOM_MAP_MIN_BOUNDS[axis], CUSTOM_MAP_MAX_BOUNDS[axis]),
    };
    const placements = activeMap.placements.map((placement) => ({
      ...placement,
      x: clamp(placement.x, -nextBounds.w / 2 + placement.w / 2, nextBounds.w / 2 - placement.w / 2),
      y: clamp(placement.y, -nextBounds.h / 2 + placement.h / 2, nextBounds.h / 2 - placement.h / 2),
    }));
    updateDraft({ bounds: nextBounds, placements });
  };

  const removePlacement = () => {
    if (!activeMap || !selectedPlacementId) return;
    updateDraft({ placements: activeMap.placements.filter((placement) => placement.id !== selectedPlacementId) });
    setSelectedPlacementId(null);
    setNotice('Placement removed.');
  };

  const duplicatePlacement = () => {
    if (!activeMap || !selectedPlacement || activeMap.placements.length >= MAX_CUSTOM_MAP_PLACEMENTS) return;
    const copy = {
      ...selectedPlacement,
      id: `${selectedPlacement.id}-copy-${Date.now().toString(36)}`,
      x: snap(selectedPlacement.x + CUSTOM_MAP_GRID * 2),
      y: snap(selectedPlacement.y + CUSTOM_MAP_GRID * 2),
    };
    updateDraft({ placements: [...activeMap.placements, copy] });
    setSelectedPlacementId(copy.id);
    setNotice('Placement duplicated.');
  };

  const pointerPosition = (event: PointerEvent<HTMLElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || !activeMap) return null;
    const x = ((event.clientX - rect.left) / rect.width - 0.5) * activeMap.bounds.w;
    const y = ((event.clientY - rect.top) / rect.height - 0.5) * activeMap.bounds.h;
    return { x, y };
  };

  const handlePointerDown = (event: PointerEvent<HTMLElement>, placement: CustomMapPlacement) => {
    event.stopPropagation();
    const point = pointerPosition(event);
    if (!point) return;
    setSelectedPlacementId(placement.id);
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    setDragging({ id: placement.id, offsetX: point.x - placement.x, offsetY: point.y - placement.y });
  };

  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    if (!dragging || !activeMap) return;
    const point = pointerPosition(event);
    if (!point) return;
    const placement = activeMap.placements.find((item) => item.id === dragging.id);
    if (!placement) return;
    const x = clamp(point.x - dragging.offsetX, -activeMap.bounds.w / 2 + placement.w / 2, activeMap.bounds.w / 2 - placement.w / 2);
    const y = clamp(point.y - dragging.offsetY, -activeMap.bounds.h / 2 + placement.h / 2, activeMap.bounds.h / 2 - placement.h / 2);
    updatePlacement(dragging.id, { x: snapEnabled ? snap(x) : Math.round(x), y: snapEnabled ? snap(y) : Math.round(y) });
  };

  const endDrag = () => setDragging(null);

  const canvasStyle = activeMap
    ? {
        aspectRatio: `${activeMap.bounds.w} / ${activeMap.bounds.h}`,
        backgroundImage: `linear-gradient(${assetFromId(activeMap.groundAssetId)?.color ?? '#0b6b75'}26, rgba(6, 18, 25, .84)), url(${import.meta.env.BASE_URL}${activeMap.backdrop})`,
      }
    : undefined;

  return (
    <div className="min-h-[100dvh] overflow-x-hidden bg-[#071116] text-slate-100">
      <div className="pointer-events-none fixed inset-0 z-0 opacity-50" style={{ background: 'radial-gradient(circle at 80% 0%, rgba(21, 102, 112, .2), transparent 40%)' }} />
      <header className="relative z-10 border-b border-cyan-200/15 bg-[#0b171c]/95 px-4 py-4 shadow-[0_12px_50px_rgba(0,0,0,.22)] sm:px-7">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onBack}
              data-testid="button-map-computer-back"
              className="group flex items-center gap-2 border border-cyan-200/20 bg-cyan-100/[.03] px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[.2em] text-cyan-100/70 transition hover:border-cyan-200/50 hover:bg-cyan-100/[.08] hover:text-cyan-100"
            >
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
              Computer
            </button>
            <div className="hidden h-7 w-px bg-cyan-100/15 sm:block" />
            <div>
              <div className="flex items-center gap-2 font-mono text-[9px] font-bold uppercase tracking-[.28em] text-orange-300">
                <Database className="h-3.5 w-3.5" />
                Sanctum terminal · route lab
              </div>
              <h1 className="mt-1 text-2xl font-black uppercase leading-none tracking-tight text-slate-100 sm:text-3xl">616 / map builder</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-slate-400">
            <span className={`h-2 w-2 rounded-full ${isDirty ? 'bg-orange-300 shadow-[0_0_12px_rgba(253,186,116,.8)]' : 'bg-emerald-300'}`} />
            {isDirty ? 'unsaved changes' : 'archive synced'}
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto grid max-w-[1500px] gap-5 px-4 py-5 sm:px-7 lg:grid-cols-[240px_minmax(0,1fr)_300px]">
        <aside className="space-y-4">
          <div className="border border-cyan-100/15 bg-[#0c1a20]/90">
            <div className="flex items-center justify-between border-b border-cyan-100/10 px-4 py-3">
              <div>
                <p className="font-mono text-[9px] font-bold uppercase tracking-[.25em] text-cyan-200/60">Saved routes</p>
                 <p className="mt-1 text-xs text-slate-500">{maps.length} / {MAX_CUSTOM_MAPS} slots used</p>
              </div>
              <button
                type="button"
                onClick={handleCreate}
                data-testid="button-create-custom-map"
                className="grid h-8 w-8 place-items-center border border-orange-300/50 text-orange-200 transition hover:bg-orange-300 hover:text-[#091216]"
                title="Create new map"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[330px] overflow-y-auto p-2">
              {maps.length === 0 ? (
                <div className="m-2 border border-dashed border-cyan-100/15 px-3 py-5 text-center">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">No route records</p>
                  <button type="button" onClick={handleCreate} className="mt-3 text-[10px] font-bold uppercase tracking-widest text-orange-200 hover:text-orange-100">Start a route</button>
                </div>
              ) : maps.map((map) => (
                <button
                  type="button"
                  key={map.id}
                  onClick={() => selectMap(map)}
                  className={`mb-1 w-full border-l-2 px-3 py-3 text-left transition ${activeMapId === map.id ? 'border-orange-300 bg-orange-300/[.08]' : 'border-transparent hover:border-cyan-200/40 hover:bg-cyan-100/[.04]'}`}
                >
                  <span className="block truncate text-xs font-bold uppercase tracking-wide text-slate-200">{map.name}</span>
                  <span className="mt-1 block font-mono text-[9px] uppercase tracking-wider text-slate-500">{map.placements.length} objects · {formatAge(map.updatedAt)}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="border border-cyan-100/15 bg-[#0c1a20]/80 p-4">
            <div className="flex items-center gap-2 text-orange-200">
              <Grip className="h-4 w-4" />
              <p className="font-mono text-[10px] font-bold uppercase tracking-[.2em]">Field notes</p>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-slate-400">Click an asset to drop it at center. Drag any marker across the street plan. Coordinates lock to the {CUSTOM_MAP_GRID}px grid when snap is on.</p>
          </div>
        </aside>

        <section className="min-w-0 space-y-5">
          {!activeMap ? (
            <div className="grid min-h-[520px] place-items-center border border-dashed border-cyan-100/20 bg-[#0c1a20]/70 p-8 text-center">
              <div>
                <MapPinned className="mx-auto h-10 w-10 text-orange-200/70" />
                <h2 className="mt-4 text-xl font-black uppercase tracking-tight">The desk is clear</h2>
                <p className="mx-auto mt-2 max-w-sm text-sm text-slate-400">Create a route record and sketch a way through the district before nightfall.</p>
                <button type="button" onClick={handleCreate} data-testid="button-create-custom-map" className="mt-5 inline-flex items-center gap-2 bg-orange-300 px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-widest text-[#091216] transition hover:bg-orange-200"><Plus className="h-4 w-4" /> New route</button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-col justify-between gap-4 border-b border-cyan-100/15 pb-4 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1">
                  <label htmlFor="custom-map-name" className="font-mono text-[9px] font-bold uppercase tracking-[.25em] text-orange-200/80">Route name</label>
                  <input
                    id="custom-map-name"
                    data-testid="input-custom-map-name"
                    value={activeMap.name}
                    onChange={(event) => updateDraft({ name: event.target.value.slice(0, 48) })}
                    className="mt-1 block w-full border-0 border-b border-cyan-100/25 bg-transparent px-0 py-1 text-2xl font-black uppercase tracking-tight text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-orange-300 sm:text-3xl"
                    placeholder="Name this route"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={handleDuplicate} data-testid="button-duplicate-custom-map" className="inline-flex items-center gap-2 border border-cyan-100/20 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-300 transition hover:border-cyan-200/60 hover:text-cyan-100"><Copy className="h-3.5 w-3.5" /> Duplicate</button>
                  <button type="button" onClick={handleDelete} data-testid="button-delete-custom-map" className={`inline-flex items-center gap-2 border px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-widest transition ${isDeleting ? 'border-red-300 bg-red-300 text-[#1b1010]' : 'border-red-200/20 text-red-200/70 hover:border-red-200/60 hover:text-red-100'}`}><Trash2 className="h-3.5 w-3.5" /> {isDeleting ? 'Confirm delete' : 'Delete'}</button>
                  {isDeleting && <button type="button" onClick={() => setIsDeleting(false)} className="grid h-9 w-9 place-items-center border border-cyan-100/20 text-slate-400 hover:text-slate-100" aria-label="Cancel delete"><X className="h-4 w-4" /></button>}
                  <button type="button" onClick={handleSave} data-testid="button-save-custom-map" className="inline-flex items-center gap-2 bg-orange-300 px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-[#091216] transition hover:bg-orange-200"><Save className="h-3.5 w-3.5" /> Save route</button>
                </div>
              </div>

              <div
                ref={canvasRef}
                data-testid="custom-map-canvas"
                className="relative isolate mx-auto w-full max-w-[940px] touch-none overflow-hidden border border-cyan-100/25 bg-cover bg-center shadow-[0_20px_60px_rgba(0,0,0,.35)]"
                style={canvasStyle}
                onPointerMove={handlePointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onPointerDown={() => setSelectedPlacementId(null)}
              >
                <div className="pointer-events-none absolute inset-0 opacity-30" style={{ backgroundImage: `linear-gradient(rgba(132, 220, 226, .2) 1px, transparent 1px), linear-gradient(90deg, rgba(132, 220, 226, .2) 1px, transparent 1px)`, backgroundSize: `${(CUSTOM_MAP_GRID / activeMap.bounds.w) * 100}% ${(CUSTOM_MAP_GRID / activeMap.bounds.h) * 100}%` }} />
                <div className="pointer-events-none absolute inset-0 border-[12px] border-[#071116]/60" />
                <div className="pointer-events-none absolute left-4 top-4 border border-cyan-100/20 bg-[#071116]/70 px-2 py-1 font-mono text-[9px] uppercase tracking-[.2em] text-cyan-100/65">north / {activeMap.bounds.w} × {activeMap.bounds.h}</div>
                <div className="pointer-events-none absolute bottom-4 left-4 flex items-center gap-2 font-mono text-[9px] uppercase tracking-widest text-cyan-100/60"><Crosshair className="h-3 w-3" /> origin 0, 0</div>
                {activeMap.landmarkAssetId && (
                  <div className="pointer-events-none absolute left-1/2 top-1/2 z-[1] -translate-x-1/2 -translate-y-1/2 border border-dashed border-orange-200/45 px-5 py-3 font-mono text-[9px] uppercase tracking-[.2em] text-orange-100/75">
                    <MapPinned className="mx-auto mb-1 h-4 w-4" />
                    {assetFromId(activeMap.landmarkAssetId)?.name ?? 'Route landmark'}
                  </div>
                )}
                {activeMap.placements.map((placement) => {
                  const asset = assetFromId(placement.assetId);
                  if (!asset) return null;
                  const isSelected = placement.id === selectedPlacementId;
                  return (
                    <button
                      type="button"
                      key={placement.id}
                      data-testid="custom-map-placement"
                      onPointerDown={(event) => handlePointerDown(event, placement)}
                      onClick={(event) => { event.stopPropagation(); setSelectedPlacementId(placement.id); }}
                      className={`absolute z-10 flex -translate-x-1/2 -translate-y-1/2 touch-none items-center justify-center border text-center transition ${isSelected ? 'border-orange-200 bg-orange-200/25 shadow-[0_0_0_2px_rgba(253,186,116,.3)]' : 'border-cyan-100/60 bg-[#071116]/75 hover:border-cyan-100'}`}
                      style={{ left: `${((placement.x / activeMap.bounds.w) + .5) * 100}%`, top: `${((placement.y / activeMap.bounds.h) + .5) * 100}%`, width: `${(placement.w / activeMap.bounds.w) * 100}%`, height: `${(placement.h / activeMap.bounds.h) * 100}%`, minWidth: 34, minHeight: 30, color: asset.color }}
                      title={`${asset.name} · ${displayCoordinate(placement.x)}, ${displayCoordinate(placement.y)}`}
                    >
                      <span className="pointer-events-none max-w-full truncate px-1 font-mono text-[8px] font-bold uppercase leading-tight">{asset.name}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border border-cyan-100/15 bg-[#0c1a20]/70 px-4 py-3">
                <div className="flex items-center gap-5 font-mono text-[10px] uppercase tracking-widest text-slate-400">
                  <span><strong className="text-slate-100">{activeMap.placements.length}</strong> / {MAX_CUSTOM_MAP_PLACEMENTS} objects</span>
                  <span className="hidden text-cyan-100/50 sm:inline">grid {CUSTOM_MAP_GRID}px</span>
                  <label className="flex cursor-pointer items-center gap-2 text-cyan-100/70">
                    <input type="checkbox" checked={snapEnabled} onChange={(event) => setSnapEnabled(event.target.checked)} className="accent-orange-300" />
                    Snap
                  </label>
                </div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-orange-200/70">{activeMap.threat} threat · {activeMap.durationSec}s route</div>
              </div>
            </>
          )}
        </section>

        <aside className="min-w-0 space-y-4">
          {activeMap && (
            <>
              <section className="border border-cyan-100/15 bg-[#0c1a20]/90">
                <div className="border-b border-cyan-100/10 px-4 py-3">
                  <p className="font-mono text-[9px] font-bold uppercase tracking-[.25em] text-cyan-200/60">Route controls</p>
                  <p className="mt-1 text-xs text-slate-500">Tune the conditions before you draw.</p>
                </div>
                <div className="space-y-4 p-4">
                  <div>
                    <label htmlFor="custom-map-search" className="font-mono text-[9px] font-bold uppercase tracking-[.2em] text-slate-400">Asset feed</label>
                    <div className="relative mt-2">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                      <input id="custom-map-search" data-testid="input-custom-map-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search the city index" className="w-full border border-cyan-100/15 bg-[#071116] py-2 pl-9 pr-3 font-mono text-[10px] uppercase tracking-wider text-slate-200 outline-none placeholder:text-slate-600 focus:border-orange-300/70" />
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="font-mono text-[9px] font-bold uppercase tracking-[.2em] text-slate-400">Plan dimensions</p>
                      <span className="font-mono text-[9px] uppercase tracking-wider text-slate-600">world units</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="border border-cyan-100/10 bg-[#071116] px-2 py-1.5">
                        <span className="block font-mono text-[8px] uppercase tracking-widest text-slate-600">width</span>
                        <input type="number" min={CUSTOM_MAP_MIN_BOUNDS.w} max={CUSTOM_MAP_MAX_BOUNDS.w} step={CUSTOM_MAP_GRID} value={activeMap.bounds.w} onChange={(event) => updateBounds('w', event.target.value)} className="mt-1 w-full bg-transparent font-mono text-xs text-slate-200 outline-none" />
                      </label>
                      <label className="border border-cyan-100/10 bg-[#071116] px-2 py-1.5">
                        <span className="block font-mono text-[8px] uppercase tracking-widest text-slate-600">height</span>
                        <input type="number" min={CUSTOM_MAP_MIN_BOUNDS.h} max={CUSTOM_MAP_MAX_BOUNDS.h} step={CUSTOM_MAP_GRID} value={activeMap.bounds.h} onChange={(event) => updateBounds('h', event.target.value)} className="mt-1 w-full bg-transparent font-mono text-xs text-slate-200 outline-none" />
                      </label>
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="font-mono text-[9px] font-bold uppercase tracking-[.2em] text-slate-400">Duration</p>
                      <span className="font-mono text-xs font-bold text-orange-200">{activeMap.durationSec}s</span>
                    </div>
                    <input type="range" min="60" max="600" step="10" value={activeMap.durationSec} onChange={(event) => updateDraft({ durationSec: Number(event.target.value) })} className="w-full accent-orange-300" />
                    <div className="mt-1 flex justify-between font-mono text-[8px] uppercase text-slate-600"><span>60 sec</span><span>10 min</span></div>
                  </div>
                  <div>
                    <p className="mb-2 font-mono text-[9px] font-bold uppercase tracking-[.2em] text-slate-400">Threat profile</p>
                    <div className="grid grid-cols-2 gap-1">
                      {THREAT_OPTIONS.map((option) => (
                        <button type="button" key={option.value} onClick={() => updateDraft({ threat: option.value })} className={`border px-2 py-2 text-left transition ${activeMap.threat === option.value ? 'border-orange-300 bg-orange-300/[.1] text-orange-100' : 'border-cyan-100/10 text-slate-500 hover:border-cyan-100/30 hover:text-slate-300'}`}>
                          <span className="block font-mono text-[9px] font-bold uppercase tracking-widest">{option.label}</span>
                          <span className="mt-1 block text-[9px] leading-tight opacity-70">{option.detail}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              <section className="border border-cyan-100/15 bg-[#0c1a20]/90">
                <div className="border-b border-cyan-100/10 px-4 py-3">
                  <p className="font-mono text-[9px] font-bold uppercase tracking-[.25em] text-cyan-200/60">Asset index</p>
                  <p className="mt-1 text-xs text-slate-500">Settings load instantly. Objects drop on the plan.</p>
                </div>
                <div className="max-h-[430px] overflow-y-auto p-2">
                  {CUSTOM_MAP_ASSET_CATEGORIES.map((category) => {
                    const assets = filteredAssets.filter((asset) => asset.category === category.id);
                    if (assets.length === 0) return null;
                    const Icon = CATEGORY_ICONS[category.id] ?? Box;
                    const isOpen = openCategories[category.id] ?? true;
                    return (
                      <div key={category.id} className="mb-1">
                        <button type="button" onClick={() => setOpenCategories((current) => ({ ...current, [category.id]: !isOpen }))} className="flex w-full items-center justify-between px-2 py-2 text-left hover:bg-cyan-100/[.04]">
                          <span className="flex items-center gap-2 font-mono text-[9px] font-bold uppercase tracking-[.15em] text-slate-400"><Icon className="h-3.5 w-3.5 text-orange-200/70" /> {category.label}</span>
                          {isOpen ? <ChevronUp className="h-3.5 w-3.5 text-slate-600" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-600" />}
                        </button>
                        {isOpen && assets.map((asset) => {
                          const isSetting = asset.category === 'ground' || asset.category === 'landmark';
                          const isActiveSetting = asset.category === 'ground'
                            ? activeMap.groundAssetId === asset.id
                            : activeMap.landmarkAssetId === asset.id;
                          return (
                            <button
                              type="button"
                              key={asset.id}
                              data-testid={`button-place-${asset.id}`}
                              onClick={() => placeAsset(asset.id)}
                              className={`group mb-1 flex w-full items-center gap-2 border px-2 py-2 text-left transition ${isActiveSetting ? 'border-orange-300/60 bg-orange-300/[.08]' : 'border-transparent bg-[#071116]/45 hover:border-cyan-100/25 hover:bg-cyan-100/[.05]'}`}
                            >
                              <span className="grid h-7 w-7 shrink-0 place-items-center border border-current/30 bg-[#071116]/70" style={{ color: asset.color }}><span className="h-2 w-2 rounded-full bg-current shadow-[0_0_10px_currentColor]" /></span>
                              <span className="min-w-0 flex-1"><span className="block truncate text-[10px] font-bold uppercase text-slate-200">{asset.name}</span><span className="mt-0.5 block truncate text-[9px] text-slate-500">{asset.description}</span></span>
                              {isSetting ? <span className="font-mono text-[8px] uppercase tracking-wider text-orange-200/60">{isActiveSetting ? <Check className="h-3.5 w-3.5" /> : 'set'}</span> : <Plus className="h-3.5 w-3.5 shrink-0 text-slate-600 transition group-hover:text-orange-200" />}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                  {filteredAssets.length === 0 && <p className="p-6 text-center font-mono text-[10px] uppercase tracking-widest text-slate-500">No matching assets</p>}
                </div>
              </section>

              <section className="border border-cyan-100/15 bg-[#0c1a20]/90 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-mono text-[9px] font-bold uppercase tracking-[.25em] text-cyan-200/60">Selected signal</p>
                    <p className="mt-1 text-sm font-black uppercase text-slate-100">{selectedPlacement ? assetFromId(selectedPlacement.assetId)?.name : 'Nothing selected'}</p>
                  </div>
                  {selectedPlacement && <span className="h-2 w-2 rounded-full bg-orange-300 shadow-[0_0_12px_rgba(253,186,116,.8)]" />}
                </div>
                {selectedPlacement ? (
                  <>
                    <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-[9px] uppercase tracking-wider text-slate-500">
                      <span>x <strong className="text-slate-200">{displayCoordinate(selectedPlacement.x)}</strong></span>
                      <span>y <strong className="text-slate-200">{displayCoordinate(selectedPlacement.y)}</strong></span>
                      <span>w <strong className="text-slate-200">{selectedPlacement.w}</strong></span>
                      <span>h <strong className="text-slate-200">{selectedPlacement.h}</strong></span>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <button type="button" onClick={duplicatePlacement} data-testid="button-duplicate-placement" className="flex flex-1 items-center justify-center gap-2 border border-cyan-100/20 py-2 font-mono text-[9px] font-bold uppercase tracking-widest text-slate-300 transition hover:border-cyan-100/50 hover:text-cyan-100"><Copy className="h-3.5 w-3.5" /> Clone</button>
                      <button type="button" onClick={removePlacement} data-testid="button-delete-placement" className="flex flex-1 items-center justify-center gap-2 border border-red-200/20 py-2 font-mono text-[9px] font-bold uppercase tracking-widest text-red-200/75 transition hover:border-red-200/60 hover:text-red-100"><Trash2 className="h-3.5 w-3.5" /> Remove</button>
                    </div>
                  </>
                ) : <p className="mt-3 text-xs leading-relaxed text-slate-500">Select a marker on the street plan to inspect its position or move it.</p>}
              </section>

              <section className="border border-orange-200/20 bg-orange-200/[.04] p-4">
                <div className="flex items-center gap-2 text-orange-200"><AlertTriangle className="h-4 w-4" /><p className="font-mono text-[9px] font-bold uppercase tracking-[.2em]">Preflight</p></div>
                {validation.length > 0 ? <ul className="mt-3 space-y-2">{validation.map((warning) => <li key={warning} className="flex gap-2 text-[10px] leading-relaxed text-orange-100/75"><Minus className="mt-0.5 h-3 w-3 shrink-0" />{warning}</li>)}</ul> : <p className="mt-3 flex items-center gap-2 text-[10px] text-emerald-200"><Check className="h-3.5 w-3.5" /> Route has the minimum signals for launch.</p>}
                 <button type="button" onClick={handleLaunch} disabled={validation.some((warning) => warning.startsWith('No enemy pressure'))} data-testid="button-launch-custom-map" className="mt-4 flex w-full items-center justify-center gap-2 bg-orange-300 py-3 font-mono text-[10px] font-bold uppercase tracking-widest text-[#091216] transition hover:bg-orange-200 disabled:cursor-not-allowed disabled:opacity-40"><Upload className="h-3.5 w-3.5" /> Launch route</button>
              </section>
            </>
          )}
        </aside>
      </main>
      {notice && <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 border border-cyan-100/30 bg-[#0b171c] px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-widest text-cyan-100 shadow-[0_12px_35px_rgba(0,0,0,.35)]"><Check className="h-4 w-4 text-emerald-300" /> {notice}</div>}
    </div>
  );
}

export default MapBuilder;