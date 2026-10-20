/**
 * Writes this game's achievement catalog as the JSON the GSix hub's
 * Achievements page renders against (`apps/hub/lib/achievements/catalog-survivor616.json`
 * in the Gsixhub repo), so the hub can show achievements a player has not
 * unlocked yet -- with the same names, requirements and rewards as in-game.
 *
 *   node --import tsx scripts/export-achievements-catalog.ts <output.json>
 *
 * Re-run and copy the file whenever achievements are added or reworded. Only
 * plain data leaves the game (no `isComplete` closures). Unlocks themselves are
 * reported separately, see src/lib/lokAchievements.ts.
 */
import { writeFileSync } from 'node:fs';
import { ACHIEVEMENT_CATEGORIES, ACHIEVEMENTS, type AchievementReward } from '../src/game/data/achievements';
import { LOKDEX_APP_KEY } from '../src/lib/lokDexSnapshot';

const REWARD_LABEL: Record<AchievementReward['kind'], string> = {
  cred: 'cred',
  lootTokens: 'loot tokens',
  cardCredits: 'card credits',
};

const catalog = {
  appKey: LOKDEX_APP_KEY,
  name: '616 Survivor',
  categories: ACHIEVEMENT_CATEGORIES.map(({ id, label }) => ({ id, label })),
  achievements: ACHIEVEMENTS.map((achievement) => ({
    id: achievement.id,
    category: achievement.category,
    name: achievement.name,
    description: achievement.description,
    tier: achievement.tier,
    reward: achievement.reward ? `+${achievement.reward.amount.toLocaleString('en-US')} ${REWARD_LABEL[achievement.reward.kind]}` : undefined,
  })),
};

const out = process.argv[2];
if (!out) throw new Error('usage: export-achievements-catalog.ts <output.json>');
writeFileSync(out, `${JSON.stringify(catalog, null, 1)}\n`);
console.log(`wrote ${catalog.achievements.length} achievements in ${catalog.categories.length} categories to ${out}`);
