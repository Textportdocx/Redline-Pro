(async()=>{ const sleep=t=>new Promise(r=>setTimeout(r,t));
 const bytes=b=>{const bin=atob(b);const u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return u};
 setView('edit'); await RE.openBytes(bytes('__M__'),'mixed.pdf'); await sleep(2500);
 const sp=[...document.querySelectorAll('#etl span')].find(s=>s.textContent.startsWith('Line 5')); const r=document.createRange(); r.setStart(sp.firstChild,8); r.setEnd(sp.firstChild,24); getSelection().removeAllRanges(); getSelection().addRange(r);
 document.getElementById('etl').dispatchEvent(new MouseEvent('mouseup',{bubbles:true})); await sleep(400);
 return ['bar visible '+!document.getElementById('selbar').hidden]; })()
