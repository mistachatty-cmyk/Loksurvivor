import { useEffect, useState } from 'react';
import { useAuth } from '@/state/authStore';
import { lokClient } from '@/lib/lokClient';
import { listStudioDrafts } from '@/game/studio/v3Store';
import { approvalCount, REQUIRED_FRAMES, type StudioProject } from '@/game/studio/v3Project';
import { CommunityGalleryV3 } from './CommunityGalleryV3';

const BUTTON = 'min-h-10 border border-border bg-card px-3 py-2 text-xs text-white hover:border-primary';
export function PersonalLockerV3({ onBack }: { onBack: () => void }) {
  const { session } = useAuth();
  const [drafts, setDrafts] = useState<StudioProject[]>([]);
  const [accountDrafts, setAccountDrafts] = useState<StudioProject[]>([]);
  const [owned, setOwned] = useState<{ id: string; title: string; state: string }[]>([]);
  const [adopted, setAdopted] = useState<{ id: string; title: string }[]>([]);
  useEffect(() => { void listStudioDrafts().then(setDrafts).catch(() => {}); }, []);
  useEffect(() => {
    if (!session || !lokClient) return;
    void Promise.all([
      lokClient.from('gsix_studio_drafts').select('project').eq('owner_id', session.user.id).order('updated_at', { ascending: false }).limit(30),
      lokClient.from('gsix_creations').select('id').eq('owner_id', session.user.id),
      lokClient.from('gsix_adoptions').select('revision_id').eq('adopter_id', session.user.id),
    ]).then(async ([savedDrafts, creations, adoptions]) => {
      setAccountDrafts((savedDrafts.data ?? []).map((row) => row.project as StudioProject));
      const ids = (creations.data ?? []).map((row) => row.id);
      if (ids.length) {
        const { data } = await lokClient!.from('gsix_creation_revisions').select('id,title,state').in('creation_id', ids);
        setOwned((data ?? []) as typeof owned);
      }
      const revisionIds = (adoptions.data ?? []).map((row) => row.revision_id);
      if (revisionIds.length) {
        const { data } = await lokClient!.from('gsix_creation_revisions').select('id,title').in('id', revisionIds);
        setAdopted((data ?? []) as typeof adopted);
      }
    });
  }, [session?.user.id]);
  return <main className="mx-auto max-w-5xl space-y-5 p-5" data-testid="personal-locker-v3">
    <button type="button" className={BUTTON} onClick={onBack}>← Back to your Room</button>
    <h1 className="text-3xl font-black">Personal Locker</h1>
    <p className="text-sm text-muted-foreground">Your device drafts, reviewed creations, and adopted characters.</p>
    <section><h2 className="font-bold">Drafts</h2>{drafts.length ? <div className="flex flex-wrap gap-2">{drafts.map((draft) => <span key={draft.id} className={BUTTON}>{draft.name} · {approvalCount(draft)}/{REQUIRED_FRAMES} frames</span>)}</div> : <p className="text-sm">No drafts on this device yet.</p>}</section>
    <section><h2 className="font-bold">Account drafts</h2>{accountDrafts.length ? <div className="flex flex-wrap gap-2">{accountDrafts.map((draft) => <span key={draft.id} className={BUTTON}>{draft.name} · {approvalCount(draft)}/{REQUIRED_FRAMES} frames</span>)}</div> : <p className="text-sm">No synced drafts yet.</p>}</section>
    <section><h2 className="font-bold">Your creations</h2>{owned.length ? <div className="flex flex-wrap gap-2">{owned.map((item) => <span key={item.id} className={BUTTON}>{item.title} · {item.state}</span>)}</div> : <p className="text-sm">No account creations yet.</p>}</section>
    <section><h2 className="font-bold">Adopted</h2>{adopted.length ? <div className="flex flex-wrap gap-2">{adopted.map((item) => <span key={item.id} className={BUTTON}>{item.title}</span>)}</div> : <p className="text-sm">No adopted characters yet.</p>}</section>
    <CommunityGalleryV3 />
  </main>;
}
