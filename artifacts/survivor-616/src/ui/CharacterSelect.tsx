/**
 * Roster / character picker. Owned by the design pass -- keep the export
 * name and props stable.
 */
import { Fragment } from 'react';
import { BookOpen, LockKeyhole, Zap } from 'lucide-react';

import { describeUnlock, effectiveStats, episodeProgress, episodeStatus, useMeta } from '@/game/state/metaStore';
import { CHARACTER_EPISODE_BY_CHARACTER_ID } from '@/game/data/episodes';
import type { CharacterDef, MetaState } from '@/game/types';
import { ScreenLayout } from './ScreenLayout';
import { RigPortrait } from './RigPortrait';
import { CharacterAbilityVisualizer } from './CharacterAbilityVisualizer';
import { LokPetVariantSheet } from './LokPetVariantSheet';
import { WeaponIcon } from './WeaponIcon';

export interface CharacterSelectProps {
  onBack: () => void;
  /** Called after the player commits to a character. */
  onConfirm: () => void;
  /** Opens the selected character's replayable signature episode. */
  onLaunchEpisode?: (episodeId: string, areaId: string) => void;
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 py-1.5 text-xs">
      <span className="uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="font-bold text-white">{value}</span>
    </div>
  );
}

function CharacterDetail({
  character,
  meta,
  onLaunchEpisode,
  inline = false,
}: {
  character: CharacterDef;
  meta: MetaState;
  onLaunchEpisode?: (episodeId: string, areaId: string) => void;
  inline?: boolean;
}) {
  const stats = effectiveStats(character, meta);
  const episode = CHARACTER_EPISODE_BY_CHARACTER_ID[character.id];
  const status = episode ? episodeStatus(episode.id, meta) : 'locked';
  const progress = episode ? episodeProgress(episode.id, meta) : 0;

  return (
    <div
      className={`terminal-frame border border-border bg-card p-4 ${inline ? 'flex flex-wrap gap-5' : 'flex flex-col gap-4'}`}
      data-testid={`section-character-detail-${character.id}`}
    >
      <div className="flex shrink-0 items-center gap-3">
        <div className="terminal-frame grid h-16 w-16 shrink-0 place-items-center border border-primary/40 bg-black/40">
          <RigPortrait rig={character.rig} palette={character.palette} anim="idle" size={56} />
        </div>
        <div className="min-w-0">
          <h3 className="terminal-glow truncate text-lg font-black uppercase leading-tight text-white">{character.name}</h3>
          <p className="truncate text-[11px] font-bold uppercase tracking-wider text-primary">{character.handle}</p>
        </div>
      </div>

      <div className={inline ? 'min-w-[14rem] flex-1' : ''}>
        <p className="text-xs italic text-muted-foreground">&ldquo;{character.tagline}&rdquo;</p>
        <div className={`mt-3 grid gap-x-4 ${inline ? 'grid-cols-3' : 'grid-cols-2'}`}>
          <StatRow label="Health" value={Math.round(stats.maxHp).toString()} />
          <StatRow label="Speed" value={Math.round(stats.speed).toString()} />
          <StatRow label="Power" value={`x${stats.power.toFixed(2)}`} />
          <StatRow label="Armor" value={`${Math.round(stats.armor * 100)}%`} />
          <StatRow label="Crit" value={`${Math.round(stats.crit * 100)}%`} />
          <StatRow label="Lifesteal" value={`${Math.round(stats.lifesteal * 100)}%`} />
        </div>
      </div>

      <div className={`flex flex-col gap-3 ${inline ? 'min-w-[14rem] flex-1' : ''}`}>
        <div>
          <div className="mb-1 flex items-center gap-2">
            <WeaponIcon weaponId={character.weapon.id} kind={character.weapon.kind} color={character.weapon.color ?? character.palette.accent} size={24} label={character.weapon.name} />
            <span className="text-[10px] font-bold uppercase tracking-widest text-white">{character.weapon.name}</span>
          </div>
          <p className="text-xs text-muted-foreground">{character.weapon.description}</p>
        </div>
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Zap className="h-3 w-3 text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-white">{character.ultimate.name}</span>
          </div>
          <p className="text-xs text-muted-foreground">{character.ultimate.description}</p>
        </div>
        {episode ? (
          <div className="border-t border-primary/20 pt-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <BookOpen className="h-3 w-3 shrink-0 text-primary" />
                <span className="truncate text-[10px] font-bold uppercase tracking-widest text-primary">
                  Episode &middot; {episode.title}
                </span>
              </div>
              <span className="shrink-0 font-mono text-[9px] uppercase text-muted-foreground">
                {status === 'completed' ? 'Complete' : status === 'locked' ? 'Locked' : `${progress}/${episode.objective.targetCount}`}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{status === 'completed' ? episode.completionText : episode.teaser}</p>
            {onLaunchEpisode && status !== 'locked' ? (
              <button
                type="button"
                onClick={() => onLaunchEpisode(episode.id, episode.areaId)}
                className="mt-2 w-full border border-primary/40 bg-primary/10 px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest text-primary hover:bg-primary hover:text-primary-foreground"
                data-testid={`button-episode-${episode.id}`}
              >
                {status === 'completed' ? 'Replay episode' : status === 'in-progress' ? 'Continue episode' : 'Play episode'}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CharacterTile({
  character,
  selected,
  onSelect,
}: {
  character: CharacterDef;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`terminal-frame flex flex-col items-center gap-2 border p-3 text-center transition-colors ${
        selected ? 'border-primary bg-primary/10' : 'border-border bg-card hover:border-primary/50'
      }`}
      data-testid={`button-character-${character.id}`}
    >
      <div className="grid h-14 w-14 place-items-center border border-border bg-black/40">
        <RigPortrait rig={character.rig} palette={character.palette} anim="idle" size={48} />
      </div>
      <span className="w-full truncate text-[10px] font-black uppercase tracking-wide text-white">{character.name}</span>
    </button>
  );
}

function LockedCharacterTile({ character }: { character: CharacterDef }) {
  return (
    <div
      className="flex flex-col items-center gap-2 border border-border/60 bg-card/30 p-3 text-center opacity-60"
      data-testid={`character-locked-${character.id}`}
    >
      <div className="grid h-14 w-14 place-items-center border border-border bg-black/30">
        <LockKeyhole className="h-5 w-5 text-muted-foreground" />
      </div>
      <span className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">???</span>
      <p className="text-[9px] leading-tight text-primary/80">{describeUnlock(character.unlock)}</p>
    </div>
  );
}

export function CharacterSelect({ onBack, onConfirm, onLaunchEpisode }: CharacterSelectProps) {
  const { unlockedCharacters, lockedCharacters, selectedCharacter, selectCharacter, meta } = useMeta();
  const layout = meta.uiPanelLayout;

  return (
    <ScreenLayout
      title="Roster"
      subtitle="Assemble the crew"
      onBack={onBack}
      action={
        <button
          type="button"
          onClick={onConfirm}
          className="px-6 py-4 bg-primary text-primary-foreground font-black uppercase tracking-widest text-sm hover:bg-white transition-colors"
          data-testid="button-confirm-character"
        >
          Take {selectedCharacter.name} out
        </button>
      }
    >
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <CharacterAbilityVisualizer character={selectedCharacter} />
        <LokPetVariantSheet />

        {layout === 'rail' ? (
          <div className="grid gap-4 lg:grid-cols-[20rem_1fr]" data-testid="section-roster-grid">
            <CharacterDetail character={selectedCharacter} meta={meta} onLaunchEpisode={onLaunchEpisode} />
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {unlockedCharacters.map((character) => (
                <CharacterTile
                  key={character.id}
                  character={character}
                  selected={character.id === selectedCharacter.id}
                  onSelect={() => selectCharacter(character.id)}
                />
              ))}
              {lockedCharacters.map((character) => (
                <LockedCharacterTile key={character.id} character={character} />
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 [grid-auto-flow:dense]" data-testid="section-roster-grid">
            {unlockedCharacters.map((character) => (
              <Fragment key={character.id}>
                <CharacterTile
                  character={character}
                  selected={character.id === selectedCharacter.id}
                  onSelect={() => selectCharacter(character.id)}
                />
                {character.id === selectedCharacter.id ? (
                  <div className="col-span-full">
                    <CharacterDetail character={selectedCharacter} meta={meta} onLaunchEpisode={onLaunchEpisode} inline />
                  </div>
                ) : null}
              </Fragment>
            ))}
            {lockedCharacters.map((character) => (
              <LockedCharacterTile key={character.id} character={character} />
            ))}
          </div>
        )}
      </div>
    </ScreenLayout>
  );
}

export default CharacterSelect;
