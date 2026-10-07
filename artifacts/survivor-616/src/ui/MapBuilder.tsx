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
  customMapValidationIssues,
  areaToCustomMapTemplate,
  generateCustomMap,
  normalizePersonalPrefabs,
} from '@/game/data/customMaps';
import { expandMapPrefab, MAP_PREFABS, MAP_PROP_ART_BY_ID, type MapPrefab } from '@/game/data/mapPack';
import { drawMapPackProp } from '@/game/render/mapPackArt';
import { AREAS } from '@/game/data/areas';
import { useMeta } from '@/game/state/metaStore';
import type { CustomMap, CustomMapPlacement } from '@/game/types';
import { MapLivePreview } from './MapLivePreview';

interface MapBuilderProps {
  onBack: () => void;
  onLaunch: (mapId: string) => void;
}

type PlacementCategory = CustomMapPlacement['category'];

const CATEGORY_ICONS: Record<string, typeof Box> = {
  ground: Layers3,
  tile: Grip,
  beacon: Radio,
  structure: Box,
  hazard: AlertTriangle,
  landmark: MapPinned,
  enemy: Swords,
  encounter: Radio,
  'spawn-point': Crosshair,
  'objective-marker': MapPinned,
  pickup: Plus,
  interactable: Radio,
  ambiance: Layers3,
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
    mode: asset?.defaultMode,
  };
}

function AssetThumbnail({ artId, color, category }: { artId?: string; color: string; category: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const art = artId ? MAP_PROP_ART_BY_ID[artId] : undefined;
    const context = canvas?.getContext('2d');
    if (!canvas || !context || !art) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.save();
    context.translate(24, 20);
    const scale = Math.min(32 / art.w, 32 / art.h);
    context.scale(scale, scale);
    drawMapPackProp(context, artId!, 0, 0, art.w, art.h, 0, 0);
    context.restore();
  }, [artId]);
  const Icon = CATEGORY_ICONS[category] ?? Box;
  return artId ? <canvas ref={ref} width={48} height={40} className="h-9 w-10 shrink-0" aria-hidden /> : <span className="grid h-9 w-10 shrink-0 place-items-center border border-current/30 bg-[#071116]/70" style={{ color }}><Icon className="h-4 w-4" /></span>;
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
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [undoStack, setUndoStack] = useState<CustomMap[]>([]);
  const [redoStack, setRedoStack] = useState<CustomMap[]>([]);
  const [zoom, setZoom] = useState(1);
  const [gridVisible, setGridVisible] = useState(true);
  const [seed, setSeed] = useState('616');
  const [prefabName, setPrefabName] = useState('');
  const [remixTheme, setRemixTheme] = useState<'street' | 'null' | 'breach'>('breach');
  const [personalPrefabs, setPersonalPrefabs] = useState<MapPrefab[]>(() => {
    try { return normalizePersonalPrefabs(JSON.parse(localStorage.getItem('survivor616-map-prefabs-v1') ?? '[]')); } catch { return []; }
  });
  const [snapEnabled, setSnapEnabled] = useState(true);
  // Draw the draft through the real game renderer behind the (still
  // draggable) placement markers, so authors can see the actual map.
  const [livePreview, setLivePreview] = useState(true);
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({
    ground: true,
    tile: true,
    beacon: true,
    structure: true,
    hazard: true,
    landmark: true,
    enemy: true,
    encounter: true,
    'spawn-point': true,
    'objective-marker': true,
    pickup: true,
    interactable: true,
    ambiance: true,
  });
  const [notice, setNotice] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [dragging, setDragging] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const knownMapIds = useRef(new Set(maps.map((map) => map.id)));
  useEffect(() => { try { localStorage.setItem('survivor616-map-prefabs-v1', JSON.stringify(personalPrefabs)); } catch { setNotice('Prefab storage is full. Remove older groups.'); } }, [personalPrefabs]);

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
      setSelectedIds([]);
      setUndoStack([]);
      setRedoStack([]);
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
    return customMapValidationIssues(activeMap);
  }, [activeMap]);

  const updateDraft = (updates: Partial<CustomMap>) => {
    if (!activeMap) return;
    setUndoStack((history) => [...history.slice(-39), activeMap]);
    setRedoStack([]);
    setDraft({ ...activeMap, ...updates, updatedAt: Date.now() });
    setIsDirty(true);
  };

  const undo = () => {
    const previous = undoStack.at(-1);
    if (!previous || !activeMap) return;
    setRedoStack((history) => [...history, activeMap]); setUndoStack((history) => history.slice(0, -1)); setDraft(previous); setIsDirty(true);
  };
  const redo = () => {
    const next = redoStack.at(-1);
    if (!next || !activeMap) return;
    setUndoStack((history) => [...history, activeMap]); setRedoStack((history) => history.slice(0, -1)); setDraft(next); setIsDirty(true);
  };

  const selectMap = (map: CustomMap) => {
    setActiveMapId(map.id);
    setDraft(map);
    setSelectedPlacementId(null);
    setSelectedIds([]);
    setUndoStack([]);
    setRedoStack([]);
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
    if (!activeMap || validation.length) {
      setNotice(validation[0] ?? 'Route cannot launch.');
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
    if (asset.category === 'ambiance') {
      updateDraft({ ambiance: asset.id.slice('ambiance:'.length) as CustomMap['ambiance'] });
      setNotice(`${asset.name} applied.`);
      return;
    }
    if (activeMap.placements.length >= MAX_CUSTOM_MAP_PLACEMENTS) {
      setNotice('Placement limit reached. Remove an item before adding another.');
      return;
    }
    const placement = newPlacement(asset.id, activeMap.placements.length + 1, activeMap);
    updateDraft({ placements: [...activeMap.placements, placement] });
    setSelectedPlacementId(placement.id);
    setSelectedIds([placement.id]);
  };

  const placePrefab = (prefab: MapPrefab) => {
    if (!activeMap) return;
    const groupId = `group-${Date.now().toString(36)}`;
    const pieces = expandMapPrefab(prefab, { x: 0, y: 0 }, groupId);
    if (activeMap.placements.length + pieces.length > MAX_CUSTOM_MAP_PLACEMENTS) { setNotice('Not enough placement slots for this group.'); return; }
    updateDraft({ placements: [...activeMap.placements, ...pieces] });
    setSelectedIds(pieces.map((piece) => piece.id)); setSelectedPlacementId(pieces[0]?.id ?? null);
  };

  const selectedGroup = activeMap?.placements.filter((placement) => selectedIds.includes(placement.id)) ?? [];
  const transformGroup = (kind: 'rotate' | 'duplicate' | 'ungroup') => {
    if (!activeMap || !selectedGroup.length) return;
    if (kind === 'ungroup') { updateDraft({ placements: activeMap.placements.map((piece) => selectedIds.includes(piece.id) ? { ...piece, groupId: undefined } : piece) }); return; }
    const cx = selectedGroup.reduce((sum, piece) => sum + piece.x, 0) / selectedGroup.length;
    const cy = selectedGroup.reduce((sum, piece) => sum + piece.y, 0) / selectedGroup.length;
    if (kind === 'rotate') {
      updateDraft({ placements: activeMap.placements.map((piece) => selectedIds.includes(piece.id) ? { ...piece, x: snap(cx - (piece.y - cy)), y: snap(cy + (piece.x - cx)), w: piece.h, h: piece.w } : piece) });
    } else {
      if (activeMap.placements.length + selectedGroup.length > MAX_CUSTOM_MAP_PLACEMENTS) return;
      const groupId = `group-${Date.now().toString(36)}`;
      const copies = selectedGroup.map((piece, index) => ({ ...piece, id: `${groupId}-${index}`, groupId, x: piece.x + 40, y: piece.y + 40 }));
      updateDraft({ placements: [...activeMap.placements, ...copies] }); setSelectedIds(copies.map((piece) => piece.id)); setSelectedPlacementId(copies[0]?.id ?? null);
    }
  };
  const groupSelection = () => {
    if (!activeMap || selectedIds.length < 2) return;
    const groupId = `group-${Date.now().toString(36)}`;
    updateDraft({ placements: activeMap.placements.map((piece) => selectedIds.includes(piece.id) ? { ...piece, groupId } : piece) });
  };
  const saveGroup = () => {
    if (!selectedGroup.length) return;
    const cx = selectedGroup.reduce((sum, piece) => sum + piece.x, 0) / selectedGroup.length;
    const cy = selectedGroup.reduce((sum, piece) => sum + piece.y, 0) / selectedGroup.length;
    const id = `personal-${Date.now().toString(36)}`;
    const prefab: MapPrefab = { id, name: prefabName.trim() || `Group ${personalPrefabs.length + 1}`, theme: selectedGroup.some((piece) => piece.assetId.includes('root') || piece.assetId.includes('resin')) ? 'null' : 'street', pieces: selectedGroup.slice(0, 20).map((piece) => ({ assetId: piece.assetId, category: piece.category, x: Math.round(piece.x - cx), y: Math.round(piece.y - cy), w: piece.w, h: piece.h, mode: piece.mode, fromSec: piece.fromSec, toSec: piece.toSec, ratePerSec: piece.ratePerSec, burst: piece.burst })) };
    setPersonalPrefabs((items) => normalizePersonalPrefabs([prefab, ...items])); setNotice('Group saved to your prefab library.');
    setPrefabName('');
  };

  const loadTemplate = (areaId: string) => {
    if (!activeMap) return;
    const area = AREAS.find((candidate) => candidate.id === areaId);
    if (!area) return;
    const next = areaToCustomMapTemplate(area, activeMap.id);
    updateDraft({ ...next, name: `${area.name} draft` }); setSelectedIds([]); setSelectedPlacementId(null);
  };
  const remix = () => {
    if (!activeMap) return;
    updateDraft(generateCustomMap(seed || '616', remixTheme, activeMap.id)); setSelectedIds([]); setSelectedPlacementId(null);
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
    if (event.shiftKey || event.ctrlKey) setSelectedIds((ids) => ids.includes(placement.id) ? ids.filter((id) => id !== placement.id) : [...ids, placement.id]);
    else if (!selectedIds.includes(placement.id)) setSelectedIds(placement.groupId ? activeMap?.placements.filter((piece) => piece.groupId === placement.groupId).map((piece) => piece.id) ?? [placement.id] : [placement.id]);
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
    const nextX = clamp(snapEnabled ? snap(x) : Math.round(x), -activeMap.bounds.w / 2 + placement.w / 2, activeMap.bounds.w / 2 - placement.w / 2);
    const nextY = clamp(snapEnabled ? snap(y) : Math.round(y), -activeMap.bounds.h / 2 + placement.h / 2, activeMap.bounds.h / 2 - placement.h / 2);
    const dx = nextX - placement.x; const dy = nextY - placement.y;
    if (dx || dy) updateDraft({ placements: activeMap.placements.map((piece) => (piece.id === dragging.id || selectedIds.includes(piece.id)) ? { ...piece, x: clamp(piece.x + dx, -activeMap.bounds.w / 2 + piece.w / 2, activeMap.bounds.w / 2 - piece.w / 2), y: clamp(piece.y + dy, -activeMap.bounds.h / 2 + piece.h / 2, activeMap.bounds.h / 2 - piece.h / 2) } : piece) });
  };

  const endDrag = () => setDragging(null);

  const canvasStyle = activeMap
    ? {
        aspectRatio: `${activeMap.bounds.w} / ${activeMap.bounds.h}`,
        backgroundImage: `linear-gradient(${assetFromId(activeMap.groundAssetId)?.color ?? '#0b6b75'}26, rgba(6, 18, 25, .84)), url(${import.meta.env.BASE_URL}${activeMap.backdrop})`,
      }
    : undefined;

  return (
    <div data-ui-theme={meta.uiTheme} className="min-h-[100dvh] overflow-x-hidden bg-[#071116] text-slate-100">
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

              <div className="max-h-[760px] overflow-auto">
              <div
                ref={canvasRef}
                data-testid="custom-map-canvas"
                className="relative isolate mx-auto touch-none overflow-hidden border border-cyan-100/25 bg-cover bg-center shadow-[0_20px_60px_rgba(0,0,0,.35)]"
                style={{ ...canvasStyle, width: `${zoom * 100}%`, minWidth: 360 }}
                onPointerMove={handlePointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onPointerDown={() => { setSelectedPlacementId(null); setSelectedIds([]); }}
              >
                {livePreview && <MapLivePreview map={activeMap} />}
                {gridVisible && <div className="pointer-events-none absolute inset-0 z-[1] opacity-30" style={{ backgroundImage: `linear-gradient(rgba(132, 220, 226, .2) 1px, transparent 1px), linear-gradient(90deg, rgba(132, 220, 226, .2) 1px, transparent 1px)`, backgroundSize: `${(CUSTOM_MAP_GRID / activeMap.bounds.w) * 100}% ${(CUSTOM_MAP_GRID / activeMap.bounds.h) * 100}%` }} />}
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
                  const isSelected = selectedIds.includes(placement.id);
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
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border border-cyan-100/15 bg-[#0c1a20]/70 px-4 py-3">
                <div className="flex items-center gap-5 font-mono text-[10px] uppercase tracking-widest text-slate-400">
                  <span><strong className="text-slate-100">{activeMap.placements.length}</strong> / {MAX_CUSTOM_MAP_PLACEMENTS} objects</span>
                  <span className="hidden text-cyan-100/50 sm:inline">grid {CUSTOM_MAP_GRID}px</span>
                  <label className="flex cursor-pointer items-center gap-2 text-cyan-100/70">
                    <input type="checkbox" checked={snapEnabled} onChange={(event) => setSnapEnabled(event.target.checked)} className="accent-orange-300" />
                    Snap
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-cyan-100/70" title="Draw the route through the real game renderer instead of flat boxes">
                    <input type="checkbox" checked={livePreview} onChange={(event) => setLivePreview(event.target.checked)} className="accent-orange-300" data-testid="toggle-live-preview" />
                    Live art
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-cyan-100/70"><input type="checkbox" checked={gridVisible} onChange={(event) => setGridVisible(event.target.checked)} className="accent-orange-300" /> Grid</label>
                  <button type="button" onClick={undo} disabled={!undoStack.length} className="disabled:opacity-30">Undo</button>
                  <button type="button" onClick={redo} disabled={!redoStack.length} className="disabled:opacity-30">Redo</button>
                  <label className="flex items-center gap-2">Zoom <input aria-label="Map zoom" type="range" min="1" max="2.5" step="0.25" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} className="w-20 accent-orange-300" /></label>
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
                  <div className="space-y-2 border-b border-cyan-100/10 pb-4">
                    <p className="font-mono text-[9px] font-bold uppercase tracking-[.2em] text-slate-400">Start from a finished map</p>
                    <select aria-label="Map template" defaultValue="" onChange={(event) => { if (event.target.value) loadTemplate(event.target.value); event.target.value = ''; }} className="w-full border border-cyan-100/15 bg-[#071116] p-2 text-xs text-slate-100"><option value="">Choose a template</option><option value="floodline-breach">Floodline Breach</option><option value="glassroot-annex">Glassroot Annex</option></select>
                    <div className="flex gap-1"><select aria-label="Remix theme" value={remixTheme} onChange={(event) => setRemixTheme(event.target.value as typeof remixTheme)} className="border border-cyan-100/15 bg-[#071116] p-2 text-xs"><option value="street">Street</option><option value="null">Null</option><option value="breach">Breach</option></select><input aria-label="Remix seed" value={seed} onChange={(event) => setSeed(event.target.value)} className="min-w-0 flex-1 border border-cyan-100/15 bg-[#071116] p-2 text-xs" /><button type="button" onClick={remix} className="bg-orange-300 px-2 text-xs font-bold text-[#091216]">Generate</button></div>
                  </div>
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

              <section className="border border-cyan-100/15 bg-[#0c1a20]/90 p-4">
                <p className="font-mono text-[9px] font-bold uppercase tracking-[.25em] text-cyan-200/60">Encounter timeline</p>
                <div className="mt-2 flex justify-between font-mono text-[8px] text-slate-500"><span>0:00</span><span>{Math.floor(activeMap.durationSec / 60)}:{String(activeMap.durationSec % 60).padStart(2, '0')}</span></div>
                <div className="mt-2 max-h-40 space-y-2 overflow-y-auto">{activeMap.placements.filter((piece) => piece.category === 'enemy' || piece.category === 'encounter').sort((a, b) => (a.fromSec ?? 0) - (b.fromSec ?? 0)).map((piece) => <button type="button" key={piece.id} onClick={() => { setSelectedPlacementId(piece.id); setSelectedIds([piece.id]); }} className="w-full text-left text-[9px] text-slate-300"><span>{assetFromId(piece.assetId)?.name} · {piece.fromSec ?? 0}s–{piece.toSec ?? activeMap.durationSec}s</span><span className="mt-1 block h-1.5 bg-slate-800"><span className="block h-full bg-orange-300" style={{ marginLeft: `${((piece.fromSec ?? 0) / activeMap.durationSec) * 100}%`, width: `${(((piece.toSec ?? activeMap.durationSec) - (piece.fromSec ?? 0)) / activeMap.durationSec) * 100}%` }} /></span></button>)}{!activeMap.placements.some((piece) => piece.category === 'enemy' || piece.category === 'encounter') && <p className="text-[10px] text-slate-500">Place an enemy or encounter to schedule pressure.</p>}</div>
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
                          const isSetting = asset.category === 'ground' || asset.category === 'landmark' || asset.category === 'ambiance';
                          const isActiveSetting = asset.category === 'ground'
                            ? activeMap.groundAssetId === asset.id
                            : asset.category === 'ambiance' ? activeMap.ambiance === asset.id.slice('ambiance:'.length) : activeMap.landmarkAssetId === asset.id;
                          return (
                            <button
                              type="button"
                              key={asset.id}
                              data-testid={`button-place-${asset.id}`}
                              onClick={() => placeAsset(asset.id)}
                              className={`group mb-1 flex w-full items-center gap-2 border px-2 py-2 text-left transition ${isActiveSetting ? 'border-orange-300/60 bg-orange-300/[.08]' : 'border-transparent bg-[#071116]/45 hover:border-cyan-100/25 hover:bg-cyan-100/[.05]'}`}
                            >
                              <AssetThumbnail artId={asset.artAssetId} color={asset.color} category={asset.category} />
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
                <p className="font-mono text-[9px] font-bold uppercase tracking-[.25em] text-cyan-200/60">Prefab library</p>
                <p className="mt-1 text-xs text-slate-500">Place a group, then drag or rotate it as one.</p>
                <div className="mt-3 max-h-44 space-y-1 overflow-y-auto">{[...MAP_PREFABS, ...personalPrefabs].map((prefab) => <div key={prefab.id} className="flex items-center gap-1"><button type="button" onClick={() => placePrefab(prefab)} className="flex-1 border border-cyan-100/15 px-2 py-1 text-left text-[10px] uppercase text-slate-200 hover:border-orange-300">{prefab.name} <span className="text-slate-500">({prefab.pieces.length})</span></button>{prefab.id.startsWith('personal-') && <button type="button" aria-label={`Delete ${prefab.name}`} onClick={() => setPersonalPrefabs((items) => items.filter((item) => item.id !== prefab.id))} className="p-1 text-red-200"><Trash2 className="h-3 w-3" /></button>}</div>)}</div>
                <p className="mt-3 text-[10px] text-slate-500">Shift or Ctrl click to select several objects.</p>
                <input aria-label="Prefab name" value={prefabName} onChange={(event) => setPrefabName(event.target.value.slice(0, 40))} placeholder="Name your prefab" className="mt-2 w-full border border-cyan-100/15 bg-[#071116] p-2 text-xs" />
                <div className="mt-2 grid grid-cols-2 gap-1 text-[9px] uppercase"><button type="button" onClick={groupSelection} disabled={selectedIds.length < 2} className="border border-cyan-100/20 p-2 disabled:opacity-30">Group selection</button><button type="button" onClick={() => transformGroup('rotate')} disabled={!selectedIds.length} className="border border-cyan-100/20 p-2 disabled:opacity-30">Rotate 90°</button><button type="button" onClick={() => transformGroup('duplicate')} disabled={!selectedIds.length} className="border border-cyan-100/20 p-2 disabled:opacity-30">Duplicate group</button><button type="button" onClick={() => transformGroup('ungroup')} disabled={!selectedIds.length} className="border border-cyan-100/20 p-2 disabled:opacity-30">Ungroup</button><button type="button" onClick={saveGroup} disabled={!selectedIds.length} className="col-span-2 border border-orange-300/50 p-2 text-orange-200 disabled:opacity-30">Save prefab</button></div>
              </section>

              <section className="border border-cyan-100/15 bg-[#0c1a20]/90 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-mono text-[9px] font-bold uppercase tracking-[.25em] text-cyan-200/60">Selected route</p>
                    <p className="mt-1 text-sm font-black uppercase text-slate-100">{selectedPlacement ? assetFromId(selectedPlacement.assetId)?.name : 'Nothing selected'}</p>
                  </div>
                  {selectedPlacement && <span className="h-2 w-2 rounded-full bg-orange-300 shadow-[0_0_12px_rgba(253,186,116,.8)]" />}
                </div>
                {selectedPlacement ? (
                  <>
                    <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-[9px] uppercase tracking-wider text-slate-500">
                      {(['x', 'y', 'w', 'h'] as const).map((field) => (
                        <label key={field} className="border border-cyan-100/10 bg-[#071116] px-2 py-1.5">
                          <span className="block text-[8px] tracking-widest">{field}</span>
                          <input
                            type="number"
                            step={field === 'x' || field === 'y' ? CUSTOM_MAP_GRID : 4}
                            min={field === 'w' || field === 'h' ? 12 : undefined}
                            max={field === 'w' || field === 'h' ? (selectedPlacement.category === 'tile' ? activeMap.bounds[field] : 360) : undefined}
                            value={selectedPlacement[field]}
                            onChange={(event) => {
                              const value = Number(event.target.value);
                              if (Number.isFinite(value)) updatePlacement(selectedPlacement.id, { [field]: value });
                            }}
                            className="mt-1 w-full bg-transparent text-xs text-slate-200 outline-none"
                            aria-label={`Placement ${field}`}
                          />
                        </label>
                      ))}
                    </div>
                    {selectedPlacement.category === 'structure' && assetFromId(selectedPlacement.assetId)?.artAssetId && <label className="mt-3 block text-[10px] text-slate-400">Behavior<select aria-label="Prop behavior" value={selectedPlacement.mode ?? assetFromId(selectedPlacement.assetId)?.defaultMode ?? 'permanent'} onChange={(event) => updatePlacement(selectedPlacement.id, { mode: event.target.value as CustomMapPlacement['mode'] })} className="mt-1 w-full border border-cyan-100/20 bg-[#071116] p-2 text-slate-100">{MAP_PROP_ART_BY_ID[assetFromId(selectedPlacement.assetId)!.artAssetId!]?.modes.map((mode) => <option key={mode} value={mode}>{mode}</option>)}</select></label>}
                    {(selectedPlacement.category === 'enemy' || selectedPlacement.category === 'encounter') && <div className="mt-3 grid grid-cols-2 gap-2">{(['fromSec', 'toSec', 'ratePerSec', 'burst'] as const).map((field) => <label key={field} className="text-[9px] uppercase text-slate-400">{field}<input type="number" aria-label={field} min={field === 'ratePerSec' ? 0.05 : field === 'burst' ? 1 : 0} max={field === 'burst' ? 12 : field === 'ratePerSec' ? 5 : activeMap.durationSec} step={field === 'ratePerSec' ? 0.05 : 1} value={selectedPlacement[field] ?? (field === 'toSec' ? activeMap.durationSec : field === 'ratePerSec' ? 0.65 : field === 'burst' ? 1 : 0)} onChange={(event) => updatePlacement(selectedPlacement.id, { [field]: Number(event.target.value) })} className="mt-1 w-full border border-cyan-100/20 bg-[#071116] p-1 text-slate-100" /></label>)}</div>}
                    <div className="mt-4 flex gap-2">
                      <button type="button" onClick={duplicatePlacement} data-testid="button-duplicate-placement" className="flex flex-1 items-center justify-center gap-2 border border-cyan-100/20 py-2 font-mono text-[9px] font-bold uppercase tracking-widest text-slate-300 transition hover:border-cyan-100/50 hover:text-cyan-100"><Copy className="h-3.5 w-3.5" /> Clone</button>
                      <button type="button" onClick={removePlacement} data-testid="button-delete-placement" className="flex flex-1 items-center justify-center gap-2 border border-red-200/20 py-2 font-mono text-[9px] font-bold uppercase tracking-widest text-red-200/75 transition hover:border-red-200/60 hover:text-red-100"><Trash2 className="h-3.5 w-3.5" /> Remove</button>
                    </div>
                  </>
                ) : <p className="mt-3 text-xs leading-relaxed text-slate-500">Select a marker on the street plan to inspect its position or move it.</p>}
              </section>

              <section className="border border-orange-200/20 bg-orange-200/[.04] p-4">
                <div className="flex items-center gap-2 text-orange-200"><AlertTriangle className="h-4 w-4" /><p className="font-mono text-[9px] font-bold uppercase tracking-[.2em]">Preflight</p></div>
                {validation.length > 0 ? <ul className="mt-3 space-y-2">{validation.map((warning) => <li key={warning} className="flex gap-2 text-[10px] leading-relaxed text-orange-100/75"><Minus className="mt-0.5 h-3 w-3 shrink-0" />{warning}</li>)}</ul> : <p className="mt-3 flex items-center gap-2 text-[10px] text-emerald-200"><Check className="h-3.5 w-3.5" /> Route has the minimum checkpoints for launch.</p>}
                 <button type="button" onClick={handleLaunch} disabled={validation.length > 0} data-testid="button-launch-custom-map" className="mt-4 flex w-full items-center justify-center gap-2 bg-orange-300 py-3 font-mono text-[10px] font-bold uppercase tracking-widest text-[#091216] transition hover:bg-orange-200 disabled:cursor-not-allowed disabled:opacity-40"><Upload className="h-3.5 w-3.5" /> Playtest route</button>
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
