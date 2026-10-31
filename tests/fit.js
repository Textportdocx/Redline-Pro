(async()=>{ const sleep=t=>new Promise(r=>setTimeout(r,t)); const log=[];
 const bytes=b=>{const bin=atob(b);const u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return u};
 setView('edit'); const {E,ops}=RE; await RE.openBytes(bytes('__M__'),'mixed.pdf'); await sleep(1500);
 const chk=tag=>{ const v=document.getElementById('eview'), c=document.getElementById('ecv'); const r=c.getBoundingClientRect(), vr=v.getBoundingClientRect(); log.push(tag+': page '+Math.round(r.width)+'x'+Math.round(r.height)+' view '+v.clientWidth+'x'+v.clientHeight+' fits='+(r.height<=v.clientHeight&&r.width<=v.clientWidth)); };
 chk('open p1'); RE.goto(1); await sleep(900); chk('goto p2 landscape'); RE.goto(2); await sleep(900); chk('goto p3 A3');
 RE.goto(0); await sleep(700); await ops.rot(90); await sleep(1200); chk('rotated p1');
 window.dispatchEvent(new Event('resize')); await sleep(700); chk('after resize');
 return log; })()
