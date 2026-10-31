(async()=>{
 const sleep=t=>new Promise(r=>setTimeout(r,t)); const log=[];
 const bytes=b=>{const bin=atob(b);const u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return u};
 const fB=new File([bytes('__B__')],'B.pdf',{type:'application/pdf'});
 setView('edit'); const {E,ops,addAnn,commit,openBytes}=RE;
 await openBytes(bytes('__A__').buffer,'A.pdf'); await sleep(1200);
 await ops.rot(90); await ops.rot(-90); await ops.blank(); await ops.dup(); log.push('blank+dup '+E.n);
 await ops.merge([fB]); log.push('merge '+E.n);
 await ops.nums({fmt:'Page {n} of {N}',pos:'bottom-right',size:12,start:1}); await ops.wm({text:'CONFIDENTIAL',size:80,opacity:25,angle:45,color:'#888888',which:'all'});
 await ops.meta({title:'Test title',author:'Surya',subject:'S',keywords:'a,b'});
 E.pages=new Set([2]); await ops.del(); log.push('delete '+E.n);
 await RE.reorder([0],2); log.push('reorder ok');
 await ops.split({mode:'ranges',ranges:'1-2,3'}); await ops.png({which:'all',dpi:72}); await ops.text();
 E.pages=new Set([0,1]); await ops.extract();
 await ops.opt();
 await openBytes(bytes('__A__').buffer,'A.pdf'); await sleep(600);
 addAnn({t:'redact',x:55,y:396,w:215,h:24,color:'#000',size:1}); await commit(); await ops.text();
 const U=RE.E; U.bytes && log.push('redacted pages '+U.n);
 await RE.undo(); await sleep(500); log.push('undo ok');
 return log;
})()
