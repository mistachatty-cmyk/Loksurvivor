export interface CameraState {
  x: number;
  y: number;
  zoom: number;
  targetZoom: number;
  isTacticalView: boolean;
  visionRadius: number;
}

export class TacticalCamera {
  private state: CameraState;
  private readonly MIN_ZOOM = 0.35; // Tactical zoom out for Sector 616
  private readonly MAX_ZOOM = 1.5; // Slight zoom in
  private readonly DEFAULT_ZOOM = 1.0;
  private readonly ZOOM_SPEED = 0.12; // Smooth zoom transition
  private readonly DEFAULT_VISION_RADIUS = 400; // Pixels
  private readonly TACTICAL_VISION_RADIUS = 300; // Smaller vision in tactical mode

  private initializedZoom: boolean = false;
  private crowdScale: number = 1.0;
  private manualZoomLevel: number = 1.0;

  constructor(startX: number = 0, startY: number = 0) {
    this.state = {
      x: startX,
      y: startY,
      zoom: this.DEFAULT_ZOOM,
      targetZoom: this.DEFAULT_ZOOM,
      isTacticalView: false,
      visionRadius: this.DEFAULT_VISION_RADIUS,
    };
  }

  /**
   * Toggle tactical/strategic view (zoom out + show distant entities as eyes)
   */
  toggleTacticalView(): void {
    this.state.isTacticalView = !this.state.isTacticalView;
    this.state.visionRadius = this.state.isTacticalView
      ? this.TACTICAL_VISION_RADIUS
      : this.DEFAULT_VISION_RADIUS;
  }

  /**
   * Hold-to-activate tactical view (for key-hold style)
   */
  setTacticalViewActive(active: boolean): void {
    this.state.isTacticalView = active;
    this.state.visionRadius = active
      ? this.TACTICAL_VISION_RADIUS
      : this.DEFAULT_VISION_RADIUS;
  }

  /**
   * Set dynamic scale based on crowd density
   */
  setCrowdScale(scale: number): void {
    this.crowdScale = Math.max(0.55, Math.min(1.2, scale));
  }

  /**
   * Set manual zoom override
   */
  setManualZoom(level: number): void {
    this.manualZoomLevel = Math.max(0.4, Math.min(1.5, level));
  }

  /**
   * Get current manual zoom setting
   */
  getManualZoom(): number {
    return this.manualZoomLevel;
  }

  /**
   * Cycle manual zoom levels: 1.0 (standard) -> 0.75 (wide) -> 0.58 (tactical overview) -> 1.0
   */
  cycleManualZoom(): number {
    if (this.manualZoomLevel > 0.85) {
      this.manualZoomLevel = 0.75;
    } else if (this.manualZoomLevel > 0.65) {
      this.manualZoomLevel = 0.58;
    } else {
      this.manualZoomLevel = 1.0;
    }
    return this.manualZoomLevel;
  }

  /**
   * Set target zoom level based on view mode and base zoom
   */
  setTargetView(viewWidth: number, baseTargetView: number): void {
    const baseZoom = viewWidth / Math.max(1, baseTargetView);
    const combinedScale = this.crowdScale * this.manualZoomLevel;
    this.state.targetZoom = this.state.isTacticalView
      ? baseZoom * this.MIN_ZOOM * this.manualZoomLevel
      : baseZoom * combinedScale;
    if (!this.initializedZoom) {
      this.state.zoom = this.state.targetZoom;
      this.initializedZoom = true;
    }
  }

  /**
   * Update camera position and smooth zoom
   */
  update(playerX: number, playerY: number, _deltaTime?: number): void {
    // Smooth zoom interpolation
    const zoomDiff = this.state.targetZoom - this.state.zoom;
    if (Math.abs(zoomDiff) > 0.005) {
      this.state.zoom += zoomDiff * this.ZOOM_SPEED;
    } else {
      this.state.zoom = this.state.targetZoom;
    }
    // Center camera on player
    this.state.x = playerX;
    this.state.y = playerY;
  }

  /**
   * Apply camera transform to canvas context
   */
  applyTransform(ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number, dpr: number = 1): void {
    const safeDpr = Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
    ctx.save();
    ctx.setTransform(safeDpr, 0, 0, safeDpr, 0, 0);
    ctx.translate(canvasWidth / 2, canvasHeight / 2);
    ctx.scale(this.state.zoom, this.state.zoom);
    ctx.translate(-this.state.x, -this.state.y);
  }

  /**
   * Reset camera transform
   */
  resetTransform(ctx: CanvasRenderingContext2D): void {
    ctx.restore();
  }

  /**
   * Convert screen coordinates to world coordinates
   */
  screenToWorld(screenX: number, screenY: number, canvasWidth: number, canvasHeight: number): { x: number; y: number } {
    const zoom = Math.max(0.001, this.state.zoom);
    const worldX = (screenX - canvasWidth / 2) / zoom + this.state.x;
    const worldY = (screenY - canvasHeight / 2) / zoom + this.state.y;
    return { x: worldX, y: worldY };
  }

  /**
   * Check if a world position is within the player's vision radius
   */
  isInVisionRadius(worldX: number, worldY: number): boolean {
    const dx = worldX - this.state.x;
    const dy = worldY - this.state.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance <= this.state.visionRadius;
  }

  /**
   * Get distance from player to a world position
   */
  getDistanceFromPlayer(worldX: number, worldY: number): number {
    const dx = worldX - this.state.x;
    const dy = worldY - this.state.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // Getters
  getZoom(): number { return this.state.zoom; }
  getTargetZoom(): number { return this.state.targetZoom; }
  isTactical(): boolean { return this.state.isTacticalView; }
  getVisionRadius(): number { return this.state.visionRadius; }
  getPosition(): { x: number; y: number } { return { x: this.state.x, y: this.state.y }; }
}
