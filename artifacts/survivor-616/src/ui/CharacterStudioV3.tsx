import { useEffect, useRef, useState } from 'react';
import { CLIPS, DIRECTIONS, REQUIRED_FRAMES, RIG_FAMILIES, STYLE_FAMILIES, STUDIO_SIZE, approvalCount, approveStudioFrame, editStudioFrame, generateStudioProject, isStudioComplete, projectFromForgedOperator, studioErrors, transformStudioPixel, type ClipName, type Direction, type StudioProject } from '@/game/studio/v3Project';
import type { ForgedOperator } from '@/game/data/operatorForge';
import { listStudioDrafts, saveStudioDraft } from '@/game/studio/v3Store';
import { lokClient } from '@/lib/lokClient';
import { useAuth } from '@/state/authStore';
import { CommunityGalleryV3 } from './CommunityGalleryV3';

type Tool = 'pen' | 'erase' | 'fill' | 'select';
const CONTROL = 'min-h-10 border border-border bg-background px-3 py-2 text-xs text-white hover:border-primary disabled:opacity-40';

function paint(canvas: HTMLCanvasElement, project: StudioProject, direction: Direction, clip: ClipName, frameIndex: number, onion: boolean) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  canvas.width = STUDIO_SIZE;
  canvas.height = STUDIO_SIZE;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, 48, 48);
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
        ctx.fillRect(px, py, 1, 1);
      }
    }
  };
  if (onion && frameIndex > 0) draw(frameIndex - 1, 0.2);
  draw(frameIndex, 1);
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
  const [tool, setTool] = useState<Tool>('pen');
  const [selection, setSelection] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [onion, setOnion] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [message, setMessage] = useState('');
  const [past, setPast] = useState<StudioProject[]>([]);
  const [future, setFuture] = useState<StudioProject[]>([]);
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const sources = kind === 'operator' ? operatorSources : enemySources;

  useEffect(() => { listStudioDrafts().then(setDrafts).catch(() => setMessage('IndexedDB is unavailable on this device.')); }, []);
  useEffect(() => {
    if (!lokClient || !session) { setCloudDrafts([]); return; }
    void lokClient.from('gsix_studio_drafts').select('project,revision').eq('owner_id', session.user.id).then(({ data }) => {
      if (data) setCloudDrafts(data as { project: StudioProject; revision: number }[]);
    });
  }, [session?.user.id]);
  useEffect(() => {
    if (!canvas.current || !project) return;
    paint(canvas.current, project, direction, clip, frameIndex, onion);
    if (selection) {
      const ctx = canvas.current.getContext('2d');
      if (ctx) { ctx.strokeStyle = '#ffffff'; ctx.setLineDash([2, 2]); ctx.strokeRect(Math.min(selection.x0, selection.x1) + 0.5, Math.min(selection.y0, selection.y1) + 0.5, Math.abs(selection.x1 - selection.x0) + 1, Math.abs(selection.y1 - selection.y0) + 1); ctx.setLineDash([]); }
    }
  }, [project, direction, clip, frameIndex, onion, selection]);
  useEffect(() => {
    if (!playing || !project || document.hidden) return;
    const ms = project.views[direction][clip][frameIndex]?.ms ?? 130;
    const timer = window.setTimeout(() => setFrameIndex((index) => (index + 1) % CLIPS[clip]), ms);
    return () => window.clearTimeout(timer);
  }, [playing, project, direction, clip, frameIndex]);

  function change(next: StudioProject) { if (project) setPast((items) => [...items.slice(-19), project]); setFuture([]); setProject(next); }
  function create() {
    if (!sourceId) { setMessage('Choose an unlocked source first.'); return; }
    const next = generateStudioProject({ id: crypto.randomUUID(), kind, sourceId, seed, prompt, rigFamily, styleFamily });
    setProject(next); setPast([]); setFuture([]); setFrameIndex(0); setMessage('Generated frames are editable. Review and approve every frame before use.');
  }
  async function save(): Promise<boolean> {
    if (!project) return false;
    try { await saveStudioDraft(project); setDrafts(await listStudioDrafts()); }
    catch { setMessage('Could not save this draft in IndexedDB.'); return false; }
    if (lokClient && session) {
      const existing = cloudDrafts.find((draft) => draft.project.id === project.id);
      const { data, error } = await lokClient.rpc('gsix_save_studio_draft', { p_project: project, p_expected_revision: existing?.revision ?? null });
      if (error) { setMessage(`Saved on this device. Account sync: ${error.message}`); return false; }
      const revision = Number((data as { revision?: number })?.revision ?? 1);
      setCloudDrafts((items) => [...items.filter((draft) => draft.project.id !== project.id), { project, revision }]);
      setMessage(isStudioComplete(project) ? 'Saved to your account. Creator badge and mailbox message are ready.' : 'Saved on this device and your account.');
    } else setMessage('Draft saved on this device. Sign in to sync it.');
    return true;
  }
  async function submit() {
    if (!project || !isStudioComplete(project) || !lokClient || !session) return;
    if (!await save()) return;
    const { error } = await lokClient.rpc('gsix_submit_creation', { p_draft_id: project.id, p_description: project.prompt });
    setMessage(error ? error.message : 'Immutable revision submitted for staff review.');
  }
  function rotate(step: number) { setDirection(DIRECTIONS[(DIRECTIONS.indexOf(direction) + step + 8) % 8]!); }
  function moveLayer(dx: number, dy: number) { if (!project) return; change(editStudioFrame(project, direction, clip, frameIndex, (frame) => { const [x, y] = frame.offsets[layerId] ?? [0, 0]; frame.offsets[layerId] = [x + dx, y + dy]; })); }
  function rotateLayer(degrees: number) { if (!project) return; change(editStudioFrame(project, direction, clip, frameIndex, (frame) => { frame.rotations ??= {}; frame.rotations[layerId] = (frame.rotations[layerId] ?? 0) + degrees; })); }
  function changePivot(axis: 0 | 1, value: number) {
    if (!project || !Number.isFinite(value)) return;
    const layers = project.layers.map((layer) => layer.id === layerId ? { ...layer, pivot: (axis === 0 ? [value, layer.pivot[1]] : [layer.pivot[0], value]) as [number, number] } : layer);
    const views = { ...project.views };
    for (const view of DIRECTIONS) {
      views[view] = { ...project.views[view] };
      for (const animation of Object.keys(CLIPS) as ClipName[]) views[view][animation] = project.views[view][animation].map((frame) => ({ ...frame, approved: false }));
    }
    change({ ...project, layers, views, approvalState: 'draft', revision: project.revision + 1 });
  }
  function point(event: React.PointerEvent<HTMLCanvasElement>): [number, number] {
    const bounds = event.currentTarget.getBoundingClientRect();
    return [Math.max(0, Math.min(47, Math.floor((event.clientX - bounds.left) * 48 / bounds.width))), Math.max(0, Math.min(47, Math.floor((event.clientY - bounds.top) * 48 / bounds.height)))];
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
  function applyPixel(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!project || !canvas.current || !drawing.current) return;
    const [x, y] = point(event);
    if (x < 0 || y < 0 || x >= 48 || y >= 48 || tool === 'select') return;
    const current = project.views[direction][clip][frameIndex]?.layers[layerId] ?? [];
    if (tool === 'pen' && current.some((pixel) => pixel[0] === x && pixel[1] === y && pixel[2] === color)) return;
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
      } else frame.layers[layerId] = [...pixels.filter((pixel) => pixel[0] !== x || pixel[1] !== y), ...(tool === 'pen' ? [[x, y, color] as [number, number, number]] : [])];
    }));
    if (tool === 'fill') drawing.current = false;
  }
  if (!project) return <section className="mt-5 space-y-4 border border-border bg-card p-4" data-testid="studio-v3">
    <h2 className="text-xl font-black">Character Studio v3</h2>
    <p className="text-sm text-muted-foreground">Eight-direction layered pixel art. Original Forge designs and share codes remain available in their tabs.</p>
    <div className="flex flex-wrap gap-2"><select aria-label="Kind" className={CONTROL} value={kind} onChange={(event) => { const next = event.target.value as typeof kind; setKind(next); setSourceId((next === 'operator' ? operatorSources : enemySources)[0]?.id ?? ''); }}><option value="operator">Operator</option><option value="enemy">Enemy appearance</option></select>
      <select aria-label="Source" className={CONTROL} value={sourceId} onChange={(event) => setSourceId(event.target.value)}>{sources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}</select>
      <select aria-label="Rig family" className={CONTROL} value={rigFamily} onChange={(event) => setRigFamily(event.target.value as typeof rigFamily)}>{RIG_FAMILIES.map((family) => <option key={family}>{family}</option>)}</select>
      <select aria-label="Style family" className={CONTROL} value={styleFamily} onChange={(event) => setStyleFamily(event.target.value as typeof styleFamily)}>{STYLE_FAMILIES.map((style) => <option key={style}>{style}</option>)}</select></div>
    <div className="flex flex-wrap gap-2"><input aria-label="Seed" className={CONTROL} value={seed} onChange={(event) => setSeed(event.target.value)} /><input aria-label="Prompt choices" placeholder="Optional curated prompt" className={CONTROL} value={prompt} onChange={(event) => setPrompt(event.target.value)} /><button type="button" className={CONTROL} onClick={create}>Generate editable project</button></div>
    {drafts.length > 0 && <div><h3 className="font-bold">Device drafts</h3>{drafts.map((draft) => <button key={draft.id} type="button" className={CONTROL} onClick={() => { setProject(draft); setKind(draft.kind); setSourceId(draft.sourceId); }}>{draft.name} · {approvalCount(draft)}/{REQUIRED_FRAMES}</button>)}</div>}
    {v2Operators.length > 0 && <div><h3 className="font-bold">Start from a Forge v1/v2 operator</h3>{v2Operators.map((operator) => <button key={operator.id} type="button" className={CONTROL} onClick={() => { setProject(projectFromForgedOperator(operator, crypto.randomUUID())); setMessage('Copied into a new v3 draft. Your original Forge design stays saved.'); }}>{operator.name}</button>)}</div>}
    {cloudDrafts.length > 0 && <div><h3 className="font-bold">Account drafts</h3>{cloudDrafts.map(({ project: draft }) => <button key={draft.id} type="button" className={CONTROL} onClick={() => { setProject(draft); setKind(draft.kind); setSourceId(draft.sourceId); }}>{draft.name} · {approvalCount(draft)}/{REQUIRED_FRAMES}</button>)}</div>}
    <CommunityGalleryV3 onRemix={(draft) => { setProject(draft); setKind(draft.kind); setSourceId(draft.sourceId); setPast([]); setFuture([]); setMessage('Remix draft opened. Review all 192 frames before publishing.'); }} />
    {message && <p role="status">{message}</p>}
  </section>;
  const current = project.views[direction][clip][frameIndex]!;
  return <section className="mt-5 space-y-4 border border-border bg-card p-4" data-testid="studio-v3-editor">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-black">Character Studio v3</h2><button type="button" className={CONTROL} onClick={() => setProject(null)}>All drafts</button></div>
    <input aria-label="Creation name" className={CONTROL} value={project.name} onChange={(event) => change({ ...project, name: event.target.value, approvalState: 'draft' })} />
    <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={project.remixAllowed} onChange={(event) => change({ ...project, remixAllowed: event.target.checked })} />Allow adopters to remix this creation with credit to you</label>
    {project.parentRevisionId && <p className="text-xs text-muted-foreground">Remix of reviewed revision {project.parentRevisionId.slice(0, 8)}. The original creator will be credited.</p>}
    <p className="text-sm">{approvalCount(project)}/{REQUIRED_FRAMES} frames approved. {isStudioComplete(project) ? 'Ready for review.' : 'Private draft.'}</p>
    <div className="flex flex-wrap items-center gap-2"><button type="button" className={CONTROL} onClick={() => rotate(-1)} aria-label="Previous direction">←</button><strong>{direction}</strong><button type="button" className={CONTROL} onClick={() => rotate(1)} aria-label="Next direction">→</button>
      <select aria-label="Animation" className={CONTROL} value={clip} onChange={(event) => { setClip(event.target.value as ClipName); setFrameIndex(0); }}>{Object.keys(CLIPS).map((name) => <option key={name}>{name}</option>)}</select>
      <button type="button" className={CONTROL} onClick={() => setPlaying(!playing)}>{playing ? 'Pause' : 'Play preview'}</button><label className="text-xs"><input type="checkbox" checked={onion} onChange={(event) => setOnion(event.target.checked)} /> Onion skin</label></div>
    <div className="flex flex-wrap gap-4"><canvas ref={canvas} className="aspect-square w-full max-w-96 border border-border bg-[#161622] [image-rendering:pixelated] touch-none" onPointerDown={(event) => { drawing.current = true; event.currentTarget.setPointerCapture(event.pointerId); if (tool === 'select') { const [x, y] = point(event); setSelection({ x0: x, y0: y, x1: x, y1: y }); } else applyPixel(event); }} onPointerMove={(event) => { if (tool === 'select' && drawing.current) { const [x, y] = point(event); setSelection((current) => current ? { ...current, x1: x, y1: y } : null); } else applyPixel(event); }} onPointerUp={() => { drawing.current = false; }} onPointerCancel={() => { drawing.current = false; }} aria-label="48 by 48 pixel art canvas" role="img" />
      <div className="space-y-3"><div className="flex flex-wrap gap-1">{(['pen', 'erase', 'fill', 'select'] as Tool[]).map((name) => <button key={name} type="button" aria-pressed={tool === name} className={CONTROL} onClick={() => setTool(name)}>{name}</button>)}</div>
        <div className="grid grid-cols-8 gap-1">{project.palette.map((value, index) => <button key={index} type="button" aria-label={`Color ${index + 1}`} aria-pressed={color === index} onClick={() => setColor(index)} style={{ background: value }} className="h-8 w-8 border-2 border-white/30 aria-pressed:border-white" />)}</div>
        <div className="space-y-1"><p className="text-xs font-bold">Layers</p>{project.layers.map((layer) => <button key={layer.id} type="button" className={CONTROL} aria-pressed={layerId === layer.id} onClick={() => setLayerId(layer.id)}>{layer.name}</button>)}<div><button type="button" className={CONTROL} onClick={() => moveLayer(-1, 0)}>Layer ←</button><button type="button" className={CONTROL} onClick={() => moveLayer(1, 0)}>Layer →</button><button type="button" className={CONTROL} onClick={() => moveLayer(0, -1)}>Layer ↑</button><button type="button" className={CONTROL} onClick={() => moveLayer(0, 1)}>Layer ↓</button><button type="button" className={CONTROL} onClick={() => rotateLayer(-15)}>Rotate ↶</button><button type="button" className={CONTROL} onClick={() => rotateLayer(15)}>Rotate ↷</button></div>
          <div className="flex gap-2">{([0, 1] as const).map((axis) => <label key={axis} className="text-xs">Pivot {axis ? 'Y' : 'X'}<input type="number" className={CONTROL} value={project.layers.find((layer) => layer.id === layerId)?.pivot[axis] ?? 24} onChange={(event) => changePivot(axis, Number(event.target.value))} /></label>)}</div>
          {selection && <div><p className="text-xs">Selection {Math.abs(selection.x1 - selection.x0) + 1} × {Math.abs(selection.y1 - selection.y0) + 1}</p><button type="button" className={CONTROL} onClick={() => moveSelection(-1, 0)}>←</button><button type="button" className={CONTROL} onClick={() => moveSelection(1, 0)}>→</button><button type="button" className={CONTROL} onClick={() => moveSelection(0, -1)}>↑</button><button type="button" className={CONTROL} onClick={() => moveSelection(0, 1)}>↓</button></div>}
        </div>
      </div></div>
    <div className="flex flex-wrap gap-1" aria-label="Frame timeline">{project.views[direction][clip].map((frame, index) => <button key={index} type="button" className={CONTROL} aria-pressed={frameIndex === index} onClick={() => setFrameIndex(index)}>{index + 1}{frame.approved ? ' ✓' : ''}</button>)}</div>
    <div className="flex flex-wrap gap-2"><label className="text-xs">Frame milliseconds <input type="number" min={30} max={1000} className={CONTROL} value={current.ms} onChange={(event) => change(editStudioFrame(project, direction, clip, frameIndex, (frame) => { frame.ms = Number(event.target.value); }))} /></label>
      <button type="button" className={CONTROL} onClick={() => setProject(approveStudioFrame(project, direction, clip, frameIndex))}>Approve this frame</button>
      <button type="button" className={CONTROL} disabled={!past.length} onClick={() => { const previous = past.at(-1)!; setPast(past.slice(0, -1)); setFuture([...future, project]); setProject(previous); }}>Undo</button>
      <button type="button" className={CONTROL} disabled={!future.length} onClick={() => { const next = future.at(-1)!; setFuture(future.slice(0, -1)); setPast([...past, project]); setProject(next); }}>Redo</button>
      <button type="button" className={CONTROL} onClick={() => { void save(); }}>Save draft</button>
      <button type="button" className={CONTROL} disabled={!isStudioComplete(project) || !session} onClick={() => { void submit(); }}>Submit for review</button></div>
    {studioErrors(project).map((error) => <p key={error} className="text-xs text-red-300">{error}</p>)}{message && <p role="status" className="text-xs">{message}</p>}
  </section>;
}
