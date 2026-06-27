// ============================================================================
// V13 ADDITIONS: Roles, Audit, Tickets, Undo/Redo, Export, Batch, Breaks
// ============================================================================

// --- ROLE UI ---
function canEdit(){var r=currentUser?.role;return !r||r==="editor"||r==="admin"}
function requireEdit(){if(!canEdit()){showToast("Viewers cannot modify content","w");return false}return true}
function updateRoleUI(){
  var r=currentUser?.role||"viewer";
  var el=document.getElementById("role-badge-header");
  if(el){el.textContent=r.toUpperCase();el.className="role-badge role-"+r+" ml-2";el.style.display="inline-flex"}
  var ed=canEdit();
  var isAdmin = r === "admin";
  // Show admin panel link only for admins
  var adminLink = document.getElementById("admin-panel-link");
  if (adminLink) adminLink.style.display = isAdmin ? "flex" : "none";
  // Disable editor for viewers
  document.querySelectorAll("#editor-main .inp,#editor-main select,#editor-main .btn-primary,#editor-main .btn-secondary,#editor-main [onclick*='addSeg']").forEach(function(e){e.style.pointerEvents=ed?"":"none";e.style.opacity=ed?"":"0.5"});
  document.querySelectorAll("#new-a-btn,[onclick*='openNewAsset']").forEach(function(b){if(b.tagName==="BUTTON"||b.tagName==="A")b.style.display=ed?"":"none"});
  if(!ed&&document.getElementById("editor-empty"))document.getElementById("editor-empty").style.display="flex"
}

// Patch saveToSheets, createNewAsset, deleteAsset to enforce roles
var _origSave=saveToSheets;saveToSheets=function(){if(!requireEdit())return;_origSave()};
var _origCreate=createNewAsset;createNewAsset=async function(){if(!requireEdit())return;await _origCreate()};
var _origDelete=deleteAsset;deleteAsset=function(){if(!requireEdit())return;_origDelete()};
// Hide new-asset button from viewers
document.addEventListener("DOMContentLoaded",function(){if(!canEdit())document.querySelectorAll("[onclick*='openNewAsset']").forEach(function(b){b.style.display="none"})});

// V13 init: runs after original initApp via setTimeout to ensure DOMContentLoaded handler captured new version
document.addEventListener("DOMContentLoaded",function(){
  setTimeout(function(){
    if(currentUser&&currentUser.id){
      sb.from("profiles").select("role,banned").eq("id",currentUser.id).maybeSingle().then(function(r2){
        if(r2.data){
          currentUser.role=r2.data.role||"viewer";updateRoleUI()
          if(r2.data.banned){
            showBannedScreen();
            return;
          }
        }
      });
      loadTickets();
    }
    if(!window._auditPruned){window._auditPruned=true;
      var cut=new Date(Date.now()-7*24*60*60*1000).toISOString();
      sb.from("audit_logs").delete().lt("created_at",cut).then(function(){})
    }
  },0)
});

// Patch loadUserProfiles to include role
var _origLoadProfiles = loadUserProfiles;
loadUserProfiles = function(){
  sb.from("profiles").select("id, name, avatar, email, role").then(function(r){
    if(r.error){_origLoadProfiles.call(this);return}
    userProfiles={};
    (r.data||[]).forEach(function(p){
      if(p.email)userProfiles[p.email.toLowerCase()]={name:p.name||p.email.split('@')[0],avatar:p.avatar||"",email:p.email,role:p.role||"viewer"}
    });
    if(currentUser&&currentUser.email){
      var p2=userProfiles[currentUser.email.toLowerCase()];
      if(p2){currentUser.name=p2.name;currentUser.avatar=p2.avatar;currentUser.role=p2.role||"viewer";updateSidebarProfile();updateRoleUI()}
    }
    refreshCurrentView();
  });
};

// --- AUDIT ---
function logAudit(action,assetId,details){
  if(!currentUser||!currentUser.email)return;
  sb.from("audit_logs").insert({user_email:currentUser.email,user_name:currentUser.name||"",action:action,asset_id:assetId||"",details:details||""}).then(function(){})
}

// Log crucial actions automatically
function logErrorAction(action,assetId,details){
  logAudit("error_"+action,assetId,details);
}
function logSuspiciousAction(details){
  logAudit("suspicious_activity","",details);
}

// --- UNDO / REDO ---
var redoStack=[];
function pushUndo(segKey,rowHtml,idx,ctx){undoStack.push({k:segKey,h:rowHtml,i:idx,c:JSON.parse(JSON.stringify(ctx||{})),t:Date.now()});redoStack=[]}
function undoLastAction(){
  var u=undoStack.pop();if(!u){showToast("Nothing to undo","i");return}
  redoStack.push({k:u.k,h:u.h,i:u.i,c:JSON.parse(JSON.stringify(segmentGlitches[u.k]||{}))});
  var tb=document.getElementById("segmentGrid");if(!tb)return;
  var rows=tb.querySelectorAll(".segment-row");
  if(u.i>=rows.length)tb.insertAdjacentHTML("beforeend",u.h);else rows[u.i].insertAdjacentHTML("beforebegin",u.h);
  updateSegCounts();normalizeSegments();calcGrid();markUnsaved()
}
function redoLastAction(){
  var u=redoStack.pop();if(!u){showToast("Nothing to redo","i");return}
  var tb=document.getElementById("segmentGrid");if(!tb)return;
  var row=tb.querySelector('.segment-row[data-seg="'+u.k+'"]');
  if(!row)return;
  pushUndo(u.k,u.h,u.i,segmentGlitches[u.k]);
  row.remove();
  if(window._currentRowData)window._currentRowData=window._currentRowData.filter(function(r){return r.seg!==u.k});
  updateSegCounts();normalizeSegments();calcGrid();markUnsaved()
}
setInterval(function(){var n=Date.now();while(undoStack.length&&n-undoStack[0].t>120000)undoStack.shift()},60000);

// --- EXPORT ---
function exportAssets(){
  var a=grpAssets();if(!a.length){showToast("No assets","w");return}
  var data=a.map(function(x){return{id:x.id,title:x.title,date:x.date,type:x.type,owner:x.owner,status:x.status,segments:x.rows.length,totalDuration:tcStr(x.rows.reduce(function(s,r){return s+toSec(r[9]||"")},0))}});
  var fmt=document.getElementById("export-fmt-select")?.value||"csv";
  var blob;
  if(fmt==="csv"){
    var h="Asset ID,Title,Date,Type,Owner,Status,Segments,Total Duration\n";
    var r2=data.map(function(d){return '"'+(d.id||"")+'","'+(d.title||"")+'","'+(d.date||"")+'","'+(d.type||"")+'","'+(d.owner||"")+'","'+(d.status||"")+'","'+(d.segments||0)+'","'+(d.totalDuration||"")+'"'}).join("\n");
    blob=new Blob(["\ufeff"+h+r2],{type:"text/csv;charset=utf-8"})
  }else if(fmt==="xml"){
    var x='<?xml version="1.0"?>\n<assets>\n';data.forEach(function(d){x+='  <asset>\n    <id>'+(d.id||"")+'</id>\n    <title>'+(d.title||"")+'</title>\n    <date>'+(d.date||"")+'</date>\n    <type>'+(d.type||"")+'</type>\n    <owner>'+(d.owner||"")+'</owner>\n    <status>'+(d.status||"")+'</status>\n    <segments>'+(d.segments||0)+'</segments>\n    <total_duration>'+(d.totalDuration||"")+'</total_duration>\n  </asset>\n'});x+='</assets>';
    blob=new Blob([x],{type:"application/xml"})
  }else{
    blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"})
  }
  var url=URL.createObjectURL(blob);var a2=document.createElement("a");a2.href=url;a2.download="segmentor_assets."+fmt;a2.click();URL.revokeObjectURL(url);
  showToast("Exported "+data.length+" assets","s");logAudit("export_"+fmt,"","Exported "+data.length+" assets")
}

// --- BATCH ---
var batchSelectedAssets=new Set();
function toggleAssetSelect(aid,ck){if(ck)batchSelectedAssets.add(aid);else batchSelectedAssets.delete(aid);updateBatchBar()}
function toggleSelectAllAssets(ck){
  grpAssets().forEach(function(a){if(ck)batchSelectedAssets.add(a.id);else batchSelectedAssets.delete(a.id)});
  document.querySelectorAll(".asset-select").forEach(function(cb){cb.checked=!!ck});updateBatchBar()
}
function updateBatchBar(){
  var bar=document.getElementById("asset-batch-bar"),cnt=document.getElementById("batch-count");
  if(!bar||!cnt)return;
  bar.style.display=batchSelectedAssets.size>0?"flex":"none";cnt.textContent=batchSelectedAssets.size+" selected"
}
function clearBatchSelection(){batchSelectedAssets.clear();updateBatchBar()}
function batchDeleteAssets(){
  if(!requireEdit())return;
  var del=[],block=[];
  batchSelectedAssets.forEach(function(aid){
    var a=grpAssets().find(function(g){return g.id===aid});
    if(!a||a.status==="Ended"){del.push(aid);return}
    var l=a.lockedBy||"",e=(currentUser.email||"").toLowerCase();
    if(l&&l.toLowerCase()!==e){block.push(aid+" (locked)")}else del.push(aid)
  });
  if(block.length)showToast("Cannot delete: "+block.join(", "),"w",6000);
  if(!del.length){showToast("No deletable assets","w");return}
  requestConfirmation("Delete "+del.length+" assets?","This cannot be undone.",function(){
    var done=0;del.forEach(function(aid){sb.from("segments").delete().eq("asset_id",aid).then(function(){done++;if(done===del.length){clearBatchSelection();loadAllSegments();showToast("Deleted "+del.length+" assets","s");logAudit("batch_delete","","Deleted "+del.length+" assets")}})})
  },"Delete All")
}

// --- BREAKS ---
function calcBreaks(){
  var g=document.getElementById("segmentGrid");if(!g)return;
  var segCount=g.querySelectorAll(".segment-row").length;
  var bc=Math.max(0,segCount-1);
  var bce=document.getElementById("metaBreakCount");if(bce)bce.value=bc;
  var bde=document.getElementById("metaBreakDur"),bs=toSec(bde?bde.value:"");
  var ne=document.getElementById("metaNetDur");if(ne)ne.textContent=tcStr(bs);
  var sbe=document.getElementById("sumBreakDur");if(sbe)sbe.textContent=tcStr(bs)
}
var _origCalcGrid=calcGrid;calcGrid=function(){_origCalcGrid();calcBreaks()};

// ============ BILLING INFO ============
function renderBillingView(){
  var yr=document.getElementById("b-yr")?.value||"All";
  var mo=document.getElementById("b-mo")?.value||"All";
  var dtFrom=document.getElementById("b-date-from")?.value||"";
  var dtTo=document.getElementById("b-date-to")?.value||"";
  var container=document.getElementById("billing-container");if(!container)return;container.innerHTML="";
  var assets=grpAssets(yr,mo);
  if(!assets.length){container.innerHTML='<div class="card ts p-10 text-center text-secondary font-bold text-[16px]">No assets match this filter.</div>';return}
  if(dtFrom||dtTo){
    var f=function(d){if(!d)return true;var dv=new Date(d);if(isNaN(dv))return true;if(dtFrom&&dv<new Date(dtFrom))return false;if(dtTo){var t=new Date(dtTo);t.setDate(t.getDate()+1);if(dv>=t)return false}return true};
    assets=assets.filter(function(a){return a.rows.some(function(r){return f(cleanDateString(r[0]))})})
  }
  if(!assets.length){container.innerHTML='<div class="card ts p-10 text-center text-secondary font-bold text-[16px]">No assets match this filter.</div>';return}
  
  // Group by year-month
  var groups={};
  assets.forEach(function(a){
    var d=a.date?new Date(a.date):null;
    var key=d&&!isNaN(d)?d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0"):"Unknown";
    if(!groups[key])groups[key]={label:key,name:d&&!isNaN(d)?d.toLocaleString("default",{month:"long",year:"numeric"}):"Unknown",assets:[],actual:0,expected:0,overtime:0};
    groups[key].assets.push(a)
  });
  var sortedKeys=Object.keys(groups).sort().reverse();
  
  var grandActual=0,grandExpected=0,grandOvertime=0;
  
  sortedKeys.forEach(function(key){
    var g=groups[key];
    // Calc group totals per asset
    g.assets.forEach(function(a){
      var actualSecs=a.rows.reduce(function(s,r){return s+toSec(r[9]||"")},0);
      var expSecs=toSec("00:30:00");
      var diff=actualSecs-expSecs;
      var ot=diff>0?diff:0;
      g.actual+=actualSecs;g.expected+=expSecs;g.overtime+=ot;
      grandActual+=actualSecs;grandExpected+=expSecs;grandOvertime+=ot
    });
    
    var isOpen=localStorage.getItem("bill_group_"+key)!=="closed";
    
    var section=document.createElement("div");
    section.className="card ts overflow-hidden";
    
    // Header
    var hdr=document.createElement("div");
    hdr.className="flex items-center justify-between px-5 py-3 cursor-pointer select-none hover:bg-sclo smooth border-b border-ov/30";
    hdr.setAttribute("data-bill-group",key);
    hdr.onclick=function(){toggleBillingGroup(this.getAttribute("data-bill-group"))};
    hdr.innerHTML='<div class="flex items-center gap-3"><span class="ms text-[20px] text-primary smooth transition-transform'+(isOpen?'':' -rotate-90')+'">expand_more</span><span class="font-bold text-[15px] text-on-surface">'+g.name+'</span><span class="text-xs text-secondary font-mono">'+g.assets.length+' asset'+(g.assets.length!==1?"s":"")+'</span></div><div class="flex items-center gap-6 text-sm font-mono"><span class="text-secondary">Actual: <strong class="text-on-surface">'+tcStr(g.actual)+'</strong></span><span class="text-secondary">Overtime: <strong class="text-error">+'+tcStr(g.overtime)+'</strong></span></div>';
    section.appendChild(hdr);
    
    // Build table HTML as single string
    var tableHtml='<table class="w-full text-left" style="min-width:700px"><thead class="border-b border-ov/50 text-[11px] text-secondary uppercase tracking-wider font-bold font-mono bg-sclo"><tr><th class="py-3 px-6">Asset ID</th><th class="py-3 px-6">Date</th><th class="py-3 px-6 text-right">Actual Duration</th><th class="py-3 px-6 text-right">Expected Duration</th><th class="py-3 px-6 text-right">Overtime</th></tr></thead><tbody class="divide-y divide-ov/30 text-sm bg-scl">';
    
    g.assets.forEach(function(a){
      var actualSecs=a.rows.reduce(function(s,r){return s+toSec(r[9]||"")},0);
      var expSecs=toSec("00:30:00");
      var diff=actualSecs-expSecs;
      var isOT=diff>0;
      tableHtml+='<tr class="hover:bg-sclo smooth"><td class="py-3 px-6"><span class="font-bold text-primary font-mono text-[15px]">'+escHtml(a.id)+'</span><div class="text-[13px] font-medium truncate max-w-[250px] mt-0.5 text-secondary">'+escHtml(a.title||"")+'</div></td><td class="py-3 px-6 text-[13px] text-secondary font-mono">'+fmtD(a.date)+'</td><td class="py-3 px-6 text-right font-mono text-sm">'+tcStr(actualSecs)+'</td><td class="py-3 px-6 text-right font-mono text-sm text-secondary">'+tcStr(expSecs)+'</td><td class="py-3 px-6 text-right font-mono text-sm '+(isOT?"text-error font-bold":"text-secondary")+'">'+(isOT?"+"+tcStr(diff):"—")+'</td></tr>'
    });
    
    tableHtml+='<tr class="bg-sclo font-bold border-t-2 border-ov/50"><td class="py-3 px-6" colspan="2">Group Total</td><td class="py-3 px-6 text-right font-mono">'+tcStr(g.actual)+'</td><td class="py-3 px-6 text-right font-mono text-secondary">'+tcStr(g.expected)+'</td><td class="py-3 px-6 text-right font-mono text-error">+'+tcStr(g.overtime)+'</td></tr>';
    tableHtml+='</tbody></table>';
    
    var bodyWrap=document.createElement("div");
    bodyWrap.className="smooth"+(isOpen?"":" hidden");
    bodyWrap.id="bill-body-"+key;
    bodyWrap.innerHTML=tableHtml;
    section.appendChild(bodyWrap);
    container.appendChild(section)
  });
  
  // Grand total
  var gt=document.createElement("div");
  gt.className="card ts bg-sclo mt-4";
  gt.innerHTML='<div class="flex items-center justify-between px-6 py-4"><span class="font-bold text-[16px] text-on-surface">Grand Total</span><div class="flex items-center gap-8 text-sm font-mono"><span class="text-secondary">Actual: <strong class="text-on-surface">'+tcStr(grandActual)+'</strong></span><span class="text-secondary">Expected: <strong class="text-on-surface">'+tcStr(grandExpected)+'</strong></span><span class="text-secondary">Overtime: <strong class="text-error">+'+tcStr(grandOvertime)+'</strong></span></div></div>';
  container.appendChild(gt)
}

function toggleBillingGroup(key){
  var body=document.getElementById("bill-body-"+key);
  if(!body)return;
  var parent=body.parentElement;
  var hdr=parent?.querySelector('[data-bill-group="'+key+'"]');
  var closed=body.classList.contains("hidden");
  if(closed){
    body.classList.remove("hidden");
    localStorage.removeItem("bill_group_"+key);
  }else{
    body.classList.add("hidden");
    localStorage.setItem("bill_group_"+key,"closed");
  }
  if(hdr){
    var icon=hdr.querySelector(".ms");
    if(icon)icon.classList.toggle("-rotate-90")
  }
}
function exportBilling(){
  var assets=grpAssets();if(!assets.length){showToast("No assets","w");return}
  var fmt=document.getElementById("export-billing-fmt")?.value||"csv";
  var data=assets.map(function(a){
    var actualSecs=a.rows.reduce(function(s,r){return s+toSec(r[9]||"")},0);
    return{id:a.id,title:a.title,date:a.date,actualDuration:tcStr(actualSecs)}
  });
  var totalSecs=assets.reduce(function(s,a){return s+a.rows.reduce(function(s2,r){return s2+toSec(r[9]||"")},0)},0);
  var blob;
  if(fmt==="csv"){
    var h="Asset ID,Title,Date,Actual Duration\n";
    var r2=data.map(function(d){return '"'+(d.id||"")+'","'+(d.title||"")+'","'+(d.date||"")+'","'+(d.actualDuration||"")+'"'}).join("\n");
    blob=new Blob(["\ufeff"+h+r2+"\nTotal,,,"+tcStr(totalSecs)],{type:"text/csv;charset=utf-8"})
  }else if(fmt==="xml"){
    var x='<?xml version="1.0"?>\n<billing>\n';data.forEach(function(d){x+='  <asset>\n    <id>'+(d.id||"")+'</id>\n    <title>'+(d.title||"")+'</title>\n    <date>'+(d.date||"")+'</date>\n    <actual_duration>'+(d.actualDuration||"")+'</actual_duration>\n  </asset>\n'});x+='  <total_duration>'+tcStr(totalSecs)+'</total_duration>\n</billing>';
    blob=new Blob([x],{type:"application/xml"})
  }else if(fmt==="xlsx"){
    var x='<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Billing"><Table>';
    x+='<Row><Cell><Data ss:Type="String">Asset ID</Data></Cell><Cell><Data ss:Type="String">Title</Data></Cell><Cell><Data ss:Type="String">Date</Data></Cell><Cell><Data ss:Type="String">Actual Duration</Data></Cell></Row>';
    data.forEach(function(d){x+='<Row><Cell><Data ss:Type="String">'+(d.id||"")+'</Data></Cell><Cell><Data ss:Type="String">'+(d.title||"")+'</Data></Cell><Cell><Data ss:Type="String">'+(d.date||"")+'</Data></Cell><Cell><Data ss:Type="String">'+(d.actualDuration||"")+'</Data></Cell></Row>'});
    x+='<Row><Cell><Data ss:Type="String">Total</Data></Cell><Cell/><Cell/><Cell><Data ss:Type="String">'+tcStr(totalSecs)+'</Data></Cell></Row>';
    x+='</Table></Worksheet></Workbook>';
    blob=new Blob([x],{type:"application/vnd.ms-excel"})
  }else{
    var jsonData = data.concat({id:"Total",title:"",date:"",actualDuration:tcStr(totalSecs)});
    blob=new Blob([JSON.stringify(jsonData,null,2)],{type:"application/json"})
  }
  var url=URL.createObjectURL(blob);var a2=document.createElement("a");a2.href=url;a2.download="billing_info."+fmt;a2.click();URL.revokeObjectURL(url);
  showToast("Exported "+data.length+" assets","s");logAudit("export_billing_"+fmt,"","Exported "+data.length+" billing entries")
}

// --- BANNED USER SCREEN ---
function showBannedScreen() {
  var existing = document.getElementById("banned-overlay");
  if (existing) return;
  var overlay = document.createElement("div");
  overlay.id = "banned-overlay";
  overlay.style.cssText = "position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)";
  var card = document.createElement("div");
  card.style.cssText = "background:var(--c-card);border:1px solid var(--c-ov);border-radius:20px;padding:40px;max-width:440px;width:90%;text-align:center;box-shadow:0 24px 80px rgba(0,0,0,.4)";
  card.innerHTML = '<span class="ms" style="font-size:64px;color:var(--c-error);display:block;margin-bottom:16px">block</span><h2 style="font-size:22px;font-weight:800;margin:0 0 8px;color:var(--c-on-surface)">Account Blocked</h2><p style="font-size:14px;color:var(--c-secondary);margin:0 0 20px;line-height:1.6">You are currently on hold.<br>Contact an administrator to resolve this issue.</p><div id="banned-admin-emails" style="margin-bottom:16px;text-align:left;font-size:13px;color:var(--c-secondary)"><em>Loading admin contacts...</em></div><button onclick="contactAdmin()" class="btn-primary" style="padding:12px 28px;border-radius:12px;font-weight:700;font-size:15px;display:inline-flex;align-items:center;gap:8px"><span class="ms" style="font-size:20px">mail</span> Contact Admin</button>';
  overlay.appendChild(card);
  document.body.appendChild(overlay);
  // Fetch admin emails
  sb.from("profiles").select("name,email").eq("role","admin").then(function(r){
    var el = document.getElementById("banned-admin-emails");
    if (r.data && r.data.length) {
      var list = r.data.map(function(a){ return '<div style="padding:4px 0;display:flex;align-items:center;gap:8px"><span class="ms" style="font-size:16px;color:var(--c-primary)">person</span><span><strong>' + (a.name || a.email) + '</strong> — ' + a.email + '</span></div>' }).join('');
      el.innerHTML = '<div style="font-size:12px;font-weight:600;color:var(--c-secondary);margin-bottom:6px">ADMINISTRATORS</div>' + list;
    } else {
      el.innerHTML = '<div style="font-size:12px;color:var(--c-secondary)">No admin contacts available. Please try again later.</div>';
    }
  });
}
function contactAdmin() {
  sb.from("profiles").select("email").eq("role","admin").then(function(r){
    if (r.data && r.data.length) {
      var emails = r.data.map(function(a){ return a.email }).join(",");
      var sub = encodeURIComponent("Account Blocked - Access Required");
      var body = encodeURIComponent("Hello,\n\nMy account has been blocked and I need assistance to regain access.\n\nMy email: " + (currentUser?.email || "unknown") + "\n\nPlease help resolve this issue.\n\nThank you.");
      window.location.href = "mailto:" + emails + "?subject=" + sub + "&body=" + body;
    } else {
      showToast("No admin contact available","w");
    }
  });
}
