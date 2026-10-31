(async()=>{
 const sleep=t=>new Promise(r=>setTimeout(r,t)); const log=[]; localStorage.setItem('author','Surya');
 const toBytes=b=>{const bin=atob(b);const u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return u};
 setView('edit'); const {E,addAnn,commit,openBytes}=RE; const errs=[]; window.addEventListener('unhandledrejection',e=>errs.push(String(e.reason)));
 await openBytes(toBytes('__A__').buffer,'A.pdf'); await sleep(1500);
 await RE.addNote(0,500,100,'Check this value'); await sleep(400);
 await RE.addMarkup(0,'Highlight',{x:55,y:396,w:215,h:22},'Value looks wrong','#ffe600'); await sleep(400);
 await RE.addMarkup(0,'Underline',{x:60,y:520,w:420,h:16},'','#e11d48'); await sleep(400);
 await RE.addMarkup(0,'StrikeOut',{x:55,y:396,w:60,h:22},'old value','#e11d48'); await sleep(400);
 log.push('comments '+E.comments.length+' types '+E.comments.map(c=>c.type).join('/'));
 let top=E.comments.filter(c=>!c.irt); await RE.replyTo(top[0],'Agreed, fixing it'); await sleep(400);
 top=E.comments.filter(c=>!c.irt); await RE.toggleRes(top[0]); await sleep(400);
 const p=RE.editC(E.comments.find(c=>c.type==='Highlight')); await sleep(300); document.querySelector('#dB textarea').value='Edited: use 22k'; document.getElementById('dF').requestSubmit(); await p; await sleep(400);
 log.push('after reply+resolve+edit: '+E.comments.length+' resolved='+E.comments.filter(c=>c.state==='Completed').length+' edited='+E.comments.some(c=>c.contents==='Edited: use 22k')+' reply='+E.comments.some(c=>c.irt&&c.contents==='Agreed, fixing it'));
 document.getElementById('cCsv').click(); await sleep(800); document.getElementById('cTxt').click(); await sleep(800);
 const ul=E.comments.find(c=>c.type==='Underline'); await RE.delC(ul); await sleep(400); log.push('after delete underline: '+E.comments.length);
 addAnn({t:'text',x:60,y:60,text:'Ünïcode € 日本 test',color:'#e11d48',size:20}); addAnn({t:'stamp',x:700,y:60,w:150,h:34,fs:20,text:'APPROVED',color:'#0b8a3d'});
 try{ await commit(); log.push('burn-in commit ok'); }catch(e){ log.push('COMMIT ERROR '+e.message); }
 document.getElementById('eSave').click(); await sleep(1500);
 document.getElementById('cTab').click(); E.selC=E.comments.find(c=>c.type==='Highlight').key; RE.renderComments(); await sleep(800);
 log.push('errs '+JSON.stringify(errs)+' status '+document.getElementById('est').textContent);
 return log;
})()
