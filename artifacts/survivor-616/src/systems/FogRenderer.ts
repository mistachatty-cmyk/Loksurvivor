import { TacticalCamera } from './TacticalCamera';

export interface Entity {
  id: string;
  x: number;
  y: number;
  type: 'enemy' | 'neutral' | 'elite' | 'boss';
  // Add any other properties your entities have
}

export interface LightSource {
  x: number;
  y: number;
  radius: number;
  color?: string;
  intensity?: number;
}

export class FogRenderer {
  private readonly FOG_COLOR = 'rgba(10, 10, 20, 0.85)'; // Dark blue-black fog
  private readonly EYE_PULSE_SPEED = 2; // Radians per second
  private eyePulseTime: number = 0;
  private layerCanvas: HTMLCanvasElement | null = null;

  /** Reusable off-screen layer the fog is built on (null outside a browser, e.g. in unit tests). */
  private getLayer(canvasWidth: number, canvasHeight: number, dpr: number) {
    if (typeof document === 'undefined') return null;
    const safeDpr = Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
    const width = Math.max(1, Math.ceil(canvasWidth * safeDpr));
    const height = Math.max(1, Math.ceil(canvasHeight * safeDpr));
    if (!this.layerCanvas) this.layerCanvas = document.createElement('canvas');
    if (this.layerCanvas.width !== width) this.layerCanvas.width = width;
    if (this.layerCanvas.height !== height) this.layerCanvas.height = height;
    const layerCtx = this.layerCanvas.getContext('2d');
    return layerCtx ? { canvas: this.layerCanvas, ctx: layerCtx } : null;
  }

  /**
   * Render the fog overlay with vision radius cutout and extra light sources
   */
  renderFog(
    ctx: CanvasRenderingContext2D,
    camera: TacticalCamera,
    canvasWidth: number,
    canvasHeight: number,
    dpr: number = 1,
    customFogColor?: string,
    customVisionRadius?: number,
    lightSources?: LightSource[],
  ): void {
    const { x: playerX, y: playerY } = camera.getPosition();
    const visionRadius = Math.max(1, customVisionRadius ?? camera.getVisionRadius());

    if (!Number.isFinite(canvasWidth) || !Number.isFinite(canvasHeight) || canvasWidth <= 0 || canvasHeight <= 0) {
      return;
    }

    // Build the fog on a private layer. `destination-out` erases whatever it is
    // drawn over, so cutting the vision hole straight into the game canvas
    // deleted the world itself (the map went black). Cut the hole in the layer,
    // then composite the finished layer over the world.
    const layer = this.getLayer(canvasWidth, canvasHeight, dpr);
    // No layer (no DOM): skip the fog rather than ever erasing the game canvas.
    if (!layer) return;
    const target = layer.ctx;
    target.setTransform(1, 0, 0, 1, 0, 0);
    target.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
    ctx.save();
    camera.applyTransform(target, canvasWidth, canvasHeight, dpr);

    // Draw fog everywhere across full screen bounds
    const zoom = Math.max(0.01, camera.getZoom());
    const halfSpanX = (canvasWidth / zoom) * 1.5;
    const halfSpanY = (canvasHeight / zoom) * 1.5;
    target.fillStyle = customFogColor ?? this.FOG_COLOR;
    target.fillRect(
      playerX - halfSpanX,
      playerY - halfSpanY,
      halfSpanX * 2,
      halfSpanY * 2,
    );

    // Cut out the vision radius (clear fog in player's view)
    target.globalCompositeOperation = 'destination-out';

    // Create radial gradient for soft edge
    const innerRadius = Math.max(0, visionRadius * 0.7);
    const outerRadius = Math.max(innerRadius + 0.1, visionRadius);
    const gradient = target.createRadialGradient(
      playerX,
      playerY,
      innerRadius,
      playerX,
      playerY,
      outerRadius,
    );
    gradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    target.fillStyle = gradient;
    target.beginPath();
    target.arc(playerX, playerY, outerRadius, 0, Math.PI * 2);
    target.fill();

    // Cut out extra light sources (ambient fireflies, glowing enemies, lanterns, light orbs)
    if (lightSources && lightSources.length > 0) {
      for (const light of lightSources) {
        if (!Number.isFinite(light.x) || !Number.isFinite(light.y) || light.radius <= 0) continue;
        const inner = Math.max(0, light.radius * 0.35);
        const outer = Math.max(inner + 1, light.radius);
        const lightGrad = target.createRadialGradient(light.x, light.y, inner, light.x, light.y, outer);
        const alpha = Math.min(1, Math.max(0.1, light.intensity ?? 0.88));
        lightGrad.addColorStop(0, `rgba(0, 0, 0, ${alpha})`);
        lightGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        target.fillStyle = lightGrad;
        target.beginPath();
        target.arc(light.x, light.y, outer, 0, Math.PI * 2);
        target.fill();
      }
    }

    // Reset composite operation
    target.globalCompositeOperation = 'source-over';

    // Reset camera transform (pops the save made by applyTransform on the same context)
    camera.resetTransform(target);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(layer.canvas, 0, 0);
    // Restore state
    ctx.restore();
  }

  /**
   * Render distant entities as glowing eyes in the fog
   */
  renderDistantEyes(
    ctx: CanvasRenderingContext2D,
    camera: TacticalCamera,
    entities: Entity[],
    canvasWidth: number,
    canvasHeight: number,
    deltaTime: number,
    dpr: number = 1,
    intensity: 'lil' | 'mid' | 'lot' | 'off' = 'mid',
  ): void {
    if (intensity === 'off') {
      return;
    }
    if (!Number.isFinite(canvasWidth) || !Number.isFinite(canvasHeight) || canvasWidth <= 0 || canvasHeight <= 0) {
      return;
    }
    // Update pulse animation
    this.eyePulseTime += deltaTime * this.EYE_PULSE_SPEED;

    ctx.save();
    camera.applyTransform(ctx, canvasWidth, canvasHeight, dpr);

    const zoom = Math.max(0.01, camera.getZoom());
    const halfSpanX = (canvasWidth / zoom) * 0.7;
    const halfSpanY = (canvasHeight / zoom) * 0.7;
    const { x: camX, y: camY } = camera.getPosition();
    const minX = camX - halfSpanX;
    const maxX = camX + halfSpanX;
    const minY = camY - halfSpanY;
    const maxY = camY + halfSpanY;

    let drawnCount = 0;
    const maxEyes = intensity === 'lot' ? 140 : intensity === 'lil' ? 20 : 60;
    const baseRadius = intensity === 'lot' ? 3.8 : intensity === 'lil' ? 2.2 : 3.0;
    const baseBlur = intensity === 'lot' ? 22 : intensity === 'lil' ? 10 : 15;

    for (const entity of entities) {
      if (drawnCount >= maxEyes) break;

      // Skip non-finite or outside camera viewport
      if (
        !Number.isFinite(entity.x) ||
        !Number.isFinite(entity.y) ||
        entity.x < minX ||
        entity.x > maxX ||
        entity.y < minY ||
        entity.y > maxY
      ) {
        continue;
      }

      // Skip if entity is within vision radius (it is rendered normally)
      if (camera.isInVisionRadius(entity.x, entity.y)) {
        continue;
      }

      // Determine eye color based on entity type
      const eyeColor = this.getEyeColor(entity.type);
      const pulseScale = Math.max(0.2, 1 + Math.sin(this.eyePulseTime + entity.x * 0.01) * 0.2);

      // Draw glowing eyes (two small circles)
      const eyeSpacing = 8;
      const eyeRadius = Math.max(0.5, baseRadius * pulseScale);

      ctx.fillStyle = eyeColor;
      ctx.shadowColor = eyeColor;
      ctx.shadowBlur = Math.max(0, baseBlur * pulseScale);

      // Left eye
      ctx.beginPath();
      ctx.arc(entity.x - eyeSpacing / 2, entity.y, eyeRadius, 0, Math.PI * 2);
      ctx.fill();

      // Right eye
      ctx.beginPath();
      ctx.arc(entity.x + eyeSpacing / 2, entity.y, eyeRadius, 0, Math.PI * 2);
      ctx.fill();

      drawnCount++;
    }

    // Reset shadow
    ctx.shadowBlur = 0;
    camera.resetTransform(ctx);
    ctx.restore();
  }

  /**
   * Get eye color based on entity type
   */
  private getEyeColor(type: Entity['type']): string {
    switch (type) {
      case 'enemy':
        return 'rgba(255, 80, 80, 0.9)'; // Red
      case 'neutral':
        return 'rgba(255, 255, 255, 0.8)'; // White
      case 'elite':
        return 'rgba(255, 200, 50, 1)'; // Gold
      case 'boss':
        return 'rgba(200, 50, 255, 1)'; // Purple
      default:
        return 'rgba(255, 255, 255, 0.8)';
    }
  }

  /**
   * Optional: Render a vignette effect during tactical view
   */
  renderTacticalVignette(
    ctx: CanvasRenderingContext2D,
    canvasWidth: number,
    canvasHeight: number,
    dpr: number = 1,
  ): void {
    if (!Number.isFinite(canvasWidth) || !Number.isFinite(canvasHeight) || canvasWidth <= 0 || canvasHeight <= 0) {
      return;
    }
    const safeDpr = Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
    const r1 = Math.max(0, canvasWidth * 0.3);
    const r2 = Math.max(r1 + 1, canvasWidth * 0.7);
    ctx.save();
    ctx.setTransform(safeDpr, 0, 0, safeDpr, 0, 0);
    const gradient = ctx.createRadialGradient(
      canvasWidth / 2,
      canvasHeight / 2,
      r1,
      canvasWidth / 2,
      canvasHeight / 2,
      r2,
    );
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.5)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    ctx.restore();
  }
}
