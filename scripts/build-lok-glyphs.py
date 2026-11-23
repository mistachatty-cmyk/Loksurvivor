#!/usr/bin/env python3
"""Lok Facet glyph set: original icon art for Survivor 616 and the Lok ecosystem.
Rules: 24x24 grid, straight edges only (no curves), 30/45/60 degree angles, solid shards separated by
a consistent slit. Output is ONE path string per glyph (fill-rule evenodd) used by both SVG (GameIcon)
and canvas (Path2D). Edit here, then run: python3 scripts/build-lok-glyphs.py"""
import math, json, pathlib
from shapely.geometry import Polygon, LineString, box, MultiPolygon, Point
from shapely.ops import unary_union
from shapely import affinity as A

def P(*p): return Polygon(p)
def R(x,y,w,h): return box(x,y,x+w,y+h)
def rot(g,d,c=(12,12)): return A.rotate(g,d,origin=c)
def mir(g): return A.scale(g,-1,1,origin=(12,12))
def ngon(cx,cy,r,n,d=0): return Polygon([(cx+r*math.cos(math.radians(d+360*i/n)),cy+r*math.sin(math.radians(d+360*i/n))) for i in range(n)])
def U(*g): return unary_union(g)
def cut(g,*lines,w=1.3):
    for l in lines: g=g.difference(LineString(l).buffer(w/2,cap_style=2))
    return g
def line(pts,w=1.8): return LineString(pts).buffer(w/2,cap_style=2,join_style=2)
def ring(cx,cy,r1,r2,n=8,d=22.5): return ngon(cx,cy,r1,n,d).difference(ngon(cx,cy,r2,n,d))
def star(cx,cy,ro,ri,n,d=-90,jit=None):
    pts=[]
    for i in range(n*2):
        r=(ro if i%2==0 else ri)
        if jit and i%2==0: r=ro*jit[(i//2)%len(jit)]
        a=math.radians(d+180*i/n); pts.append((cx+r*math.cos(a),cy+r*math.sin(a)))
    return Polygon(pts)
def arc(cx,cy,r1,r2,a0,a1,step=15):
    a=list(range(int(a0),int(a1)+1,step)); 
    if a[-1]!=a1:a.append(a1)
    o=[(cx+r1*math.cos(math.radians(t)),cy+r1*math.sin(math.radians(t))) for t in a]
    i=[(cx+r2*math.cos(math.radians(t)),cy+r2*math.sin(math.radians(t))) for t in reversed(a)]
    return Polygon(o+i)
def chamf(x,y,w,h,c=2):
    return P((x+c,y),(x+w-c,y),(x+w,y+c),(x+w,y+h-c),(x+w-c,y+h),(x+c,y+h),(x,y+h-c),(x,y+c))

G={}
# ---------- elements ----------
G['fire']=P((12,1.5),(16.2,7.5),(19.5,13),(18,19),(12,22.5),(6,19),(4.5,13),(8,8.5),(9.6,11.8),(12,8)).difference(P((12,14.5),(14.6,18),(12,21),(9.4,18)))
G['freeze']=U(cut(ring(12,12,10.8,7.4,6,-90),[(12,0),(12,5)],[(12,19),(12,24)],w=1.8),P((12,8.4),(15.2,12),(12,15.6),(8.8,12)))
G['slow']=U(P((5,2.5),(19,2.5),(19,5),(13.2,11.3),(10.8,11.3),(5,5)).difference(P((9.5,5.2),(14.5,5.2),(12,8.6))),
            P((10.8,12.7),(13.2,12.7),(19,19),(19,21.5),(5,21.5),(5,19)).difference(P((12,15.8),(15.4,19.4),(8.6,19.4))))
G['shock']=U(P((14.5,1.5),(5.5,13.2),(10.8,13.2),(8.8,22.5),(18.5,10.2),(13.2,10.2)),ngon(19.6,4.4,2.4,6,0))
G['glitch']=U(R(3,3,13,3.6),R(17.6,3,3.4,3.6),R(8,8.4,13,3.6),R(3,13.8,9,3.6),R(14,13.8,7,3.6),R(6,19.2,12,2.6))
_sh=P((12,1.5),(20.5,4.5),(20.5,12),(12,22.5),(3.5,12),(3.5,4.5))
_in=A.scale(_sh,0.52,0.52,origin=(12,11))
G['guard']=cut(U(_sh.difference(_in),A.scale(_sh,0.2,0.2,origin=(12,10))),[(12,0),(12,24)],w=1.6)
G['aero']=U(P((2.5,3),(21.5,3),(19.5,6.6),(4.5,6.6)),P((6.5,8.4),(19.5,8.4),(17.5,12),(8.5,12)),P((10,13.8),(17,13.8),(15,17.4),(11.8,17.4)),P((13,19.2),(15,19.2),(14.4,22.5)))
_c=ngon(12,12,3.4,6,0); _s=[P((12+6.4*math.cos(math.radians(a))-2.2*math.sin(math.radians(a)),12+6.4*math.sin(math.radians(a))+2.2*math.cos(math.radians(a))),
      (12+6.4*math.cos(math.radians(a))+2.2*math.sin(math.radians(a)),12+6.4*math.sin(math.radians(a))-2.2*math.cos(math.radians(a))),
      (12+10.8*math.cos(math.radians(a)),12+10.8*math.sin(math.radians(a)))) for a in range(30,390,60)]
G['light']=U(_c,*_s)
G['dark']=U(ngon(11,12,9.8,28,0).difference(ngon(15.6,9.4,8.2,28,0)),P((18.6,6.4),(20.2,9),(18.6,11.6),(17,9)))
def sl(xt,y1,y2,w=3.2,k=0.38): return P((xt,y1),(xt+w,y1),(xt+w-(y2-y1)*k,y2),(xt-(y2-y1)*k,y2))
G['striker']=U(sl(17.5,1.8,22.2),sl(11.2,1.8,17),sl(5,5,13))
G['blaster']=star(12,12,10.8,4.6,10,-90,[1,0.82,1.02,0.88,0.96]).difference(P((12,9.2),(14.8,12),(12,14.8),(9.2,12)))
_f=A.rotate(chamf(7.5,4.5,10,15,2),12,origin=(12.5,12)); _b=A.rotate(chamf(6.5,4.5,10,15,2),-14,origin=(11.5,12))
G['trickster']=U(_f.difference(A.rotate(P((12.5,9),(15,12),(12.5,15),(10,12)),12,origin=(12.5,12))),_b.difference(_f.buffer(1.3,join_style=2)))
G['speedster']=U(P((13,4.5),(22,12),(13,19.5),(16.4,12)),P((2,6.8),(10.5,6.8),(9.3,9.2),(2,9.2)),P((5,10.8),(13.2,10.8),(13.2,13.2),(5,13.2)),P((2,14.8),(9.3,14.8),(10.5,17.2),(2,17.2)))
G['weaver']=cut(U(ring(12,12,10.8,8.6,8,22.5),ring(12,12,5.6,2.8,4,-90)),[(0,0),(5,5)],[(24,0),(19,5)],[(0,24),(5,19)],[(24,24),(19,19)],w=1.6)
_g=P((12,1.5),(17.2,6.5),(17.2,17),(12,22.5),(6.8,17),(6.8,6.5))
G['gem']=cut(_g,[(12,6.5),(12,24)],[(5,6.5),(19,6.5)],w=1.2)
G['battery']=U(R(9,1.5,6,2.2),R(5,4.6,14,18).difference(R(7.1,6.7,9.8,13.8)),R(8.6,7.9,6.8,3),R(8.6,11.9,6.8,3),R(8.6,15.9,6.8,3))
_t=[rot(P((10.2,2.2),(13.8,2.2),(14.6,5),(9.4,5)),a) for a in range(0,360,45)]
G['gear']=U(ngon(12,12,7.8,16,0),*_t).difference(ngon(12,12,3,6,0))
_fl=P((9.2,2),(14.8,2),(14.8,9),(20.5,20),(19,22),(5,22),(3.5,20),(9.2,9))
G['vial']=U(_fl.difference(_fl.buffer(-1.7,join_style=2)),_fl.buffer(-3.3,join_style=2).intersection(R(0,15,24,9)),R(11,10.4,1.8,1.8))
_w=P((3,2.5),(9.2,7.2),(14.8,7.2),(21,2.5),(20.5,12.5),(15,20.5),(12,22.5),(9,20.5),(3.5,12.5))
_e=P((6,11),(10,12.2),(8.8,14.2),(6,13.4))
G['wolf']=_w.difference(U(_e,mir(_e),P((10.5,18),(13.5,18),(12,20))))
G['frog']=U(R(3.5,3,6.5,6.5).difference(R(5.8,5.3,1.9,1.9)),R(14,3,6.5,6.5).difference(R(16.3,5.3,1.9,1.9)),cut(P((2.5,10.8),(21.5,10.8),(19,21.5),(5,21.5)),[(6,16),(18,16)],w=1.4))
_leg=lambda dy:line([(1.8,12+dy*1.3),(7,12+dy*0.5)],1.7)
G['mite']=U(ngon(12,12,5.4,6,0).difference(U(R(9.4,9.8,1.8,1.8),R(12.8,9.8,1.8,1.8))),*[g for dy in (-6,0,6) for g in (_leg(dy),mir(_leg(dy)))])
_hx=lambda cx,cy:ngon(cx,cy,4.3,6,-90)
G['hive']=U(_hx(8,7.5),ring(16,7.5,4.3,2.1,6,-90),_hx(12,14.5),ring(12,21,2.6,1.2,6,-90).buffer(0))
_sk=P((6.5,10.6),(6.5,7),(9,3),(15,3),(17.5,7),(17.5,10.6)); _si=P((9.1,10.6),(9.1,7.8),(10.5,5.5),(13.5,5.5),(14.9,7.8),(14.9,10.6))
G['lock']=U(_sk.difference(_si),chamf(4,11.8,16,10.6,2).difference(U(ngon(12,15.6,2.1,6,0),R(11.1,16.4,1.8,3.8))))
# ---------- marks / UI ----------
_st=star(12,12.6,10.8,4.8,5,-90)
G['star']=cut(_st,*[[(12,12.6),(12+9*math.cos(math.radians(-90+36+72*i)),12.6+9*math.sin(math.radians(-90+36+72*i)))] for i in range(5)],w=0.9)
G['starHollow']=_st.difference(_st.buffer(-2.1,join_style=2))
_sp=star(12,12,11,3,8,-90,[1,0.58])
G['spark']=_sp
G['sparkHollow']=_sp.difference(_sp.buffer(-1.7,join_style=2))
_h=P((12,21.5),(2.5,11.2),(2.5,7),(5.5,3.5),(9.5,3.5),(12,6.8),(14.5,3.5),(18.5,3.5),(21.5,7),(21.5,11.2))
G['heart']=cut(_h,[(12,6.8),(12,24)],w=1.3)
G['heartHollow']=_h.difference(_h.buffer(-2.3,join_style=2))
_d=P((12,1.5),(21,12),(12,22.5),(3,12))
G['diamond']=cut(_d,[(2,12),(22,12)],w=1.1)
G['diamondHollow']=_d.difference(_d.buffer(-2.2,join_style=2))
G['diamondCore']=U(G['diamondHollow'],P((12,8.4),(15.2,12),(12,15.6),(8.8,12)))
G['dot']=ngon(12,12,9.6,8,22.5)
G['dotCore']=U(ring(12,12,10,7.6),ngon(12,12,3.8,8,22.5))
G['ring']=ring(12,12,10,7.6)
G['ringDouble']=U(ring(12,12,10.4,8.6),ring(12,12,5.4,3.2))
_nh=A.rotate(A.scale(ngon(8,18,3.8,6,0),1.15,0.82),-20,origin=(8,18))
G['note']=U(_nh,R(10.6,3.2,1.9,15),P((12.5,3.2),(18.6,6.6),(18.6,10.4),(12.5,7.4)))
G['noteStem']=U(_nh,R(10.6,3.2,1.9,15))
_nh2=A.rotate(A.scale(ngon(16.5,17,3.3,6,0),1.15,0.82),-20,origin=(16.5,17))
_nh1=A.rotate(A.scale(ngon(6.5,19,3.3,6,0),1.15,0.82),-20,origin=(6.5,19))
G['noteBeam']=U(_nh1,_nh2,R(8.4,5,1.8,14),R(18.4,3.4,1.8,13.6),P((8.4,4.2),(20.2,2.4),(20.2,6.2),(8.4,8)))
G['rankUp']=P((12,2.8),(21.6,21),(12,16.6),(2.4,21))
G['rankUpSmall']=A.scale(G['rankUp'],0.62,0.62,origin=(12,12))
G['blade']=U(P((12,1.5),(15.2,5),(15.2,15.8),(12,18.6),(8.8,15.8),(8.8,5)),R(5.8,16.6,12.4,2.2),R(10.8,19.6,2.4,3.2))
G['crown']=U(P((3,18),(3,7),(8,12),(12,3.5),(16,12),(21,7),(21,18)),R(3,19.6,18,2.6))
G['check']=P((2.8,12.8),(5.4,10.2),(9.6,14.4),(18.6,5),(21.2,7.6),(9.6,19.6))
_x=U(rot(R(10.6,1.5,2.8,21),45),rot(R(10.6,1.5,2.8,21),-45))
G['cross']=cut(_x,[(12,12),(12,12)],w=0)  # plain X
_ar=P((2,9.4),(12.4,9.4),(12.4,4.8),(22,12),(12.4,19.2),(12.4,14.6),(2,14.6))
G['arrowR']=cut(_ar,[(6.4,6),(6.4,18)],w=1.3)
G['arrowL']=mir(G['arrowR']); G['arrowU']=rot(G['arrowR'],-90); G['arrowD']=rot(G['arrowR'],90)
G['chevUp']=P((2.5,15.5),(12,6),(21.5,15.5),(18.6,18.4),(12,11.8),(5.4,18.4))
G['chevDown']=rot(G['chevUp'],180)
G['swap']=P((1.5,12),(7,6.5),(7,10.4),(17,10.4),(17,6.5),(22.5,12),(17,17.5),(17,13.6),(7,13.6),(7,17.5))
_a1=200; _pm=(12+8.2*math.cos(math.radians(_a1)),12+8.2*math.sin(math.radians(_a1)))
_tg=(-math.sin(math.radians(_a1)),math.cos(math.radians(_a1))); _rd=(math.cos(math.radians(_a1)),math.sin(math.radians(_a1)))
G['rotateL']=U(arc(12,12,9.6,6.8,-30,_a1),P((_pm[0]+_rd[0]*4.4,_pm[1]+_rd[1]*4.4),(_pm[0]-_rd[0]*4.4,_pm[1]-_rd[1]*4.4),(_pm[0]+_tg[0]*5.4,_pm[1]+_tg[1]*5.4)))
G['rotateR']=mir(G['rotateL'])
G['square']=chamf(3.5,3.5,17,17,2.4)
G['squareHollow']=G['square'].difference(chamf(6,6,12,12,1.2))
G['squareCore']=U(G['squareHollow'],R(9.4,9.4,5.2,5.2))
G['bar']=P((6,7),(22,7),(18,17),(2,17))
G['credit']=U(chamf(2.5,4,19,16,2).difference(chamf(4.8,6.3,14.4,11.4,1)),R(6.9,8.7,4.6,6.6),R(13.4,9.8,3,1.5),R(13.4,13,3,1.5))
G['coin']=U(ring(12,12,10.4,7.6),R(10.8,7.2,2.4,9.6))
G['warn']=U(P((12,2.2),(22.6,21.2),(1.4,21.2)).difference(A.scale(P((12,2.2),(22.6,21.2),(1.4,21.2)),0.68,0.68,origin=(12,15.5))),R(10.9,9.6,2.2,5.6),R(10.9,16.6,2.2,2.2))
G['hatTop']=cut(U(R(2,17,20,3.2),R(6.5,4.5,11,12)),[(6,13.6),(18,13.6)],w=1.4)
_ha=ring(12,12,10.4,8.2,12,0)
G['halo']=cut(_ha,[(12,0),(12,4)],[(12,20),(12,24)],[(0,12),(4,12)],[(20,12),(24,12)],w=2.4)
G['satellite']=U(ring(12,12,6.2,4,8),ngon(12,12,2,8,22.5),R(1.5,9.8,5,4.4),R(17.5,9.8,5,4.4))
G['rainCloud']=U(P((4.6,13.6),(2.6,10.6),(5,7.6),(8.6,7.4),(10.6,4.4),(15.4,4.4),(17.4,7.8),(20,8.2),(21.6,11),(19.6,13.6)),sl(5.6,16,21.5,1.8,0.3),sl(10.6,16,21.5,1.8,0.3),sl(15.6,16,21.5,1.8,0.3))
G['cone']=cut(U(P((12,2.2),(17.2,19.2),(6.8,19.2)),R(4,20,16,2.4)),[(8,12.4),(16,12.4)],w=1.2)
_ey=P((1.5,12),(7,6.5),(17,6.5),(22.5,12),(17,17.5),(7,17.5))
G['orbitalEye']=U(_ey.difference(ngon(12,12,3.8,8,22.5)),ngon(12,12,1.5,8,22.5))
_wg=P((11,12),(1.8,4),(3.2,15.6),(8.4,19.8))
G['mothCap']=U(_wg,mir(_wg),R(11.1,6,1.8,15))
G['antenna']=U(R(11.1,11,1.8,11.5),ngon(12,8,2.2,6,0),*[line([(12-d+1.6,8-d*.62),(12-d,8),(12-d+1.6,8+d*.62)],1.5) for d in (5.5,9.5)],*[line([(12+d-1.6,8-d*.62),(12+d,8),(12+d-1.6,8+d*.62)],1.5) for d in (5.5,9.5)])
G['vinyl']=U(ring(12,12,10.6,7.8),ring(12,12,6.4,1.8))
G['visor']=U(P((3,9.5),(12.5,5.5),(21.5,9.5),(21.5,13),(10,13)),R(3,14.4,18,3))

G['plusCross']=U(R(10.6,2,2.8,20),R(2,10.6,20,2.8))
G['slashA']=sl(14.5,2,22,3.4,0.5)
G['slashB']=mir(G['slashA'])
G['dashes']=U(R(1,10.6,5,2.8),R(9.5,10.6,5,2.8),R(18,10.6,5,2.8))

# Ported meanings from Queens N Kings (drawn again here in the 616 shard language, 2026-11-23)
G['house']=cut(U(P((12,2.5),(22,11),(2,11)),R(4.5,12.4,15,9.1)),[(10,17.2),(10,21.6)],[(14,17.2),(14,21.6)],w=1.3).difference(R(10,16,4,6))
_cup=P((5.5,2.5),(18.5,2.5),(17.5,9.5),(14,13),(10,13),(6.5,9.5))
_hd=line([(5.6,4.6),(2.6,4.6),(2.6,8),(6.8,10.6)],1.8)
G['trophy']=U(_cup,_hd,mir(_hd),R(11.1,13.6,1.8,4.4),P((7,21.5),(8.5,18.4),(15.5,18.4),(17,21.5)))
G['scroll']=cut(U(R(5,5,14,14),R(3,2.5,18,2.6),R(3,18.9,18,2.6)),[(8,9),(16,9)],[(8,12),(16,12)],[(8,15),(13,15)],w=1.3)
G['map']=U(P((2,6),(8,4),(8,20),(2,22)),P((9.3,4.5),(14.7,6.5),(14.7,22),(9.3,20)),P((16,6.5),(22,4),(22,20),(16,22)))
G['menu']=U(P((3,4.5),(21,4.5),(19.5,7.5),(4.5,7.5)),P((3,10.5),(21,10.5),(19.5,13.5),(4.5,13.5)),P((3,16.5),(21,16.5),(19.5,19.5),(4.5,19.5)))
_sp=P((3,9),(7,9),(12,4.5),(12,19.5),(7,15),(3,15))
G['sound']=U(_sp,line([(15,9),(17,12),(15,15)],1.8),line([(18,6.5),(21,12),(18,17.5)],1.8))
G['mute']=U(_sp,line([(15,9.5),(21,15.5)],1.9),line([(21,9.5),(15,15.5)],1.9))

def path(g):
    polys=[g] if isinstance(g,Polygon) else [p for p in getattr(g,'geoms',[]) if isinstance(p,Polygon)]
    out=[]
    for p in polys:
        if p.is_empty or p.area<0.05: continue
        for ring_ in [p.exterior,*p.interiors]:
            pts=list(ring_.coords)[:-1]
            out.append('M'+' '.join(f'{x:.2f}'.rstrip('0').rstrip('.')+','+f'{y:.2f}'.rstrip('0').rstrip('.') for x,y in pts)+'Z')
    return ''.join(out)

out={k:path(v) for k,v in G.items()}
root=pathlib.Path(__file__).resolve().parent.parent
dst=root/'artifacts/survivor-616/src/ui/lokGlyphs.generated.ts'
dst.write_text("// GENERATED by scripts/build-lok-glyphs.py. Do not edit by hand.\n// Lok Facet glyph set: 24x24 grid, evenodd fill, one path per glyph.\nexport const LOK_GLYPH_PATHS = "+json.dumps(out,indent=1)+" as const;\nexport type LokGlyphKey = keyof typeof LOK_GLYPH_PATHS;\n")
# preview sheet
cells=[]
for i,(k,d) in enumerate(out.items()):
    x=(i%10)*96; y=(i//10)*96
    cells.append(f'<g transform="translate({x+10},{y+6}) scale(3)"><path d="{d}" fill="#38bdf8" fill-rule="evenodd"/></g><text x="{x+48}" y="{y+90}" font-size="10" fill="#94a3b8" text-anchor="middle" font-family="monospace">{k}</text>')
rows=(len(out)+9)//10
pathlib.Path('/tmp/sheet.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="960" height="{rows*96}"><rect width="100%" height="100%" fill="#0d1825"/>'+''.join(cells)+'</svg>')
print(len(out),'glyphs')
