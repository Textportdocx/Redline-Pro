(async()=>{
 const sleep=t=>new Promise(r=>setTimeout(r,t)); const log=[];
 const mk=(b,n)=>{const bin=atob(b);const u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return new File([u],n,{type:'application/pdf'})};
 await loadFile('A',mk('__A__','A.pdf')); await loadFile('B',mk('__BS__','Bshift.pdf')); await sleep(9000);
 log.push('shifted regions before align: '+S.cur.regions.length);
 document.getElementById('align').click(); await sleep(14000);
 log.push('shift now '+document.getElementById('dx').value+','+document.getElementById('dy').value+' regions after align: '+S.cur.regions.length);
 for (const m of ['over','diff','side','blink','A','B','paper']) { const sel=document.getElementById('mode'); sel.value=m; sel.dispatchEvent(new Event('change')); await sleep(900); }
 log.push('modes ok');
 document.getElementById('png').click(); await sleep(1500); document.getElementById('csv').click(); await sleep(1200);
 await loadFile('B',mk('__B__','B.pdf')); await sleep(9000);
 log.push('real B regions: '+S.cur.regions.length+' status: '+document.getElementById('st').textContent);
 return log;
})()
