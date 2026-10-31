(async()=>{ const sleep=t=>new Promise(r=>setTimeout(r,t));
 const log=[]; log.push('menus '+document.querySelectorAll('.mb').length+' icons '+document.querySelectorAll('svg.ic').length+' view '+document.body.dataset.view);
 document.querySelectorAll('.mb')[0].click(); await sleep(300); log.push('file menu items '+document.querySelectorAll('.dd .mi').length);
 return log; })()
