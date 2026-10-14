import { useEffect, useMemo, useRef, useState } from 'react';
import { CLIPS, DIRECTIONS, REQUIRED_FRAMES, RIG_FAMILIES, STYLE_FAMILIES, STUDIO_SIZE, approvalCount, approveStudioClip, approveStudioFrame, copyStudioClipToDirections, copyStudioFrameToClip, editStudioAppearance, editStudioFrame, generateBlankStudioProject, generateStudioProject, paintStudioBrush, paintStudioLine, projectFromForgedOperator, studioErrors, transformStudioPixel, type ClipName, type Direction, type StudioProject } from '@/game/studio/v3Project';
import type { ForgedOperator } from '@/game/data/operatorForge';
import { listStudioDrafts, saveStudioDraft } from '@/game/studio/v3Store';
import { lokClient } from '@/lib/lokClient';
import { useAuth } from '@/state/authStore';
import { CommunityGalleryV3 } from './CommunityGalleryV3';

type Tool = 'pen' | 'erase' | 'fill' | 'select';
const CONTROL = 'min-h-10 border border-border bg-background px-3 py-2 text-xs text-white hover:border-primary disabled:opacity-40';
const PIXEL_SCALE = 10;
interface ActiveStroke {
  pointerId: number;
  working: StudioProject;
  last: [number, number];
  direction: Direction;
  clip: ClipName;
  frameIndex: number;
  layerId: string;
  color: number;
  size: number;
  erase: boolean;
}

function paint(canvas: HTMLCanvasElement, project: StudioProject, direction: Direction, clip: ClipName, frameIndex: number, onion: boolean, grid: boolean) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  canvas.width = STUDIO_SIZE * PIXEL_SCALE;
  canvas.height = STUDIO_SIZE * PIXEL_SCALE;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const frames = project.views[direction][clip];
  const draw = (index: number, alpha: number) => {
    const frame = frames[index];
    if (!frame) return;
    ctx.globalAlpha = alpha;
    for (const layer of [...project.layers].sort((a, b) => a.order - b.order)) {
      if (!layer.visible) continue;
      for (const [x, y, color] of frame.layers[layer.id] ?? []) {
        ctx.fillStyle = project.palette[color] ?? '#ffffff';
        const [px, py] = transformStudioPixel(frame, layer, x, y);
        ctx.fillRect(px * PIXEL_SCALE, py * PIXEL_SCALE, PIXEL_SCALE, PIXEL_SCALE);
      }
    }
  };
  if (onion && frameIndex > 0) draw(frameIndex - 1, 0.2);
  draw(frameIndex, 1);
  if (grid) {
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let index = 0; index <= STUDIO_SIZE; index++) {
      const position = index * PIXEL_SCALE + 0.5;
      ctx.moveTo(position, 0); ctx.lineTo(position, canvas.height);
      ctx.moveTo(0, position); ctx.lineTo(canvas.width, position);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

export function CharacterStudioV3({ operatorSources, enemySources, v2Operators }: { operatorSources: { id: string; name: string }[]; enemySources: { id: string; name: string }[]; v2Operators: ForgedOperator[] }) {
  const { session } = useAuth();
  const [project, setProject] = useState<StudioProject | null>(null);
  const [drafts, setDrafts] = useState<StudioProject[]>([]);
  const [cloudDrafts, setCloudDrafts] = useState<{ project: StudioProject; revision: number }[]>([]);
  const [kind, setKind] = useState<'operator' | 'enemy'>('operator');
  const [sourceId, setSourceId] = useState(operatorSources[0]?.id ?? '');
  const [seed, setSeed] = useState('616');
  const [prompt, setPrompt] = useState('');
  const [rigFamily, setRigFamily] = useState<(typeof RIG_FAMILIES)[number]>('humanoid');
  const [styleFamily, setStyleFamily] = useState<(typeof STYLE_FAMILIES)[number]>('creepy');
  const [direction, setDirection] = useState<Direction>('S');
  const [clip, setClip] = useState<ClipName>('idle');
  const [frameIndex, setFrameIndex] = useState(0);
  const [layerId, setLayerId] = useState('layer-0');
  const [color, setColor] = useState(3);
  const [brushSize, setBrushSize] = useState(1);
  const [pixelX, setPixelX] = useState(0);
  const [pixelY, setPixelY] = useState(0);
  const [grid, setGrid] = useState(true);
  const [tool, setTool] = useState<Tool>('pen');
  const [selection, setSelection] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [onion, setOnion] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [layerNameDraft, setLayerNameDraft] = useState('');
  const [past, setPast] = useState<StudioProject[]>([]);
  const [future, setFuture] = useState<StudioProject[]>([]);
  const canvas = useRef<HTMLCanvasElement>(null);
  const activeStroke = useRef<ActiveStroke | null>(null);
  const selectionPointer = useRef<number | null>(null);
  const sources = kind === 'operator' ? operatorSources : enemySources;
  const selectedLayerName = project?.layers.find((layer) => layer.id === layerId)?.name ?? '';
  const errors = useMemo(() => project ? studioErrors(project) : [], [project]);
  const approvedFrames = useMemo(() => project ? approvalCount(project) : 0, [project]);
  const complete = errors.length === 0 && approvedFrames === REQUIRED_FRAMES;

  useEffect(() => { setLayerNameDraft(selectedLayerName); }, [layerId, selectedLayerName]);

  useEffect(() => { listStudioDrafts().then(setDrafts).catch(() => setMessage('IndexedDB is unavailable on this device.')); }, []);
  useEffect(() => {
    if (!lokClient || !session) { setCloudDrafts([]); return; }
    void lokClient.from('gsix_studio_drafts').select('project,revision').eq('owner_id', session.user.id).then(({ data }) => {
      if (data) setCloudDrafts(data as { project: StudioProject; revision: number }[]);
    });
  }, [session?.user.id]);
  useEffect(() => {
    if (!canvas.current || !project) return;
    paint(canvas.current, project, direction, clip, frameIndex, onion, grid);
    if (selection) {
      const ctx = canvas.current.getContext('2d');
      if (ctx) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]); ctx.strokeRect(Math.min(selection.x0, selection.x1) * PIXEL_SCALE + 1, Math.min(selection.y0, selection.y1) * PIXEL_SCALE + 1, (Math.abs(selection.x1 - selection.x0) + 1) * PIXEL_SCALE - 2, (Math.abs(selection.y1 - selection.y0) + 1) * PIXEL_SCALE - 2); ctx.setLineDash([]); }
    }
  }, [project, direction, clip, frameIndex, onion, grid, selection]);
  useEffect(() => {
    if (!playing || !project || document.hidden) return;
    const ms = project.views[direction][clip][frameIndex]?.ms ?? 130;
    const timer = window.setTimeout(() => setFrameIndex((index) => (index + 1) % CLIPS[clip]), ms);
    return () => window.clearTimeout(timer);
  }, [playing, project, direction, clip, frameIndex]);

  function change(next: StudioProject) { if (project) setPast((items) => [...items.slice(-19), project]); setFuture([]); setProject(next); }
  function openProject(next: StudioProject, note?: string) {
    activeStroke.current = null; selectionPointer.current = null; setPlaying(false);
    setProject(next); setPast([]); setFuture([]); setSelection(null);
    setDirection('S'); setClip('idle'); setFrameIndex(0); setLayerId(next.layers[0]?.id ?? 'layer-0');
    if (note) setMessage(note);
  }
  function create(blank = false) {
    if (!sourceId) { setMessage('Choose an unlocked source first.'); return; }
    const options = { id: crypto.randomUUID(), kind, sourceId, seed, prompt, rigFamily, styleFamily };
    const next = blank ? generateBlankStudioProject(options) : generateStudioProject(options);
    openProject(next, blank ? 'Blank 48 × 48 project ready. Draw one pose, then copy it into the other frames and directions.' : 'Generated frames are editable. Review and approve every frame before use.');
  }
  async function save(): Promise<boolean> {
    if (!project) return false;
    setSaving(true);
    try {
      try { await saveStudioDraft(project); setDrafts(await listStudioDrafts()); }
      catch { setMessage('Could not save this draft on this device.'); return false; }
      if (lokClient && session) {
        const existing = cloudDrafts.find((draft) => draft.project.id === project.id);
        const { data, error } = await lokClient.rpc('gsix_save_studio_draft', { p_project: project, p_expected_revision: existing?.revision ?? null });
        if (error) { setMessage(`Saved on this device. Account sync: ${error.message}`); return false; }
        const revision = Number((data as { revision?: number })?.revision ?? 1);
        setCloudDrafts((items) => [...items.filter((draft) => draft.project.id !== project.id), { project, revision }]);
        setMessage(complete ? 'Saved to your account. Creator badge and mailbox message are ready.' : 'Saved on this device and your account.');
      } else setMessage(session ? 'Draft saved on this device. Account sync is waiting for the shared connection.' : 'Draft saved on this device. Sign in to sync it.');
      return true;
    } catch (error) {
      setMessage(`Saved on this device. Account sync: ${error instanceof Error ? error.message : 'Connection failed'}`);
      return false;
    } finally { setSaving(false); }
  }
  async function submit() {
    if (!project || !complete || !lokClient || !session || submitting) return;
    setSubmitting(true);
    try {
      if (!await save()) return;
      const { error } = await lokClient.rpc('gsix_submit_creation', { p_draft_id: project.id, p_description: project.prompt });
      setMessage(error ? `Submission failed: ${error.message}` : 'Submitted for staff review. After approval, this creation can appear in the Survivor 616 and GSix community galleries.');
    } catch (error) { setMessage(`Submission failed: ${error instanceof Error ? error.message : 'Connection failed'}`); }
    finally { setSubmitting(false); }
  }
  function rotate(step: number) { setDirection(DIRECTIONS[(DIRECTIONS.indexOf(direction) + step + 8) % 8]!); }
  function moveLayer(dx: number, dy: number) { if (!project) return; change(editStudioFrame(project, direction, clip, frameIndex, (frame) => { const [x, y] = frame.offsets[layerId] ?? [0, 0]; frame.offsets[layerId] = [x + dx, y + dy]; })); }
  function rotateLayer(degrees: number) { if (!project) return; change(editStudioFrame(project, direction, clip, frameIndex, (frame) => { frame.rotations ??= {}; frame.rotations[layerId] = (frame.rotations[layerId] ?? 0) + degrees; })); }
  function changePivot(axis: 0 | 1, value: number) {
    if (!project || !Number.isFinite(value)) return;
    change(editStudioAppearance(project, (draft) => {
      const layer = draft.layers.find((item) => item.id === layerId);
      if (layer) layer.pivot[axis] = Math.max(0, Math.min(STUDIO_SIZE - 1, Math.round(value)));
    }));
  }
  function addLayer() {
    if (!project || project.layers.length >= 16) return;
    const id = `layer-${crypto.randomUUID()}`;
    change(editStudioAppearance(project, (draft) => {
      draft.layers.push({ id, name: `Layer ${draft.layers.length + 1}`, pivot: [24, 24], order: draft.layers.length, visible: true });
      for (const view of DIRECTIONS) for (const animation of Object.keys(CLIPS) as ClipName[]) for (const frame of draft.views[view][animation]) frame.layers[id] = [];
    }));
    setLayerId(id);
  }
  function renameLayer() {
    if (!project) return;
    const name = layerNameDraft.trim().slice(0, 32);
    if (!name || name === selectedLayerName) { setLayerNameDraft(selectedLayerName); return; }
    change(editStudioAppearance(project, (draft) => { const layer = draft.layers.find((item) => item.id === layerId); if (layer) layer.name = name; }));
  }
  function reorderLayer(step: number) {
    if (!project) return;
    const sorted = [...project.layers].sort((a, b) => a.order - b.order);
    const index = sorted.findIndex((layer) => layer.id === layerId);
    const neighbor = sorted[index + step];
    if (!neighbor) return;
    change(editStudioAppearance(project, (draft) => {
      const first = draft.layers.find((layer) => layer.id === layerId)!;
      const second = draft.layers.find((layer) => layer.id === neighbor.id)!;
      [first.order, second.order] = [second.order, first.order];
    }));
  }
  function removeLayer() {
    if (!project || project.layers.length <= 1) return;
    change(editStudioAppearance(project, (draft) => {
      draft.layers = draft.layers.filter((layer) => layer.id !== layerId);
      for (const view of DIRECTIONS) for (const animation of Object.keys(CLIPS) as ClipName[]) for (const frame of draft.views[view][animation]) {
        delete frame.layers[layerId]; delete frame.offsets[layerId];
        if (frame.rotations) delete frame.rotations[layerId];
      }
    }));
    setLayerId(project.layers.find((layer) => layer.id !== layerId)!.id);
  }
  function pointAt(target: HTMLCanvasElement, clientX: number, clientY: number): [number, number] | null {
    const bounds = target.getBoundingClientRect();
    const x = clientX - bounds.left; const y = clientY - bounds.top;
    if (x < 0 || y < 0 || x >= bounds.width || y >= bounds.height) return null;
    return [Math.floor(x * STUDIO_SIZE / bounds.width), Math.floor(y * STUDIO_SIZE / bounds.height)];
  }
  function brushOrigin(position: [number, number], size = brushSize): [number, number] {
    const maxOrigin = STUDIO_SIZE - size;
    return [
      Math.max(0, Math.min(maxOrigin, position[0] - Math.floor(size / 2))),
      Math.max(0, Math.min(maxOrigin, position[1] - Math.floor(size / 2))),
    ];
  }
  function beginStroke(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!project || activeStroke.current || selectionPointer.current !== null) return;
    const position = pointAt(event.currentTarget, event.clientX, event.clientY);
    if (!position) return;
    const actualTool = event.button === 2 || (event.pointerType === 'pen' && (event.button === 5 || (event.buttons & 32) !== 0)) ? 'erase' : tool;
    if (actualTool === 'select') {
      selectionPointer.current = event.pointerId;
      event.currentTarget.setPointerCapture(event.pointerId);
      setSelection({ x0: position[0], y0: position[1], x1: position[0], y1: position[1] });
      return;
    }
    const [left, top] = brushOrigin(position);
    setPixelX(left); setPixelY(top);
    if (actualTool === 'fill') { applyAt(position[0], position[1]); return; }
    if (!project.layers.find((layer) => layer.id === layerId)?.visible) { setMessage('Show this layer before drawing on it.'); return; }
    setPlaying(false);
    const working = editStudioFrame(project, direction, clip, frameIndex, (frame) => paintStudioBrush(frame, layerId, left, top, color, brushSize, actualTool === 'erase'));
    activeStroke.current = { pointerId: event.pointerId, working, last: [left, top], direction, clip, frameIndex, layerId, color, size: brushSize, erase: actualTool === 'erase' };
    event.currentTarget.setPointerCapture(event.pointerId);
    paint(event.currentTarget, working, direction, clip, frameIndex, onion, grid);
  }
  function extendStroke(event: React.PointerEvent<HTMLCanvasElement>) {
    const stroke = activeStroke.current;
    if (!stroke || stroke.pointerId !== event.pointerId) return;
    const coalesced = event.nativeEvent.getCoalescedEvents?.();
    const samples = coalesced?.length ? coalesced : [event.nativeEvent];
    let changed = false;
    for (const sample of samples) {
      const position = pointAt(event.currentTarget, sample.clientX, sample.clientY);
      if (!position) continue;
      const [left, top] = brushOrigin(position, stroke.size);
      if (left === stroke.last[0] && top === stroke.last[1]) continue;
      paintStudioLine(stroke.working.views[stroke.direction][stroke.clip][stroke.frameIndex]!, stroke.layerId, stroke.last[0], stroke.last[1], left, top, stroke.color, stroke.size, stroke.erase);
      stroke.last = [left, top]; changed = true;
    }
    if (changed) {
      setPixelX(stroke.last[0]); setPixelY(stroke.last[1]);
      paint(event.currentTarget, stroke.working, stroke.direction, stroke.clip, stroke.frameIndex, onion, grid);
    }
  }
  function finishStroke(event: React.PointerEvent<HTMLCanvasElement>) {
    if (selectionPointer.current === event.pointerId) { selectionPointer.current = null; return; }
    const stroke = activeStroke.current;
    if (!stroke || stroke.pointerId !== event.pointerId) return;
    extendStroke(event);
    activeStroke.current = null;
    change(stroke.working);
  }
  function moveSelection(dx: number, dy: number) {
    if (!project || !selection) return;
    const x0 = Math.min(selection.x0, selection.x1); const x1 = Math.max(selection.x0, selection.x1);
    const y0 = Math.min(selection.y0, selection.y1); const y1 = Math.max(selection.y0, selection.y1);
    change(editStudioFrame(project, direction, clip, frameIndex, (frame) => {
      frame.layers[layerId] = (frame.layers[layerId] ?? []).map(([x, y, color]) => x >= x0 && x <= x1 && y >= y0 && y <= y1 ? [Math.max(0, Math.min(47, x + dx)), Math.max(0, Math.min(47, y + dy)), color] : [x, y, color]);
    }));
    setSelection({ x0: x0 + dx, x1: x1 + dx, y0: y0 + dy, y1: y1 + dy });
  }
  function applyAt(x: number, y: number) {
    if (!project) return;
    if (tool === 'select') return;
    const current = project.views[direction][clip][frameIndex]?.layers[layerId] ?? [];
    if (tool === 'pen' || tool === 'erase') {
      const size = tool === 'pen' || tool === 'erase' ? brushSize : 1;
      const touched: [number, number][] = [];
      for (let py = y; py < y + size && py < STUDIO_SIZE; py++) for (let px = x; px < x + size && px < STUDIO_SIZE; px++) if (px >= 0 && py >= 0) touched.push([px, py]);
      if (touched.length && touched.every(([px, py]) => tool === 'pen'
        ? current.some((pixel) => pixel[0] === px && pixel[1] === py && pixel[2] === color)
        : !current.some((pixel) => pixel[0] === px && pixel[1] === py))) return;
    }
    change(editStudioFrame(project, direction, clip, frameIndex, (frame) => {
      const pixels = frame.layers[layerId] ?? [];
      if (tool === 'fill') {
        const map = new Map(pixels.map((pixel) => [`${pixel[0]},${pixel[1]}`, pixel[2]]));
        const target = map.get(`${x},${y}`) ?? -1;
        const queue: [number, number][] = [[x, y]];
        const visited = new Set<string>();
        while (queue.length && visited.size < 2304) {
          const [px, py] = queue.pop()!; const key = `${px},${py}`;
          if (px < 0 || py < 0 || px >= 48 || py >= 48 || visited.has(key) || (map.get(key) ?? -1) !== target) continue;
          visited.add(key); map.set(key, color);
          queue.push([px - 1, py], [px + 1, py], [px, py - 1], [px, py + 1]);
        }
        frame.layers[layerId] = [...map.entries()].map(([key, value]) => { const [px, py] = key.split(',').map(Number); return [px!, py!, value]; });
      } else paintStudioBrush(frame, layerId, x, y, color, brushSize, tool === 'erase');
    }));
  }
  if (!project) return <section className="mt-5 space-y-4 border border-border bg-card p-4" data-testid="studio-v3">
    <h2 className="text-xl font-black">Character Studio v3</h2>
    <p className="text-sm text-muted-foreground">Eight-direction layered pixel art. Original Forge designs and share codes remain available in their tabs.</p>
    <div className="flex flex-wrap gap-2"><select aria-label="Kind" className={CONTROL} value={kind} onChange={(event) => { const next = event.target.value as typeof kind; setKind(next); setSourceId((next === 'operator' ? operatorSources : enemySources)[0]?.id ?? ''); }}><option value="operator">Operator</option><option value="enemy">Enemy appearance</option></select>
      <select aria-label="Source" className={CONTROL} value={sourceId} onChange={(event) => setSourceId(event.target.value)}>{sources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}</select>
      <select aria-label="Rig family" className={CONTROL} value={rigFamily} onChange={(event) => setRigFamily(event.target.value as typeof rigFamily)}>{RIG_FAMILIES.map((family) => <option key={family}>{family}</option>)}</select>
      <select aria-label="Style family" className={CONTROL} value={styleFamily} onChange={(event) => setStyleFamily(event.target.value as typeof styleFamily)}>{STYLE_FAMILIES.map((style) => <option key={style}>{style}</option>)}</select></div>
    <div className="flex flex-wrap gap-2"><input aria-label="Seed" className={CONTROL} value={seed} onChange={(event) => setSeed(event.target.value)} /><input aria-label="Prompt choices" placeholder="Optional curated prompt" className={CONTROL} value={prompt} onChange={(event) => setPrompt(event.target.value)} /><button type="button" className={CONTROL} onClick={() => create()}>Generate editable project</button><button type="button" className={CONTROL} onClick={() => create(true)}>Start with blank canvas</button></div>
    {drafts.length > 0 && <div><h3 className="font-bold">Device drafts</h3>{drafts.map((draft) => <button key={draft.id} type="button" className={CONTROL} onClick={() => { openProject(draft); setKind(draft.kind); setSourceId(draft.sourceId); }}>{draft.name} · {approvalCount(draft)}/{REQUIRED_FRAMES}</button>)}</div>}
    {v2Operators.length > 0 && <div><h3 className="font-bold">Start from a Forge v1/v2 operator</h3>{v2Operators.map((operator) => <button key={operator.id} type="button" className={CONTROL} onClick={() => { openProject(projectFromForgedOperator(operator, crypto.randomUUID()), 'Copied into a new v3 draft. Your original Forge design stays saved.'); }}>{operator.name}</button>)}</div>}
    {cloudDrafts.length > 0 && <div><h3 className="font-bold">Account drafts</h3>{cloudDrafts.map(({ project: draft }) => <button key={draft.id} type="button" className={CONTROL} onClick={() => { openProject(draft); setKind(draft.kind); setSourceId(draft.sourceId); }}>{draft.name} · {approvalCount(draft)}/{REQUIRED_FRAMES}</button>)}</div>}
    <CommunityGalleryV3 onRemix={(draft) => { openProject(draft, 'Remix draft opened. Review all 192 frames before publishing.'); setKind(draft.kind); setSourceId(draft.sourceId); }} />
    {message && <p role="status">{message}</p>}
  </section>;
  const current = project.views[direction][clip][frameIndex]!;
  return <section className="mt-5 space-y-4 border border-border bg-card p-4" data-testid="studio-v3-editor">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-black">Character Studio v3</h2><button type="button" className={CONTROL} onClick={() => { activeStroke.current = null; selectionPointer.current = null; setProject(null); setPast([]); setFuture([]); setSelection(null); setPlaying(false); }}>All drafts</button></div>
    <input aria-label="Creation name" className={CONTROL} value={project.name} onChange={(event) => change({ ...project, name: event.target.value, approvalState: 'draft' })} />
    <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={project.remixAllowed} onChange={(event) => change({ ...project, remixAllowed: event.target.checked })} />Allow adopters to remix this creation with credit to you</label>
    {project.parentRevisionId && <p className="text-xs text-muted-foreground">Remix of reviewed revision {project.parentRevisionId.slice(0, 8)}. The original creator will be credited.</p>}
    <p className="text-sm">{approvedFrames}/{REQUIRED_FRAMES} frames approved. {complete ? 'Ready to submit for staff review.' : 'Private draft.'}</p>
    <div className="flex flex-wrap items-center gap-2"><button type="button" className={CONTROL} onClick={() => rotate(-1)} aria-label="Previous direction">←</button><strong>{direction}</strong><button type="button" className={CONTROL} onClick={() => rotate(1)} aria-label="Next direction">→</button>
      <select aria-label="Animation" className={CONTROL} value={clip} onChange={(event) => { setClip(event.target.value as ClipName); setFrameIndex(0); }}>{Object.keys(CLIPS).map((name) => <option key={name}>{name}</option>)}</select>
      <button type="button" className={CONTROL} onClick={() => setPlaying(!playing)}>{playing ? 'Pause' : 'Play preview'}</button><label className="text-xs"><input type="checkbox" checked={onion} onChange={(event) => setOnion(event.target.checked)} /> Onion skin</label></div>
    <div className="flex flex-wrap gap-4"><div className="w-full max-w-96"><div className="flex justify-between text-[10px] text-muted-foreground"><span>Y ↓</span><span>X → 0 · 8 · 16 · 24 · 32 · 40 · 47</span></div><canvas ref={canvas} className="aspect-square w-full border border-border bg-[#161622] [image-rendering:pixelated] touch-none cursor-crosshair" onContextMenu={(event) => event.preventDefault()} onPointerDown={beginStroke} onPointerMove={(event) => { if (activeStroke.current?.pointerId === event.pointerId) { extendStroke(event); return; } const position = pointAt(event.currentTarget, event.clientX, event.clientY); if (selectionPointer.current === event.pointerId && position) setSelection((current) => current ? { ...current, x1: position[0], y1: position[1] } : null); else if (position) { const [left, top] = brushOrigin(position); setPixelX(left); setPixelY(top); } }} onPointerUp={finishStroke} onPointerCancel={finishStroke} onLostPointerCapture={finishStroke} aria-label="48 by 48 pixel art map. Draw with touch, mouse, or pen. X and Y run from 0 to 47." role="application" /><p className="text-[10px] text-muted-foreground">Draw with a finger, mouse, or pen. Right click or use a stylus eraser to erase. Each stroke is one undo step.</p></div>
      <div className="space-y-3"><div className="flex flex-wrap gap-1">{(['pen', 'erase', 'fill', 'select'] as Tool[]).map((name) => <button key={name} type="button" aria-pressed={tool === name} className={CONTROL} onClick={() => setTool(name)}>{name}</button>)}</div>
        <div className="space-y-2 border border-border p-2"><p className="text-xs font-bold">Pixel map · 48 × 48</p><p className="text-[10px] text-muted-foreground">Top-left origin · X across, Y down · coordinates 0–47</p><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={grid} onChange={(event) => setGrid(event.target.checked)} />Show pixel grid</label><div className="flex gap-2"><label className="text-xs">X<input aria-label="Pixel X" type="number" min={0} max={47} className={`${CONTROL} w-20`} value={pixelX} onChange={(event) => setPixelX(Math.max(0, Math.min(47, Number(event.target.value) || 0)))} /></label><label className="text-xs">Y<input aria-label="Pixel Y" type="number" min={0} max={47} className={`${CONTROL} w-20`} value={pixelY} onChange={(event) => setPixelY(Math.max(0, Math.min(47, Number(event.target.value) || 0)))} /></label><button type="button" className={CONTROL} onClick={() => applyAt(pixelX, pixelY)}>Place at XY</button></div><label className="block text-xs">Brush size · {brushSize}px<input aria-label="Brush size" type="range" min={1} max={8} value={brushSize} onChange={(event) => setBrushSize(Number(event.target.value))} className="block w-full" /><span className="text-muted-foreground">1 px detail · 4 px recommended · 8 px max</span></label></div>
        <div className="space-y-2"><p className="text-xs font-bold">16-color palette</p><div className="grid grid-cols-8 gap-1">{project.palette.map((value, index) => <button key={index} type="button" aria-label={`Color ${index + 1}`} aria-pressed={color === index} onClick={() => setColor(index)} style={{ background: value }} className="h-8 w-8 border-2 border-white/30 aria-pressed:border-white" />)}</div><label className="flex items-center gap-2 text-xs">Edit color {color + 1}<input aria-label="Edit selected color" type="color" value={project.palette[color]} onChange={(event) => change(editStudioAppearance(project, (draft) => { draft.palette[color] = event.target.value; }))} /></label><p className="text-[10px] text-muted-foreground">Changing a color updates every frame and clears frame approvals.</p></div>
        <div className="space-y-1"><div className="flex items-center gap-2"><p className="text-xs font-bold">Layers · {project.layers.length}/16</p><button type="button" className={CONTROL} disabled={project.layers.length >= 16} onClick={addLayer}>Add layer</button></div>{[...project.layers].sort((a, b) => b.order - a.order).map((layer) => <div key={layer.id} className="flex items-center gap-1"><button type="button" className={CONTROL} aria-pressed={layerId === layer.id} onClick={() => setLayerId(layer.id)}>{layer.name}</button><button type="button" className={CONTROL} aria-label={`${layer.visible ? 'Hide' : 'Show'} ${layer.name}`} onClick={() => change(editStudioAppearance(project, (draft) => { draft.layers.find((item) => item.id === layer.id)!.visible = !layer.visible; }))}>{layer.visible ? '👁' : 'Show'}</button></div>)}<label className="block text-xs">Selected layer name<input aria-label="Selected layer name" className={CONTROL} maxLength={32} value={layerNameDraft} onChange={(event) => setLayerNameDraft(event.target.value)} onBlur={renameLayer} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} /></label><div className="flex flex-wrap gap-1"><button type="button" className={CONTROL} onClick={() => reorderLayer(1)}>Move layer up</button><button type="button" className={CONTROL} onClick={() => reorderLayer(-1)}>Move layer down</button><button type="button" className={CONTROL} onClick={() => change(editStudioFrame(project, direction, clip, frameIndex, (frame) => { frame.layers[layerId] = []; }))}>Clear layer in frame</button><button type="button" className={CONTROL} disabled={project.layers.length <= 1} onClick={removeLayer}>Remove layer</button></div><div><button type="button" className={CONTROL} onClick={() => moveLayer(-1, 0)}>Layer ←</button><button type="button" className={CONTROL} onClick={() => moveLayer(1, 0)}>Layer →</button><button type="button" className={CONTROL} onClick={() => moveLayer(0, -1)}>Layer ↑</button><button type="button" className={CONTROL} onClick={() => moveLayer(0, 1)}>Layer ↓</button><button type="button" className={CONTROL} onClick={() => rotateLayer(-15)}>Rotate ↶</button><button type="button" className={CONTROL} onClick={() => rotateLayer(15)}>Rotate ↷</button></div>
          <div className="flex gap-2">{([0, 1] as const).map((axis) => <label key={axis} className="text-xs">Pivot {axis ? 'Y' : 'X'}<input type="number" className={CONTROL} value={project.layers.find((layer) => layer.id === layerId)?.pivot[axis] ?? 24} onChange={(event) => changePivot(axis, Number(event.target.value))} /></label>)}</div>
          {selection && <div><p className="text-xs">Selection {Math.abs(selection.x1 - selection.x0) + 1} × {Math.abs(selection.y1 - selection.y0) + 1}</p><button type="button" className={CONTROL} onClick={() => moveSelection(-1, 0)}>←</button><button type="button" className={CONTROL} onClick={() => moveSelection(1, 0)}>→</button><button type="button" className={CONTROL} onClick={() => moveSelection(0, -1)}>↑</button><button type="button" className={CONTROL} onClick={() => moveSelection(0, 1)}>↓</button></div>}
        </div>
      </div></div>
    <div className="flex flex-wrap items-center gap-1" aria-label="Frame timeline">{project.views[direction][clip].map((frame, index) => <button key={index} type="button" className={CONTROL} aria-pressed={frameIndex === index} onClick={() => setFrameIndex(index)}>{index + 1}{frame.approved ? ' ✓' : ''}</button>)}<button type="button" className={CONTROL} title={`Replace the other ${CLIPS[clip] - 1} frames in this ${clip} clip with frame ${frameIndex + 1}. Their timing stays the same and they need review.`} onClick={() => change(copyStudioFrameToClip(project, direction, clip, frameIndex))}>Copy frame to {clip}</button><button type="button" className={CONTROL} title={`Replace the ${clip} clip in the other seven directions with this ${direction} clip. Copied frames need review.`} onClick={() => change(copyStudioClipToDirections(project, direction, clip))}>Copy {clip} to all directions</button></div>
    <div className="flex flex-wrap gap-2"><label className="text-xs">Frame milliseconds <input type="number" min={30} max={1000} className={CONTROL} value={current.ms} onChange={(event) => change(editStudioFrame(project, direction, clip, frameIndex, (frame) => { frame.ms = Number(event.target.value); }))} /></label>
      <button type="button" className={CONTROL} onClick={() => change(approveStudioFrame(project, direction, clip, frameIndex))}>Approve this frame</button><button type="button" className={CONTROL} onClick={() => change(approveStudioClip(project, direction, clip))}>Approve {direction} {clip} clip</button>
      <button type="button" className={CONTROL} disabled={!past.length} onClick={() => { const previous = past.at(-1)!; setPast(past.slice(0, -1)); setFuture([...future, project]); setProject(previous); }}>Undo</button>
      <button type="button" className={CONTROL} disabled={!future.length} onClick={() => { const next = future.at(-1)!; setFuture(future.slice(0, -1)); setPast([...past, project]); setProject(next); }}>Redo</button>
      <button type="button" className={CONTROL} disabled={saving || submitting} onClick={() => { void save(); }}>{saving ? 'Saving…' : 'Save draft'}</button>
      <button type="button" className={CONTROL} disabled={!complete || !session || !lokClient || saving || submitting} onClick={() => { void submit(); }}>{submitting ? 'Submitting…' : 'Submit for review'}</button></div>
    {!session && <p className="text-xs text-muted-foreground">Sign in to sync a draft and submit it for staff review. Device drafts can be saved now.</p>}
    {errors.map((error) => <p key={error} className="text-xs text-red-300">{error}</p>)}{message && <p role="status" className="text-xs">{message}</p>}
  </section>;
}
