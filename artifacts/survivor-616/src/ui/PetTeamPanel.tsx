/**
 * Pet Whisperer roster: pick which earned LokPets guarantee-spawn (permanent,
 * no expiry) at the start of every run.
 */
import { LOKPET_RARITY_COLORS, MAX_PET_TEAM_SIZE, PET_WHISPERER_VENDOR_ID } from '@/game/data/lokPets';
import { vendorPurchaseCount } from '@/game/data/vendor';
import { useMeta } from '@/game/state/metaStore';
import { ScreenLayout } from './ScreenLayout';
import { LokPetIcon } from './LokPetVariantSheet';
import { Sparkles, Lock, Check } from 'lucide-react';

export interface PetTeamPanelProps {
  onBack: () => void;
}

export function PetTeamPanel({ onBack }: PetTeamPanelProps) {
  const { meta, setPetTeam } = useMeta();
  const unlocked = vendorPurchaseCount(meta, PET_WHISPERER_VENDOR_ID) > 0;
  const team = new Set(meta.petTeamIds);

  function toggle(id: string) {
    if (team.has(id)) {
      setPetTeam(meta.petTeamIds.filter((petId) => petId !== id));
    } else if (team.size < MAX_PET_TEAM_SIZE) {
      setPetTeam([...meta.petTeamIds, id]);
    }
  }

  return (
    <ScreenLayout title="Pet team" subtitle="Field your earned LokPets" onBack={onBack}>
      <div className="mx-auto mt-4 w-full max-w-4xl space-y-6">
        {!unlocked ? (
          <div className="terminal-frame flex items-center gap-3 border border-border bg-card p-4">
            <Lock className="h-5 w-5 shrink-0 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              Buy <span className="font-bold text-white">Pet Whisperer</span> from the Quartermaster to keep the LokPets
              you roll from chests and bring a team of them into every run.
            </p>
          </div>
        ) : (
          <>
            <div className="terminal-frame flex flex-wrap items-center justify-between gap-3 border border-border bg-card p-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-pink-300" />
                <p className="text-xs text-muted-foreground">
                  Team pets never expire during a run. Bring up to {MAX_PET_TEAM_SIZE}.
                </p>
              </div>
              <span className="font-mono text-sm font-bold text-white">
                {team.size} / {MAX_PET_TEAM_SIZE} selected
              </span>
            </div>

            {meta.ownedLokPets.length === 0 ? (
              <p className="p-4 text-center text-xs text-muted-foreground">
                No LokPets earned yet. Roll a blue box during a run to add one to your roster.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3" data-testid="grid-pet-team">
                {meta.ownedLokPets.map((pet) => {
                  const selected = team.has(pet.id);
                  const disabled = !pet.alive || (!selected && team.size >= MAX_PET_TEAM_SIZE);
                  return (
                    <button
                      key={pet.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => toggle(pet.id)}
                      data-testid={`button-pet-team-${pet.id}`}
                      className={`terminal-frame flex items-center gap-3 border p-3 text-left transition-colors ${
                        selected
                          ? 'border-primary bg-primary/10'
                          : disabled
                            ? 'border-border/40 bg-black/20 opacity-50'
                            : 'border-border bg-card hover:border-primary/60'
                      }`}
                    >
                      <LokPetIcon silhouette={pet.roll.silhouette} palette={pet.roll.palette} size={40} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-black uppercase tracking-wide text-white">{pet.roll.name}</p>
                        <p
                          className="truncate text-[10px] uppercase tracking-wider"
                          style={{ color: LOKPET_RARITY_COLORS[pet.roll.rarity] }}
                        >
                          {pet.roll.rarityLabel} · {pet.roll.traitLabel}
                        </p>
                        {!pet.alive && (
                          <p className="text-[10px] uppercase tracking-wider text-destructive">Fallen</p>
                        )}
                      </div>
                      {selected && <Check className="h-4 w-4 shrink-0 text-primary" />}
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </ScreenLayout>
  );
}

export default PetTeamPanel;
