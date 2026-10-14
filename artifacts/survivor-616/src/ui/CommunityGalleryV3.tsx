import { useEffect, useRef, useState } from 'react';
import { lokClient } from '@/lib/lokClient';
import { useAuth } from '@/state/authStore';
import { activateStudioAppearance } from '@/game/studio/v3Appearances';
import { studioFrame } from '@/game/render/sprite';
import { CLIPS, DIRECTIONS, renderStudioPixels, type ClipName, type Direction, type StudioProject } from '@/game/studio/v3Project';
import { exportStudioMp4, shareOrDownload } from '@/game/studio/rosterExport';

interface GalleryEntry { id: string; creation_id: string; title: string; description: string; poster: StudioProject; submitted_at: string; gsix_creations: { owner_id: string; kind: 'operator' | 'enemy'; remix_allowed: boolean; parent_revision_id: string | null } }
const BUTTON = 'min-h-10 border border-border bg-background px-3 py-2 text-xs text-white hover:border-primary disabled:opacity-40';
const PAGE_SIZE = 24;

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
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<'all' | 'operator' | 'enemy'>('all');
  const [page, setPage] = useState(0);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedError, setFeedError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [reportReason, setReportReason] = useState('');
  const [direction, setDirection] = useState<Direction>('S');
  const [clip, setClip] = useState<ClipName>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [message, setMessage] = useState('');
  const [exporting, setExporting] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [exportedVideo, setExportedVideo] = useState<Blob | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = search.trim().replace(/[%_,]/g, '').slice(0, 60);
      if (next !== query) { setEntries([]); setSelected(null); setPage(0); setQuery(next); }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [search, query]);
  useEffect(() => {
    if (!lokClient) { setFeedError('The community gallery is waiting for the shared account connection.'); return; }
    let active = true;
    setLoading(true); setFeedError('');
    let request = lokClient.from('gsix_creation_revisions').select('id,creation_id,title,description,poster,submitted_at,gsix_creations!gsix_creation_revisions_creation_id_fkey!inner(owner_id,kind,remix_allowed,parent_revision_id)').eq('state', 'approved').order('submitted_at', { ascending: false });
    if (kind !== 'all') request = request.eq('gsix_creations.kind', kind);
    if (query) request = request.ilike('title', `%${query}%`);
    void request.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE).then(({ data, error }) => {
      if (!active) return;
      setLoading(false);
      if (error) { setFeedError(error.message); setMore(false); return; }
      const rows = ((data ?? []) as unknown as GalleryEntry[]).slice(0, PAGE_SIZE);
      const hasMore = (data?.length ?? 0) > PAGE_SIZE;
      setEntries((items) => page === 0 ? rows : [...items.filter((item) => !rows.some((row) => row.id === item.id)), ...rows]);
      setMore(hasMore);
    });
    return () => { active = false; };
  }, [query, kind, page, refresh]);
  useEffect(() => {
    if (!selected || !lokClient) return;
    let active = true;
    setProject(null); setAdopted(false); setCreatorHandle(''); setParentHandle(''); setExportedVideo(null); setReportReason(''); setElapsed(0);
    void lokClient.from('gsix_creation_revisions').select('project').eq('id', selected.id).eq('state', 'approved').maybeSingle().then(({ data, error }) => {
      if (!active) return;
      if (error || !data?.project) { setMessage(error?.message ?? 'This creation is no longer in the gallery.'); setEntries((items) => items.filter((item) => item.id !== selected.id)); setSelected(null); return; }
      setProject({ ...(data.project as StudioProject), approvalState: 'approved' });
    });
    void lokClient.from('lok_profiles').select('handle').eq('user_id', selected.gsix_creations.owner_id).maybeSingle().then(({ data }) => { if (active) setCreatorHandle(data?.handle ?? 'creator'); });
    if (selected.gsix_creations.parent_revision_id) void lokClient.from('gsix_creation_revisions').select('creation_id').eq('id', selected.gsix_creations.parent_revision_id).eq('state', 'approved').maybeSingle().then(async ({ data }) => {
      if (!data || !lokClient) return;
      const { data: parent } = await lokClient.from('gsix_creations').select('owner_id').eq('id', data.creation_id).maybeSingle();
      if (!parent) return;
      const { data: profile } = await lokClient.from('lok_profiles').select('handle').eq('user_id', parent.owner_id).maybeSingle();
      if (active) setParentHandle(profile?.handle ?? 'creator');
    });
    if (session) void lokClient.from('gsix_adoptions').select('id').eq('creation_id', selected.creation_id).eq('adopter_id', session.user.id).maybeSingle().then(({ data }) => { if (active) setAdopted(Boolean(data)); });
    return () => { active = false; };
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
    const reason = reportReason.trim().slice(0, 500);
    if (reason.length < 4) { setMessage('Please add at least four characters to your report.'); return; }
    const { error } = await lokClient.from('gsix_creation_reports').insert({ revision_id: selected.id, reporter_id: session.user.id, reason });
    setMessage(error ? error.message : 'Report sent to staff.');
    if (!error) setReportReason('');
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
  return <section className="mt-6 space-y-3 border border-border bg-card p-4" data-testid="community-gallery-v3">
    <div className="flex flex-wrap items-end justify-between gap-2"><div><h3 className="text-lg font-black">Community Gallery</h3><p className="text-xs text-muted-foreground">Reviewed creations shared with GSix.online.</p></div><button type="button" className={BUTTON} onClick={() => { setEntries([]); setPage(0); setRefresh((value) => value + 1); }}>Refresh gallery</button></div>
    <div className="flex flex-wrap gap-2"><input aria-label="Search creations" placeholder="Search approved creations" className={BUTTON} value={search} onChange={(event) => setSearch(event.target.value)} /><select aria-label="Creation kind" className={BUTTON} value={kind} onChange={(event) => { setKind(event.target.value as typeof kind); setEntries([]); setSelected(null); setPage(0); }}><option value="all">All</option><option value="operator">Operators</option><option value="enemy">Enemies</option></select></div>
    {loading && <p className="text-sm" role="status">Loading reviewed creations…</p>}
    {feedError && <p className="text-sm text-red-300" role="status">{feedError}</p>}
    {!loading && !feedError && entries.length === 0 && <p className="text-sm text-muted-foreground">No reviewed creations match these filters yet.</p>}
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{entries.map((entry) => <button key={entry.id} type="button" className={`${BUTTON} flex h-auto items-center gap-3 text-left`} aria-pressed={selected?.id === entry.id} onClick={() => setSelected(entry)}><GalleryPoster poster={entry.poster} title={entry.title} /><span><strong className="block text-sm">{entry.title}</strong><span className="text-xs text-muted-foreground">{entry.gsix_creations.kind} · Reviewed</span></span></button>)}</div>
    {more && <button type="button" className={BUTTON} disabled={loading} onClick={() => setPage((value) => value + 1)}>Load more creations</button>}
    {selected && <div className="space-y-2 border border-border p-3"><h4 className="font-bold">{selected.title}</h4><p className="text-sm">{selected.description}</p><p className="text-xs">Created by <a className="underline" href={`https://gsix.online/profile/${encodeURIComponent(creatorHandle)}`} target="_blank" rel="noreferrer">@{creatorHandle}</a></p>
      {selected.gsix_creations.parent_revision_id && <p className="text-xs">Remixed from <a className="underline" href={`https://gsix.online/creators/${selected.gsix_creations.parent_revision_id}`} target="_blank" rel="noreferrer">a reviewed creation</a>{parentHandle && <> by <a className="underline" href={`https://gsix.online/profile/${encodeURIComponent(parentHandle)}`} target="_blank" rel="noreferrer">@{parentHandle}</a></>}.</p>}
      <canvas ref={canvas} className="h-64 w-64 border border-border bg-black [image-rendering:pixelated]" aria-label={`${selected.title} animation preview`} role="img" />
      <div className="flex flex-wrap gap-2"><button type="button" className={BUTTON} onClick={() => setDirection(DIRECTIONS[(DIRECTIONS.indexOf(direction) + 7) % 8]!)}>←</button><span>{direction}</span><button type="button" className={BUTTON} onClick={() => setDirection(DIRECTIONS[(DIRECTIONS.indexOf(direction) + 1) % 8]!)}>→</button><select aria-label="Preview animation" className={BUTTON} value={clip} onChange={(event) => setClip(event.target.value as ClipName)}>{Object.keys(CLIPS).map((value) => <option key={value}>{value}</option>)}</select></div>
      <div className="flex flex-wrap gap-2"><a className={BUTTON} href={`https://gsix.online/creators/${encodeURIComponent(selected.id)}`} target="_blank" rel="noreferrer">Open on GSix.online</a><button type="button" className={BUTTON} disabled={!session || selected.gsix_creations.owner_id === session?.user.id || adopted} onClick={() => { void adopt(); }}>{adopted ? 'In your Locker' : 'Adopt · 100 LokTokens'}</button><button type="button" className={BUTTON} disabled={!project || (!adopted && selected.gsix_creations.owner_id !== session?.user.id)} onClick={() => { void useInRun(); }}>Use in run</button>{onRemix && <button type="button" className={BUTTON} disabled={!project || (!adopted && selected.gsix_creations.owner_id !== session?.user.id) || !selected.gsix_creations.remix_allowed} onClick={() => { if (!project) return; const draft = structuredClone(project); draft.id = crypto.randomUUID(); draft.name = `${selected.title} remix`; draft.parentRevisionId = selected.id; draft.revision = 1; draft.approvalState = 'draft'; draft.remixAllowed = false; draft.updatedAt = Date.now(); for (const view of Object.values(draft.views)) for (const frames of Object.values(view)) for (const frame of frames) frame.approved = false; onRemix(draft); }}>Remix in Studio</button>}<button type="button" className={BUTTON} onClick={() => { void exportCard(false); }}>Download PNG card</button><button type="button" className={BUTTON} onClick={() => { void exportCard(true); }}>Share PNG card</button><button type="button" className={BUTTON} disabled={exporting} onClick={() => { void exportVideo(false); }}>{exporting ? `Making MP4 ${videoProgress}%` : 'Download 9:16 MP4'}</button><button type="button" className={BUTTON} disabled={exporting} onClick={() => { void exportVideo(true); }}>Share MP4</button></div>
      {session && <div className="flex flex-wrap items-end gap-2"><label className="min-w-60 flex-1 text-xs">Report a concern<textarea aria-label="Report a concern" className={`${BUTTON} mt-1 w-full`} maxLength={500} rows={2} value={reportReason} onChange={(event) => setReportReason(event.target.value)} placeholder="Tell staff what needs review" /></label><button type="button" className={BUTTON} onClick={() => { void report(); }}>Send report</button></div>}
    </div>}
    {message && <p role="status" className="text-sm">{message}</p>}
  </section>;
}
