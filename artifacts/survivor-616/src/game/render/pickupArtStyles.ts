/**
 * Realistic, tech and pixel drop packs (see data/dropPacks.ts). Pure
 * Canvas2D and procedural; every frame is a pure function of
 * (now - bornAt, uid). The shared wrapper at the bottom adds the spawn hop,
 * bob, ground shadow and magnet streak so each style only draws the object.
 */
import type { Pickup, PickupKind } from '../engine/world';
import type { DropStyle } from '../data/dropPacks';
import { drawEnhancedPickup, PICKUP_COLOR } from './pickupArt';
import { BODY_COLOR, shapesFor, type Shape } from './pickupArtShapes';

const TAU = Math.PI * 2;
type StyleFn = (ctx: CanvasRenderingContext2D, e: Entry, x: number, y: number, t: number, lite: boolean, uid: number) => void;
interface Entry { k: string; c: string; a: string; n: string }

function hx(c:string){const n=parseInt(c.slice(1),16);return[n>>16,(n>>8)&255,n&255]}
function mix(c:string,t:string,f:number){const a=hx(c),b=hx(t);return `rgb(${a.map((v,i)=>Math.round(v+(b[i]-v)*f)).join(',')})`}
const dk=(c:string,f=.55)=>mix(c,'#050607',f), lt=(c:string,f=.5)=>mix(c,'#ffffff',f), mt=(c:string,f=.55)=>mix(c,'#6b7078',f);
function lg(ctx:CanvasRenderingContext2D,x0:number,y0:number,x1:number,y1:number,st:[number,string][]){const g=ctx.createLinearGradient(x0,y0,x1,y1);st.forEach(([o,c])=>g.addColorStop(o,c));return g}
function rg(ctx:CanvasRenderingContext2D,x:number,y:number,r:number,st:[number,string][],fx=0,fy=0){const g=ctx.createRadialGradient(x+fx,y+fy,0,x,y,r);st.forEach(([o,c])=>g.addColorStop(o,c));return g}
function shadow(ctx:CanvasRenderingContext2D,x:number,y:number,r:number){ctx.fillStyle=rg(ctx,x,y+8,r,[[0,'rgba(0,0,0,.55)'],[1,'rgba(0,0,0,0)']]);ctx.save();ctx.translate(0,0);ctx.beginPath();ctx.ellipse(x,y+8,r,r*.35,0,0,TAU);ctx.fill();ctx.restore()}
function P(ctx:CanvasRenderingContext2D,pts:number[][],f:string|CanvasGradient,s?:string,lw=.6){ctx.beginPath();pts.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=f;ctx.fill();if(s){ctx.strokeStyle=s;ctx.lineWidth=lw;ctx.stroke()}}
function aura(ctx:CanvasRenderingContext2D,x:number,y:number,r:number,c:string,a=.25){ctx.fillStyle=rg(ctx,x,y,r,[[0,c.replace('rgb','rgba').replace(')',`,${a})`)],[1,'rgba(0,0,0,0)']]);ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill()}
const A=(c:string,a:number)=>{const [r,g,b]=hx(c);return `rgba(${r},${g},${b},${a})`};
function glowA(ctx:CanvasRenderingContext2D,x:number,y:number,r:number,c:string,a:number){ctx.fillStyle=rg(ctx,x,y,r,[[0,A(c,a)],[1,A(c,0)]]);ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill()}

/* ---------- REALISTIC (gritty, material-driven) ---------- */
function real(ctx:CanvasRenderingContext2D,e:Entry,x:number,y:number,t:number){
 const c=e.c; shadow(ctx,x,y,9); glowA(ctx,x,y,16,c,.16);
 const big=e.k==='xp-4'?1.35:e.k==='xp-3'?1.1:e.k==='xp-2'?.85:e.k==='xp-1'?.62:1;
 switch(e.a){
 case 'gem':{const s=9*big;
  P(ctx,[[x,y-s],[x+s*.75,y-s*.25],[x+s*.55,y+s*.55],[x,y+s],[x-s*.55,y+s*.55],[x-s*.75,y-s*.25]],lg(ctx,x-s,y-s,x+s,y+s,[[0,lt(c,.55)],[.45,c],[1,dk(c,.7)]]),dk(c,.75),.5);
  P(ctx,[[x,y-s],[x-s*.75,y-s*.25],[x-s*.2,y]],A(lt(c,.7).replace(/rgb\((.*)\)/,'#fff'),.0),undefined);
  ctx.strokeStyle='rgba(255,255,255,.28)';ctx.lineWidth=.5;ctx.beginPath();ctx.moveTo(x,y-s);ctx.lineTo(x-s*.2,y);ctx.lineTo(x,y+s);ctx.moveTo(x-s*.2,y);ctx.lineTo(x+s*.75,y-s*.25);ctx.moveTo(x-s*.2,y);ctx.lineTo(x-s*.55,y+s*.55);ctx.stroke();
  ctx.fillStyle='rgba(255,255,255,.55)';ctx.beginPath();ctx.ellipse(x-s*.32,y-s*.45,s*.12,s*.3,.6,0,TAU);ctx.fill();break}
 case 'plus':{const r=8;ctx.fillStyle=lg(ctx,x-r,y-r,x+r,y+r,[[0,'#d8dcd6'],[1,'#8a8f88']]);ctx.beginPath();ctx.roundRect(x-r,y-r,r*2,r*2,2.5);ctx.fill();ctx.strokeStyle='#3b3f3a';ctx.lineWidth=.7;ctx.stroke();
  ctx.fillStyle=lg(ctx,x,y-6,x,y+6,[[0,'#4ade80'],[1,'#15803d']]);ctx.fillRect(x-2,y-5.5,4,11);ctx.fillRect(x-5.5,y-2,11,4);glowA(ctx,x,y,9,'#4ade80',.3);ctx.fillStyle='rgba(255,255,255,.25)';ctx.fillRect(x-7,y-7,14,1.2);break}
 case 'coin':{const r=6.6;ctx.fillStyle=rg(ctx,x,y,r,[[0,lt(c,.35)],[.7,c],[1,dk(c,.5)]],-2,-2);ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill();ctx.strokeStyle=dk(c,.65);ctx.lineWidth=.9;ctx.stroke();ctx.strokeStyle=A(lt(c,.6).replace(/rgb\(.*\)/,'#ffffff'),.35);ctx.lineWidth=.5;ctx.beginPath();ctx.arc(x,y,r-1.7,0,TAU);ctx.stroke();
  ctx.fillStyle=dk(c,.6);ctx.font='bold 6px serif';ctx.textAlign='center';ctx.fillText(e.k==='coin'?'⚷':'¢',x,y+2.2);break}
 case 'orb':{const r=7;ctx.fillStyle=rg(ctx,x,y,r,[[0,'#ffffff'],[.4,'#cfeaff'],[1,'rgba(120,180,230,.25)']]);ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill();ctx.strokeStyle='rgba(190,230,255,.5)';ctx.lineWidth=.6;ctx.beginPath();ctx.arc(x,y,r+3,0,TAU);ctx.stroke();break}
 case 'drop':{ctx.fillStyle=rg(ctx,x,y,9,[[0,lt(c,.45)],[.5,c],[1,dk(c,.7)]],-2,-3);ctx.beginPath();ctx.moveTo(x,y-9);ctx.bezierCurveTo(x+8,y-1,x+7,y+7,x,y+7);ctx.bezierCurveTo(x-7,y+7,x-8,y-1,x,y-9);ctx.fill();ctx.strokeStyle=dk(c,.7);ctx.lineWidth=.6;ctx.stroke();ctx.fillStyle='rgba(255,255,255,.6)';ctx.beginPath();ctx.ellipse(x-2.6,y-1.5,1.2,3,.4,0,TAU);ctx.fill();break}
 case 'cell':{ctx.fillStyle=lg(ctx,x-7,y,x+7,y,[[0,'#16312f'],[.5,'#2c6a63'],[1,'#10211f']]);ctx.beginPath();ctx.roundRect(x-6.5,y-10,13,20,3);ctx.fill();ctx.strokeStyle='#0a1514';ctx.lineWidth=.7;ctx.stroke();ctx.fillStyle='#3b3f42';ctx.fillRect(x-5.5,y-11,11,3);ctx.fillRect(x-5.5,y+8,11,3);ctx.fillStyle=lg(ctx,x,y-6,x,y+6,[[0,'#ccfbf1'],[1,c]]);ctx.fillRect(x-2.2,y-6,4.4,12);glowA(ctx,x,y,10,c,.4);break}
 case 'chest':case 'box':{const w=e.a==='box'?20:22,h=17;const wood=e.k==='loot-box'?'#2f4a78':e.k==='mimic-chest'?'#3b2314':e.k==='firefly-amber-chest'?'#6a3d12':'#3a3733';
  ctx.fillStyle=lg(ctx,x,y-h/2,x,y+h/2,[[0,lt(wood,.18)],[1,dk(wood,.45)]]);ctx.fillRect(x-w/2,y-h/2+4,w,h-4);
  ctx.fillStyle=lg(ctx,x,y-h/2-3,x,y-h/2+5,[[0,lt(wood,.3)],[1,wood]]);ctx.beginPath();ctx.moveTo(x-w/2,y-h/2+5);ctx.quadraticCurveTo(x,y-h/2-6,x+w/2,y-h/2+5);ctx.fill();
  const metal=e.k==='relic-vault-chest'?'#b8892b':'#8d939b';ctx.fillStyle=lg(ctx,x,y-h/2,x,y+h/2,[[0,lt(metal,.3)],[1,dk(metal,.5)]]);ctx.fillRect(x-w/2,y-h/2+4.5,w,1.6);ctx.fillRect(x-w/2+2,y-h/2+3,2.2,h-3);ctx.fillRect(x+w/2-4.2,y-h/2+3,2.2,h-3);
  ctx.fillStyle=lt(metal,.2);ctx.fillRect(x-2,y-2,4,5);ctx.fillStyle='#111';ctx.fillRect(x-.7,y-.5,1.4,2.4);
  ctx.strokeStyle='rgba(0,0,0,.55)';ctx.lineWidth=.6;ctx.strokeRect(x-w/2,y-h/2+4,w,h-4);
  if(e.a==='box'){ctx.fillStyle=A(c,.7);ctx.fillRect(x-7,y-4,14,1);ctx.fillRect(x-7,y,9,1)}
  if(e.k==='firefly-amber-chest')for(let i=0;i<3;i++){const a=i*2.1+t;glowA(ctx,x+Math.cos(a)*14,y+Math.sin(a)*8-2,4,'#fde68a',.8)}
  if(e.k==='mimic-chest'){ctx.fillStyle='#e5e1d8';for(let i=0;i<4;i++){ctx.beginPath();ctx.moveTo(x-7+i*4.6,y-h/2+5.5);ctx.lineTo(x-5.2+i*4.6,y-h/2+5.5);ctx.lineTo(x-6.1+i*4.6,y-h/2+8);ctx.fill()}glowA(ctx,x,y+2,5,'#dc2626',.7)}
  if(e.k==='relic-vault-chest')glowA(ctx,x,y+1,8,'#f59e0b',.45);break}
 case 'card':{ctx.save();ctx.translate(x,y);ctx.rotate(-.1);ctx.fillStyle=lg(ctx,-8,-11,8,11,[[0,'#1a1020'],[1,'#0b0710']]);ctx.beginPath();ctx.roundRect(-8,-11,16,22,1.5);ctx.fill();
  ctx.fillStyle=lg(ctx,-8,-11,8,11,[[0,'#6b1f7a'],[.4,'#c26be0'],[.6,'#5b2a8a'],[1,'#2a1448']]);ctx.beginPath();ctx.roundRect(-6.5,-9.5,13,19,1);ctx.fill();ctx.strokeStyle='rgba(255,230,255,.5)';ctx.lineWidth=.6;ctx.strokeRect(-4,-6.5,8,8);ctx.fillStyle='rgba(255,255,255,.7)';ctx.font='bold 4px sans-serif';ctx.textAlign='center';ctx.fillText('LP',0,6.6);ctx.restore();break}
 case 'ore':{P(ctx,[[x-9,y+7],[x-6,y+1],[x+3,y],[x+9,y+7]],lg(ctx,x,y,x,y+7,[[0,'#6a6660'],[1,'#26241f']]),'#15130f',.5);
  P(ctx,[[x-4,y+4],[x-6,y-4],[x-1.5,y-10],[x+1,y+4]],lg(ctx,x-5,y,x+1,y,[[0,lt(c,.4)],[1,dk(c,.5)]]),dk(c,.75),.5);P(ctx,[[x-1.5,y-10],[x+4,y-5],[x+1,y+4]],lg(ctx,x,y-10,x,y+4,[[0,lt(c,.6)],[1,c]]),dk(c,.75),.5);P(ctx,[[x+2,y+4],[x+3.5,y-1],[x+8,y-3],[x+7,y+5]],lg(ctx,x,y,x+8,y,[[0,c],[1,dk(c,.6)]]),dk(c,.75),.5);glowA(ctx,x,y-2,10,c,.3);break}
 case 'ingot':{P(ctx,[[x-8,y+5],[x-6,y-3],[x+7,y-3],[x+9,y+5]],lg(ctx,x,y-3,x,y+5,[[0,'#9aa3ad'],[.5,'#5f6872'],[1,'#2b3138']]),'#14181c',.6);P(ctx,[[x-6,y-3],[x+7,y-3],[x+5,y-6.5],[x-4,y-6.5]],lg(ctx,x-6,y,x+7,y,[[0,'#e6edf3'],[1,'#8e9aa6']]),'#14181c',.5);ctx.fillStyle=A(c,.7);ctx.fillRect(x-5,y,9,1);ctx.fillStyle='rgba(255,255,255,.35)';ctx.fillRect(x-4,y-5.6,6,.8);break}
 case 'quartz':{const s=10;P(ctx,[[x,y-s],[x+s*.55,y-s*.4],[x+s*.55,y+s*.45],[x,y+s],[x-s*.55,y+s*.45],[x-s*.55,y-s*.4]],lg(ctx,x-s,y-s,x+s,y+s,[[0,'#ffe4ea'],[.35,c],[.7,dk(c,.45)],[1,'#4a0d1e']]),dk(c,.8),.5);ctx.strokeStyle='rgba(255,255,255,.3)';ctx.lineWidth=.5;ctx.beginPath();ctx.moveTo(x,y-s);ctx.lineTo(x,y+s);ctx.moveTo(x-s*.55,y-s*.4);ctx.lineTo(x,y);ctx.lineTo(x+s*.55,y-s*.4);ctx.stroke();
  ctx.strokeStyle='hsla(190,90%,70%,.35)';ctx.beginPath();ctx.moveTo(x+s*.55,y-s*.4);ctx.lineTo(x+s*.55,y+s*.45);ctx.stroke();glowA(ctx,x,y,14,c,.3);break}
 case 'flask':{ctx.fillStyle='rgba(220,235,245,.18)';ctx.beginPath();ctx.arc(x,y+2.5,6.5,0,TAU);ctx.fill();ctx.fillRect(x-2.4,y-7,4.8,6);ctx.save();ctx.beginPath();ctx.arc(x,y+2.5,6,0,TAU);ctx.clip();ctx.fillStyle=lg(ctx,x,y,x,y+9,[[0,'#38bdf8'],[1,'#0b4a6e']]);ctx.fillRect(x-7,y+1,14,9);ctx.restore();ctx.strokeStyle='rgba(220,240,255,.7)';ctx.lineWidth=.7;ctx.beginPath();ctx.arc(x,y+2.5,6.5,0,TAU);ctx.stroke();ctx.strokeRect(x-2.4,y-7,4.8,6);ctx.fillStyle='#5a4326';ctx.fillRect(x-2.8,y-9,5.6,2.6);ctx.fillStyle='rgba(255,255,255,.55)';ctx.fillRect(x-4,y,1,5);break}
 }}

/* ---------- DARK SCI-FI TECH ---------- */
function tech(ctx:CanvasRenderingContext2D,e:Entry,x:number,y:number,t:number){
 const c=e.c;shadow(ctx,x,y,9);const big=e.k==='xp-4'?1.35:e.k==='xp-3'?1.1:e.k==='xp-2'?.85:e.k==='xp-1'?.62:1;
 const body='#14181f',edge=c;ctx.lineJoin='round';
 const L=(pts:number[][],close=true,w=.9,col=edge)=>{ctx.beginPath();pts.forEach(([a,b],i)=>i?ctx.lineTo(a,b):ctx.moveTo(a,b));if(close)ctx.closePath();ctx.strokeStyle=col;ctx.lineWidth=w;ctx.stroke()};
 const F=(pts:number[][],f:string)=>{ctx.beginPath();pts.forEach(([a,b],i)=>i?ctx.lineTo(a,b):ctx.moveTo(a,b));ctx.closePath();ctx.fillStyle=f;ctx.fill()};
 glowA(ctx,x,y,15,c,.14);
 switch(e.a){
 case 'gem':{const s=9*big;const d=[[x,y-s],[x+s*.7,y],[x,y+s],[x-s*.7,y]];F(d,body);F([[x,y-s],[x+s*.7,y],[x,y]],A(c,.18));L(d);L([[x,y-s],[x,y+s]],false,.5,A(c,.6));L([[x-s*.7,y],[x+s*.7,y]],false,.5,A(c,.6));ctx.fillStyle=lt(c,.7);ctx.fillRect(x-.8,y-.8,1.6,1.6);break}
 case 'plus':{F([[x-8,y-8],[x+8,y-8],[x+8,y+8],[x-8,y+8]],body);L([[x-8,y-5],[x-8,y-8],[x-5,y-8]],false,1.1);L([[x+8,y+5],[x+8,y+8],[x+5,y+8]],false,1.1);ctx.fillStyle=c;ctx.fillRect(x-1.6,y-5,3.2,10);ctx.fillRect(x-5,y-1.6,10,3.2);glowA(ctx,x,y,8,c,.3);break}
 case 'coin':{ctx.fillStyle=body;ctx.beginPath();ctx.arc(x,y,6.6,0,TAU);ctx.fill();ctx.strokeStyle=c;ctx.lineWidth=.9;ctx.stroke();ctx.setLineDash([1.5,1.2]);ctx.beginPath();ctx.arc(x,y,4.4,0,TAU);ctx.strokeStyle=A(c,.7);ctx.lineWidth=.6;ctx.stroke();ctx.setLineDash([]);ctx.fillStyle=c;ctx.fillRect(x-.8,y-2.4,1.6,4.8);break}
 case 'orb':{ctx.fillStyle=body;ctx.beginPath();ctx.arc(x,y,6,0,TAU);ctx.fill();ctx.strokeStyle=c;ctx.lineWidth=.9;ctx.stroke();ctx.beginPath();ctx.arc(x,y,10,t,t+2.2);ctx.stroke();ctx.beginPath();ctx.arc(x,y,10,t+3.4,t+5.4);ctx.stroke();glowA(ctx,x,y,6,c,.6);break}
 case 'drop':{const p=[[x,y-9],[x+6,y+1],[x+3,y+7],[x-3,y+7],[x-6,y+1]];F(p,body);L(p);L([[x,y-9],[x,y+7]],false,.5,A(c,.6));glowA(ctx,x,y+1,5,c,.5);break}
 case 'cell':{F([[x-6,y-9],[x+6,y-9],[x+6,y+9],[x-6,y+9]],body);L([[x-6,y-9],[x+6,y-9],[x+6,y+9],[x-6,y+9]]);for(let i=0;i<4;i++){ctx.fillStyle=A(c,i<3?.9:.25);ctx.fillRect(x-3.5,y-7+i*4.2,7,2.4)}break}
 case 'chest':case 'box':{const w=22,h=16;F([[x-w/2,y-h/2],[x+w/2,y-h/2],[x+w/2,y+h/2],[x-w/2,y+h/2]],body);ctx.fillStyle='#1d232c';ctx.fillRect(x-w/2,y-h/2,w,5);L([[x-w/2,y-h/2],[x+w/2,y-h/2],[x+w/2,y+h/2],[x-w/2,y+h/2]],true,.9);L([[x-w/2,y-h/2+5],[x+w/2,y-h/2+5]],false,.6,A(c,.7));ctx.fillStyle=c;ctx.fillRect(x-3,y-1,6,2.2);for(let i=0;i<3;i++){ctx.fillStyle=A(c,.4+.3*Math.sin(t*3+i));ctx.fillRect(x-7+i*5.5,y+4,3,1)}
  if(e.k==='mimic-chest'){ctx.fillStyle=c;ctx.beginPath();ctx.arc(x,y+1,2,0,TAU);ctx.fill()}glowA(ctx,x,y,12,c,.18);break}
 case 'card':{ctx.save();ctx.translate(x,y);ctx.rotate(-.08);F([[-7,-10],[7,-10],[7,10],[-7,10]],body);L([[-7,-10],[7,-10],[7,10],[-7,10]]);ctx.fillStyle=A(c,.85);ctx.fillRect(-4,-6,8,.9);ctx.fillRect(-4,-3.5,5,.9);ctx.strokeStyle=c;ctx.lineWidth=.7;ctx.strokeRect(-3.5,0,7,6);ctx.restore();break}
 case 'ore':{const p=[[x-6,y+6],[x-7,y-1],[x-2,y-9],[x+4,y-6],[x+7,y+1],[x+5,y+6]];F(p,body);L(p);L([[x-2,y-9],[x,y+1],[x+7,y+1]],false,.5,A(c,.7));L([[x,y+1],[x-6,y+6]],false,.5,A(c,.7));glowA(ctx,x,y,6,c,.55);break}
 case 'ingot':{const p=[[x-8,y+4],[x-6,y-4],[x+8,y-4],[x+10,y+4]];F(p,body);L(p);L([[x-6,y-4],[x-4,y-7],[x+6,y-7],[x+8,y-4]],false,.6,A(c,.7));ctx.fillStyle=A(c,.9);ctx.fillRect(x-4,y-1,10,1.4);break}
 case 'quartz':{const s=10;const p=[[x,y-s],[x+5.5,y-4],[x+5.5,y+4],[x,y+s],[x-5.5,y+4],[x-5.5,y-4]];F(p,body);L(p,true,1);L([[x,y-s],[x,y+s]],false,.5,A(c,.6));L([[x-5.5,y-4],[x+5.5,y+4]],false,.5,A(c,.4));L([[x+5.5,y-4],[x-5.5,y+4]],false,.5,A(c,.4));ctx.strokeStyle=`hsla(${(t*60)%360},90%,70%,.6)`;ctx.lineWidth=.6;ctx.stroke();break}
 case 'flask':{F([[x-5,y-6],[x+5,y-6],[x+6,y+8],[x-6,y+8]],body);L([[x-2.5,y-9],[x-2.5,y-6],[x-5,y-6],[x-6,y+8],[x+6,y+8],[x+5,y-6],[x+2.5,y-6],[x+2.5,y-9]],false);ctx.fillStyle=A(c,.85);ctx.fillRect(x-4.6,y+1,9.2,6);ctx.fillStyle='rgba(255,255,255,.4)';ctx.fillRect(x-4.6,y+1,9.2,.8);break}
 }}

/* ---------- PIXEL ---------- */
const BM:Record<string,string[]>={
gem:['....hh....','...hMMd...','..hMMMDd..','.hMMMMMDd.','.MMMMMMDD.','..dMMMDD..','...dMDD...','....dd....'],
plus:['..oooo..','..ohho..','ooohhooo','ohhhMMMo','oMMMMMMo','ooodDooo','..odDo..','..oooo..'],
coin:['..oooo..','.ohhhMo.','ohMMMMDo','ohMMMMDo','oMMMMDDo','.oMDDDo.','..oooo..'],
orb:['..hhhh..','.hwwwhh.','hwwwhhMh','hwwhhMMd','hhhhMMdd','.hMMMdd.','..dddd..'],
drop:['....h...','...hM...','..hMMd..','.hMMMDd.','hMMMMMDd','hMMMMDDd','.dMMDDd.','..dddd..'],
cell:['.oooooo.','.oMMMMo.','ohhhhhDo','ohwwhhDo','ohwwhhDo','ohhhhhDo','.oDDDDo.','.oooooo.'],
chest:['..oooooo..','.oMMMMMMo.','oMhhhhhhDo','oooooooooo','oDDDkkDDDo','oDDDkkDDDo','oDDDDDDDDo','oooooooooo'],
card:['.oooooo.','ohhhhhhd','ohMMMMDd','ohMwwMDd','ohMwwMDd','ohMMMMDd','ohDDDDDd','.oooooo.'],
ore:['....hh....','..hhMMd...','.hMMMDMd..','hMhMMDDMd.','oooooooooo'],
ingot:['..hhhhhhhh','.hMMMMMMMd','oooooooooo','oMMMMMMMDo','oDDDDDDDDo','oooooooooo'],
quartz:['...hh...','..hMMd..','.hMMMDd.','hMMwMMDd','hMMMMMDd','.dMMMDd.','..dDDd..','...dd...'],
flask:['..oo..','..ww..','.oooo.','owhhMo','ohMMMo','oMMMDo','.oDDo.'],
};
function pix(ctx:CanvasRenderingContext2D,e:Entry,x:number,y:number,t:number){
 let a=e.a==='box'?'chest':e.a;const m=BM[a]||BM.gem;const c=e.c;
 const wood=e.a==='chest'||e.a==='box'?({'loot-box':'#2f5aa8','relic-vault-chest':'#7a5a1c','firefly-amber-chest':'#8a4c12','mimic-chest':'#5a2a14','glitch-cache':'#274a7a'} as any)[e.k]:c;
 const base=wood||c;
 const pal:Record<string,string>={h:lt(base,.55),M:base,D:dk(base,.35),d:dk(base,.5),o:dk(base,.8),w:'#ffffff',k:e.a==='box'?'#22d3ee':'#e9c46a'};
 if(a==='plus'){pal.M='#3fbf6a';pal.h='#9af0b8';pal.D='#1f7a3f';pal.d='#1f7a3f';pal.o='#0d2a18'}
 const sc=a==='gem'?(e.k==='xp-4'?2:e.k==='xp-3'?1.7:e.k==='xp-2'?1.4:1.1):1.5;const w=m[0].length;
 ctx.fillStyle='rgba(0,0,0,.35)';ctx.fillRect(x-w*sc/2+1,y+m.length*sc/2,w*sc-2,2);
 m.forEach((row,j)=>[...row].forEach((ch,i)=>{if(ch==='.')return;ctx.fillStyle=pal[ch]||base;ctx.fillRect(Math.round(x-w*sc/2+i*sc),Math.round(y-m.length*sc/2+j*sc),Math.ceil(sc),Math.ceil(sc))}));
}


/* ---------- SHAPE-DRIVEN PACKS: Blueprint, Neon Arcade, Paper Cut ---------- */
function trace(ctx: CanvasRenderingContext2D, pts: number[][], close: boolean) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  if (close) ctx.closePath();
}
const toneColor = (tone: Shape['tone'], base: string, accent: string) =>
  tone === 'm' ? base : tone === 'l' ? lt(base, 0.35) : tone === 'd' ? dk(base, 0.4) : tone === 'a' ? accent : '#0a0c10';

function blueprint(ctx: CanvasRenderingContext2D, e: Entry, x: number, y: number, t: number, _lite: boolean, _uid: number) {
  const base = mix('#cfe3ff', e.c, 0.3);
  const shapes = shapesFor(e.a, e.k);
  // Faint drafting sheet behind the part.
  ctx.fillStyle = 'rgba(30,70,140,0.55)';
  ctx.fillRect(x - 13, y - 13, 26, 26);
  ctx.strokeStyle = 'rgba(160,200,255,0.25)';
  ctx.lineWidth = 0.4;
  ctx.strokeRect(x - 13, y - 13, 26, 26);
  ctx.beginPath(); ctx.moveTo(x - 13, y); ctx.lineTo(x - 10, y); ctx.moveTo(x + 10, y); ctx.lineTo(x + 13, y); ctx.moveTo(x, y - 13); ctx.lineTo(x, y - 10); ctx.moveTo(x, y + 10); ctx.lineTo(x, y + 13); ctx.stroke();
  ctx.save();
  ctx.translate(x, y);
  ctx.lineJoin = 'round';
  for (const sh of shapes) {
    trace(ctx, sh.pts, !sh.line);
    if (!sh.line && sh.tone !== 'k') { ctx.fillStyle = sh.tone === 'a' ? 'rgba(160,210,255,0.35)' : sh.tone === 'm' ? 'rgba(140,190,255,0.10)' : 'rgba(140,190,255,0.06)'; ctx.fill(); }
    ctx.strokeStyle = sh.tone === 'm' ? base : 'rgba(207,227,255,0.7)';
    ctx.lineWidth = sh.tone === 'm' ? 0.9 : 0.55;
    if (sh.tone === 'l' || sh.tone === 'd') ctx.setLineDash([2, 1.5]);
    ctx.lineDashOffset = -t * 6;
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
  // Dimension tick under the part.
  ctx.strokeStyle = 'rgba(207,227,255,0.6)';
  ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.moveTo(x - 9, y + 12); ctx.lineTo(x + 9, y + 12); ctx.moveTo(x - 9, y + 10.5); ctx.lineTo(x - 9, y + 13.5); ctx.moveTo(x + 9, y + 10.5); ctx.lineTo(x + 9, y + 13.5); ctx.stroke();
}

function neon(ctx: CanvasRenderingContext2D, e: Entry, x: number, y: number, t: number, lite: boolean, uid: number) {
  const shapes = shapesFor(e.a, e.k);
  const flick = Math.sin(t * 31 + uid) > 0.93 ? 0.45 : 1;
  const hot = lt(e.c, 0.55);
  ctx.save();
  ctx.translate(x, y);
  ctx.lineJoin = 'round';
  ctx.globalAlpha = flick;
  if (!lite) { ctx.shadowColor = e.c; ctx.shadowBlur = 7 + Math.sin(t * 4 + uid) * 2; }
  for (const sh of shapes) {
    trace(ctx, sh.pts, !sh.line);
    if (!sh.line) { ctx.fillStyle = sh.tone === 'a' ? A(e.c, 0.85) : sh.tone === 'l' ? A(e.c, 0.18) : '#0b0d16'; ctx.fill(); }
    ctx.strokeStyle = e.c;
    ctx.lineWidth = sh.tone === 'm' ? 1.3 : 0.8;
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
  for (const sh of shapes) {
    if (sh.tone !== 'm') continue;
    trace(ctx, sh.pts, !sh.line);
    ctx.strokeStyle = hot; ctx.lineWidth = 0.45; ctx.stroke();
  }
  ctx.restore();
}

function paper(ctx: CanvasRenderingContext2D, e: Entry, x: number, y: number, t: number, _lite: boolean, uid: number) {
  const base = mix(BODY_COLOR[e.k] ?? e.c, '#e9dcc3', 0.12);
  const accent = lt(e.c, 0.25);
  const shapes = shapesFor(e.a, e.k);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(((uid % 7) - 3) * 0.03 + Math.sin(t * 1.4) * 0.05);
  ctx.lineJoin = 'round';
  // Each paper layer casts a short hard shadow onto the layer below.
  for (const sh of shapes) {
    if (sh.line) continue;
    trace(ctx, sh.pts, true);
    ctx.save();
    ctx.translate(0.9, 1.4);
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = toneColor(sh.tone, base, accent);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,248,232,0.55)';
    ctx.lineWidth = 0.55;
    ctx.stroke();
  }
  ctx.restore();
}

const ARCH: Record<PickupKind, { a: string; c: string }> = {
  xp: { a: 'gem', c: '#6ee7ff' },
  health: { a: 'plus', c: '#4ade80' },
  cred: { a: 'coin', c: '#ffd166' },
  coin: { a: 'coin', c: '#d6c27a' },
  sweep: { a: 'orb', c: '#bfe9ff' },
  'cyber-resin': { a: 'drop', c: '#a855f7' },
  'rootglass-cell': { a: 'cell', c: '#5eead4' },
  'magnet-coil': { a: 'orb', c: '#fb7185' },
  'loot-box': { a: 'chest', c: '#3b82f6' },
  'relic-vault-chest': { a: 'chest', c: '#f59e0b' },
  'firefly-amber-chest': { a: 'chest', c: '#fbbf24' },
  'mimic-chest': { a: 'chest', c: '#dc2626' },
  'glitch-cache': { a: 'box', c: '#22d3ee' },
  'card-pack': { a: 'card', c: '#d946ef' },
  'phosphor-ore': { a: 'ore', c: '#f59e0b' },
  'silicon-alloy': { a: 'ingot', c: '#38bdf8' },
  'prism-quartz': { a: 'quartz', c: '#f43f5e' },
  'water-flask': { a: 'flask', c: '#38bdf8' },
};
const XP_COLORS = ['#4fb3c9', '#6ee7ff', '#ffb347', '#e879f9'];
const XP_KEYS = ['xp-1', 'xp-2', 'xp-3', 'xp-4'];

/** Flat two-tone gem for crowded fields: no gradients, so hundreds stay cheap. */
function cheapGem(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, c: string) {
  ctx.fillStyle = dk(c, 0.45);
  ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s * 0.7, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s * 0.7, y); ctx.fill();
  ctx.fillStyle = c;
  ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x - s * 0.7, y); ctx.lineTo(x, y + s * 0.2); ctx.fill();
}

/**
 * Draws one pickup in a non-classic pack. Caller has save()d the context.
 * `crowded` (many live pickups) swaps gradient-heavy XP gems for a flat gem.
 */
export function drawStyledPickup(ctx: CanvasRenderingContext2D, p: Pickup, now: number, style: DropStyle, lite: boolean, crowded: boolean) {
  if (style === 'toon') { drawEnhancedPickup(ctx, p, now, lite); return; }
  const age = now - p.bornAt;
  const t = age / 1000 + ((p.uid * 1.713) % TAU);
  const arch = ARCH[p.kind];
  const tier = p.kind === 'xp' ? (p.value >= 20 ? 3 : p.value >= 10 ? 2 : p.value >= 4 ? 1 : 0) : 0;
  const color = p.kind === 'xp' ? XP_COLORS[tier]! : arch.c;

  let hop = 0;
  let pop = 1;
  if (age < 380) {
    const u = age / 380;
    hop = Math.sin(u * Math.PI) * 13 * (1 - u * 0.5) + (u > 0.65 ? Math.sin((u - 0.65) / 0.35 * Math.PI) * 3 : 0);
    pop = 0.35 + 0.65 * Math.min(1, u * 2.2);
  }
  const bob = style === 'pixel' ? Math.round(Math.sin(t * 3.4) * 1.5) : Math.sin(t * 3.6) * 1.8;
  const x = p.x;
  const y = p.y + bob - hop;

  const speed = Math.hypot(p.vx, p.vy);
  if (speed > 70) {
    const len = Math.min(14, speed * 0.045);
    ctx.save();
    ctx.globalAlpha = Math.min(0.45, speed / 600);
    ctx.strokeStyle = PICKUP_COLOR[p.kind];
    ctx.lineWidth = style === 'pixel' ? 2 : 1.4;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - (p.vx / speed) * len, y - (p.vy / speed) * len); ctx.stroke();
    ctx.restore();
  }

  if (crowded && p.kind === 'xp' && style !== 'pixel') {
    cheapGem(ctx, x, y, [4, 6, 8, 11][tier]! * pop, color);
    return;
  }

  const e: Entry = { k: p.kind === 'xp' ? XP_KEYS[tier]! : p.kind, c: color, a: arch.a, n: p.kind };
  ctx.translate(x, y);
  ctx.scale(pop, pop);
  // Coins turn on their edge; everything else keeps its facing.
  if (arch.a === 'coin' && style !== 'pixel') ctx.scale(0.3 + 0.7 * Math.abs(Math.cos(t * 2.6)), 1);
  const fn: StyleFn = style === 'realistic' ? real : style === 'tech' ? tech : style === 'blueprint' ? blueprint : style === 'neon' ? neon : style === 'paper' ? paper : pix;
  fn(ctx, e, 0, 0, t, lite, p.uid);
  if (style === 'realistic' && tier > 0 || style === 'realistic' && p.kind !== 'xp' && (arch.a === 'gem' || arch.a === 'quartz' || arch.a === 'ingot')) {
    const u = (t * 0.5) % 1;
    if (u < 0.3) {
      ctx.globalAlpha = 0.5 * Math.sin((u / 0.3) * Math.PI);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      const cx = -7 + (u / 0.3) * 14;
      ctx.beginPath(); ctx.moveTo(cx - 3, 6); ctx.lineTo(cx + 3, -6); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
  if (style === 'pixel' && (arch.a === 'gem' || arch.a === 'quartz') && Math.floor(t * 2) % 3 === 0) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-2, -4, 2, 2);
  }
}
