(async()=>{
 const sleep=t=>new Promise(r=>setTimeout(r,t)); const log=[];
 const mk=(b,n)=>{const bin=atob(b);const u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return new File([u],n,{type:'application/pdf'})};
 PREF.scanMax=0; await loadFile('A',mk('__A__','A.pdf')); const t0=performance.now(); await loadFile('B',mk('__B__','B.pdf')); log.push('first compare ms '+Math.round(performance.now()-t0)+' regions '+S.cur.regions.length);
 log.push('scan-all button '+!!document.querySelector('#pages .sm'));
 document.querySelector('#pages .sm').click(); await sleep(6000); log.push('chips '+document.querySelectorAll('.pg.diff').length);
 ACT.nextDiff(); ACT.nextDiff(); log.push('sel after 2 next '+S.sel);
 document.getElementById('markAll').click(); log.push('reviewed all '+Object.keys(S.done).length);
 ACT.swap(); await sleep(7000); log.push('swapped names '+S.names.A+'/'+S.names.B+' regions '+S.cur.regions.length);
 ACT.swap(); await sleep(7000);
 S.ignore.push({x:590,y:205,w:50,h:50,page:null}); await start(); log.push('with ignore area regions '+S.cur.regions.length);
 ACT.clearIgnore(); await sleep(7000); log.push('after clear '+S.cur.regions.length);
 await ACT.report(); await sleep(500); log.push('status '+document.getElementById('st').textContent);
 document.getElementById('theme').click(); log.push('theme '+document.documentElement.dataset.theme);
 return log;
})()
