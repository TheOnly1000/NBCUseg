// ============ GLOBAL KEY SHORTCUTS (extend) ============
document.addEventListener("keydown",function(e){
  var tag=(document.activeElement?.tagName||"").toLowerCase();
  var isTyping=["input","textarea","select"].includes(tag);
  var mod=e.metaKey||e.ctrlKey;
  if(mod&&e.key.toLowerCase()==="z"&&!e.shiftKey&&!isTyping){e.preventDefault();processUndo()}
  if(mod&&e.key.toLowerCase()==="z"&&e.shiftKey&&!isTyping){e.preventDefault();processRedo()}
  if(mod&&e.key==="4"&&!isTyping){e.preventDefault();nav("tickets")}
});

// ============ UNDO/REDO STACKS ============
if(typeof redoStack==="undefined"){redoStack=[]}

// ============ UNDO/REDO FOR METADATA ============
var metaUndoStack=[],metaRedoStack=[];
function pushMetaUndo(){
  var snap={};
  ["metaTitle","metaBreakDur","metaDate","metaType"].forEach(function(id){
    var el=document.getElementById(id);if(el)snap[id]=el.value
  });
  var a=document.getElementById("metaAssetId")?.value||"";
  metaUndoStack.push({t:Date.now(),assetId:a,snap:snap});
  metaRedoStack=[];
  if(metaUndoStack.length>50)metaUndoStack.shift()
}
function undoMeta(){
  if(!metaUndoStack.length){showToast("Nothing to undo","i");return}
  var u=metaUndoStack.pop();
  var snap={};
  ["metaTitle","metaBreakDur","metaDate","metaType"].forEach(function(id){
    var el=document.getElementById(id);if(el)snap[id]=el.value
  });
  metaRedoStack.push({t:Date.now(),assetId:document.getElementById("metaAssetId")?.value||"",snap:snap});
  Object.keys(u.snap).forEach(function(id){var el=document.getElementById(id);if(el)el.value=u.snap[id]});
  markUnsaved();showToast("Metadata restored","i")
}
function redoMeta(){
  if(!metaRedoStack.length){showToast("Nothing to redo","i");return}
  var u=metaRedoStack.pop();
  var snap={};
  ["metaTitle","metaBreakDur","metaDate","metaType"].forEach(function(id){
    var el=document.getElementById(id);if(el)snap[id]=el.value
  });
  metaUndoStack.push({t:Date.now(),assetId:document.getElementById("metaAssetId")?.value||"",snap:snap});
  Object.keys(u.snap).forEach(function(id){var el=document.getElementById(id);if(el)el.value=u.snap[id]});
  markUnsaved();showToast("Metadata restored","i")
}

// ============ UNIFIED UNDO/REDO ============
function processUndo(){
  var tag=(document.activeElement?.tagName||"").toLowerCase();
  if(["input","textarea","select"].includes(tag)&&document.activeElement?.id.startsWith("meta")){undoMeta();return}
  var lastDel=undoStack.pop();
  if(!lastDel){showToast("Nothing to undo","i");return}
  var gridEl=document.getElementById("segmentGrid");
  if(!gridEl)return;
  var childRows=[...gridEl.children];
  if(lastDel.idx>=childRows.length){
    gridEl.insertAdjacentHTML("beforeend",lastDel.html);
  }else{
    childRows[lastDel.idx].insertAdjacentHTML("beforebegin",lastDel.html);
  }
  redoStack.push(lastDel);
  timelineSegments.splice(lastDel.idx,0,lastDel.nm);
  segmentGlitches[lastDel.nm]=lastDel.glts;
  normalizeSegments();updateSegCount();calcGrid();markUnsaved();
}
function processRedo(){
  var tag=(document.activeElement?.tagName||"").toLowerCase();
  if(["input","textarea","select"].includes(tag)&&document.activeElement?.id.startsWith("meta")){redoMeta();return}
  var u=redoStack.pop();
  if(!u){showToast("Nothing to redo","i");return}
  var tb=document.getElementById("segmentGrid");
  if(!tb)return;
  var row=tb.querySelector('.segment-row[data-seg="'+u.nm+'"]');
  if(!row)return;
  undoStack.push(u);
  row.remove();
  timelineSegments=timelineSegments.filter(function(s){return s!==u.nm});
  if(u.glts)delete segmentGlitches[u.nm];
  normalizeSegments();updateSegCount();calcGrid();markUnsaved();
}

// ============ METADATA CHANGE TRACKING ============
document.addEventListener("change",function(e){
  var id=e.target?.id||"";
  if(id.startsWith("meta")&&id!=="metaExpSeg"&&id!=="metaExpDur")pushMetaUndo()
});

// ============ INIT V13 ============
document.addEventListener("DOMContentLoaded",function(){
  var assetsView=document.getElementById("vp-assets");
  if(assetsView&&!document.getElementById("asset-batch-bar")){
    var bar=document.createElement("div");bar.id="asset-batch-bar";bar.className="batch-bar";bar.style.display="none";
    bar.innerHTML='<span class="ms text-primary">checklist</span><span id="batch-count" class="text-xs font-bold">0 selected</span>'+
      '<button onclick="batchDeleteAssets()" class="tk-btn text-error" style="background:var(--c-ec)">Delete</button>'+
      '<button onclick="clearBatchSelection()" class="tk-btn">Clear</button>';
    assetsView.insertBefore(bar,assetsView.firstChild)
  }
});
