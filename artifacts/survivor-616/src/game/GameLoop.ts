import { TacticalCamera } from '../systems/TacticalCamera';
import { FogRenderer, type Entity } from '../systems/FogRenderer';
import { InputHandler } from '../systems/InputHandler';

export class GameLoop {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private camera: TacticalCamera;
  private fogRenderer: FogRenderer;
  private inputHandler: InputHandler;
  private entities: Entity[] = [];
  private lastTime: number = 0;
  private running: boolean = false;
  private rafId: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;

    // Initialize systems
    this.camera = new TacticalCamera(0, 0);
    this.fogRenderer = new FogRenderer();
    this.inputHandler = new InputHandler(this.camera, 'hold'); // or 'toggle'

    // Start game loop
    this.lastTime = performance.now();
    this.running = true;
    this.rafId = requestAnimationFrame(this.loop.bind(this));
  }

  private loop(currentTime: number): void {
    if (!this.running) return;
    const deltaTime = (currentTime - this.lastTime) / 1000; // Convert to seconds
    this.lastTime = currentTime;

    this.update(deltaTime);
    this.render(deltaTime);

    this.rafId = requestAnimationFrame(this.loop.bind(this));
  }

  private update(deltaTime: number): void {
    // Update player position (replace with your actual player logic)
    const playerX = 0;
    const playerY = 0;

    // Update camera
    this.camera.update(playerX, playerY, deltaTime);
  }

  private render(deltaTime: number): void {
    const { width, height } = this.canvas;

    // Clear canvas
    this.ctx.clearRect(0, 0, width, height);

    // 1. Render game world (your existing render logic)
    this.ctx.save();
    this.camera.applyTransform(this.ctx, width, height);

    // Custom world rendering hooks
    this.camera.resetTransform(this.ctx);
    this.ctx.restore();

    // 2. Render fog overlay (covers everything outside vision radius)
    this.fogRenderer.renderFog(this.ctx, this.camera, width, height);

    // 3. Render distant entities as glowing eyes in the fog
    this.fogRenderer.renderDistantEyes(
      this.ctx,
      this.camera,
      this.entities,
      width,
      height,
      deltaTime,
    );

    // 4. Optional: Render tactical vignette when in tactical view
    if (this.camera.isTactical()) {
      this.fogRenderer.renderTacticalVignette(this.ctx, width, height);
    }
  }

  /**
   * Add entities to the game (call this from your entity spawner)
   */
  addEntity(entity: Entity): void {
    this.entities.push(entity);
  }

  /**
   * Remove entities from the game
   */
  removeEntity(entityId: string): void {
    this.entities = this.entities.filter((e) => e.id !== entityId);
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    this.inputHandler.destroy();
  }
}
