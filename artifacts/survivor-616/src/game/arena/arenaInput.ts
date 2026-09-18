/**
 * LokSurvivorArena: local input for 2-4 players sharing one device.
 * Player 0 (host) reuses the campaign's WASD/arrow scheme. Player 1 shares
 * the same keyboard on a second fixed keymap (IJKL). Players 2-3 come from
 * the Gamepad API -- the realistic way past 2 local players on one device,
 * and a browser built-in, so no new dependency. None of this is
 * configurable yet; that's a deliberate skeleton simplification.
 */

export interface ArenaMove {
  moveX: number;
  moveY: number;
}

const HOST_KEYS = { left: ['a', 'arrowleft'], right: ['d', 'arrowright'], up: ['w', 'arrowup'], down: ['s', 'arrowdown'] };
const GUEST1_KEYS = { left: ['j'], right: ['l'], up: ['i'], down: ['k'] };

function axisFromKeys(pressed: Set<string>, keys: typeof HOST_KEYS): ArenaMove {
  let moveX = 0;
  let moveY = 0;
  if (keys.left.some((k) => pressed.has(k))) moveX -= 1;
  if (keys.right.some((k) => pressed.has(k))) moveX += 1;
  if (keys.up.some((k) => pressed.has(k))) moveY -= 1;
  if (keys.down.some((k) => pressed.has(k))) moveY += 1;
  return { moveX, moveY };
}

const GAMEPAD_DEADZONE = 0.18;

function axisFromGamepad(gamepad: Gamepad | null): ArenaMove {
  if (!gamepad) return { moveX: 0, moveY: 0 };
  const [x = 0, y = 0] = gamepad.axes;
  return {
    moveX: Math.abs(x) > GAMEPAD_DEADZONE ? x : 0,
    moveY: Math.abs(y) > GAMEPAD_DEADZONE ? y : 0,
  };
}

/**
 * Reads the current frame's move vector for every arena seat: index 0 is
 * the host (keyboard scheme A), index 1 is the second local keyboard
 * player if present, and indices 2+ pull from connected gamepads in
 * `navigator.getGamepads()` order.
 */
export function readArenaInputs(pressedKeys: Set<string>, seatCount: number): ArenaMove[] {
  const inputs: ArenaMove[] = [axisFromKeys(pressedKeys, HOST_KEYS)];
  if (seatCount < 2) return inputs;
  inputs.push(axisFromKeys(pressedKeys, GUEST1_KEYS));

  if (seatCount > 2) {
    const gamepads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    let padIndex = 0;
    for (let seat = 2; seat < seatCount; seat += 1) {
      const pad = gamepads[padIndex] ?? null;
      inputs.push(axisFromGamepad(pad));
      padIndex += 1;
    }
  }
  return inputs;
}
