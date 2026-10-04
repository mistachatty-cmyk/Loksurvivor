import { TacticalCamera } from './TacticalCamera';

export type TacticalViewMode = 'hold' | 'toggle';

export class InputHandler {
  private camera: TacticalCamera;
  private mode: TacticalViewMode;
  private tacticalKey: string = 'Tab'; // Key to activate tactical view
  private isTacticalKeyDown: boolean = false;
  private onToggleCallback?: (active: boolean) => void;

  constructor(camera: TacticalCamera, mode: TacticalViewMode = 'toggle', onToggle?: (active: boolean) => void) {
    this.camera = camera;
    this.mode = mode;
    this.onToggleCallback = onToggle;
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    window.addEventListener('keydown', this.handleKeyDown.bind(this));
    window.addEventListener('keyup', this.handleKeyUp.bind(this));
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (event.key.toLowerCase() === this.tacticalKey.toLowerCase()) {
      event.preventDefault();
      if (this.mode === 'hold') {
        this.isTacticalKeyDown = true;
        this.camera.setTacticalViewActive(true);
        this.onToggleCallback?.(true);
      } else if (this.mode === 'toggle' && !this.isTacticalKeyDown) {
        this.isTacticalKeyDown = true;
        this.camera.toggleTacticalView();
        this.onToggleCallback?.(this.camera.isTactical());
      }
    }
  }

  private handleKeyUp(event: KeyboardEvent): void {
    if (event.key.toLowerCase() === this.tacticalKey.toLowerCase()) {
      this.isTacticalKeyDown = false;
      if (this.mode === 'hold') {
        this.camera.setTacticalViewActive(false);
        this.onToggleCallback?.(false);
      }
    }
  }

  /**
   * Change the tactical view mode at runtime
   */
  setMode(mode: TacticalViewMode): void {
    this.mode = mode;
    // Reset tactical view when changing modes
    this.camera.setTacticalViewActive(false);
    this.onToggleCallback?.(false);
  }

  /**
   * Change the key binding for tactical view
   */
  setTacticalKey(key: string): void {
    this.tacticalKey = key;
  }

  /**
   * Clean up event listeners
   */
  destroy(): void {
    window.removeEventListener('keydown', this.handleKeyDown.bind(this));
    window.removeEventListener('keyup', this.handleKeyUp.bind(this));
  }
}
