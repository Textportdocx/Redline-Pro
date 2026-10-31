(async()=>{
 const sleep=t=>new Promise(r=>setTimeout(r,t));
 const toBytes=b=>{const bin=atob(b);const u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return u};
 setView('edit'); await RE.openBytes(toBytes('__A__').buffer,'A.pdf'); await sleep(2500);
 const nonwhite=()=>{const c=document.getElementById('ecv'),x=c.getContext('2d'),d=x.getImageData(0,0,c.width,c.height).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i]<200)n++;return n+' of '+(d.length/4)+' size '+c.width+'x'+c.height};
 const log=['after open: '+nonwhite()];
 RE.goto(0); RE.goto(0); document.getElementById('eZi').click(); document.getElementById('eZi').click(); document.getElementById('eZo').click(); await sleep(2500); log.push('after rapid zoom: '+nonwhite());
 await RE.mutate(async d=>{},'x'); await sleep(2000); log.push('after mutate: '+nonwhite());
 await RE.commit(); await RE.ops.rot(90); await sleep(2500); log.push('after rotate: '+nonwhite()+' status '+document.getElementById('est').textContent);
 return log;
})()
