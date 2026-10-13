import { useEffect, useRef, useState } from 'react';
import { lokClient } from '@/lib/lokClient';
import { useAuth } from '@/state/authStore';
import { activateStudioAppearance } from '@/game/studio/v3Appearances';
import { studioFrame } from '@/game/render/sprite';
import { CLIPS, DIRECTIONS, renderStudioPixels, type ClipName, type Direction, type StudioProject } from '@/game/studio/v3Project';
import { exportStudioMp4, shareOrDownload } from '@/game/studio/rosterExport';

interface GalleryEntry { id: string; creation_id: string; title: string; description: string; poster: StudioProject; submitted_at: string; gsix_creations: { owner_id: string; kind: 'operator' | 'enemy'; remix_allowed: boolean; parent_revision_id: string | null } }
const BUTTON = 'min-h-10 border border-border bg-background px-3 py-2 text-xs text-white hover:border-primary disabled:opacity-40';

function GalleryPoster({ poster, title }: { poster: StudioProject; title: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    const frame = poster?.views?.S?.idle?.[0];
    if (ctx && frame) renderStudioPixels(ctx, poster, frame);
  }, [poster]);
  return <canvas ref={ref} width={48} height={48} className="h-12 w-12 shrink-0 [image-rendering:pixelated]" aria-label={`${title} portrait`} role="img" />;
}

export function CommunityGalleryV3({ onRemix }: { onRemix?: (project: StudioProject) => void } = {}) {
  const { session } = useAuth();
  const [entries, setEntries] = useState<GalleryEntry[]>([]);
  const [selected, setSelected] = useState<GalleryEntry | null>(null);
  const [project, setProject] = useState<StudioProject | null>(null);
  const [creatorHandle, setCreatorHandle] = useState('');
  const [parentHandle, setParentHandle] = useState('');
  const [adopted, setAdopted] = useState(false);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<'all' | 'operator' | 'enemy'>('all');
  const [direction, setDirection] = useState<Direction>('S');
  const [clip, setClip] = useState<ClipName>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [message, setMessage] = useState('');
  const [exporting, setExporting] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [exportedVideo, setExportedVideo] = useState<Blob | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!lokClient) return;
    let request = lokClient.from('gsix_creation_revisions').select('id,creation_id,title,description,poster,submitted_at,gsix_creations(owner_id,kind,remix_allowed,parent_revision_id)').eq('state', 'approved').order('submitted_at', { ascending: false }).limit(24);
    if (query.trim()) request = request.ilike('title', `%${query.trim().replace(/[%_]/g, '')}%`);
    void request.then(({ data, error }) => { if (error) setMessage(error.message); else setEntries((data ?? []) as unknown as GalleryEntry[]); });
  }, [query]);
  useEffect(() => {
    if (!selected || !lokClient) return;
    setProject(null); setAdopted(false); setCreatorHandle(''); setParentHandle(''); setExportedVideo(null);
    void lokClient.from('gsix_creation_revisions').select('project').eq('id', selected.id).single().then(({ data }) => {
      if (data?.project) setProject({ ...(data.project as StudioProject), approvalState: 'approved' });
    });
    void lokClient.from('lok_profiles').select('handle').eq('user_id', selected.gsix_creations.owner_id).maybeSingle().then(({ data }) => setCreatorHandle(data?.handle ?? 'creator'));
    if (selected.gsix_creations.parent_revision_id) void lokClient.from('gsix_creation_revisions').select('creation_id').eq('id', selected.gsix_creations.parent_revision_id).eq('state', 'approved').maybeSingle().then(async ({ data }) => {
      if (!data || !lokClient) return;
      const { data: parent } = await lokClient.from('gsix_creations').select('owner_id').eq('id', data.creation_id).maybeSingle();
      if (!parent) return;
      const { data: profile } = await lokClient.from('lok_profiles').select('handle').eq('user_id', parent.owner_id).maybeSingle();
      setParentHandle(profile?.handle ?? 'creator');
    });
    if (session) void lokClient.from('gsix_adoptions').select('id').eq('creation_id', selected.creation_id).eq('adopter_id', session.user.id).maybeSingle().then(({ data }) => setAdopted(Boolean(data)));
  }, [selected?.id, session?.user.id]);
  useEffect(() => {
    if (!project || !canvas.current) return;
    const ctx = canvas.current.getContext('2d');
    if (!ctx) return;
    canvas.current.width = 48; canvas.current.height = 48;
    ctx.clearRect(0, 0, 48, 48);
    const image = studioFrame(project, direction, clip, elapsed);
    if (image) ctx.drawImage(image, 0, 0);
  }, [project, direction, clip, elapsed]);
  useEffect(() => {
    if (!project || document.hidden || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => setElapsed((value) => value + 80), 80);
    return () => window.clearInterval(timer);
  }, [project]);

  async function adopt() {
    if (!selected || !session || !lokClient) return;
    const key = `creator-adopt:${session.user.id}:${selected.creation_id}`;
    const { data, error } = await lokClient.rpc('gsix_adopt_creation', { p_revision_id: selected.id, p_idem_key: key });
    if (error || !(data as { ok?: boolean })?.ok) { setMessage(error?.message ?? 'Adoption failed'); return; }
    setAdopted(true); setMessage('Adopted for 100 LokTokens. This revision is in your Locker.');
  }
  async function report() {
    if (!selected || !session || !lokClient) return;
    const reason = window.prompt('Why should staff review this creation?');
    if (!reason || reason.trim().length < 4) return;
    const { error } = await lokClient.from('gsix_creation_reports').insert({ revision_id: selected.id, reporter_id: session.user.id, reason: reason.trim().slice(0, 500) });
    setMessage(error ? error.message : 'Report sent to staff.');
  }
  async function useInRun() {
    if (!project) return;
    try { await activateStudioAppearance(project); setMessage('Appearance selected for this device’s runs.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Could not activate appearance'); }
  }
  async function exportCard(preferShare: boolean) {
    if (!project || !selected) return;
    const card = document.createElement('canvas'); card.width = 800; card.height = 1000;
    const ctx = card.getContext('2d'); if (!ctx) return;
    ctx.fillStyle = '#111525'; ctx.fillRect(0, 0, 800, 1000);
    const image = studioFrame(project, 'S', 'idle', 0);
    if (image) { ctx.imageSmoothingEnabled = false; ctx.drawImage(image, 160, 100, 480, 480); }
    ctx.fillStyle = '#e5faff'; ctx.font = 'bold 46px sans-serif'; ctx.fillText(selected.title.slice(0, 25), 55, 700);
    ctx.font = '27px sans-serif'; ctx.fillText(`By @${creatorHandle}`, 55, 755);
    if (parentHandle) { ctx.font = '23px sans-serif'; ctx.fillText(`Remix of @${parentHandle}`, 55, 795); }
    ctx.font = '22px sans-serif'; ctx.fillText(`gsix.online/creators/${selected.id}`, 55, 835);
    const blob = await new Promise<Blob | null>((resolve) => card.toBlob(resolve, 'image/png'));
    if (blob) await shareOrDownload(blob, `survivor616-${selected.creation_id}.png`, preferShare);
  }
  async function exportVideo(preferShare: boolean) {
    if (!project || !selected) return;
    setExporting(true); setVideoProgress(0);
    try {
      const blob = exportedVideo ?? await exportStudioMp4(project, creatorHandle, `https://gsix.online/creators/${selected.id}`, setVideoProgress, parentHandle || undefined);
      setExportedVideo(blob);
      await shareOrDownload(blob, `survivor616-${selected.creation_id}.mp4`, preferShare);
      setMessage('Vertical MP4 export is ready.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'MP4 export failed'); }
    finally { setExporting(false); }
  }
  const filtered = entries.filter((entry) => kind === 'all' || entry.gsix_creations.kind === kind);
  return <section className="mt-6 space-y-3 border border-border bg-card p-4" data-testid="community-gallery-v3">
    <h3 className="text-lg font-black">Community Gallery</h3>
    <div className="flex flex-wrap gap-2"><input aria-label="Search creations" placeholder="Search approved creations" className={BUTTON} value={query} onChange={(event) => setQuery(event.target.value)} /><select aria-label="Creation kind" className={BUTTON} value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}><option value="all">All</option><option value="operator">Operators</option><option value="enemy">Enemies</option></select></div>
    <div className="flex flex-wrap gap-2">{filtered.map((entry) => <button key={entry.id} type="button" className={`${BUTTON} flex items-center gap-2`} onClick={() => setSelected(entry)}><GalleryPoster poster={entry.poster} title={entry.title} /><span>{entry.title} · {entry.gsix_creations.kind}</span></button>)}</div>
    {selected && <div className="space-y-2 border border-border p-3"><h4 className="font-bold">{selected.title}</h4><p className="text-sm">{selected.description}</p><p className="text-xs">Created by <a className="underline" href={`https://gsix.online/profile/${encodeURIComponent(creatorHandle)}`} target="_blank" rel="noreferrer">@{creatorHandle}</a></p>
      {selected.gsix_creations.parent_revision_id && <p className="text-xs">Remixed from <a className="underline" href={`https://gsix.online/creators/${selected.gsix_creations.parent_revision_id}`} target="_blank" rel="noreferrer">a reviewed creation</a>{parentHandle && <> by <a className="underline" href={`https://gsix.online/profile/${encodeURIComponent(parentHandle)}`} target="_blank" rel="noreferrer">@{parentHandle}</a></>}.</p>}
      <canvas ref={canvas} className="h-64 w-64 border border-border bg-black [image-rendering:pixelated]" aria-label={`${selected.title} animation preview`} role="img" />
      <div className="flex flex-wrap gap-2"><button type="button" className={BUTTON} onClick={() => setDirection(DIRECTIONS[(DIRECTIONS.indexOf(direction) + 7) % 8]!)}>←</button><span>{direction}</span><button type="button" className={BUTTON} onClick={() => setDirection(DIRECTIONS[(DIRECTIONS.indexOf(direction) + 1) % 8]!)}>→</button><select aria-label="Preview animation" className={BUTTON} value={clip} onChange={(event) => setClip(event.target.value as ClipName)}>{Object.keys(CLIPS).map((value) => <option key={value}>{value}</option>)}</select></div>
      <div className="flex flex-wrap gap-2"><button type="button" className={BUTTON} disabled={!session || selected.gsix_creations.owner_id === session?.user.id || adopted} onClick={() => { void adopt(); }}>{adopted ? 'In your Locker' : 'Adopt · 100 LokTokens'}</button><button type="button" className={BUTTON} disabled={!project || (!adopted && selected.gsix_creations.owner_id !== session?.user.id)} onClick={() => { void useInRun(); }}>Use in run</button>{onRemix && <button type="button" className={BUTTON} disabled={!project || !adopted || !selected.gsix_creations.remix_allowed} onClick={() => { if (!project) return; const draft = structuredClone(project); draft.id = crypto.randomUUID(); draft.name = `${selected.title} remix`; draft.parentRevisionId = selected.id; draft.revision = 1; draft.approvalState = 'draft'; draft.remixAllowed = false; draft.updatedAt = Date.now(); for (const view of Object.values(draft.views)) for (const frames of Object.values(view)) for (const frame of frames) frame.approved = false; onRemix(draft); }}>Remix in Studio</button>}<button type="button" className={BUTTON} onClick={() => { void exportCard(false); }}>Download PNG card</button><button type="button" className={BUTTON} onClick={() => { void exportCard(true); }}>Share PNG card</button><button type="button" className={BUTTON} disabled={exporting} onClick={() => { void exportVideo(false); }}>{exporting ? `Making MP4 ${videoProgress}%` : 'Download 9:16 MP4'}</button><button type="button" className={BUTTON} disabled={exporting} onClick={() => { void exportVideo(true); }}>Share MP4</button><button type="button" className={BUTTON} disabled={!session} onClick={() => { void report(); }}>Report</button></div>
    </div>}
    {message && <p role="status" className="text-sm">{message}</p>}
  </section>;
}
