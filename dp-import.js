/* Surveyor's Toolbox — DP to CAD Phase 1 */
(function(){
 'use strict';
 var VERSION='6.5.438',modulePromise=null,pdfDoc=null,report=null,selected=-1,runId=0;
 function el(id){return document.getElementById(id)}
 function fmt(n){return Number(n||0).toLocaleString('en-AU')}
 function setStatus(message,error){
  var x=el('dpProcessingStatus');if(!x)return;
  x.hidden=!message;x.textContent=message||'';
  x.style.background=error?'#fff2f0':'#f3f6f3';x.style.color=error?'#9b4540':'#64756b';
 }
 function loadPdfJs(){
  if(window.pdfjsLib&&window.pdfjsLib.getDocument)return Promise.resolve(window.pdfjsLib);
  if(!modulePromise){
   modulePromise=import('https://cdn.jsdelivr.net/npm/pdfjs-dist@'+VERSION+'/build/pdf.mjs').then(function(lib){
    lib.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@'+VERSION+'/build/pdf.worker.mjs';
    window.pdfjsLib=lib;return lib;
   }).catch(function(){modulePromise=null;throw new Error('Could not load the PDF engine. Connect to the internet and try again.')});
  }
  return modulePromise;
 }
 function getReverse(ops){var r={};Object.keys(ops).forEach(function(k){r[ops[k]]=k});return r}
 function has(code,ops,names){return names.some(function(k){return typeof ops[k]==='number'&&code===ops[k]})}
 function inspect(list,lib){
  var ops=lib.OPS||{},reverse=getReverse(ops),counts={},paths=0,lines=0,curves=0,images=0,drawing=0;
  var imageNames=['paintImageXObject','paintInlineImageXObject','paintImageMaskXObject','paintSolidColorImageMask','paintJpegXObject','paintImageXObjectRepeat','paintImageMaskXObjectRepeat'];
  var drawingNames=['constructPath','stroke','closeStroke','fill','eoFill','fillStroke','eoFillStroke','closeFillStroke','closeEOFillStroke'];
  var f=list.fnArray||[],a=list.argsArray||[];
  for(var i=0;i<f.length;i++){
   var code=f[i],name=reverse[code]||('op_'+code);counts[name]=(counts[name]||0)+1;
   if(has(code,ops,imageNames))images++;
   if(has(code,ops,drawingNames))drawing++;
   if(typeof ops.constructPath==='number'&&code===ops.constructPath){
    paths++;var cmds=(a[i]||[])[0];
    if(cmds&&cmds.length)for(var j=0;j<cmds.length;j++){
     if(cmds[j]===ops.lineTo)lines++;
     if(cmds[j]===ops.curveTo||cmds[j]===ops.curveTo2||cmds[j]===ops.curveTo3)curves++;
    }
   }
  }
  if(!paths){paths=drawing;lines=counts.lineTo||0;curves=(counts.curveTo||0)+(counts.curveTo2||0)+(counts.curveTo3||0)}
  return {pathGroups:paths,lineSegments:lines,curveSegments:curves,imageOps:images,drawingOps:drawing,operatorCount:f.length,operatorCounts:counts};
 }
 async function analyse(file,id){
  if(!file||(!/\.pdf$/i.test(file.name||'')&&file.type!=='application/pdf'))throw new Error('Choose a PDF document.');
  if(file.size>100*1024*1024)throw new Error('This PDF exceeds the 100 MB Phase 1 limit.');
  setStatus('Loading PDF inspection engine…');
  var lib=await loadPdfJs();if(id!==runId)return;
  var bytes=new Uint8Array(await file.arrayBuffer());
  var pdf=await lib.getDocument({data:bytes,isEvalSupported:false}).promise;
  if(id!==runId){pdf.destroy();return}
  pdfDoc=pdf;var pages=[];
  for(var n=1;n<=pdf.numPages;n++){
   if(id!==runId)return;
   setStatus('Inspecting PDF sheet '+n+' of '+pdf.numPages+'…');
   var page=await pdf.getPage(n),viewport=page.getViewport({scale:1});
   var text=await page.getTextContent({includeMarkedContent:false});
   var ops=await page.getOperatorList(),stats=inspect(ops,lib);
   var items=(text.items||[]).filter(function(x){return x&&typeof x.str==='string'&&x.str.trim()});
   pages.push({
    pageNumber:n,width:Math.round(viewport.width*100)/100,height:Math.round(viewport.height*100)/100,rotation:page.rotate||0,
    textItemCount:items.length,textPreview:items.slice(0,8).map(function(x){return x.str.trim()}).join(' · '),
    pathGroups:stats.pathGroups,lineSegments:stats.lineSegments,curveSegments:stats.curveSegments,
    imageOps:stats.imageOps,drawingOps:stats.drawingOps,operatorCount:stats.operatorCount,operatorCounts:stats.operatorCounts,
    likelyPlanSheet:stats.imageOps===0&&(stats.pathGroups>=350||stats.drawingOps>=600)
   });
   page.cleanup();
  }
  if(id!==runId)return;
  report={fileName:file.name,fileSize:file.size,pageCount:pdf.numPages,inspectedAt:new Date().toISOString(),pages:pages};
  renderSummary();
  var plan=pages.filter(function(p){return p.likelyPlanSheet});
  el('dpDocumentBar').hidden=false;el('dpDocumentName').textContent=file.name;
  el('dpDocumentDetails').textContent=fmt(file.size)+' bytes · '+pages.length+' sheets analysed';
  el('dpExportAnalysisBtn').disabled=false;el('dpAnalysisArea').hidden=false;
  setStatus('Inspection complete. '+plan.length+' likely vector drawing sheet(s) found across '+pages.length+' page(s).');
  var initial=plan.length?plan[0].pageNumber-1:0;
  await window.dpSelectPage(initial);
 }
 function renderSummary(){
  if(!report)return;
  var pages=report.pages,plan=pages.filter(function(p){return p.likelyPlanSheet});
  el('dpStatPages').textContent=fmt(pages.length);
  el('dpStatPlans').textContent=fmt(plan.length);
  el('dpStatPaths').textContent=fmt(pages.reduce(function(s,p){return s+p.pathGroups},0));
  el('dpStatImages').textContent=fmt(pages.reduce(function(s,p){return s+p.imageOps},0));
  el('dpPageList').innerHTML=pages.map(function(p,i){
   var cls=p.likelyPlanSheet?' plan':'',badge=p.likelyPlanSheet?'PLAN SHEET':'OTHER';
   return '<button type="button" class="dp-page-choice'+cls+(i===selected?' active':'')+'" onclick="dpSelectPage('+i+')"><span class="dp-page-no">'+p.pageNumber+'</span><span class="dp-page-copy"><strong>PDF page '+p.pageNumber+'</strong><small>'+fmt(p.pathGroups)+' vector paths · '+fmt(p.imageOps)+' image ops</small></span><span class="dp-page-badge">'+badge+'</span></button>';
  }).join('');
 }
 function renderStats(p){
  [['dpPathGroups',p.pathGroups],['dpLineSegments',p.lineSegments],['dpCurveSegments',p.curveSegments],['dpTextItems',p.textItemCount],['dpImageOps',p.imageOps],['dpDrawingOps',p.drawingOps]].forEach(function(pair){el(pair[0]).textContent=fmt(pair[1])});
  el('dpPreviewTitle').textContent='PDF page '+p.pageNumber;
  el('dpPreviewMeta').textContent=(p.likelyPlanSheet?'Likely vector plan drawing':'Other document sheet')+' · '+fmt(p.textItemCount)+' selectable text items';
  el('dpPreviewTag').textContent=p.likelyPlanSheet?'LIKELY PLAN':'OTHER SHEET';
  el('dpPageDimensions').textContent=p.width+' × '+p.height+' pt · rotation '+p.rotation+'°';
  var note=p.likelyPlanSheet
   ?'High native-vector drawing density and no image operators. Strong candidate for linework extraction. Boundaries are not yet identified.'
   :'Does not meet the vector-plan heuristic. May be an administration sheet, scanned page, or a drawing with a different PDF structure.';
  if(p.likelyPlanSheet&&p.textItemCount<10)note+=' Very little selectable text was found; labels and dimensions may be outlined as vector paths and need OCR later.';
  el('dpInspectionNote').textContent=note+(p.textPreview?' Text sample: '+p.textPreview:'');
 }
 window.dpSelectPage=async function(index){
  if(!pdfDoc||!report)return;
  selected=Math.max(0,Math.min(report.pages.length-1,Number(index)||0));
  var p=report.pages[selected];renderSummary();renderStats(p);
  el('dpPreviewEmpty').hidden=true;el('dpPageCanvas').hidden=false;
  setStatus('Rendering PDF page '+p.pageNumber+'…');
  try{
   var page=await pdfDoc.getPage(p.pageNumber),base=page.getViewport({scale:1});
   var scale=Math.min(1.25,1080/base.width,680/base.height),viewport=page.getViewport({scale:scale});
   var canvas=el('dpPageCanvas'),ctx=canvas.getContext('2d',{alpha:false});
   canvas.width=Math.max(1,Math.round(viewport.width));canvas.height=Math.max(1,Math.round(viewport.height));
   canvas.style.width='100%';canvas.style.height='auto';
   await page.render({canvasContext:ctx,viewport:viewport}).promise;
   setStatus('Ready. Previewing PDF page '+p.pageNumber+'.');
  }catch(e){setStatus('Could not render this sheet preview: '+(e&&e.message||''),true)}
 };
 function processFile(file){
  runId++;var id=runId;report=null;selected=-1;
  if(pdfDoc){try{pdfDoc.destroy()}catch(e){}pdfDoc=null}
  el('dpDocumentBar').hidden=true;el('dpAnalysisArea').hidden=true;
  status('Starting inspection…');
  analyse(file,id).catch(function(e){if(id!==runId)return;status(e&&e.message||'Could not inspect this PDF.',true);el('dpDocumentBar').hidden=true;el('dpAnalysisArea').hidden=true});
 }
 window.dpChooseFile=function(){var input=el('dpPdfFile');if(input){input.value='';input.click()}};
 window.dpDragOver=function(e){e.preventDefault();el('dpDropZone').classList.add('is-dragover')};
 window.dpDragLeave=function(e){e.preventDefault();el('dpDropZone').classList.remove('is-dragover')};
 window.dpDropFile=function(e){e.preventDefault();el('dpDropZone').classList.remove('is-dragover');var f=e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files[0];if(f)processFile(f)};
 window.dpHandleFile=function(e){var input=e&&e.target,f=input&&input.files&&input.files[0];if(f)processFile(f);if(input)input.value=''};
 window.dpExportAnalysis=function(){
  if(!report)return;
  var payload={product:'Surveyor’s Toolbox · DP to CAD Phase 1',reportType:'PDF sheet and vector operator inventory',sourceFile:report.fileName,sourceFileSizeBytes:report.fileSize,inspectedAt:report.inspectedAt,pageCount:report.pageCount,notes:['Sheet identification is heuristic, not boundary interpretation.','Vector path counts include outlined text, symbols and all other vector drawing content.','Bearings and distances have not yet been extracted in Phase 1.'],pages:report.pages};
  var blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=(report.fileName.replace(/\.pdf$/i,'')||'DP')+' - DP analysis.json';document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url)},1000);
 };
 window.dpReset=function(){
  runId++;if(pdfDoc){try{pdfDoc.destroy()}catch(e){}pdfDoc=null}
  report=null;selected=-1;el('dpPdfFile').value='';el('dpDocumentBar').hidden=true;el('dpAnalysisArea').hidden=true;
  el('dpPreviewEmpty').hidden=false;el('dpPageCanvas').hidden=true;el('dpPageCanvas').getContext('2d').clearRect(0,0,el('dpPageCanvas').width,el('dpPageCanvas').height);status('');
 };
})();
