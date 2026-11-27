C={'common':'#38f2ff','rare':'#7cff6b','epic':'#ff3fd2','legendary':'#ffd23f'}
E='#3b2a20'; CR='#FAF6EE'
def icon(kind,col,s=40):
    p={'hat':'<path d="M6 28h28v5H6z M11 28V16q9-9 18 0v12z"/>',
       'cape':'<path d="M14 7h12l7 27-7-4-6 5-6-5-7 4z"/>',
       'dice':'<rect x="8" y="8" width="24" height="24" rx="5"/><g fill="#07061a"><circle cx="15" cy="15" r="2.6"/><circle cx="20" cy="20" r="2.6"/><circle cx="25" cy="25" r="2.6"/></g>',
       'palette':'<circle cx="15" cy="16" r="9"/><circle cx="26" cy="17" r="8" opacity=".7"/><circle cx="20" cy="27" r="8" opacity=".45"/>',
       'emote':'<path d="M7 8h26v19H21l-8 7v-7H7z"/><g fill="#07061a"><circle cx="15" cy="17" r="2.6"/><circle cx="25" cy="17" r="2.6"/></g>'}[kind]
    return f'<svg width="{s}" height="{s}" viewBox="0 0 40 40" fill="{col}">{p}</svg>'
items=[('Gold Crown','hat','legendary'),('Astral Plum','palette','epic'),('Crown Knight','cape','rare'),('Cyan Glass','dice','common'),('Relay Cap','hat','common'),('Owl Nod','emote','common')]
def page(title,body):
    return f'''<meta charset="utf-8"><style>*{{box-sizing:border-box;margin:0;font-family:Inter,Arial,sans-serif}}body{{width:390px;height:760px;overflow:hidden;color:#fff;background:radial-gradient(ellipse at 50% 20%,#2a1d5c,#07061a 70%);padding:16px}}
.c{{background:{CR};color:{E};border:3px solid {E};border-radius:14px;box-shadow:0 3px 0 {E}}}.b{{border:3px solid {E};border-radius:10px;padding:9px 12px;font-weight:900;font-size:13px;color:{E};background:#ffcf3c;text-align:center}}
.d{{background:#1a1238;border-radius:10px;display:flex;align-items:center;justify-content:center}}h1{{font-size:26px;text-align:center}}small{{font-size:11px;opacity:.75}}.row{{display:flex;gap:8px}}</style>
<div style="text-align:center;font:12px monospace;letter-spacing:.3em;color:#67e8f9">LOK PARTY VAULT</div><h1>{title}</h1>
<div style="display:flex;justify-content:center;gap:8px;margin:10px 0 14px;font-weight:800;font-size:13px"><span class="c" style="padding:5px 10px">2 capsules</span><span class="c" style="padding:5px 10px">1 key</span><span class="c" style="padding:5px 10px">420 dust</span></div>{body}'''
grid=''.join(f'<div class="c" style="padding:8px;text-align:center;{"outline:4px solid #ff3fd2;" if i==1 else ""}"><div class="d" style="height:62px">{icon(k,C[r])}</div><div style="font-weight:900;font-size:11px;margin-top:5px">{n}</div><small style="font-size:10px">{r}</small></div>' for i,(n,k,r) in enumerate(items))
A=page('A. Shelf',f'''<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:9px">{grid}</div>
<div class="c" style="margin-top:16px;padding:14px"><div class="row" style="align-items:center"><div class="d" style="width:76px;height:76px">{icon("palette",C["epic"],52)}</div><div><b style="font-size:18px">Astral Plum</b><br><small>epic palette shard</small></div></div>
<div class="row" style="margin-top:12px"><div class="b" style="flex:1;opacity:.5">Forge<br><small>750 dust</small></div><div class="b" style="flex:1;background:#38f2ff">Break down<br><small>+180 dust</small></div></div>
<div class="b" style="margin-top:8px;background:#efe5d0">Add to reroll (0 of 3)</div></div>
<div style="text-align:center;margin-top:14px"><small>Tap a shard on the shelf. Its actions show below.</small></div>''')
rows=''.join(f'<div class="c" style="display:flex;gap:9px;align-items:center;padding:7px;margin-bottom:8px"><div class="d" style="width:48px;height:48px">{icon(k,C[r],34)}</div><div style="flex:1"><b style="font-size:13px">{n}</b><br><small>{r} {k}</small></div><div class="b" style="padding:5px 8px;font-size:11px;{"" if r=="common" else "opacity:.5"}">Forge<br>{ {"common":120,"rare":300,"epic":750,"legendary":1500}[r]}</div><div class="b" style="padding:5px 8px;font-size:11px;background:#38f2ff">Break<br>+{ {"common":30,"rare":75,"epic":180,"legendary":360}[r]}</div></div>' for n,k,r in items)
B=page('B. List',f'<div class="row" style="margin-bottom:10px"><div class="b" style="flex:1">Shards (6)</div><div class="b" style="flex:1;background:#efe5d0">Unlocked (2)</div></div>{rows}<div class="b" style="background:#7cff6b">Reroll 3 shards into 1 unlock</div><div style="text-align:center;margin-top:10px"><small>Everything has its own buttons. No extra taps.</small></div>')
slot=lambda n,k,r: f'<div class="d" style="flex:1;height:78px;border:2px dashed #fff5;flex-direction:column;color:#fff">{icon(k,C[r],36)}<small>{n}</small></div>' if n else '<div class="d" style="flex:1;height:78px;border:2px dashed #fff5;font-size:26px;opacity:.5">+</div>'
tray=''.join(f'<div class="c" style="min-width:66px;padding:5px"><div class="d" style="height:48px">{icon(k,C[r],32)}</div></div>' for n,k,r in items)
Cc=page('C. Workbench',f'''<div class="c" style="padding:14px;text-align:center"><b>Reroll bench</b><br><small>3 shards become 1 permanent unlock</small><div class="row" style="margin:12px 0">{slot("Cyan Glass","dice","common")}{slot("Owl Nod","emote","common")}{slot("","","")}</div><div class="b" style="opacity:.5">Pick one more</div></div>
<div style="margin:16px 0 8px;font-weight:900">Your shards</div><div class="row" style="overflow:hidden">{tray}</div><div style="text-align:center;margin:8px 0"><small>Tap to put on the bench. Hold to forge or break down.</small></div>
<div style="margin:16px 0 8px;font-weight:900">Unlocked 2 of 17</div><div style="display:grid;grid-template-columns:repeat(5,1fr);gap:7px">{"".join(f'<div class="d" style="height:60px;background:{"#33246b" if i<2 else "#120d28"}">{icon(["hat","cape"][i],"#ffd23f",34) if i<2 else "<span style=opacity:.3>?</span>"}</div>' for i in range(10))}</div>''')
for n,h in (('a',A),('b',B),('c',Cc)): open(n+'.html','w').write(h)
