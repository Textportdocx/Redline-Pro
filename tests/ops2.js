(async()=>{
 const sleep=t=>new Promise(r=>setTimeout(r,t)); const log=[];
 const bytes=b=>{const bin=atob(b);const u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return u};
 const fB=new File([bytes('__B__')],'B.pdf',{type:'application/pdf'});
 setView('edit'); const {E,ops,ui,F}=RE; PREF.confirmSave=false;
 const snap=async n=>{ await RE.commit(); await window.native.saveFile({name:n,bytes:E.bytes}); };
 await RE.openBytes(bytes('__A__'),'A.pdf','/home/claude/out7/A.pdf'); await sleep(1200);
 log.push('dirty after open '+window.isDirty());
 await ops.crop({top:20,right:20,bottom:20,left:20,which:'all',reset:false}); log.push('crop view '+(await E.doc.getPage(1)).view.map(Math.round).join(','));
 await ops.crop({which:'all',reset:true}); log.push('crop reset '+(await E.doc.getPage(1)).view.map(Math.round).join(','));
 await ops.hf({hl:'HDR-LEFT',hc:'',hr:'{date}',fl:'{file}',fc:'Page {n} of {N}',fr:'',size:10,margin:10,which:'all'}); await snap('snap_hf.pdf');
 log.push('dirty after edit '+window.isDirty());
 await ops.insertpdf([fB]); log.push('insert '+E.n); await ops.reverse(); log.push('reverse ok '+E.n);
 await RE.undo(); log.push('undo hist '+E.hist.length+' redo '+E.redo.length); await RE.redo(); log.push('redo done '+E.redo.length);
 await ui.selOdd(); log.push('odd '+[...E.pages]); await ui.selEven(); log.push('even '+[...E.pages]); await ui.selAll(); log.push('all '+[...E.pages]); await ui.selInv(); log.push('inv '+[...E.pages]);
 await RE.runFind('VCC'); log.push('find VCC hits '+F.hits.length); await RE.runFind('zzzz'); log.push('find none '+F.hits.length);
 E.meas[0]=[{t:'meas',x1:0,y1:0,x2:72,y2:0}]; RE.goto(0); await sleep(500);
 await RE.doSave(false); await sleep(800); log.push('dirty after save '+window.isDirty()+' path '+E.path);
 E.pages=new Set([0]); await ops.flatten({which:'sel',dpi:100}); await snap('snap_flat.pdf'); log.push('flatten ok');
 document.getElementById('cTab').click(); document.getElementById('tTab').click();
 return log;
})()
