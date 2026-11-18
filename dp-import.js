/* Surveyor's Toolbox — DP to CAD Phase 1 + Phase 2 */
(function(){
 'use strict';
 var PDFJS_VERSION='6.5.438';
 var modulePromise=null,pdfDocument=null,currentReport=null,selectedPage=-1,selectedSegment=-1,selectedRunKey='',runId=0;
 var minLineLength=25,overlayVisible=true,boundaryOverlayVisible=true,boundaryMinLength=35,currentBoundaryRuns=[],boundaryReviewMap={};
 var maxCandidateRows=120;

 function el(id){return document.getElementById(id)}
 function fmt(n){return Number(n||0).toLocaleString('en-AU')}
 function nextPaint(){return new Promise(function(resolve){requestAnimationFrame(function(){resolve()})})}
 function setStatus(message,isError){
  var x=el('dpProcessingStatus');if(!x)return;
  x.hidden=!message;x.textContent=message||'';
  x.style.background=isError?'#fff1ef':'#eef4ef';
  x.style.color=isError?'#9b4540':'#4c6958';
 }
 function loadPdfJs(){
  if(window.pdfjsLib&&window.pdfjsLib.getDocument)return Promise.resolve(window.pdfjsLib);
  if(!modulePromise){
   modulePromise=(async function(){
    var sources=[
     'https://cdn.jsdelivr.net/npm/pdfjs-dist@'+PDFJS_VERSION+'/build/pdf.mjs',
     'https://unpkg.com/pdfjs-dist@'+PDFJS_VERSION+'/build/pdf.mjs'
    ];
    var failures=[];
    for(var i=0;i<sources.length;i++){
     try{
      var lib=await import(sources[i]);
      var base=sources[i].replace(/pdf\.mjs$/,'');
      lib.GlobalWorkerOptions.workerSrc=base+'pdf.worker.mjs';
      window.pdfjsLib=lib;
      return lib;
     }catch(error){failures.push(error&&error.message?error.message:String(error))}
    }
    throw new Error('The PDF reader could not load from either supported CDN. Check your internet connection and try again. '+failures.join(' / '));
   })().catch(function(error){modulePromise=null;throw error});
  }
  return modulePromise;
 }
 function matrixMultiply(a,b){
  return [
   a[0]*b[0]+a[2]*b[1],
   a[1]*b[0]+a[3]*b[1],
   a[0]*b[2]+a[2]*b[3],
   a[1]*b[2]+a[3]*b[3],
   a[0]*b[4]+a[2]*b[5]+a[4],
   a[1]*b[4]+a[3]*b[5]+a[5]
  ];
 }
 function transformPoint(m,x,y){return {x:m[0]*x+m[2]*y+m[4],y:m[1]*x+m[3]*y+m[5]}}
 function cubicPoint(p0,p1,p2,p3,t){
  var mt=1-t;
  return {
   x:mt*mt*mt*p0.x+3*mt*mt*t*p1.x+3*mt*t*t*p2.x+t*t*t*p3.x,
   y:mt*mt*mt*p0.y+3*mt*mt*t*p1.y+3*mt*t*t*p2.y+t*t*t*p3.y
  };
 }
 function extractVectorSegments(operatorList,lib){
  var OPS=lib.OPS||{},fn=operatorList.fnArray||[],args=operatorList.argsArray||[];
  var CTM=[1,0,0,1,0,0],lineWidth=1,stack=[],segments=[],pathGroups=0,curveGroups=0;
  var maxSegments=60000;
  function addLine(a,b){
   if(!a||!b||segments.length>=maxSegments)return;
   var p1=transformPoint(CTM,a.x,a.y),p2=transformPoint(CTM,b.x,b.y);
   var dx=p2.x-p1.x,dy=p2.y-p1.y,length=Math.hypot(dx,dy);
   if(!Number.isFinite(length)||length<0.025)return;
   var scale=Math.sqrt(Math.abs(CTM[0]*CTM[3]-CTM[1]*CTM[2]))||1;
   segments.push({
    id:segments.length+1,
    x1:p1.x,y1:p1.y,x2:p2.x,y2:p2.y,
    length:length,width:Math.abs(lineWidth*scale)
   });
  }
  function curve(from,c1,c2,to){
   var last=from;
   for(var k=1;k<=8;k++){
    var next=cubicPoint(from,c1,c2,to,k/8);
    addLine(last,next);last=next;
   }
   curveGroups++;
  }
  for(var i=0;i<fn.length;i++){
   var code=fn[i],a=args[i]||[];
   if(typeof OPS.save==='number'&&code===OPS.save){stack.push({ctm:CTM.slice(),lineWidth:lineWidth});continue}
   if(typeof OPS.restore==='number'&&code===OPS.restore){var restored=stack.pop();if(restored){CTM=restored.ctm;lineWidth=restored.lineWidth}continue}
   if(typeof OPS.transform==='number'&&code===OPS.transform&&a.length>=6){CTM=matrixMultiply(CTM,Array.from(a).slice(0,6));continue}
   if(typeof OPS.setLineWidth==='number'&&code===OPS.setLineWidth){lineWidth=Number(a[0])||lineWidth;continue}
   if(typeof OPS.constructPath!=='number'||code!==OPS.constructPath)continue;
   pathGroups++;
   var pathOps=a[0]||[],coords=a[1]||[],cursor=0,current=null,subpath=null;
   function readPoint(){var x=Number(coords[cursor++]),y=Number(coords[cursor++]);return {x:x,y:y}}
   for(var j=0;j<pathOps.length;j++){
    var op=pathOps[j];
    if(typeof OPS.moveTo==='number'&&op===OPS.moveTo){
     current=readPoint();subpath=current;continue;
    }
    if(typeof OPS.lineTo==='number'&&op===OPS.lineTo){
     var lineEnd=readPoint();if(current)addLine(current,lineEnd);current=lineEnd;continue;
    }
    if(typeof OPS.curveTo==='number'&&op===OPS.curveTo){
     var c1=readPoint(),c2=readPoint(),end=readPoint();if(current)curve(current,c1,c2,end);current=end;continue;
    }
    if(typeof OPS.curveTo2==='number'&&op===OPS.curveTo2){
     var c2b=readPoint(),end2=readPoint();if(current)curve(current,current,c2b,end2);current=end2;continue;
    }
    if(typeof OPS.curveTo3==='number'&&op===OPS.curveTo3){
     var c1c=readPoint(),end3=readPoint();if(current)curve(current,c1c,end3,end3);current=end3;continue;
    }
    if(typeof OPS.closePath==='number'&&op===OPS.closePath){
     if(current&&subpath)addLine(current,subpath);current=subpath;continue;
    }
    if(typeof OPS.rectangle==='number'&&op===OPS.rectangle){
     var rx=Number(coords[cursor++]),ry=Number(coords[cursor++]),rw=Number(coords[cursor++]),rh=Number(coords[cursor++]);
     var pA={x:rx,y:ry},pB={x:rx+rw,y:ry},pC={x:rx+rw,y:ry+rh},pD={x:rx,y:ry+rh};
     addLine(pA,pB);addLine(pB,pC);addLine(pC,pD);addLine(pD,pA);
     current=pA;subpath=pA;
    }
   }
  }
  return {segments:segments,pathGroups:pathGroups,curveGroups:curveGroups};
 }
 function inspectOtherOperators(operatorList,lib){
  var ops=lib.OPS||{},reverse={},counts={},imageOps=0,drawingOps=0;
  Object.keys(ops).forEach(function(k){reverse[ops[k]]=k});
  var imageNames=['paintImageXObject','paintInlineImageXObject','paintImageMaskXObject','paintSolidColorImageMask','paintJpegXObject','paintImageXObjectRepeat','paintImageMaskXObjectRepeat'];
  var drawNames=['constructPath','stroke','closeStroke','fill','eoFill','fillStroke','eoFillStroke','closeFillStroke','closeEOFillStroke'];
  var fn=operatorList.fnArray||[];
  for(var i=0;i<fn.length;i++){
   var name=reverse[fn[i]]||('op_'+fn[i]);counts[name]=(counts[name]||0)+1;
   if(imageNames.indexOf(name)>=0)imageOps++;
   if(drawNames.indexOf(name)>=0)drawingOps++;
  }
  return {imageOps:imageOps,drawingOps:drawingOps,operatorCount:fn.length,operatorCounts:counts};
 }
 function likelyPlan(stats,textCount){
  return stats.imageOps===0&&(stats.pathGroups>=350||stats.drawingOps>=600);
 }
 function updateSummary(){
  if(!currentReport)return;
  var pages=currentReport.pages||[],complete=pages.filter(function(p){return p&&p.processed}),plans=complete.filter(function(p){return p.likelyPlanSheet});
  el('dpStatPages').textContent=fmt(currentReport.pageCount);
  el('dpStatPlans').textContent=fmt(plans.length);
  el('dpStatPaths').textContent=fmt(complete.reduce(function(s,p){return s+p.pathGroups},0));
  el('dpStatImages').textContent=fmt(complete.reduce(function(s,p){return s+p.imageOps},0));
  el('dpSheetCount').textContent=complete.length+' / '+currentReport.pageCount+' SHEETS';
  el('dpPageList').innerHTML=complete.map(function(p){
   var i=p.pageNumber-1,cls=p.likelyPlanSheet?' plan':'',badge=p.likelyPlanSheet?'PLAN SHEET':'OTHER';
   return '<button type="button" class="dp-page-choice'+cls+(i===selectedPage?' active':'')+'" onclick="dpSelectPage('+i+')"><span class="dp-page-no">'+p.pageNumber+'</span><span class="dp-page-copy"><strong>PDF page '+p.pageNumber+'</strong><small>'+fmt(p.pathGroups)+' path groups · '+fmt(p.vectorSegments.length)+' straight segments · '+fmt(p.imageOps)+' image ops</small></span><span class="dp-page-badge">'+badge+'</span></button>';
  }).join('')+(complete.length<currentReport.pageCount?'<div class="dp-page-progress">Analysing remaining sheets…</div>':'');
  if(el('dpPageCount'))el('dpPageCount').textContent=fmt(complete.length);
 }
 function filteredCandidates(page){
  if(!page||!page.vectorSegments)return [];
  return page.vectorSegments.filter(function(s){return s.length>=minLineLength&&s.width<=3.5}).sort(function(a,b){return b.length-a.length});
 }

 function boundaryRegionFilter(page,segment){
  var padX=65,padY=150;
  var minX=Math.min(segment.x1,segment.x2),maxX=Math.max(segment.x1,segment.x2);
  var minY=Math.min(segment.y1,segment.y2),maxY=Math.max(segment.y1,segment.y2);
  return minX>=padX&&maxX<=page.width-padX&&minY>=padY&&maxY<=page.height-padY;
 }
 function angleOf(segment){
  var a=Math.atan2(segment.y2-segment.y1,segment.x2-segment.x1)%Math.PI;
  return a<0?a+Math.PI:a;
 }
 function angleDifference(a,b){
  var d=Math.abs(a-b)%Math.PI;
  return Math.min(d,Math.PI-d);
 }
 function buildBoundaryRuns(page){
  if(!page||!page.vectorSegments)return [];
  var candidates=filteredCandidates(page).filter(function(segment){
   return segment.length>=boundaryMinLength&&segment.width<=1.55&&boundaryRegionFilter(page,segment);
  });
  if(!candidates.length)return [];
  var parent=candidates.map(function(_,index){return index});
  function find(x){while(parent[x]!==x){parent[x]=parent[parent[x]];x=parent[x]}return x}
  function join(a,b){a=find(a);b=find(b);if(a!==b)parent[b]=a}
  var snap=2.8,angleTolerance=2.2*Math.PI/180;
  for(var i=0;i<candidates.length;i++){
   var a=candidates[i],aa=angleOf(a);
   for(var j=i+1;j<candidates.length;j++){
    var b=candidates[j];
    if(angleDifference(aa,angleOf(b))>angleTolerance)continue;
    var near=Math.hypot(a.x1-b.x1,a.y1-b.y1)<=snap||
     Math.hypot(a.x1-b.x2,a.y1-b.y2)<=snap||
     Math.hypot(a.x2-b.x1,a.y2-b.y1)<=snap||
     Math.hypot(a.x2-b.x2,a.y2-b.y2)<=snap;
    if(near)join(i,j);
   }
  }
  var groups=Object.create(null);
  candidates.forEach(function(segment,index){var root=find(index);(groups[root]||(groups[root]=[])).push(segment)});
  var runs=Object.keys(groups).map(function(root){
   var segments=groups[root],cos=0,sin=0,total=0,width=0;
   segments.forEach(function(segment){
    var angle=angleOf(segment),weight=segment.length;
    cos+=Math.cos(2*angle)*weight;sin+=Math.sin(2*angle)*weight;
    total+=weight;width+=segment.width;
   });
   var angle=(Math.atan2(sin,cos)/2+Math.PI)%Math.PI;
   var ux=Math.cos(angle),uy=Math.sin(angle),points=[];
   segments.forEach(function(s){points.push({x:s.x1,y:s.y1},{x:s.x2,y:s.y2})});
   var projections=points.map(function(p){return p.x*ux+p.y*uy});
   var min=Math.min.apply(null,projections),max=Math.max.apply(null,projections);
   return {
    key:segments.map(function(s){return s.id}).sort(function(a,b){return a-b}).join('-'),
    segments:segments,segmentIds:segments.map(function(s){return s.id}).sort(function(a,b){return a-b}),
    span:max-min,totalSegmentLength:total,averageWidth:width/segments.length,angle:angle*180/Math.PI,
    start:points[projections.indexOf(min)],end:points[projections.indexOf(max)],junctions:0,priority:0,review:'unreviewed'
   };
  });
  function pointToSegmentDistance(point,segment){
   var dx=segment.x2-segment.x1,dy=segment.y2-segment.y1,len2=dx*dx+dy*dy||1;
   var t=Math.max(0,Math.min(1,((point.x-segment.x1)*dx+(point.y-segment.y1)*dy)/len2));
   return Math.hypot(point.x-(segment.x1+t*dx),point.y-(segment.y1+t*dy));
  }
  runs.forEach(function(run){
   var contacts=0;
   run.segments.forEach(function(segment){
    [{x:segment.x1,y:segment.y1},{x:segment.x2,y:segment.y2}].forEach(function(point){
     var touched=candidates.some(function(other){
      return run.segmentIds.indexOf(other.id)<0&&pointToSegmentDistance(point,other)<=3.2;
     });
     if(touched)contacts++;
    });
   });
   run.junctions=contacts;
   var lengthScore=run.span>=250?35:(run.span>=120?27:(run.span>=70?19:10));
   var widthScore=run.averageWidth<=0.9?20:12;
   var chainScore=run.segments.length>1?8:0;
   var junctionScore=Math.min(22,contacts*6);
   run.priority=Math.min(100,lengthScore+widthScore+chainScore+junctionScore);
   run.priorityLabel=run.priority>=65?'HIGH':(run.priority>=45?'MEDIUM':'LOW');
   run.review=boundaryReviewMap[page.pageNumber+':'+run.key]||'unreviewed';
  });
  return runs.sort(function(a,b){return b.priority-a.priority||b.span-a.span});
 }
 function updateBoundaryPanel(){
  var page=currentReport&&currentReport.pages[selectedPage];
  currentBoundaryRuns=page&&page.processed?buildBoundaryRuns(page):[];
  var countEl=el('dpBoundaryRunCount'),body=el('dpBoundaryRunBody');
  if(!countEl||!body)return;
  var confirmed=0,easement=0,ignored=0;
  currentBoundaryRuns.forEach(function(run){
   if(run.review==='boundary')confirmed++;
   else if(run.review==='easement')easement++;
   else if(run.review==='ignore')ignored++;
  });
  countEl.textContent=fmt(currentBoundaryRuns.length)+' RUNS';
  el('dpBoundaryReviewCount').textContent=fmt(currentBoundaryRuns.length-confirmed-easement-ignored);
  el('dpBoundaryConfirmedCount').textContent=fmt(confirmed);
  el('dpBoundaryEasementCount').textContent=fmt(easement);
  el('dpBoundaryIgnoredCount').textContent=fmt(ignored);
  var hasSelection=currentBoundaryRuns.some(function(run){return run.key===selectedRunKey});
  if(!hasSelection)selectedRunKey='';
  ['dpMarkBoundaryBtn','dpMarkEasementBtn','dpIgnoreBoundaryBtn','dpResetBoundaryBtn'].forEach(function(id){if(el(id))el(id).disabled=!selectedRunKey});
  el('dpExportBoundaryReview').disabled=!currentBoundaryRuns.length;
  body.innerHTML=currentBoundaryRuns.slice(0,150).map(function(run,index){
   var key=run.key.replace(/[^0-9-]/g,''),review=run.review;
   var reviewText=review==='boundary'?'BOUNDARY':(review==='easement'?'EASEMENT / TIE':(review==='ignore'?'IGNORED':'UNREVIEWED'));
   return '<tr class="'+(selectedRunKey===run.key?'active':'')+'" onclick="dpSelectBoundaryRun(\''+key+'\')">'+
    '<td>BR'+String(index+1).padStart(3,'0')+'</td><td>'+run.span.toFixed(2)+' pt</td><td>'+run.angle.toFixed(1)+'°</td>'+
    '<td>'+run.segments.length+'</td><td>'+run.averageWidth.toFixed(2)+' pt</td><td>'+run.junctions+'</td>'+
    '<td class="dp-priority">'+run.priority+' / 100 · '+run.priorityLabel+'</td><td><span class="dp-review-pill '+review+'">'+reviewText+'</span></td></tr>';
  }).join('')||'<tr><td colspan="8">No long, thin line runs found in the main drawing area. Lower the minimum length or inspect another sheet.</td></tr>';
  renderVectorOverlay();
 }

 function updateCandidatePanel(){
  var page=currentReport&&currentReport.pages[selectedPage];
  if(!page||!page.processed){
   el('dpCandidateCount').textContent='0 CANDIDATES';
   el('dpCandidateTotal').textContent='0';el('dpCandidateVisible').textContent='0';
   el('dpCandidateBody').innerHTML='<tr><td colspan="6">Select an inspected plan sheet to review vector segments.</td></tr>';
   el('dpExportCandidates').disabled=true;return;
  }
  var candidates=filteredCandidates(page),shown=candidates.slice(0,maxCandidateRows);
  el('dpCandidateCount').textContent=fmt(candidates.length)+' CANDIDATES';
  el('dpCandidateTotal').textContent=fmt(candidates.length);
  el('dpCandidateVisible').textContent=fmt(shown.length)+(candidates.length>shown.length?' of '+fmt(candidates.length):'');
  el('dpExportCandidates').disabled=!candidates.length;
  el('dpCandidateBody').innerHTML=shown.map(function(s){
   var angle=Math.atan2(s.y2-s.y1,s.x2-s.x1)*180/Math.PI;
   var selected=s.id===selectedSegment?' active':'';
   return '<tr class="'+selected+'" onclick="dpHighlightCandidate('+s.id+')"><td>L'+String(s.id).padStart(4,'0')+'</td><td>'+s.length.toFixed(2)+' pt</td><td>'+s.width.toFixed(2)+' pt</td><td>'+angle.toFixed(1)+'°</td><td>'+s.x1.toFixed(1)+', '+s.y1.toFixed(1)+'</td><td>'+s.x2.toFixed(1)+', '+s.y2.toFixed(1)+'</td></tr>';
  }).join('')||'<tr><td colspan="6">No segments meet this filter. Lower the minimum length to inspect more linework.</td></tr>';
  updateBoundaryPanel();
 }
 function renderVectorOverlay(){
  var svg=el('dpVectorOverlay'),page=currentReport&&currentReport.pages[selectedPage];
  if(!svg||!page||!page.processed||!page.viewportTransform){if(svg)svg.innerHTML='';return}
  var lines=[],viewport=page.viewportTransform;
  if(overlayVisible){
   filteredCandidates(page).slice(0,1600).forEach(function(s){
    var p1=pdfToViewport(viewport,s.x1,s.y1),p2=pdfToViewport(viewport,s.x2,s.y2);
    var stroke=s.id===selectedSegment?'#d74737':'#d69a35';
    var width=s.id===selectedSegment?3.2:1.0,opacity=s.id===selectedSegment?1:.28;
    lines.push('<line x1="'+p1.x.toFixed(2)+'" y1="'+p1.y.toFixed(2)+'" x2="'+p2.x.toFixed(2)+'" y2="'+p2.y.toFixed(2)+'" stroke="'+stroke+'" stroke-width="'+width+'" opacity="'+opacity+'" vector-effect="non-scaling-stroke"/>');
   });
  }
  if(boundaryOverlayVisible){
   currentBoundaryRuns.forEach(function(run){
    var color=run.review==='boundary'?'#168652':(run.review==='easement'?'#8c69b2':(run.review==='ignore'?'#9aa39e':'#167db4'));
    var isSelected=run.key===selectedRunKey;
    run.segments.forEach(function(s){
     var p1=pdfToViewport(viewport,s.x1,s.y1),p2=pdfToViewport(viewport,s.x2,s.y2);
     lines.push('<line x1="'+p1.x.toFixed(2)+'" y1="'+p1.y.toFixed(2)+'" x2="'+p2.x.toFixed(2)+'" y2="'+p2.y.toFixed(2)+'" stroke="'+(isSelected?'#e04837':color)+'" stroke-width="'+(isSelected?3.6:2.0)+'" opacity="'+(isSelected?1:.88)+'" vector-effect="non-scaling-stroke"/>');
    });
   });
  }
  svg.setAttribute('viewBox','0 0 '+page.width+' '+page.height);
  svg.setAttribute('preserveAspectRatio','none');
  svg.innerHTML=lines.join('');
 }
 function pdfToViewport(matrix,x,y){
  return {x:matrix[0]*x+matrix[2]*y+matrix[4],y:matrix[1]*x+matrix[3]*y+matrix[5]};
 }
 function renderPageStats(page){
  [['dpPathGroups',page.pathGroups],['dpLineSegments',page.lineSegments],['dpCurveSegments',page.curveSegments],['dpTextItems',page.textItemCount],['dpImageOps',page.imageOps],['dpDrawingOps',page.drawingOps]].forEach(function(pair){el(pair[0]).textContent=fmt(pair[1])});
  el('dpPreviewTitle').textContent='PDF page '+page.pageNumber;
  el('dpPreviewMeta').textContent=(page.likelyPlanSheet?'Likely vector plan drawing':'Other document sheet')+' · '+fmt(page.textItemCount)+' selectable text items';
  el('dpPreviewTag').textContent=page.likelyPlanSheet?'LIKELY PLAN':'OTHER SHEET';
  el('dpPageDimensions').textContent=page.width+' × '+page.height+' pt · rotation '+page.rotation+'°';
  el('dpAnalysisTag').textContent=page.likelyPlanSheet?'VECTOR RICH':'INSPECTED';
  var note=page.likelyPlanSheet
   ?'This page has native vector drawing content and no embedded page image. Line segments are available for geometry review, but they are not yet identified as parcel boundaries.'
   :'This page has not met the vector-plan heuristic. It may be an administration sheet, scanned page, or a drawing with a different PDF structure.';
  if(page.textItemCount<10&&page.likelyPlanSheet)note+=' The drawing contains very little selectable text; dimensions and mark labels appear to be outlined as vectors and require OCR later.';
  el('dpInspectionNote').textContent=note+(page.textPreview?' Text sample: '+page.textPreview:'');
  updateCandidatePanel();
 }
 async function renderSelectedPage(index,id){
  if(!pdfDocument||!currentReport)return;
  var pageData=currentReport.pages[index];if(!pageData||!pageData.processed)return;
  selectedPage=index;selectedSegment=-1;updateSummary();
  renderPageStats(pageData);
  el('dpPreviewEmpty').hidden=true;el('dpPageLayer').hidden=false;
  setStatus('Rendering original PDF sheet '+pageData.pageNumber+'…');
  try{
   var page=await pdfDocument.getPage(pageData.pageNumber);
   var base=page.getViewport({scale:1}),stage=el('dpCanvasStage');
   var maxW=Math.max(240,(stage.clientWidth||850)-20),maxH=680;
   var scale=Math.min(1.35,maxW/base.width,maxH/base.height);
   var viewport=page.getViewport({scale:scale});
   var matrix=page.getViewport({scale:1}).transform;
   pageData.viewportTransform=matrix;
   var layer=el('dpPageLayer'),canvas=el('dpPageCanvas'),ctx=canvas.getContext('2d',{alpha:false});
   layer.style.width=viewport.width+'px';layer.style.height=viewport.height+'px';layer.style.aspectRatio=base.width+'/'+base.height;
   canvas.width=Math.max(1,Math.round(viewport.width));canvas.height=Math.max(1,Math.round(viewport.height));
   canvas.style.width='100%';canvas.style.height='100%';
   var svg=el('dpVectorOverlay');svg.style.width='100%';svg.style.height='100%';
   await page.render({canvasContext:ctx,viewport:viewport}).promise;
   renderVectorOverlay();
   setStatus('Ready. PDF page '+pageData.pageNumber+' is displayed with '+fmt(filteredCandidates(pageData).length)+' candidate line segments.');
  }catch(error){
   setStatus('The PDF sheet was read, but its preview failed: '+(error&&error.message?error.message:String(error)),true);
  }
 }
 async function analysePdf(file,id){
  if(!file||(!/\.pdf$/i.test(file.name||'')&&file.type!=='application/pdf'))throw new Error('Choose a PDF document.');
  if(file.size>100*1024*1024)throw new Error('This PDF exceeds the 100 MB Phase 1 limit.');
  setStatus('Loading PDF inspection engine…');await nextPaint();
  var lib=await loadPdfJs();if(id!==runId)return;
  setStatus('Opening '+file.name+'…');await nextPaint();
  var bytes=new Uint8Array(await file.arrayBuffer());
  var pdf=await lib.getDocument({data:bytes,isEvalSupported:false}).promise;
  if(id!==runId){try{await pdf.destroy()}catch(e){}return}
  pdfDocument=pdf;
  currentReport={fileName:file.name,fileSize:file.size,pageCount:pdf.numPages,inspectedAt:new Date().toISOString(),pages:[]};
  selectedPage=-1;selectedSegment=-1;
  el('dpDocumentBar').hidden=false;el('dpDocumentName').textContent=file.name;
  el('dpDocumentDetails').textContent=fmt(file.size)+' bytes · '+pdf.numPages+' pages';
  el('dpExportAnalysisBtn').disabled=false;el('dpAnalysisArea').hidden=false;
  el('dpStatPages').textContent=fmt(pdf.numPages);el('dpStatPlans').textContent='0';el('dpStatPaths').textContent='0';el('dpStatImages').textContent='0';
  el('dpPageList').innerHTML='<div class="dp-page-progress">Reading page 1…</div>';
  await nextPaint();
  for(var pageNo=1;pageNo<=pdf.numPages;pageNo++){
   if(id!==runId)return;
   setStatus('Inspecting PDF page '+pageNo+' of '+pdf.numPages+'…');await nextPaint();
   var page=await pdf.getPage(pageNo),base=page.getViewport({scale:1});
   var results=await Promise.all([
    page.getTextContent({includeMarkedContent:false}),
    page.getOperatorList()
   ]);
   var textContent=results[0],operatorList=results[1];
   var vector=extractVectorSegments(operatorList,lib),other=inspectOtherOperators(operatorList,lib);
   var textItems=(textContent.items||[]).filter(function(x){return x&&typeof x.str==='string'&&x.str.trim()});
   var pageData={
    pageNumber:pageNo,width:Math.round(base.width*100)/100,height:Math.round(base.height*100)/100,rotation:page.rotate||0,
    textItemCount:textItems.length,textPreview:textItems.slice(0,10).map(function(x){return x.str.trim()}).join(' · '),
    pathGroups:vector.pathGroups,lineSegments:vector.segments.length,curveSegments:vector.curveGroups,
    imageOps:other.imageOps,drawingOps:other.drawingOps,operatorCount:other.operatorCount,
    operatorCounts:other.operatorCounts,vectorSegments:vector.segments,processed:true
   };
   pageData.likelyPlanSheet=likelyPlan(pageData,textItems.length);
   currentReport.pages.push(pageData);
   updateSummary();
   if(pageNo===1){
    selectedPage=0;
    await renderSelectedPage(0,id);
   }else if(selectedPage>=0){
    updateSummary();updateCandidatePanel();
   }
   page.cleanup();
  }
  if(id!==runId)return;
  var plans=currentReport.pages.filter(function(p){return p.likelyPlanSheet});
  if(plans.length){
   var first=plans[0].pageNumber-1;
   if(first!==selectedPage)await renderSelectedPage(first,id);
  }
  el('dpDocumentDetails').textContent=fmt(file.size)+' bytes · '+pdf.numPages+' pages · '+plans.length+' likely plan sheets';
  setStatus('Inspection complete. '+plans.length+' likely vector plan sheet(s) found. Phase 2 extracted native linework for review.');
 }
 window.dpSelectPage=async function(index){if(!pdfDocument||!currentReport)return;index=Math.max(0,Math.min(currentReport.pages.length-1,Number(index)||0));if(currentReport.pages[index]&&currentReport.pages[index].processed)await renderSelectedPage(index,runId)};
 window.dpSetMinLength=function(value){minLineLength=Math.max(5,Number(value)||25);el('dpMinLengthLabel').textContent=minLineLength+' pt';selectedSegment=-1;updateCandidatePanel()};
 window.dpToggleOverlay=function(value){overlayVisible=!!value;renderVectorOverlay()};
 window.dpHighlightCandidate=function(id){
  selectedSegment=Number(id)||-1;
  var s=currentReport&&currentReport.pages[selectedPage]&&currentReport.pages[selectedPage].vectorSegments.find(function(x){return x.id===selectedSegment});
  el('dpSelectedCandidate').textContent=s?'Selected L'+String(s.id).padStart(4,'0')+' · '+s.length.toFixed(2)+' pt':'No segment selected';
  updateCandidatePanel();
 };
 window.dpExportCandidateLines=function(){
  var page=currentReport&&currentReport.pages[selectedPage];if(!page)return;
  var candidates=filteredCandidates(page);
  var payload={sourceFile:currentReport.fileName,pdfPage:page.pageNumber,pageCoordinates:'PDF user-space points; not MGA/grid coordinates',candidateFilter:{minimumLengthPt:minLineLength,maximumStrokeWidthPt:3.5},count:candidates.length,segments:candidates};
  var blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=(currentReport.fileName.replace(/\.pdf$/i,'')||'DP')+' - page '+page.pageNumber+' candidate linework.json';
  document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url)},1500);
 };

 window.dpSetBoundaryFilter=function(value){
  boundaryMinLength=Math.max(15,Number(value)||35);
  el('dpMinBoundaryLengthLabel').textContent=boundaryMinLength+' pt';
  selectedRunKey='';updateBoundaryPanel();
 };
 window.dpToggleBoundaryOverlay=function(value){boundaryOverlayVisible=!!value;renderVectorOverlay()};
 window.dpSelectBoundaryRun=function(key){selectedRunKey=String(key||'');updateBoundaryPanel()};
 window.dpClassifyBoundaryRun=function(kind){
  if(!selectedRunKey)return;
  if(['boundary','easement','ignore','review'].indexOf(kind)<0)return;
  var run=currentBoundaryRuns.find(function(item){return item.key===selectedRunKey});
  if(!run)return;
  boundaryReviewMap[currentReport.pages[selectedPage].pageNumber+':'+run.key]=kind==='review'?'unreviewed':kind;
  updateBoundaryPanel();
  var note=el('dpBoundaryReviewNote');
  if(note)note.textContent='Run '+run.key+' marked '+(kind==='review'?'unreviewed':kind)+'. This review is retained for the current PDF session and can be exported as JSON.';
 };
 window.dpExportBoundaryReview=function(){
  if(!currentReport)return;
  var pages=currentReport.pages.filter(function(page){return page&&page.processed}).map(function(page){
   return {pageNumber:page.pageNumber,pageSizePt:{width:page.width,height:page.height},
    coordinateBasis:'PDF user-space points; not MGA/grid coordinates',
    runs:buildBoundaryRuns(page).map(function(run){
     return {key:run.key,segmentIds:run.segmentIds,segments:run.segments,spanPt:run.span,angleDegrees:run.angle,
      averageStrokeWidthPt:run.averageWidth,junctionContacts:run.junctions,priorityScore:run.priority,
      priorityLabel:run.priorityLabel,review:run.review,start:run.start,end:run.end};
    })};
  });
  var payload={product:'Surveyor’s Toolbox · DP to CAD Phase 3',sourceFile:currentReport.fileName,
   inspectedAt:new Date().toISOString(),method:'Grouped collinear native vector segments with endpoint snapping, main-sheet region and thin-stroke filters',
   warnings:['Candidate runs are not automatically confirmed parcel boundaries.','PDF coordinates are not MGA coordinates.','Bearing/distance labels have not yet been OCR-associated with runs.'],pages:pages};
  var blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=(currentReport.fileName.replace(/\.pdf$/i,'')||'DP')+' - boundary run review.json';
  document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url)},1500);
 };

 window.dpChooseFile=function(){var input=el('dpPdfFile');if(input){input.value='';input.click()}};
 window.dpFileSelected=function(event){if(typeof window.dpHandleFile==='function')window.dpHandleFile(event);else setStatus('The DP importer has not loaded. Reopen the app while connected to the internet.',true)};
 window.dpDragOver=function(event){event.preventDefault();el('dpDropZone').classList.add('is-dragover')};
 window.dpDragLeave=function(event){event.preventDefault();el('dpDropZone').classList.remove('is-dragover')};
 window.dpDropFile=function(event){event.preventDefault();el('dpDropZone').classList.remove('is-dragover');var f=event.dataTransfer&&event.dataTransfer.files&&event.dataTransfer.files[0];if(f)processFile(f)};
 function processFile(file){
  runId++;var id=runId;currentReport=null;selectedPage=-1;selectedSegment=-1;
  if(pdfDocument){try{pdfDocument.destroy()}catch(e){}pdfDocument=null}
  el('dpDocumentBar').hidden=true;el('dpAnalysisArea').hidden=true;
  setStatus('Starting PDF inspection…');
  analysePdf(file,id).catch(function(error){
   if(id!==runId)return;
   setStatus(error&&error.message?error.message:'Could not inspect this PDF.',true);
   el('dpDocumentBar').hidden=true;el('dpAnalysisArea').hidden=true;
  });
 }
 window.dpHandleFile=function(event){
  var input=event&&event.target,file=input&&input.files&&input.files[0];if(!file)return;
  processFile(file);if(input)input.value='';
 };
 window.dpExportAnalysis=function(){
  if(!currentReport)return;
  var payload={
   product:'Surveyor’s Toolbox · DP to CAD Phase 2',
   reportType:'PDF sheet, native vector linework and operator inventory',
   sourceFile:currentReport.fileName,sourceFileSizeBytes:currentReport.fileSize,
   inspectedAt:currentReport.inspectedAt,pageCount:currentReport.pageCount,
   notes:[
    'Plan sheet identification is heuristic, not boundary interpretation.',
    'Vector segments and candidate runs are measured in PDF user-space points and are not MGA coordinates.',
    'Outlined text, symbols, title blocks, easements and parcel lines all contribute vector segments.',
    'Boundary runs are geometric candidates requiring human review; bearings and distances are not yet associated with parcel boundaries.'
   ],
   pages:currentReport.pages.map(function(p){
    return {pageNumber:p.pageNumber,width:p.width,height:p.height,rotation:p.rotation,textItemCount:p.textItemCount,
     pathGroups:p.pathGroups,lineSegments:p.lineSegments,curveSegments:p.curveSegments,imageOps:p.imageOps,
     drawingOps:p.drawingOps,likelyPlanSheet:p.likelyPlanSheet,
     candidateLines:filteredCandidates(p),boundaryRuns:buildBoundaryRuns(p).map(function(run){return {key:run.key,segmentIds:run.segmentIds,spanPt:run.span,angleDegrees:run.angle,averageStrokeWidthPt:run.averageWidth,junctionContacts:run.junctions,priorityScore:run.priority,priorityLabel:run.priorityLabel,review:run.review}})};
   })
  };
  var blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=(currentReport.fileName.replace(/\.pdf$/i,'')||'DP')+' - DP analysis.json';
  document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url)},1500);
 };
 window.dpReset=function(){
  runId++;if(pdfDocument){try{pdfDocument.destroy()}catch(e){}pdfDocument=null}
  currentReport=null;selectedPage=-1;selectedSegment=-1;
  el('dpPdfFile').value='';el('dpDocumentBar').hidden=true;el('dpAnalysisArea').hidden=true;
  el('dpPreviewEmpty').hidden=false;el('dpPageLayer').hidden=true;
  el('dpPageCanvas').getContext('2d').clearRect(0,0,el('dpPageCanvas').width,el('dpPageCanvas').height);
  el('dpVectorOverlay').innerHTML='';setStatus('');
 };
 window.dpImporterReady=true;
 if(el('dpProcessingStatus'))setStatus('DP PDF engine ready. Choose or drop a deposited plan PDF to begin.');
})();
