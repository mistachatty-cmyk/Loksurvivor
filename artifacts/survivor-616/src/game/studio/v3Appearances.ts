import { CHARACTERS_BY_ID } from '@/game/data/characters';
import { ENEMIES_BY_ID } from '@/game/data/enemies';
import { isStudioComplete, type StudioProject } from './v3Project';
import { loadStudioDraft, saveStudioDraft } from './v3Store';

const ACTIVE_KEY = 'survivor616.studio.active.v3';
type ActiveIds = { operator: string | null; enemy: string | null };

function readActive(): ActiveIds {
  try { const saved = JSON.parse(localStorage.getItem(ACTIVE_KEY) ?? '{}') as Partial<ActiveIds>; return { operator: saved.operator ?? null, enemy: saved.enemy ?? null }; }
  catch { return { operator: null, enemy: null }; }
}
function install(project: StudioProject) {
  if (project.kind === 'operator') {
    const base = CHARACTERS_BY_ID[project.sourceId];
    if (base) base.rig.studioV3 = project;
  } else {
    const base = ENEMIES_BY_ID[project.sourceId];
    if (base) base.rig.studioV3 = project;
  }
}
export async function activateStudioAppearance(project: StudioProject): Promise<void> {
  if (project.approvalState !== 'approved' || !isStudioComplete(project)) throw new Error('Only complete approved creations can enter a run');
  await saveStudioDraft(project);
  const active = readActive();
  active[project.kind] = project.id;
  localStorage.setItem(ACTIVE_KEY, JSON.stringify(active));
  install(project);
}
export async function restoreStudioAppearances(): Promise<void> {
  const active = readActive();
  for (const id of [active.operator, active.enemy]) {
    if (!id) continue;
    const project = await loadStudioDraft(id);
    if (project?.approvalState === 'approved' && isStudioComplete(project)) install(project);
  }
}
