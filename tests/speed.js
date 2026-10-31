(async()=>{ const sleep=t=>new Promise(r=>setTimeout(r,t)); const log=[];
 const mk=(b,n)=>{const bin=atob(b);const u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return new File([u],n,{type:'application/pdf'})};
 PREF.scanMax=0; await loadFile('A',mk('__A__','A.pdf')); await loadFile('B',mk('__B__','B.pdf')); await sleep(500);
 let t=performance.now(); S.rc=null; await show(1); log.push('full compare (render + diff) ms '+Math.round(performance.now()-t));
 t=performance.now(); await show(1); log.push('same page again, cached render ms '+Math.round(performance.now()-t));
 document.getElementById('tol').value=70; t=performance.now(); await show(1); log.push('after tolerance change ms '+Math.round(performance.now()-t));
 return log; })()
