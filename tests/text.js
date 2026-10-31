(async()=>{ const sleep=t=>new Promise(r=>setTimeout(r,t)); const log=[]; localStorage.setItem('author','Surya');
 const bytes=b=>{const bin=atob(b);const u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return u};
 setView('edit'); const {E}=RE; await RE.openBytes(bytes('__M__'),'mixed.pdf'); await sleep(2500);
 const spans=()=>[...document.querySelectorAll('#etl span')];
 log.push('text spans '+spans().length+' items '+E.titems.length);
 const sel=(sp,a,b)=>{ const r=document.createRange(); r.setStart(sp.firstChild,a); r.setEnd(sp.firstChild,b); const s=getSelection(); s.removeAllRanges(); s.addRange(r); };
 const spanOf=t=>spans().find(s=>s.textContent.startsWith(t));
 const fill=async(fn,set)=>{ const p=fn(); await sleep(350); set(); document.getElementById('dF').requestSubmit(); return p; };
 // 1. highlight selected word
 let sp=spanOf('Line 3'); sel(sp,sp.textContent.indexOf('quick'),sp.textContent.indexOf('quick')+5);
 log.push('selbar text "'+getSelection().toString()+'" boxes '+RE.selBoxes().length);
 await fill(()=>RE.markFromSelection('Highlight','#ffe600'),()=>{ document.querySelector('#dB textarea').value='check this word'; }); await sleep(600);
 log.push('highlight comments '+E.comments.filter(c=>c.type==='Highlight').length+' text "'+(E.comments[0]||{}).contents+'"');
 // 2. partial edit of a word
 sp=spanOf('Line 4'); let i0=sp.textContent.indexOf('brown'); sel(sp,i0,i0+5);
 await fill(()=>RE.editFromSelection(),()=>{ document.querySelector('#dB textarea').value='RED'; }); log.push('partial edit annotations '+(E.ann[0]||[]).length);
 await RE.undo(); log.push('after undo '+(E.ann[0]||[]).length); await RE.redo(); log.push('after redo '+(E.ann[0]||[]).length);
 // 3. whole-line edit via tool path
 const it=E.titems.find(t=>t.str.startsWith('Line 6')); await fill(()=>RE.editItems([it],null),()=>{ document.querySelector('#dB textarea').value='Line 6: EDITED WHOLE LINE'; document.querySelector('#dB input[type=color]').value='#cc0000'; });
 // 4. two lines at once
 const a=spanOf('Line 8'), b=spanOf('Line 9'); const r=document.createRange(); r.setStart(a.firstChild,2); r.setEnd(b.firstChild,10); getSelection().removeAllRanges(); getSelection().addRange(r);
 log.push('multi items '+RE.itemsIn(RE.selBoxes()).length);
 await fill(()=>RE.editFromSelection(),()=>{ document.querySelector('#dB textarea').value='NEW LINE EIGHT\nNEW LINE NINE'; });
 log.push('annotations on page1 '+E.ann[0].length);
 await RE.commit(); await sleep(800);
 await window.native.saveFile({name:'text_page1.pdf',bytes:E.bytes});
 // 5. flatten-type edit on page 2 (landscape)
 RE.goto(1); await sleep(1500); const it2=E.titems.find(t=>t.str.startsWith('Line 2')); log.push('page2 items '+E.titems.length);
 await fill(()=>RE.editItems([it2],null),()=>{ document.querySelector('#dB textarea').value='Line 2: REMOVED OLD TEXT'; document.querySelector('#dB input[type=checkbox]').checked=true; });
 await RE.commit(); await sleep(800); await window.native.saveFile({name:'text_page2.pdf',bytes:E.bytes});
 RE.goto(0); await sleep(1500); document.getElementById('tTab').click();
 return log; })()
