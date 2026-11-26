/**
 * Button handlers for Lok Party: act on pointerdown (no tap delay) and still work from a keyboard.
 * A keyboard or switch "click" has detail 0; the click that follows a pointer press is ignored.
 */
export function press(onPress: () => void) {
  return {
    onPointerDown: (e: { preventDefault(): void }) => {
      e.preventDefault();
      onPress();
    },
    onClick: (e: { detail: number }) => {
      if (e.detail === 0) onPress();
    },
  };
}
