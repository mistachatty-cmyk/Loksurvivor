/**
 * Roster / character picker. Owned by the design pass -- keep the export
 * name and props stable.
 */
import { Fragment, useEffect } from 'react';
import { BookOpen, LockKeyhole, Zap } from 'lucide-react';

import { describeUnlock, effectiveStats, episodeProgress, episodeStatus, useMeta } from '@/game/state/metaStore';
import { CHARACTER_EPISODE_BY_CHARACTER_ID } from '@/game/data/episodes';
import { getCharacterSkins, isCharacterSkinUnlocked, resolveCharacterCosmeticPalette, type CharacterSkinDef } from '@/game/data/characterSkins';
import { characterMasteryKills, characterMasteryLevel, killsForMasteryLevel, MASTERY_SKIN_LEVELS } from '@/game/data/characterMastery';
import { DEFAULT_PALETTE_ID, getActivePalette, getThemePalette } from '@/game/data/themedPalettes';
import type { CharacterDef, MetaState } from '@/game/types';
import { ScreenLayout } from './ScreenLayout';
import { RigPortrait } from './RigPortrait';
import { CharacterAbilityVisualizer } from './CharacterAbilityVisualizer';
import { LokPetIcon, LokPetVariantSheet } from './LokPetVariantSheet';
import { WeaponIcon } from './WeaponIcon';
import { CosmeticPreview } from './CosmeticPreview';
import { getRunAuraStyle } from '@/game/data/runAuras';
import { getHatStyle } from '@/game/data/hats';
import { getCelebrationStyle } from '@/game/data/celebrations';
import type { RunModifiers } from '@/game/types';

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
  onSelectSkin,
}: {
  character: CharacterDef;
  meta: MetaState;
  onLaunchEpisode?: (episodeId: string, areaId: string) => void;
  inline?: boolean;
  onSelectSkin: (characterId: string, skinId: string) => void;
}) {
  const stats = effectiveStats(character, meta);
  const episode = CHARACTER_EPISODE_BY_CHARACTER_ID[character.id];
  const status = episode ? episodeStatus(episode.id, meta) : 'locked';
  const progress = episode ? episodeProgress(episode.id, meta) : 0;
  const skins = getCharacterSkins(character);
  const selectedSkinId = meta.characterSkinByCharacterId[character.id] ?? skins[0]!.id;
  const worldPalette = meta.activePaletteId === DEFAULT_PALETTE_ID ? undefined : getActivePalette(meta.activePaletteId);
  const displayPalette = resolveCharacterCosmeticPalette(character, selectedSkinId, worldPalette, meta.worldPaletteBlendEnabled);
  const paletteEffect = meta.paletteAnimationsEnabled ? getThemePalette(meta.activePaletteId)?.effect?.kind : undefined;
  const masteryLevel = characterMasteryLevel(character.id, meta);
  const masteryKills = characterMasteryKills(character.id, meta);
  const nextMasteryTier = MASTERY_SKIN_LEVELS.find((tier) => masteryLevel < tier);
  const nextMasterySkin = nextMasteryTier ? skins.find((skin) => skin.requiredMasteryLevel === nextMasteryTier) : undefined;
  const skinLockReason = (skin: CharacterSkinDef) => {
    if (skin.requiredMasteryLevel) return `reach Mastery Level ${skin.requiredMasteryLevel} to unlock`;
    if (skin.episodeRequired) return 'complete episode to unlock';
    return undefined;
  };

  return (
    <div
      className={`terminal-frame border border-border bg-card p-4 ${inline ? 'flex flex-wrap gap-5' : 'flex flex-col gap-4'}`}
      data-testid={`section-character-detail-${character.id}`}
    >
      <div className="flex shrink-0 items-center gap-3">
        <CosmeticPreview rig={character.rig} palette={displayPalette} aura={getRunAuraStyle(meta.activeRunAuraId)} hat={getHatStyle(meta.activeHatId)} celebration={getCelebrationStyle(meta.activeCelebrationId)} paletteEffect={paletteEffect} compact />
        <div className="min-w-0">
          {character.rarity === 'legendary' ? <span className="font-mono text-[8px] font-black uppercase tracking-[0.22em] text-amber-300">Legendary</span> : null}
          <h3 className="terminal-glow truncate text-lg font-black uppercase leading-tight text-white">{character.name}</h3>
          <p className="truncate text-[11px] font-bold uppercase tracking-wider text-primary">{character.handle}</p>
        </div>
      </div>

      <div className={`border border-primary/20 bg-black/20 p-3 ${inline ? 'min-w-[16rem] flex-1' : ''}`} data-testid={`character-skins-${character.id}`}>
        <div className="flex items-center justify-between gap-2">
          <p className="font-mono text-[9px] font-bold uppercase tracking-widest text-primary">Personal skins</p>
          <span className="font-mono text-[8px] uppercase text-muted-foreground">{meta.worldPaletteBlendEnabled ? 'World blend on' : 'Personal only'}</span>
        </div>
        <p className="mt-1 font-mono text-[9px] uppercase tracking-widest text-muted-foreground" data-testid={`character-mastery-${character.id}`}>
          Mastery Level <span className="text-white">{masteryLevel}</span> · {masteryKills.toLocaleString()} kills
        </p>
        <div className="mt-2 grid grid-cols-4 gap-1.5">
          {skins.map((skin) => {
            const locked = !isCharacterSkinUnlocked(skin, meta);
            const selected = selectedSkinId === skin.id;
            return (
              <button
                key={skin.id}
                type="button"
                onClick={() => { if (!locked) onSelectSkin(character.id, skin.id); }}
                disabled={locked}
                aria-pressed={selected}
                aria-label={`${skin.name}${locked ? `, ${skinLockReason(skin) ?? 'locked'}` : ''}`}
                className={`min-w-0 border p-1.5 text-left transition-colors ${selected ? 'border-primary bg-primary/10' : 'border-white/15 bg-black/25'} disabled:opacity-35`}
                data-testid={`button-character-skin-${skin.style}`}
              >
                <span className="flex h-5 overflow-hidden border border-white/10">
                  {[skin.palette.body, skin.palette.accent, skin.palette.glow].map((color) => <span key={color} className="flex-1" style={{ backgroundColor: color }} />)}
                </span>
                <span className="mt-1 block truncate font-mono text-[7px] font-bold uppercase text-white/75">{locked ? 'Locked' : skin.name}</span>
              </button>
            );
          })}
        </div>
        {status !== 'completed' ? (
          <p className="mt-2 text-[9px] text-muted-foreground">
            {episode ? <>Complete <span className="text-primary">{episode.title}</span> to unlock Afterstory.</> : 'Afterstory unlocks when this character’s episode arrives.'}
          </p>
        ) : null}
        {nextMasteryTier && nextMasterySkin ? (
          <p className="mt-1 text-[9px] text-muted-foreground">
            {(killsForMasteryLevel(nextMasteryTier) - masteryKills).toLocaleString()} more kills to <span className="text-primary">{nextMasterySkin.name}</span> (Mastery {nextMasteryTier}).
          </p>
        ) : null}
      </div>

      <div className={inline ? 'min-w-[14rem] flex-1' : ''}>
        <p className="text-xs italic text-muted-foreground">&ldquo;{character.tagline}&rdquo;</p>
        {character.signatureTraits ? (
          <div className="mt-2 flex flex-wrap gap-1.5" data-testid={`character-traits-${character.id}`}>
            {character.signatureTraits.map((trait) => (
              <span key={trait} className="border border-primary/30 bg-primary/10 px-2 py-1 font-mono text-[8px] font-bold uppercase tracking-wider text-primary">{trait}</span>
            ))}
          </div>
        ) : null}
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
            <WeaponIcon weaponId={character.weapon.id} kind={character.weapon.kind} color={character.weapon.color ?? displayPalette.accent} size={24} label={character.weapon.name} />
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
  palette,
}: {
  character: CharacterDef;
  selected: boolean;
  onSelect: () => void;
  palette: CharacterDef['palette'];
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
      style={character.rarity === 'legendary' ? { boxShadow: `0 0 18px ${palette.glow}33` } : undefined}
    >
      <div className="grid h-14 w-14 place-items-center border border-border bg-black/40">
        <RigPortrait rig={character.rig} palette={palette} anim="idle" size={48} />
      </div>
      <span className="w-full truncate text-[10px] font-black uppercase tracking-wide text-white">{character.name}</span>
      {character.rarity === 'legendary' ? <span className="font-mono text-[7px] font-black uppercase tracking-[0.2em] text-amber-300">Legendary</span> : null}
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

const RUN_MODIFIER_OPTIONS: Array<{ key: keyof RunModifiers; name: string; description: string }> = [
  { key: 'doubleMode', name: '2x Mode', description: 'Doubled spawn rate and a flat hp bump on any run. Stacks with everything else here.' },
  { key: 'quadSpawnMode', name: '4x Spawns', description: 'Optional fourfold wave pressure. If 2x Mode is also on, 4x wins for spawns while its hp bump remains.' },
  { key: 'unleashedMode', name: 'Unleashed 1000', description: 'Up to 1,000 live enemies with optimized 8x pressure. Overrides other spawn-rate toggles, but keeps their hp effects.' },
  { key: 'invertedMap', name: 'Invert', description: 'Mirrors the area layout left-to-right.' },
  { key: 'speedMode', name: 'Speed Mode', description: 'Raises player and enemy movement speed.' },
  { key: 'scalerMode', name: 'Scaler', description: "Enemy hp scales up with your level as the run goes." },
  { key: 'infiniteMode', name: 'Infinite Mode', description: 'The clock never runs out -- the final wave repeats and escalates instead.' },
  { key: 'hordeSpinEnabled', name: 'HordeSpin', description: 'Every 45s, spin a wheel for a scaled horde event and a reward. 5x5 and 666 are rare.' },
];

function RunModifiersChecklist({ modifiers, onToggle }: { modifiers: RunModifiers; onToggle: (key: keyof RunModifiers) => void }) {
  return (
    <section className="border border-primary/30 bg-card p-4" data-testid="section-run-modifiers">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="font-mono text-[9px] font-bold uppercase tracking-widest text-primary">Run modifiers</p>
          <h2 className="mt-1 text-lg font-black uppercase text-white">Check off before you go out</h2>
        </div>
        <span className="font-mono text-[10px] uppercase text-muted-foreground">Applies to every run</span>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {RUN_MODIFIER_OPTIONS.map((option) => {
          const checked = modifiers[option.key] === true;
          return (
            <button
              key={option.key}
              type="button"
              onClick={() => onToggle(option.key)}
              aria-pressed={checked}
              className={`flex items-start gap-2 border p-2.5 text-left transition-colors ${checked ? 'border-primary bg-primary/10' : 'border-border bg-black/20 hover:border-primary/50'}`}
              data-testid={`button-toggle-modifier-${option.key}`}
            >
              <span
                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center border font-mono text-[9px] ${checked ? 'border-primary bg-primary text-primary-foreground' : 'border-white/30 text-transparent'}`}
              >
                &#10003;
              </span>
              <span className="min-w-0">
                <span className="block text-[11px] font-bold uppercase tracking-wide text-white">{option.name}</span>
                <span className="block text-[10px] leading-snug text-muted-foreground">{option.description}</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function CharacterSelect({ onBack, onConfirm, onLaunchEpisode }: CharacterSelectProps) {
  const { unlockedCharacters, lockedCharacters, selectedCharacter, selectCharacter, selectCharacterSkin, setUiPanelLayout, meta, toggleSavedLokPet, restoreSavedLokPet, refreshPetElixirs, toggleRunModifier } = useMeta();

  useEffect(() => {
    refreshPetElixirs();
    const timer = window.setInterval(refreshPetElixirs, 60_000);
    return () => window.clearInterval(timer);
  }, [refreshPetElixirs]);
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
        <div className="sticky top-0 z-30 flex items-center justify-between gap-2 border border-border bg-background/95 p-2 backdrop-blur" data-testid="roster-layout-toggle">
          <div><p className="font-mono text-[9px] uppercase tracking-widest text-primary">Roster view</p><p className="text-[10px] text-muted-foreground">Switch without leaving this page.</p></div>
          <div className="grid grid-cols-2 gap-1">
            <button type="button" onClick={() => setUiPanelLayout('slideout')} aria-pressed={layout === 'slideout'} className={`border px-3 py-2 font-mono text-[9px] uppercase ${layout === 'slideout' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}>Compact</button>
            <button type="button" onClick={() => setUiPanelLayout('rail')} aria-pressed={layout === 'rail'} className={`border px-3 py-2 font-mono text-[9px] uppercase ${layout === 'rail' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}>Original</button>
          </div>
        </div>
        <RunModifiersChecklist modifiers={meta.runModifiers} onToggle={toggleRunModifier} />
        <details className="border border-border bg-card/40 p-3" data-testid="character-combat-preview">
          <summary className="cursor-pointer font-mono text-[10px] font-bold uppercase tracking-widest text-primary">Weapon &amp; ability preview</summary>
          <div className="mt-3"><CharacterAbilityVisualizer character={{ ...selectedCharacter, palette: resolveCharacterCosmeticPalette(selectedCharacter, meta.characterSkinByCharacterId[selectedCharacter.id], meta.activePaletteId === DEFAULT_PALETTE_ID ? undefined : getActivePalette(meta.activePaletteId), meta.worldPaletteBlendEnabled) }} /></div>
        </details>
        {meta.savedLokPets.length > 0 ? (
          <section className="border border-pink-300/30 bg-card p-4" data-testid="section-pet-loadout">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-black uppercase text-white">LokPet loadout</h2>
                <p className="text-xs text-muted-foreground">Select up to three saved companions. Elixirs regenerate 3 every 20 minutes.</p>
              </div>
              <span className="font-mono text-sm text-pink-200">{meta.petElixirs} elixir</span>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {meta.savedLokPets.map((pet) => {
                const selected = meta.selectedLokPetIds.includes(pet.id);
                return (
                  <article key={pet.id} className={`flex items-center gap-2 border p-2 ${selected ? 'border-pink-300 bg-pink-300/10' : 'border-white/15'}`}>
                    <LokPetIcon silhouette={pet.roll.silhouette} palette={pet.roll.palette} size={30} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[10px] font-bold uppercase text-white">{pet.roll.name}</p>
                      <p className="text-[9px] text-muted-foreground">{pet.roll.rarityLabel} · {pet.stamina}/3 charge</p>
                    </div>
                    {pet.stamina > 0 ? (
                      <button type="button" onClick={() => toggleSavedLokPet(pet.id)} className="border px-2 py-1 font-mono text-[8px] uppercase text-pink-100">
                        {selected ? 'Packed' : 'Pack'}
                      </button>
                    ) : (
                      <button type="button" onClick={() => restoreSavedLokPet(pet.id)} disabled={meta.petElixirs < 1} className="border px-2 py-1 font-mono text-[8px] uppercase text-pink-100 disabled:opacity-40">
                        Restore
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}
        <LokPetVariantSheet />

        {layout === 'rail' ? (
          <div className="grid gap-4 lg:grid-cols-[20rem_1fr]" data-testid="section-roster-grid">
            <CharacterDetail character={selectedCharacter} meta={meta} onLaunchEpisode={onLaunchEpisode} onSelectSkin={selectCharacterSkin} />
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {unlockedCharacters.map((character) => (
                <CharacterTile
                  key={character.id}
                  character={character}
                  selected={character.id === selectedCharacter.id}
                  onSelect={() => selectCharacter(character.id)}
                  palette={resolveCharacterCosmeticPalette(character, meta.characterSkinByCharacterId[character.id], meta.activePaletteId === DEFAULT_PALETTE_ID ? undefined : getActivePalette(meta.activePaletteId), meta.worldPaletteBlendEnabled)}
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
                  palette={resolveCharacterCosmeticPalette(character, meta.characterSkinByCharacterId[character.id], meta.activePaletteId === DEFAULT_PALETTE_ID ? undefined : getActivePalette(meta.activePaletteId), meta.worldPaletteBlendEnabled)}
                />
                {character.id === selectedCharacter.id ? (
                  <div className="col-span-full">
                    <CharacterDetail character={selectedCharacter} meta={meta} onLaunchEpisode={onLaunchEpisode} onSelectSkin={selectCharacterSkin} inline />
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
