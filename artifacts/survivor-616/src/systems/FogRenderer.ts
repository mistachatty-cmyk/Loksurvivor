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

    // Save current state
    ctx.save();

    // Apply camera transform with DPR
    camera.applyTransform(ctx, canvasWidth, canvasHeight, dpr);

    // Draw fog everywhere across full screen bounds
    const zoom = Math.max(0.01, camera.getZoom());
    const halfSpanX = (canvasWidth / zoom) * 1.5;
    const halfSpanY = (canvasHeight / zoom) * 1.5;
    ctx.fillStyle = customFogColor ?? this.FOG_COLOR;
    ctx.fillRect(
      playerX - halfSpanX,
      playerY - halfSpanY,
      halfSpanX * 2,
      halfSpanY * 2,
    );

    // Cut out the vision radius (clear fog in player's view)
    ctx.globalCompositeOperation = 'destination-out';

    // Create radial gradient for soft edge
    const innerRadius = Math.max(0, visionRadius * 0.7);
    const outerRadius = Math.max(innerRadius + 0.1, visionRadius);
    const gradient = ctx.createRadialGradient(
      playerX,
      playerY,
      innerRadius,
      playerX,
      playerY,
      outerRadius,
    );
    gradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(playerX, playerY, outerRadius, 0, Math.PI * 2);
    ctx.fill();

    // Cut out extra light sources (ambient fireflies, glowing enemies, lanterns, light orbs)
    if (lightSources && lightSources.length > 0) {
      for (const light of lightSources) {
        if (!Number.isFinite(light.x) || !Number.isFinite(light.y) || light.radius <= 0) continue;
        const inner = Math.max(0, light.radius * 0.35);
        const outer = Math.max(inner + 1, light.radius);
        const lightGrad = ctx.createRadialGradient(light.x, light.y, inner, light.x, light.y, outer);
        const alpha = Math.min(1, Math.max(0.1, light.intensity ?? 0.88));
        lightGrad.addColorStop(0, `rgba(0, 0, 0, ${alpha})`);
        lightGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = lightGrad;
        ctx.beginPath();
        ctx.arc(light.x, light.y, outer, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Reset composite operation
    ctx.globalCompositeOperation = 'source-over';

    // Reset camera transform
    camera.resetTransform(ctx);

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
