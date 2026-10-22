/**
 * LOK Chat toys: things to type besides talking to the crew. Everything is local and
 * procedural (no network, no model), so it costs nothing and works offline. A command is one
 * record in `COMMANDS`; the chat window only knows how to show a `CommandResult`, never what
 * any particular command does. Text lives in `locales/en.json` under `lokChat.cmd.*`: this
 * file returns message keys and parameters, not sentences.
 */

export type ChatFx = 'confetti' | 'disco' | 'pulse616';

export interface SayResult {
  kind: 'say';
  /** A `lokChat.cmd.*` message key. */
  key: string;
  params?: Record<string, string | number>;
  /** Parameters whose value is itself a message key to translate first (e.g. the word "rock"). */
  paramKeys?: Record<string, string>;
}

export type CommandResult = SayResult | { kind: 'open'; view: 'mail' } | { kind: 'fx'; fx: ChatFx } | { kind: 'clear' };

export interface CommandEnv {
  rng: () => number;
  now: Date;
}

export interface CommandDef {
  id: string;
  /** Typed names, without the slash, lower case. */
  names: readonly string[];
  run: (args: string, env: CommandEnv) => CommandResult;
}

export const BALL_ANSWERS = 8;
export const FORTUNES = 8;
export const VIBES = 6;
export const FACTS_616 = 8;

const say = (key: string, params?: SayResult['params'], paramKeys?: SayResult['paramKeys']): SayResult => ({ kind: 'say', key, params, paramKeys });
const pickIndex = (n: number, rng: () => number): number => Math.min(n - 1, Math.floor(rng() * n));

/** Stable 0..1 number from text, so `/rate pizza` always says the same thing. */
export function textUnit(text: string): number {
  let hash = 2166136261;
  for (const char of text.toLowerCase().trim()) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 10000) / 10000;
}

const DICE = /^(\d{1,2})?d(\d{1,3})$/i;

function rollCommand(args: string, env: CommandEnv): CommandResult {
  const text = args.trim().replace(/\s+/g, '');
  const match = text ? DICE.exec(text) : ['', '1', '20'];
  if (!match) return say('lokChat.cmd.roll.usage');
  const count = Number(match[1] ?? 1);
  const sides = Number(match[2]);
  if (count < 1 || count > 10 || sides < 2 || sides > 100) return say('lokChat.cmd.roll.usage');
  const rolls = Array.from({ length: count }, () => 1 + pickIndex(sides, env.rng));
  const total = rolls.reduce((sum, value) => sum + value, 0);
  return say(count === 1 ? 'lokChat.cmd.roll.one' : 'lokChat.cmd.roll.many', { dice: `${count}d${sides}`, rolls: rolls.join(', '), total });
}

const RPS = ['rock', 'paper', 'scissors'] as const;
const RPS_ALIASES: Record<string, (typeof RPS)[number]> = { rock: 'rock', r: 'rock', paper: 'paper', p: 'paper', scissors: 'scissors', s: 'scissors' };

function rpsCommand(args: string, env: CommandEnv): CommandResult {
  const you = RPS_ALIASES[args.trim().toLowerCase()];
  if (!you) return say('lokChat.cmd.rps.usage');
  const botIndex = pickIndex(3, env.rng);
  const bot = RPS[botIndex]!;
  const yourIndex = RPS.indexOf(you);
  const outcome = yourIndex === botIndex ? 'tie' : (yourIndex - botIndex + 3) % 3 === 1 ? 'win' : 'lose';
  return say(`lokChat.cmd.rps.${outcome}`, undefined, { you: `lokChat.cmd.rps.${you}`, bot: `lokChat.cmd.rps.${bot}` });
}

function pickCommand(args: string, env: CommandEnv): CommandResult {
  const options = args.split(/,|\bor\b/i).map((option) => option.trim()).filter(Boolean);
  if (options.length < 2) return say('lokChat.cmd.pick.usage');
  return say('lokChat.cmd.pick', { choice: options[pickIndex(options.length, env.rng)]! });
}

function timeCommand(_args: string, env: CommandEnv): CommandResult {
  const hour = env.now.getHours();
  const phase = hour < 5 ? 'late' : hour < 12 ? 'morning' : hour < 18 ? 'day' : 'night';
  let time = '';
  try {
    time = env.now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    time = `${hour}:00`;
  }
  return say(`lokChat.cmd.time.${phase}`, { time });
}

export const COMMANDS: readonly CommandDef[] = [
  { id: 'help', names: ['help', '?', 'commands'], run: () => say('lokChat.cmd.help') },
  { id: 'roll', names: ['roll', 'dice'], run: rollCommand },
  { id: 'flip', names: ['flip', 'coin'], run: (_a, env) => say(env.rng() < 0.5 ? 'lokChat.cmd.flip.heads' : 'lokChat.cmd.flip.tails') },
  {
    id: '8ball',
    names: ['8ball', 'ask'],
    run: (args, env) => (args.trim() ? say(`lokChat.cmd.ball.${pickIndex(BALL_ANSWERS, env.rng)}`) : say('lokChat.cmd.ball.usage')),
  },
  { id: 'pick', names: ['pick', 'choose'], run: pickCommand },
  { id: 'rps', names: ['rps'], run: rpsCommand },
  {
    id: 'rate',
    names: ['rate'],
    run: (args) => {
      const thing = args.trim().slice(0, 40);
      return thing ? say('lokChat.cmd.rate', { thing, score: Math.round(textUnit(thing) * 10) }) : say('lokChat.cmd.rate.usage');
    },
  },
  { id: 'fortune', names: ['fortune'], run: (_a, env) => say(`lokChat.cmd.fortune.${pickIndex(FORTUNES, env.rng)}`) },
  { id: 'vibe', names: ['vibe'], run: (_a, env) => say(`lokChat.cmd.vibe.${pickIndex(VIBES, env.rng)}`) },
  { id: '616', names: ['616', 'fact'], run: (_a, env) => say(`lokChat.cmd.fact.${pickIndex(FACTS_616, env.rng)}`) },
  {
    id: 'me',
    names: ['me'],
    run: (args) => (args.trim() ? say('lokChat.cmd.me', { text: args.trim().slice(0, 80) }) : say('lokChat.cmd.me.usage')),
  },
  { id: 'shrug', names: ['shrug'], run: () => say('lokChat.cmd.shrug') },
  { id: 'time', names: ['time'], run: timeCommand },
  { id: 'confetti', names: ['confetti', 'party'], run: () => ({ kind: 'fx', fx: 'confetti' }) },
  { id: 'disco', names: ['disco'], run: () => ({ kind: 'fx', fx: 'disco' }) },
  { id: 'pulse', names: ['pulse'], run: () => ({ kind: 'fx', fx: 'pulse616' }) },
  { id: 'mail', names: ['mail', 'mailbox'], run: () => ({ kind: 'open', view: 'mail' }) },
  { id: 'clear', names: ['clear', 'cls'], run: () => ({ kind: 'clear' }) },
];

/** What a typed line does. `null` means it is not a command and should be sent as normal chat. */
export function runChatCommand(input: string, env: CommandEnv): CommandResult | null {
  const text = input.trim();
  if (!text.startsWith('/')) return null;
  const [rawName = '', ...rest] = text.slice(1).split(/\s+/);
  const name = rawName.toLowerCase();
  if (!name) return say('lokChat.cmd.help');
  const command = COMMANDS.find((candidate) => candidate.names.includes(name));
  if (!command) return say('lokChat.cmd.unknown', { cmd: `/${name.slice(0, 20)}` });
  return command.run(rest.join(' '), env);
}

/** Every message key the commands can return, for the locale test. */
export function commandMessageKeys(): string[] {
  const keys = new Set<string>(['lokChat.cmd.help', 'lokChat.cmd.unknown', 'lokChat.cmd.shrug', 'lokChat.cmd.me', 'lokChat.cmd.me.usage']);
  const add = (...list: string[]) => list.forEach((key) => keys.add(key));
  add('lokChat.cmd.roll.usage', 'lokChat.cmd.roll.one', 'lokChat.cmd.roll.many', 'lokChat.cmd.flip.heads', 'lokChat.cmd.flip.tails', 'lokChat.cmd.ball.usage');
  add('lokChat.cmd.pick', 'lokChat.cmd.pick.usage', 'lokChat.cmd.rate', 'lokChat.cmd.rate.usage');
  add('lokChat.cmd.rps.usage', 'lokChat.cmd.rps.win', 'lokChat.cmd.rps.lose', 'lokChat.cmd.rps.tie', 'lokChat.cmd.rps.rock', 'lokChat.cmd.rps.paper', 'lokChat.cmd.rps.scissors');
  add('lokChat.cmd.time.late', 'lokChat.cmd.time.morning', 'lokChat.cmd.time.day', 'lokChat.cmd.time.night');
  for (let i = 0; i < BALL_ANSWERS; i += 1) add(`lokChat.cmd.ball.${i}`);
  for (let i = 0; i < FORTUNES; i += 1) add(`lokChat.cmd.fortune.${i}`);
  for (let i = 0; i < VIBES; i += 1) add(`lokChat.cmd.vibe.${i}`);
  for (let i = 0; i < FACTS_616; i += 1) add(`lokChat.cmd.fact.${i}`);
  return [...keys];
}
