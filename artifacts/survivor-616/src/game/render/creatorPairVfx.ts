/** Canvas touches for the two Character Creator pair signatures (Spoke Queen's wheels, Jackhammer Jean's quake). */

/** A spinning bicycle wheel: a rim, eight spokes and a hub, turning with the orbit. */
export function drawSpokeWheel(ctx: CanvasRenderingContext2D, x: number, y: number, spin: number, color: string): void {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.rotate(spin);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(0, 0, 12, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#fef9c3';
  ctx.beginPath();
  for (let i = 0; i < 8; i += 1) {
    const angle = (i / 8) * Math.PI * 2;
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(angle) * 11, Math.sin(angle) * 11);
  }
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, 0, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** A cracked-asphalt shock arc: the usual wave arc plus jagged fault lines running along it. */
export function drawQuakeCracks(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, angle: number, spread: number, fade: number): void {
  ctx.save();
  ctx.strokeStyle = '#1c1917';
  ctx.lineWidth = 2 + 2 * fade;
  ctx.globalAlpha = Math.max(0, fade);
  for (let i = 0; i < 5; i += 1) {
    const t = i / 4;
    const a = angle - spread + t * spread * 2;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * radius * 0.5, y + Math.sin(a) * radius * 0.5);
    ctx.lineTo(x + Math.cos(a + 0.08) * radius * 0.75, y + Math.sin(a + 0.08) * radius * 0.75);
    ctx.lineTo(x + Math.cos(a - 0.05) * radius * 0.92, y + Math.sin(a - 0.05) * radius * 0.92);
    ctx.stroke();
  }
  ctx.restore();
}
