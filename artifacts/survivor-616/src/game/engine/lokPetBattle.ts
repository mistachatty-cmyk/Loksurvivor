import type {
  BattleFloatingText,
  BattleLogEntry,
  BattlePet,
  BattleRewards,
  BattleState,
  BattleStatusEffect,
  LeagueTierDef,
  LokPetBattleMove,
} from '@/game/engine/lokPetBattleTypes';
import {
  BATTLE_MOVES,
  BATTLE_TRINKETS,
  LEAGUE_TIERS,
  getElementalMultiplier,
} from '@/game/data/lokPetBattles';
import {
  LOKPET_VARIANTS,
  rollLokPet,
} from '@/game/data/lokPets';
import type { LokPetElement, SavedLokPet } from '@/game/types';

/** Experience required for next level: quadratic curve */
export function getExpForLevel(level: number): number {
  return Math.floor(50 * Math.pow(level, 1.4));
}

/** Assign 4 battle moves based on pet element and variant */
export function assignBattleMoves(
  variantId: string,
  element: LokPetElement,
): LokPetBattleMove[] {
  const moves: LokPetBattleMove[] = [];

  // 1. Basic Strike
  moves.push(element === 'slow' ? BATTLE_MOVES['quick-claw'] : BATTLE_MOVES['tackle']);

  // 2. Elemental Skill
  if (element === 'fire') {
    moves.push(BATTLE_MOVES['ember-spit']);
  } else if (element === 'freeze') {
    moves.push(BATTLE_MOVES['frost-shard']);
  } else if (element === 'slow') {
    moves.push(BATTLE_MOVES['chrono-dampener']);
  } else {
    moves.push(BATTLE_MOVES['kinetic-cannon']);
  }

  // 3. Tactical / Support Move
  if (variantId === 'cosmic-axolotl' || variantId === 'rain-jelly') {
    moves.push(BATTLE_MOVES['starlight-remedy']);
  } else {
    moves.push(BATTLE_MOVES['barrier-shield']);
  }

  // 4. Apex Ultimate Finisher
  if (variantId === 'cyber-hydra') {
    moves.push(BATTLE_MOVES['tri-laser-salvo']);
  } else if (variantId === 'plasma-kitsune') {
    moves.push(BATTLE_MOVES['plasma-foxfire']);
  } else if (variantId === 'nano-phoenix') {
    moves.push(BATTLE_MOVES['nanite-rebirth']);
  } else if (variantId === 'titan-colossus') {
    moves.push(BATTLE_MOVES['seismic-fissure']);
  } else if (variantId === 'byte-serpent') {
    moves.push(BATTLE_MOVES['glitch-byte-decay']);
  } else if (variantId === 'storm-griffin') {
    moves.push(BATTLE_MOVES['thunder-dive']);
  } else if (variantId === 'chrono-hare') {
    moves.push(BATTLE_MOVES['time-dilation']);
  } else if (element === 'fire') {
    moves.push(BATTLE_MOVES['inferno-pillar']);
  } else if (element === 'freeze') {
    moves.push(BATTLE_MOVES['blizzard-burst']);
  } else if (element === 'slow') {
    moves.push(BATTLE_MOVES['time-dilation']);
  } else {
    moves.push(BATTLE_MOVES['hyper-beam']);
  }

  return moves;
}

/** Converts a SavedLokPet from the player's kennel into a BattlePet */
export function convertSavedPetToBattlePet(savedPet: SavedLokPet): BattlePet {
  const roll = savedPet.roll;
  const level = savedPet.level && savedPet.level >= 1 ? savedPet.level : 1;
  const exp = savedPet.exp || 0;
  const expToNext = getExpForLevel(level);

  // Scaled stats
  const baseHp = roll.stats?.health || 100;
  const baseDmg = roll.stats?.damage || 20;
  const baseSpd = roll.stats?.moveSpeed || 150;

  const maxHp = Math.floor((baseHp + 60) * (1 + level * 0.08));
  const attack = Math.floor((baseDmg + 12) * (1 + level * 0.07));
  const defense = Math.floor(12 + level * 1.6);
  const speed = Math.floor(baseSpd * 0.1 + level * 0.9);

  // Trinket stat adjustments
  let trinketBonusHp = 0;
  let trinketBonusAtk = 0;
  let trinketBonusDef = 0;
  let trinketBonusSpd = 0;
  let trinketBonusCrit = 0;
  let startingEnergy = 0;

  if (savedPet.equippedTrinket) {
    const trinket = BATTLE_TRINKETS.find((t) => t.id === savedPet.equippedTrinket);
    if (trinket) {
      trinketBonusHp = trinket.statBonus.hp || 0;
      trinketBonusAtk = trinket.statBonus.attack || 0;
      trinketBonusDef = trinket.statBonus.defense || 0;
      trinketBonusSpd = trinket.statBonus.speed || 0;
      trinketBonusCrit = trinket.statBonus.critRate || 0;
      startingEnergy = trinket.statBonus.initialEnergy || 0;
    }
  }

  const finalMaxHp = maxHp + trinketBonusHp;
  const moves = assignBattleMoves(roll.variantId, roll.element);

  return {
    id: `battle-${savedPet.id}-${Date.now()}`,
    originalSavedPetId: savedPet.id,
    name: roll.name,
    variantId: roll.variantId,
    silhouette: roll.silhouette,
    palette: roll.palette,
    family: roll.family,
    element: roll.element,
    elementLabel: roll.elementLabel,
    rarity: roll.rarity,
    level,
    exp,
    expToNext,
    hp: finalMaxHp,
    maxHp: finalMaxHp,
    energy: startingEnergy,
    maxEnergy: 100,
    attack: attack + trinketBonusAtk,
    defense: defense + trinketBonusDef,
    speed: speed + trinketBonusSpd,
    critRate: 0.1 + trinketBonusCrit,
    moves,
    statusEffects: [],
    isGuarding: false,
    fainted: false,
    battlesWon: savedPet.battlesWon || 0,
    equippedTrinket: savedPet.equippedTrinket,
    starter: savedPet.starter,
  };
}

/** Generates an authored or random opponent BattlePet */
export function generateOpponentPet(
  variantId: string,
  level: number,
  customName?: string,
): BattlePet {
  const roll = rollLokPet(() => 0.5, { fixedVariantId: variantId });
  const expToNext = getExpForLevel(level);

  const baseHp = roll.stats?.health || 100;
  const baseDmg = roll.stats?.damage || 20;
  const baseSpd = roll.stats?.moveSpeed || 150;

  const maxHp = Math.floor((baseHp + 60) * (1 + level * 0.08));
  const attack = Math.floor((baseDmg + 12) * (1 + level * 0.07));
  const defense = Math.floor(12 + level * 1.6);
  const speed = Math.floor(baseSpd * 0.1 + level * 0.9);

  const moves = assignBattleMoves(roll.variantId, roll.element);

  return {
    id: `enemy-${variantId}-${level}-${Math.random().toString(36).substring(2, 7)}`,
    name: customName || roll.name,
    variantId: roll.variantId,
    silhouette: roll.silhouette,
    palette: roll.palette,
    family: roll.family,
    element: roll.element,
    elementLabel: roll.elementLabel,
    rarity: roll.rarity,
    level,
    exp: 0,
    expToNext,
    hp: maxHp,
    maxHp,
    energy: 15,
    maxEnergy: 100,
    attack,
    defense,
    speed,
    critRate: 0.08,
    moves,
    statusEffects: [],
    isGuarding: false,
    fainted: false,
    battlesWon: 0,
  };
}

/** Initializes a new BattleState */
export function createBattle(options: {
  gameMode: BattleState['gameMode'];
  tierDef?: LeagueTierDef;
  playerPets: SavedLokPet[];
  dummyPresetId?: string;
  dummyCustomVariant?: string;
  dummyLevel?: number;
}): BattleState {
  let playerTeam = options.playerPets.map(convertSavedPetToBattlePet);

  // Fallback starter companion if player has no kennel pets yet!
  if (playerTeam.length === 0) {
    const starterRoll = rollLokPet(() => 0.42, { fixedVariantId: 'cinder-pouncer' });
    const starterSaved: SavedLokPet = {
      id: 'starter-companion',
      roll: starterRoll,
      stamina: 3,
      level: 5,
      exp: 0,
      battlesWon: 0,
      battlesFought: 0,
    };
    playerTeam = [convertSavedPetToBattlePet(starterSaved)];
  }

  // Generate Enemy Team
  let enemyTeam: BattlePet[] = [];
  if (options.tierDef) {
    enemyTeam = options.tierDef.team.map((entry) =>
      generateOpponentPet(entry.variantId, entry.level, entry.name),
    );
  } else if (options.gameMode === 'endless-gauntlet') {
    const gauntletLevel = 5 + Math.floor(Math.random() * 5);
    const variants = LOKPET_VARIANTS.map((v) => v.id);
    const randomVariant = variants[Math.floor(Math.random() * variants.length)];
    enemyTeam = [generateOpponentPet(randomVariant, gauntletLevel)];
  } else {
    // Test Sparring
    const level = options.dummyLevel || 10;
    const variantId = options.dummyCustomVariant || 'gyro-sentry';
    enemyTeam = [generateOpponentPet(variantId, level, 'Sparring Partner')];
  }

  const activePlayerPet = playerTeam[0];
  const activeEnemyPet = enemyTeam[0];

  // Faster pet takes first turn
  const currentTurnActor = activePlayerPet.speed >= activeEnemyPet.speed ? 'player' : 'enemy';

  const initialLog: BattleLogEntry[] = [
    {
      id: `log-start-${Date.now()}`,
      text: `Battle initiated! ${activePlayerPet.name} (Lv.${activePlayerPet.level}) enters against ${activeEnemyPet.name} (Lv.${activeEnemyPet.level})!`,
      type: 'system',
      timestamp: Date.now(),
    },
  ];

  return {
    gameMode: options.gameMode,
    tierId: options.tierDef?.id,
    floor: 1,
    playerTeam,
    activePlayerIndex: 0,
    enemyTeam,
    activeEnemyIndex: 0,
    turn: 1,
    currentTurnActor,
    phase: 'select-action',
    combatLog: initialLog,
    floatingTexts: [],
    cheerAvailable: true,
    autoBattle: false,
    battleSpeed: 1,
  };
}

/** Execute a chosen Move */
export function executeMove(
  state: BattleState,
  moveId: string,
  actorSide: 'player' | 'enemy',
): BattleState {
  const next = { ...state };
  next.combatLog = [...state.combatLog];
  next.floatingTexts = [...state.floatingTexts];

  const isPlayer = actorSide === 'player';
  const attacker = isPlayer ? next.playerTeam[next.activePlayerIndex] : next.enemyTeam[next.activeEnemyIndex];
  const defender = isPlayer ? next.enemyTeam[next.activeEnemyIndex] : next.playerTeam[next.activePlayerIndex];

  if (!attacker || !defender || attacker.fainted || defender.fainted) {
    return next;
  }

  const move = attacker.moves.find((m) => m.id === moveId) || attacker.moves[0];

  // Deduct energy or generate basic energy
  if (move.energyCost > 0) {
    attacker.energy = Math.max(0, attacker.energy - move.energyCost);
  } else {
    attacker.energy = Math.min(attacker.maxEnergy, attacker.energy + 20);
  }

  // Clear guard on turn start
  attacker.isGuarding = false;

  // Set animation
  next.activeAnimation = {
    active: true,
    animKind: move.animation,
    target: isPlayer ? 'enemy' : 'player',
    attacker: isPlayer ? 'player' : 'enemy',
    moveName: move.name,
    startedAt: Date.now(),
    durationMs: 700 / next.battleSpeed,
  };

  // Support / Healing Moves
  if (move.kind === 'guard') {
    attacker.isGuarding = true;
    attacker.statusEffects.push({
      type: 'shield',
      duration: 2,
      value: Math.floor(attacker.defense * 1.5),
      sourcePetName: attacker.name,
    });
    next.combatLog.unshift({
      id: `log-${Date.now()}-${Math.random()}`,
      text: `${attacker.name} deployed ${move.name}! Defense bolstered and incoming damage reduced!`,
      type: 'action',
      timestamp: Date.now(),
    });
    next.floatingTexts.push({
      id: `float-guard-${Date.now()}`,
      text: 'SHIELD UP!',
      color: '#38bdf8',
      target: isPlayer ? 'player' : 'enemy',
      type: 'status',
      createdAt: Date.now(),
    });
  } else if (move.id === 'starlight-remedy') {
    const healAmount = Math.floor(attacker.maxHp * 0.4);
    attacker.hp = Math.min(attacker.maxHp, attacker.hp + healAmount);
    attacker.statusEffects = attacker.statusEffects.filter((e) => e.type !== 'burn' && e.type !== 'slow');
    next.combatLog.unshift({
      id: `log-${Date.now()}-${Math.random()}`,
      text: `${attacker.name} used ${move.name}, recovering +${healAmount} HP and curing ailments!`,
      type: 'action',
      timestamp: Date.now(),
    });
    next.floatingTexts.push({
      id: `float-heal-${Date.now()}`,
      text: `+${healAmount} HP`,
      color: '#4ade80',
      target: isPlayer ? 'player' : 'enemy',
      type: 'heal',
      createdAt: Date.now(),
    });
  } else {
    // Attack calculation
    const accuracyRoll = Math.random();
    if (accuracyRoll > move.accuracy) {
      next.combatLog.unshift({
        id: `log-${Date.now()}-${Math.random()}`,
        text: `${attacker.name}'s ${move.name} missed the target!`,
        type: 'action',
        timestamp: Date.now(),
      });
      next.floatingTexts.push({
        id: `float-miss-${Date.now()}`,
        text: 'MISS',
        color: '#94a3b8',
        target: isPlayer ? 'enemy' : 'player',
        type: 'status',
        createdAt: Date.now(),
      });
    } else {
      // Hit lands!
      const isCrit = Math.random() < attacker.critRate;
      const critMultiplier = isCrit ? 1.75 : 1.0;
      const elementResult = getElementalMultiplier(move.element, defender.element);

      // Status boosts
      const empowered = attacker.statusEffects.some((e) => e.type === 'empower') ? 1.3 : 1.0;

      // Defense mitigation
      const effectiveDef = defender.isGuarding ? defender.defense * 1.8 : defender.defense;
      const rawDamage = (attacker.attack * move.power * 2.2 * empowered) / (1 + effectiveDef * 0.03);
      const variance = 0.9 + Math.random() * 0.2; // 90% - 110%
      let finalDamage = Math.max(1, Math.floor(rawDamage * critMultiplier * elementResult.multiplier * variance));

      // Shield absorption
      const shieldEffect = defender.statusEffects.find((e) => e.type === 'shield');
      if (shieldEffect) {
        finalDamage = Math.max(1, Math.floor(finalDamage * 0.5));
      }

      defender.hp = Math.max(0, defender.hp - finalDamage);

      // Defender generates energy from taking damage
      defender.energy = Math.min(defender.maxEnergy, defender.energy + Math.min(25, Math.floor(finalDamage * 0.35)));

      // Add floating damage text
      next.floatingTexts.push({
        id: `float-dmg-${Date.now()}-${Math.random()}`,
        text: `${isCrit ? 'CRIT! ' : ''}-${finalDamage}`,
        color: isCrit ? '#facc15' : elementResult.multiplier > 1.2 ? '#f97316' : '#ef4444',
        target: isPlayer ? 'enemy' : 'player',
        type: isCrit ? 'crit' : 'damage',
        createdAt: Date.now(),
      });

      if (elementResult.label) {
        next.floatingTexts.push({
          id: `float-elem-${Date.now()}-${Math.random()}`,
          text: elementResult.label,
          color: elementResult.multiplier > 1.0 ? '#38bdf8' : '#94a3b8',
          target: isPlayer ? 'enemy' : 'player',
          type: 'effective',
          createdAt: Date.now() + 150,
        });
      }

      // Log entry
      let logDesc = `${attacker.name} used ${move.name} dealing ${finalDamage} damage to ${defender.name}!`;
      if (isCrit) logDesc += ' (CRITICAL HIT!)';
      if (elementResult.label) logDesc += ` [${elementResult.label}]`;

      next.combatLog.unshift({
        id: `log-${Date.now()}-${Math.random()}`,
        text: logDesc,
        type: isCrit ? 'crit' : elementResult.multiplier > 1.2 ? 'effective' : 'damage',
        timestamp: Date.now(),
      });

      // Apply status effect if rolled
      if (move.statusEffect && Math.random() < move.statusEffect.chance) {
        defender.statusEffects.push({
          type: move.statusEffect.type,
          duration: move.statusEffect.duration,
          value: move.statusEffect.value,
          sourcePetName: attacker.name,
        });
        next.combatLog.unshift({
          id: `log-status-${Date.now()}`,
          text: `${defender.name} was inflicted with ${move.statusEffect.type.toUpperCase()}!`,
          type: 'status',
          timestamp: Date.now(),
        });
      }
    }
  }

  // Check faint
  if (defender.hp <= 0) {
    defender.fainted = true;
    next.combatLog.unshift({
      id: `log-faint-${Date.now()}`,
      text: `${defender.name} has collapsed!`,
      type: 'system',
      timestamp: Date.now(),
    });

    // Check if team is wiped
    const teamDefeated = isPlayer
      ? next.enemyTeam.every((p) => p.fainted)
      : next.playerTeam.every((p) => p.fainted);

    if (teamDefeated) {
      next.phase = isPlayer ? 'victory' : 'defeat';
      if (isPlayer) {
        next.rewards = calculateBattleRewards(next);
      }
      return next;
    } else {
      // Auto-switch to next alive teammate
      if (isPlayer) {
        const nextIndex = next.enemyTeam.findIndex((p) => !p.fainted);
        if (nextIndex !== -1) {
          next.activeEnemyIndex = nextIndex;
          next.combatLog.unshift({
            id: `log-switch-enemy-${Date.now()}`,
            text: `Opponent sent out ${next.enemyTeam[nextIndex].name}!`,
            type: 'switch',
            timestamp: Date.now(),
          });
        }
      } else {
        const nextIndex = next.playerTeam.findIndex((p) => !p.fainted);
        if (nextIndex !== -1) {
          next.activePlayerIndex = nextIndex;
          next.combatLog.unshift({
            id: `log-switch-player-${Date.now()}`,
            text: `Go, ${next.playerTeam[nextIndex].name}!`,
            type: 'switch',
            timestamp: Date.now(),
          });
        }
      }
    }
  }

  // Advance turn to other side
  next.currentTurnActor = isPlayer ? 'enemy' : 'player';
  if (!isPlayer) {
    next.turn += 1;
    applyEndOfTurnEffects(next);
  }

  return next;
}

/** Player Guards (reduces incoming damage by 50% and gains 25 SP) */
export function executeGuard(state: BattleState): BattleState {
  const next = { ...state };
  next.combatLog = [...state.combatLog];
  next.floatingTexts = [...state.floatingTexts];

  const pet = next.playerTeam[next.activePlayerIndex];
  if (!pet || pet.fainted) return next;

  pet.isGuarding = true;
  pet.energy = Math.min(pet.maxEnergy, pet.energy + 25);

  next.combatLog.unshift({
    id: `log-guard-${Date.now()}`,
    text: `${pet.name} braces into a protective stance (+25 SP)!`,
    type: 'action',
    timestamp: Date.now(),
  });

  next.floatingTexts.push({
    id: `float-guard-${Date.now()}`,
    text: 'GUARD +25 SP',
    color: '#38bdf8',
    target: 'player',
    type: 'status',
    createdAt: Date.now(),
  });

  next.currentTurnActor = 'enemy';
  return next;
}

/** Player Switches active pet */
export function executeSwitch(state: BattleState, targetIndex: number): BattleState {
  const next = { ...state };
  next.combatLog = [...state.combatLog];

  if (targetIndex < 0 || targetIndex >= next.playerTeam.length) return next;
  const targetPet = next.playerTeam[targetIndex];
  if (targetPet.fainted || targetIndex === next.activePlayerIndex) return next;

  next.activePlayerIndex = targetIndex;
  next.combatLog.unshift({
    id: `log-sw-${Date.now()}`,
    text: `Switched active companion to ${targetPet.name}!`,
    type: 'switch',
    timestamp: Date.now(),
  });

  // Switching consumes player turn
  next.currentTurnActor = 'enemy';
  return next;
}

/** Handler Cheer (Once per battle): restores +35 HP and +40 SP to active companion */
export function executeCheer(state: BattleState): BattleState {
  const next = { ...state };
  if (!next.cheerAvailable) return next;

  next.combatLog = [...state.combatLog];
  next.floatingTexts = [...state.floatingTexts];

  const pet = next.playerTeam[next.activePlayerIndex];
  if (!pet || pet.fainted) return next;

  next.cheerAvailable = false;
  pet.hp = Math.min(pet.maxHp, pet.hp + Math.floor(pet.maxHp * 0.35));
  pet.energy = Math.min(pet.maxEnergy, pet.energy + 40);
  pet.statusEffects.push({
    type: 'empower',
    duration: 2,
    value: 30,
    sourcePetName: 'Handler Cheer',
  });

  next.combatLog.unshift({
    id: `log-cheer-${Date.now()}`,
    text: `You cheered on ${pet.name}! Restored HP and SP, active damage boosted!`,
    type: 'action',
    timestamp: Date.now(),
  });

  next.floatingTexts.push({
    id: `float-cheer-${Date.now()}`,
    text: 'CHEER! +35% HP +40 SP',
    color: '#ec4899',
    target: 'player',
    type: 'heal',
    createdAt: Date.now(),
  });

  return next;
}

/** Process end of round status ticks (burn, leech, decay) */
function applyEndOfTurnEffects(state: BattleState): void {
  const allActive = [
    state.playerTeam[state.activePlayerIndex],
    state.enemyTeam[state.activeEnemyIndex],
  ].filter(Boolean);

  for (const pet of allActive) {
    if (pet.fainted) continue;

    const remainingEffects: BattleStatusEffect[] = [];
    for (const effect of pet.statusEffects) {
      if (effect.type === 'burn') {
        const burnDmg = Math.max(3, Math.floor(pet.maxHp * 0.07));
        pet.hp = Math.max(0, pet.hp - burnDmg);
        state.combatLog.unshift({
          id: `log-burn-${Date.now()}-${Math.random()}`,
          text: `${pet.name} suffered ${burnDmg} damage from burn!`,
          type: 'damage',
          timestamp: Date.now(),
        });
      }

      effect.duration -= 1;
      if (effect.duration > 0) {
        remainingEffects.push(effect);
      }
    }
    pet.statusEffects = remainingEffects;
  }
}

/** AI Opponent Turn decision */
export function executeEnemyAi(state: BattleState): BattleState {
  const enemy = state.enemyTeam[state.activeEnemyIndex];
  const player = state.playerTeam[state.activePlayerIndex];
  if (!enemy || enemy.fainted || !player || player.fainted) {
    return state;
  }

  // Check if enemy has enough energy for ultimate finisher!
  const ultimateMove = enemy.moves.find((m) => m.kind === 'ultimate' && enemy.energy >= m.energyCost);
  if (ultimateMove) {
    return executeMove(state, ultimateMove.id, 'enemy');
  }

  // If low HP and has guard/heal move
  if (enemy.hp < enemy.maxHp * 0.35) {
    const healMove = enemy.moves.find((m) => m.id === 'starlight-remedy' && enemy.energy >= m.energyCost);
    if (healMove) return executeMove(state, healMove.id, 'enemy');

    const guardMove = enemy.moves.find((m) => m.kind === 'guard' && enemy.energy >= m.energyCost);
    if (guardMove && Math.random() < 0.6) return executeMove(state, guardMove.id, 'enemy');
  }

  // Check elemental advantage move
  const skillMove = enemy.moves.find((m) => m.kind === 'skill' && enemy.energy >= m.energyCost);
  if (skillMove) {
    return executeMove(state, skillMove.id, 'enemy');
  }

  // Default to strike (builds SP)
  const strikeMove = enemy.moves.find((m) => m.energyCost === 0) || enemy.moves[0];
  return executeMove(state, strikeMove.id, 'enemy');
}

/** Calculate EXP and item rewards upon victory */
export function calculateBattleRewards(state: BattleState): BattleRewards {
  let baseCred = 150;
  let baseCardCredits = 25;
  let baseTreats = 1;
  let baseExp = 120;
  let badgeId: string | undefined;
  let badgeName: string | undefined;

  if (state.tierId) {
    const tier = LEAGUE_TIERS.find((t: LeagueTierDef) => t.id === state.tierId);
    if (tier) {
      baseCred = tier.rewards.cred;
      baseCardCredits = tier.rewards.cardCredits;
      baseTreats = tier.rewards.treats;
      badgeId = tier.rewards.badgeId;
      badgeName = tier.rewards.badgeName;
      baseExp = 150 * tier.tierNumber;
    }
  } else if (state.gameMode === 'endless-gauntlet') {
    baseCred = 300;
    baseCardCredits = 50;
    baseTreats = 2;
    baseExp = 250;
  }

  const levelUps: BattleRewards['levelUps'] = [];

  for (const pet of state.playerTeam) {
    const oldLevel = pet.level;
    pet.exp += baseExp;
    let newLevel = oldLevel;
    const maxLevel = pet.starter ? 99 : 50;
    while (pet.exp >= pet.expToNext && newLevel < maxLevel) {
      pet.exp -= pet.expToNext;
      newLevel += 1;
      pet.expToNext = getExpForLevel(newLevel);
    }
    if (newLevel > oldLevel) {
      pet.level = newLevel;
      levelUps.push({
        petId: pet.id,
        petName: pet.name,
        oldLevel,
        newLevel,
      });
    }
    pet.battlesWon += 1;
  }

  return {
    cred: baseCred,
    cardCredits: baseCardCredits,
    treats: baseTreats,
    expEarned: baseExp,
    badgeId,
    badgeName,
    levelUps,
  };
}
