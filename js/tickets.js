// ============ TICKETS ============
var ticketsCache=[],ticketIdCounter=1000;
function generateTicketId(){ticketIdCounter++;return "TCK-"+ticketIdCounter}

function loadTickets(){
  ticketsCache=ticketsCache||[];
  if(!sb){showToast("Supabase not connected","e");renderTicketsView();return}
  return sb.from("tickets").select("*").order("created_at",{ascending:false}).then(function(r){
    if(r.error){console.warn("Tickets load error:",r.error);showToast("Tickets DB error: "+r.error.message,"w");renderTicketsView();return}
    ticketsCache=r.data||[];
    var maxNum=0;
    (r.data||[]).forEach(function(t){
      var m=(t.ticket_id||"").match(/TCK-(\d+)/);
      if(m){var n=parseInt(m[1],10);if(n>maxNum)maxNum=n}
    });
    if(maxNum>ticketIdCounter)ticketIdCounter=maxNum;
    sb.from("ticket_comments").select("*").order("created_at",{ascending:true}).then(function(cr){
      if(!cr.error&&cr.data){
        ticketsCache.forEach(function(t){t._comments=cr.data.filter(function(c){return c.ticket_id===t.id})})
      }
      renderTicketsView();
      if(currentFullscreenAssetId)loadFsComments(currentFullscreenAssetId)
    }).catch(function(e){console.warn("ticket_comments query error:",e);renderTicketsView()})
  }).catch(function(e){console.warn("Tickets load error:",e);showToast("Failed to load tickets: "+e.message,"e");renderTicketsView()})
}

function renderTicketsView(){
  try {
    if(!Array.isArray(ticketsCache))ticketsCache=[];
    var q=(document.getElementById("vp-ticket-search")?.value||"").toLowerCase();
    var f=document.getElementById("vp-ticket-filter")?.value||"all";
    var ue=(currentUser.email||"").toLowerCase();
    var filtered=ticketsCache.filter(function(t){
      if(f!=="all"&&t.status!==f)return false;
      if(q&&!(t.ticket_id||"").toLowerCase().includes(q)&&!(t.subject||"").toLowerCase().includes(q))return false;
      if(t.visibility==="personal"){
        var te=(t.target_email||"").toLowerCase();
        var ce=(t.created_by_email||"").toLowerCase();
        if(ce!==ue&&te!==ue)return false
      }
      return true
    });
    var tb=document.getElementById("ttbody");if(!tb)return;tb.innerHTML="";
    var empty=document.getElementById("tickets-empty");
    if(!filtered.length){tb.innerHTML="";if(empty)empty.style.display="block";return}
    if(empty)empty.style.display="none";
    filtered.forEach(function(t,i){
      var sc=t.status==="open"?"text-amber-500 font-bold":t.status==="resolved"?"text-green-500":"text-secondary";
      var vi=t.visibility==="personal"?"lock":"public";
      var tr='<tr class="hover:bg-sclo/50 smooth cursor-pointer" onclick="openTicketDetail(\''+t.id+'\')">';
      tr+='<td class="py-3 px-4"><span class="font-mono text-xs font-bold text-primary">#'+escHtml(t.ticket_id||t.id)+'</span></td>';
      tr+='<td class="py-3 px-4"><span class="text-sm truncate max-w-[250px]">'+escHtml(t.subject||"")+'</span></td>';
      tr+='<td class="py-3 px-4"><span class="ms text-[14px] text-secondary">'+vi+'</span></td>';
      tr+='<td class="py-3 px-4"><span class="text-xs text-secondary">'+escHtml(t.created_by_name||t.created_by_email||"")+'</span></td>';
      tr+='<td class="py-3 px-4"><span class="px-2 py-0.5 rounded-md text-[10px] font-bold font-mono '+sc+'">'+(t.status||"open").toUpperCase()+'</span></td>';
      tr+='<td class="py-3 px-4 text-right text-xs text-secondary font-mono">'+(t.created_at?new Date(t.created_at).toLocaleDateString():"")+'</td></tr>';
      tb.innerHTML+=tr
    });
    // Ensure empty state is hidden if we rendered rows
    if(empty)empty.style.display="none";
  } catch(e) {
    console.error("renderTicketsView error:", e);
    var empty=document.getElementById("tickets-empty");
    if(empty)empty.style.display="block";
  }
}

function showAssetSuggestions(q){
  var list=document.getElementById("nt-asset-suggestions");
  var sel=document.getElementById("nt-asset-selected");
  if(!list)return;
  if(!q||q.length<2){list.classList.add("hidden");list.innerHTML="";return}
  var assets=grpAssets().filter(function(a){return(a.id||"").toLowerCase().includes(q.toLowerCase())||(a.title||"").toLowerCase().includes(q.toLowerCase())}).slice(0,8);
  if(!assets.length){list.classList.add("hidden");list.innerHTML="";return}
  list.innerHTML="";list.classList.remove("hidden");
  assets.forEach(function(a){
    var d=document.createElement("div");d.className="p-2 text-xs cursor-pointer hover:bg-sclo border-b border-ov/10";
    d.textContent=a.id+" — "+(a.title||"");
    d.onclick=function(){document.getElementById("nt-asset-search").value=a.id;document.getElementById("nt-asset-id").value=a.id;if(sel){sel.textContent="Asset: "+a.id;sel.classList.remove("hidden")}list.classList.add("hidden")};
    list.appendChild(d)
  })
}
function previewTicketImages(input){
  var container=document.getElementById("nt-image-previews");
  if(!container)return;
  container.innerHTML="";
  if(!input||!input.files||!input.files.length)return;
  Array.from(input.files).forEach(function(f){
    if(!f.type.match('image.*'))return;
    var reader=new FileReader();
    reader.onload=function(e){
      var wrap=document.createElement("div");wrap.className="relative w-16 h-16 rounded-lg overflow-hidden border border-ov/30";
      wrap.innerHTML='<img src="'+e.target.result+'" class="w-full h-full object-cover"><button type="button" onclick="this.parentElement.remove()" class="absolute top-0 right-0 w-4 h-4 bg-black/60 text-white text-[10px] flex items-center justify-center rounded-bl-lg">✕</button>';
      container.appendChild(wrap)
    };
    reader.readAsDataURL(f)
  })
}
function showToSuggestions(q){
  var list=document.getElementById("nt-to-suggestions");
  var sel=document.getElementById("nt-to-selected");
  if(!list)return;
  var lq=(q||"").toLowerCase();
  if(lq==="everyone"||lq==="all"){
    document.getElementById("nt-to-email").value="EVERYONE";
    if(sel){sel.textContent="TO: Everyone";sel.classList.remove("hidden")}
    list.classList.add("hidden");return
  }
  if(!q||q.length<2){list.classList.add("hidden");list.innerHTML="";return}
  var matches=[];
  for(var ek in userProfiles){
    var p=userProfiles[ek];
    var nm=(p.name||"").toLowerCase();
    var em=(p.email||"").toLowerCase();
    if(nm.includes(lq)||em.includes(lq)){matches.push({email:p.email,name:p.name||p.email.split('@')[0]})}
  }
  if(!matches.length){list.classList.add("hidden");list.innerHTML="";return}
  list.innerHTML="";list.classList.remove("hidden");
  matches.slice(0,10).forEach(function(u){
    var d=document.createElement("div");d.className="p-2 text-xs cursor-pointer hover:bg-sclo border-b border-ov/10";
    d.textContent=u.name+" — "+u.email;
    d.onclick=function(){
      document.getElementById("nt-to-email").value=u.email;
      document.getElementById("nt-to-search").value=u.name;
      if(sel){sel.textContent="TO: "+u.name;sel.classList.remove("hidden")}
      list.classList.add("hidden")
    };
    list.appendChild(d)
  })
}
function openNewTicketModal(){
  document.getElementById("nt-subject").value="";
  document.getElementById("nt-body").value="";
  document.getElementById("nt-visibility").value="personal";
  document.getElementById("nt-asset-search").value="";
  document.getElementById("nt-asset-id").value="";
  document.getElementById("nt-asset-selected").classList.add("hidden");
  document.getElementById("nt-asset-suggestions").classList.add("hidden");
  document.getElementById("nt-to-search").value="";
  document.getElementById("nt-to-email").value="";
  document.getElementById("nt-to-selected").classList.add("hidden");
  document.getElementById("nt-to-suggestions").classList.add("hidden");
  document.getElementById("nt-images").value="";
  document.getElementById("nt-image-previews").innerHTML="";
  openModal("m-new-ticket");
  setTimeout(function(){document.getElementById("nt-subject")?.focus()},100)
}

async function submitNewTicket(){
  var sub=document.getElementById("nt-subject")?.value.trim();
  var body=document.getElementById("nt-body")?.value.trim();
  var vis=document.getElementById("nt-visibility")?.value||"personal";
  if(!sub){showToast("Subject required","w");return}
  var tid=generateTicketId();
  var targetEmail=document.getElementById("nt-to-email")?.value||"";
  var isEveryone=targetEmail==="EVERYONE";
  if(isEveryone||!targetEmail)targetEmail="";
  // Fallback: extract first @mention if no TO selected
  if(!targetEmail&&vis==="personal"&&body){
    var mm=body.match(/@(\w[\w\s]*\w|\w)/);
    if(mm){
      var n=mm[1].trim().toLowerCase();
      for(var ek in userProfiles){
        if(userProfiles[ek].name&&userProfiles[ek].name.toLowerCase()===n){targetEmail=userProfiles[ek].email;break}
      }
    }
  }
  var assetId=document.getElementById("nt-asset-id")?.value||"";
  // Handle image uploads
  var images=[];
  var fileInput=document.getElementById("nt-images");
  if(fileInput&&fileInput.files&&fileInput.files.length){
    for(var fi=0;fi<fileInput.files.length;fi++){
      var f=fileInput.files[fi];
      if(!f.type.match('image.*'))continue;
      var dataUrl=await readFileAsDataUrl(f);
      images.push({name:f.name,data:dataUrl,type:f.type})
    }
  }
  var actualVis=isEveryone?"everyone":vis;
  var t={ticket_id:tid,subject:sub,body:body||"",asset_id:assetId,status:"open",created_by_email:currentUser.email||"",created_by_name:currentUser.name||"",visibility:actualVis,target_email:targetEmail};
  if(images.length)t.images=images;
  var {data,error}=await sb.from("tickets").insert(t).select();
  if(error){console.error("Ticket insert error:",error);showToast("Create ticket error: "+error.message,"e");return}
  // Immediately add to local cache so creator sees it right away
  if(data&&data.length){ticketsCache.unshift(data[0]);renderTicketsView()}
  // Also do a full refresh to sync comments and ensure consistency
  loadTickets();
  closeModal("m-new-ticket");
  showToast("Ticket #"+tid+" created","s");
  logAudit("create_ticket","","Ticket #"+tid+": "+sub);
  // Collect notification targets
  var notifTargets={};
  var curEmail=currentUser.email||"";
  // @mentions in body always get notified (except self)
  var atMentions=body?body.match(/@(\w[\w\s]*\w|\w)/g):null;
  if(atMentions){
    atMentions.forEach(function(m){
      var n=m.substring(1).trim().toLowerCase();
      for(var ek in userProfiles){
        if(userProfiles[ek].name&&userProfiles[ek].name.toLowerCase()===n&&userProfiles[ek].email!==curEmail)notifTargets[userProfiles[ek].email]=true;
      }
    });
  }
  // Personal: only the selected recipient (no self-notify)
  if(actualVis==="personal"){
    if(targetEmail)notifTargets[targetEmail]=true;
  }else{
    // Everyone: all users
    for(var ek2 in userProfiles){
      var e2=userProfiles[ek2].email;
      if(e2)notifTargets[e2]=true;
    }
    if(curEmail)notifTargets[curEmail]=true;
  }
  Object.keys(notifTargets).forEach(function(em){
    sb.from("notifications").insert({target_email:em,from_user:currentUser.name||currentUser.email||"",message:"Ticket #"+tid+": "+sub,notification_type:"ticket",ticket_id:tid,read:false}).then(function(){})
  });
}
function readFileAsDataUrl(file){
  return new Promise(function(resolve){
    var reader=new FileReader();
    reader.onload=function(e){resolve(e.target.result)};
    reader.readAsDataURL(file)
  })
}

function openTicketDetail(ticketId){
  var ticket=ticketsCache.find(function(t){return String(t.id)===String(ticketId)});
  if(!ticket){showToast("Ticket not found","w");return}
  var ce=document.getElementById("ticket-detail-content");
  if(!ce)return;
  var html='<div class="p-2">';
  html+='<div class="flex items-center justify-between mb-4"><div><h2 class="font-bold text-lg">#'+escHtml(ticket.ticket_id||ticket.id)+' '+escHtml(ticket.subject)+'</h2>';
  html+='<p class="text-xs text-secondary">by '+escHtml(ticket.created_by_name||ticket.created_by_email||"")+' on '+(ticket.created_at?new Date(ticket.created_at).toLocaleString():"")+'</p></div>';
  html+='<div class="flex gap-2">';
  if(ticket.status==="open"){
    html+='<button onclick="resolveTicket(\''+ticket.id+'\')" class="px-3 py-1.5 bg-green-500/10 text-green-500 rounded-lg text-[11px] font-bold font-mono">Resolve</button>';
    html+='<button onclick="raiseTicketNotif(\''+ticket.id+'\')" class="px-3 py-1.5 bg-amber-500/10 text-amber-600 rounded-lg text-[11px] font-bold font-mono">Raise</button>'
  }
  html+='<button onclick="closeTicket(\''+ticket.id+'\')" class="px-3 py-1.5 bg-error/10 text-error rounded-lg text-[11px] font-bold font-mono">Close</button>';
  if(ticket.status==="closed")html+='<button onclick="deleteTicket(\''+ticket.id+'\')" class="px-3 py-1.5 bg-error/20 text-error rounded-lg text-[11px] font-bold font-mono">Delete</button>'
  html+='</div></div>';
  html+='<p class="text-sm leading-relaxed mb-6 p-4 rounded-lg bg-sclo">'+(ticket.body||"No description")+'</p>';
  // Render images
  var imgs=ticket.images;
  if(imgs&&Array.isArray(imgs)&&imgs.length){
    html+='<div class="mb-6"><div class="font-bold text-sm mb-2">Attachments</div><div class="flex flex-wrap gap-3">';
    imgs.forEach(function(img){
      html+='<a href="'+(img.data||"")+'" target="_blank" class="block w-24 h-24 rounded-xl overflow-hidden border border-ov/30 bg-sclo hover:border-primary"><img src="'+(img.data||"")+'" alt="'+escHtml(img.name||"image")+'" class="w-full h-full object-cover"></a>'
    });
    html+='</div></div>'
  }
  html+='<div class="mb-6"><div class="font-bold text-sm mb-2">Status Timeline</div><div class="flex flex-col gap-2">';
  var tl=[{label:"Created",date:ticket.created_at,icon:"add_circle",color:"text-primary"}];
  if(ticket.resolved_at)tl.push({label:"Resolved",date:ticket.resolved_at,icon:"check_circle",color:"text-green-500"});
  if(ticket.closed_at)tl.push({label:"Closed",date:ticket.closed_at,icon:"cancel",color:"text-error"});
  tl.forEach(function(t,ti){
    html+='<div class="flex items-center gap-3"><span class="ms text-[16px] '+t.color+'">'+t.icon+'</span><div><div class="text-xs font-bold">'+t.label+'</div><div class="text-[10px] text-secondary">'+(t.date?new Date(t.date).toLocaleString():"")+'</div></div></div>'
  });
  html+='</div></div>';
  html+='<div class="mb-4"><div class="font-bold text-xs mb-1 text-secondary">Seen by</div><div id="ticket-readers" class="flex flex-wrap gap-1"></div></div>';
  html+='<div class="font-bold text-sm mb-3">Comments</div><div class="cmts-section">';
  var cmts=ticket._comments||[];
  if(cmts.length){
    cmts.forEach(function(c){
      html+='<div class="mb-3 p-3 rounded-lg bg-sclo">';
      html+='<div class="flex justify-between text-xs text-secondary mb-1"><span>'+escHtml(c.user_name||c.user_email||"")+'</span><span>'+(c.created_at?new Date(c.created_at).toLocaleString():"")+'</span></div>';
      html+='<p class="text-sm">'+escHtml(c.message||"")+'</p></div>'
    })
  }else{
    html+='<p class="text-xs text-secondary mb-4">No comments yet.</p>'
  }
  html+='</div>';
  if(ticket.status==="open"){
    html+='<div class="mt-4"><textarea id="ticket-cmt-input" class="gi w-full resize-none text-sm" rows="3" placeholder="Write a comment... Use @name to mention"></textarea>';
    html+='<div class="flex justify-between items-center mt-2"><span class="text-[10px] text-secondary">@mentions notify users</span>';
    html+='<button onclick="addTicketComment(\''+ticket.id+'\')" class="btn-primary text-xs px-4 py-1.5">Comment</button></div></div>'
  }
  html+='</div>';
  ce.innerHTML=html;
  window._openTicketDetailId=String(ticket.id);
  openModal("m-ticket-detail");
  // Track view and show readers
  var td = document.getElementById("ticket-readers");
  if (td) {
    sb.from("ticket_views").insert({ticket_id: Number(ticket.id), user_email: currentUser.email||""}).then(function(){});
    // Mark all comments as viewed by this user
    if (ticket._comments) {
      ticket._comments.forEach(function(c){
        sb.from("comment_views").insert({comment_id: Number(c.id), user_email: currentUser.email||""}).then(function(){});
      });
    }
    sb.from("ticket_views").select("user_email").eq("ticket_id", Number(ticket.id)).then(function(vr){
      if (!vr.error && vr.data) {
        td.innerHTML = "";
        vr.data.forEach(function(v){
          var p = userProfiles[v.user_email];
          td.innerHTML += getUserAvatarHtml(v.user_email, p ? p.name : v.user_email, 24);
        });
        if (!vr.data.length) td.innerHTML = '<span class="text-[10px] text-secondary">No views yet</span>';
      }
    });
  }
  setTimeout(function(){var ci=document.getElementById("ticket-cmt-input");if(ci)setupMentionAutocomplete(ci)},50)
}

async function addTicketComment(ticketId){
  var input=document.getElementById("ticket-cmt-input");
  if(!input)return;
  var body=input.value.trim();
  if(!body){showToast("Write a comment","w");return}
  var c={ticket_id:Number(ticketId),message:body,user_email:currentUser.email||"",user_name:currentUser.name||""};
  var {data,error}=await sb.from("ticket_comments").insert(c).select();
  if(error){showToast("Comment error: "+error.message,"e");return}
  input.value="";
  showToast("Comment added","s");
  logAudit("ticket_comment",ticketId,"Added comment");
  // Push to local cache immediately so creator sees it right away
  var ticket=ticketsCache.find(function(x){return String(x.id)===String(ticketId)});
  if(data&&data.length&&ticket){
    if(!ticket._comments)ticket._comments=[];
    ticket._comments.push(data[0]);
    // Update the modal comment section without re-opening
    var ce=document.getElementById("ticket-detail-content");
    if(ce){
      var cmtSection=ce.querySelector(".cmts-section");
      if(cmtSection){
        var cmtHtml='<div class="mb-3 p-3 rounded-lg bg-sclo">';
        cmtHtml+='<div class="flex justify-between text-xs text-secondary mb-1"><span>'+escHtml(data[0].user_name||data[0].user_email||"")+'</span><span>'+(data[0].created_at?new Date(data[0].created_at).toLocaleString():"")+'</span></div>';
        cmtHtml+='<p class="text-sm">'+escHtml(data[0].message||"")+'</p></div>';
        cmtSection.insertAdjacentHTML("beforeend",cmtHtml);
      }
    }
  }
  // Notify @mentioned users + ticket creator + target_email for personal tickets
  var mm=body.match(/@(\w[\w\s]*\w|\w)/g);
  var toNotify={};
  var curEmail=currentUser.email||"";
  if(mm){
    mm.forEach(function(m){
      var n=m.substring(1).trim().toLowerCase();
      for(var ek in userProfiles){
        if(userProfiles[ek].name&&userProfiles[ek].name.toLowerCase()===n&&userProfiles[ek].email!==curEmail){
          toNotify[userProfiles[ek].email]=true;
        }
      }
    });
  }
  if(ticket){
    // Notify ticket creator if commenter is not the creator
    if(ticket.created_by_email!==curEmail)toNotify[ticket.created_by_email]=true;
    // Notify target_email for personal tickets (but not the commenter)
    if(ticket.visibility==="personal"&&ticket.target_email&&ticket.target_email!==curEmail)toNotify[ticket.target_email]=true;
  }
  Object.keys(toNotify).forEach(function(em){
    sb.from("notifications").insert({target_email:em,from_user:currentUser.name||curEmail,message:currentUser.name+" commented on ticket #"+ticketId,notification_type:"ticket_comment",ticket_id:Number(ticketId),read:false}).then(function(){})
  });
  // Background sync for cross-user consistency
  loadTickets();
}

async function resolveTicket(ticketId){
  var {error}=await sb.from("tickets").update({status:"resolved",resolved_at:new Date().toISOString(),resolved_by:currentUser.email||""}).eq("id",ticketId);
  if(error){showToast("Error: "+error.message,"e");return}
  window._openTicketDetailId=null;loadTickets();closeModal("m-ticket-detail");showToast("Ticket resolved","s");logAudit("resolve_ticket",ticketId,"")
}

async function closeTicket(ticketId){
  requestConfirmation("Close ticket?","Mark as closed.",function(){
    sb.from("tickets").update({status:"closed",closed_at:new Date().toISOString(),closed_by:currentUser.email||""}).eq("id",ticketId).then(function(r){
      if(r.error){showToast("Error: "+r.error.message,"e");return}
      window._openTicketDetailId=null;loadTickets();closeModal("m-ticket-detail");showToast("Ticket closed","s");logAudit("close_ticket",ticketId,"")
    })
  },"Close")
}
async function deleteTicket(ticketId){
  requestConfirmation("Delete ticket permanently?","This will also delete all comments. Cannot be undone.",async function(){
    try{
      var tid=Number(ticketId);
      var {error}=await sb.from("tickets").delete().eq("id",tid);
      if(error){showToast("Delete failed: "+error.message,"e");return}
      // FK cascade handles ticket_comments — no manual delete needed
      window._openTicketDetailId=null;ticketsCache=ticketsCache.filter(function(t){return Number(t.id)!==tid});
      renderTicketsView();loadTickets();closeModal("m-ticket-detail");showToast("Ticket deleted","s");logAudit("delete_ticket",ticketId,"")
    }catch(e){showToast("Delete error: "+e.message,"e")}
  },"Delete Forever")
}
async function raiseTicketNotif(ticketId){
  var ticket=ticketsCache.find(function(t){return String(t.id)===String(ticketId)});
  if(!ticket){showToast("Ticket not found","w");return}
  var targets=[];
  if(ticket.target_email){
    targets.push(ticket.target_email)
  }else{
    targets.push(ticket.created_by_email);
    for(var ek in userProfiles){
      if(userProfiles[ek].email!==(currentUser.email||""))targets.push(userProfiles[ek].email)
    }
  }
  targets.forEach(function(em){
    sb.from("notifications").insert({target_email:em,message:"[Raised] Ticket #"+(ticket.ticket_id||ticket.id)+": "+ticket.subject,notification_type:"ticket",ticket_id:ticket.ticket_id||ticket.id,read:false}).then(function(){})
  });
  showToast("Notification raised to "+(ticket.target_email?"recipient":"all users"),"s");
  logAudit("raise_ticket",ticketId,"Raised ticket notification")
}

// ============ NOTIFICATION READ RECEIPTS ============
function renderNotifList(notifs,readsByNotif){
  var list=document.getElementById("notif-list");if(!list)return;list.innerHTML="";
  var unread=0;
  notifs.forEach(function(n){
    if(!n.read)unread++;
    var icon="notifications";
    if(n.notification_type==="ticket")icon="confirmation_number";
    else if(n.notification_type==="mention")icon="alternate_email";
    else if(n.notification_type==="handover_request")icon="forward";
    else if(n.notification_type==="handover_accepted"||n.notification_type==="handover_given")icon="handshake";
    var reads=readsByNotif[n.id]||[];
    var readerNames=reads.map(function(rr){var p=userProfiles[rr.user_email];return p?p.name||rr.user_email:rr.user_email}).join(", ");
    var eyeHtml="";
    if(n.ticket_id&&n.notification_type==="ticket"){
      var tooltip=n.read?"Read by "+(readerNames||"you"):"Mark as read";
      eyeHtml='<span class="relative group" style="cursor:help"><span class="ms text-[12px] text-secondary">visibility</span><span class="absolute bottom-full right-0 mb-1 hidden group-hover:block bg-black text-white text-[9px] rounded px-2 py-1 whitespace-nowrap z-[9999]">'+escHtml(tooltip)+'</span></span>'
    }
    var html='<div class="p-3 rounded-lg mb-2 '+(n.read?"":"font-bold")+'" style="background:var(--c-sclo);cursor:pointer" onclick="markNotifRead(\''+n.id+'\')">';
    html+='<div class="flex items-center gap-2"><span class="ms text-primary text-[16px]">'+icon+'</span><p class="text-sm flex-1">'+escHtml(n.message||"")+'</p>'+eyeHtml+'</div>';
    html+='<div class="flex justify-between text-[10px] text-secondary mt-1"><span>'+new Date(n.created_at).toLocaleString()+'</span>';
    if(n.read)html+='<span class="text-green-500"><span class="ms text-[10px]">done_all</span> Read</span>';
    else html+='<span class="text-amber-500"><span class="ms text-[10px]">mark_email_unread</span> New</span>';
    html+='</div></div>';
    list.innerHTML+=html
  });
  var badgeEl=document.getElementById("notif-badge");if(badgeEl){if(unread>0){badgeEl.classList.remove("hidden")}else{badgeEl.classList.add("hidden")}}
}
markNotifRead=function(nid){
  sb.from("notifications").update({read:true,read_at:new Date().toISOString()}).eq("id",nid).then(function(){
    sb.from("notification_reads").insert({notification_id:nid,user_email:currentUser.email||""}).then(function(){fetchNotifications()}).catch(function(){fetchNotifications()})
  })
};

// ============ FSO COMMENTS (asset-level + linked to tickets) ============
function loadFsComments(assetId){
  var list=document.getElementById("fs-comments-list");if(!list)return;
  sb.from("ticket_comments").select("*").eq("asset_id",assetId).order("created_at",{ascending:false}).then(function(cr){
    var assetComments=cr.data||[];
    var filteredTickets=ticketsCache.filter(function(t){
      if(t.status==="closed"||t.status==="resolved")return false;
      if(t.asset_id!==assetId)return false;
      if(t.visibility==="personal"&&t.created_by_email!==(currentUser.email||"")&&t.target_email!==(currentUser.email||""))return false;
      return true
    });
    if(!assetComments.length&&!filteredTickets.length){list.innerHTML='<p class="text-xs text-secondary py-4 text-center">No comments or tickets for this asset.</p>';return}
    list.innerHTML="";
    // Render asset-level comments first
    assetComments.forEach(function(c){
      var html='<div class="p-3 rounded-lg bg-sclo mb-2">';
      html+='<div class="flex justify-between text-[10px] text-secondary mb-1"><span><span class="ms text-[10px] text-primary">chat</span> '+escHtml(c.user_name||c.user_email||"")+'</span>';
      html+='<span>'+new Date(c.created_at).toLocaleString()+'</span></div>';
      html+='<p class="text-sm">'+escHtml(c.message||"")+'</p></div>';
      list.innerHTML+=html
    });
    // Render tickets
    filteredTickets.forEach(function(t){
      var html='<div class="p-3 rounded-lg '+(t.visibility==="personal"?"border border-amber-200 bg-amber-50/30":"bg-sclo")+'">';
      html+='<div class="flex justify-between text-[10px] text-secondary mb-1"><span><span class="font-mono font-bold text-primary">#'+escHtml(t.ticket_id||t.id)+'</span> '+escHtml(t.created_by_name||t.created_by_email||"")+'</span>';
      html+='<span class="flex items-center gap-1">'+(t.visibility==="personal"?'<span class="ms text-[10px]">lock</span>':'<span class="ms text-[10px]">public</span>')+new Date(t.created_at).toLocaleString()+'</span></div>';
      html+='<p class="text-sm font-medium">'+escHtml(t.subject)+'</p>';
      if(t.body)html+='<p class="text-xs text-secondary mt-1">'+escHtml(t.body)+'</p>';
      var imgs=t.images;
      if(imgs&&Array.isArray(imgs)&&imgs.length){
        html+='<div class="flex gap-1 mt-1">';
        imgs.slice(0,4).forEach(function(img){
          html+='<img src="'+(img.data||"")+'" alt="" class="w-8 h-8 rounded object-cover border border-ov/20">'
        });
        if(imgs.length>4)html+='<span class="text-[10px] text-secondary self-center">+'+(imgs.length-4)+'</span>';
        html+='</div>'
      }
      html+='<div class="flex gap-2 mt-2">';
      if(t._comments&&t._comments.length)html+='<span class="text-[10px] text-secondary">'+(t._comments.length)+' comment(s)</span>';
      if(t.status==="open"){
        html+='<button onclick="resolveTicket(\''+t.id+'\')" class="text-[10px] font-bold text-green-500">Resolve</button>';
        html+='<button onclick="raiseTicketNotif(\''+t.id+'\')" class="text-[10px] font-bold text-amber-600">Raise</button>'
      }
      html+='<button onclick="openTicketDetail(\''+t.id+'\')" class="text-[10px] font-bold text-primary">View</button>';
      html+='</div></div>';
      list.innerHTML+=html
    })
  })
}
async function submitFsComment(){
  if(!requireEdit())return;
  var input=document.getElementById("fs-comment-input");if(!input)return;
  var body=input.value.trim();if(!body){showToast("Write a comment","w");return}
  var vis=document.getElementById("fs-comment-visibility")?.value||"everyone";
  var assetId=currentFullscreenAssetId||document.getElementById("metaAssetId")?.value.trim()||"";
  if(!assetId){showToast("No asset selected","w");return}
  var c={asset_id:assetId,message:body,user_email:currentUser.email||"",user_name:currentUser.name||""};
  var {error}=await sb.from("ticket_comments").insert(c).select();
  if(error){showToast("Error: "+error.message,"e");return}
  input.value="";
  // Notify @mentioned users (excluding self)
  var mm=body.match(/@(\w[\w\s]*\w|\w)/g);
  var notifTargets={};
  var curEmail=currentUser.email||"";
  if(mm){
    mm.forEach(function(m){
      var n=m.substring(1).trim().toLowerCase();
      for(var ek in userProfiles){
        if(userProfiles[ek].name&&userProfiles[ek].name.toLowerCase()===n&&userProfiles[ek].email!==curEmail)notifTargets[userProfiles[ek].email]=true;
      }
    });
  }
  // Personal: notify only mentioned users; Everyone: also notify assigned users
  if(vis!=="personal"){
    // For everyone comments, also notify the asset owner if different
    var seg=globalSegments?globalSegments[assetId]:null;
    if(seg&&seg.assigned_to&&seg.assigned_to!==(currentUser.email||""))notifTargets[seg.assigned_to]=true;
  }
  Object.keys(notifTargets).forEach(function(em){
    sb.from("notifications").insert({target_email:em,from_user:currentUser.name||currentUser.email||"",message:currentUser.name+" mentioned you on "+assetId,notification_type:"mention",asset_id:assetId,read:false}).then(function(){})
  });
  loadFsComments(assetId);showToast("Comment posted","s");logAudit("fs_comment",assetId,"Comment on asset")
}
// Patch openFso to load comments
var _origFso=openFso;openFso=function(assetId){
  _origFso(assetId);
  setTimeout(function(){loadFsComments(assetId||currentFullscreenAssetId)},300);
  // Setup mention autocomplete on FSO comment input
  var ci=document.getElementById("fs-comment-input");if(ci)setupMentionAutocomplete(ci)
};

// ============ @MENTION AUTOCOMPLETE ============
function setupMentionAutocomplete(ta){
  if(!ta||ta.dataset.mentionReady)return;ta.dataset.mentionReady="1";
  var dd=document.createElement("div");dd.className="mention-dd";dd.style.display="none";
  dd.style.cssText="position:absolute;z-index:9999;background:var(--c-scl,#fff);border:1.5px solid var(--c-ov,#cbd5e1);border-radius:12px;padding:4px;min-width:180px;max-height:180px;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,.2);font-size:12px";
  ta.parentElement.style.position="relative";ta.parentElement.appendChild(dd);
  ta.addEventListener("keydown",function(e){
    if(e.key==="Tab"&&dd.style.display!=="none"&&dd.querySelector(".mention-dd-item.hover")){
      e.preventDefault();var h=dd.querySelector(".mention-dd-item.hover");
      if(h){insertMention(ta,h.dataset.email,h.dataset.name);dd.style.display="none"}
    }
  });
  ta.addEventListener("keyup",function(e){
    if(e.key==="ArrowDown"||e.key==="ArrowUp"){e.preventDefault();moveMentionHover(dd,e.key);return}
    var val=ta.value,pos=ta.selectionStart,pre=val.substring(0,pos);
    var m=pre.match(/@(\w*)$/);
    if(!m){dd.style.display="none";return}
    var q=m[1].toLowerCase();
    var matches=[];
    for(var ek in userProfiles){
      var p=userProfiles[ek];
      if((p.name||"").toLowerCase().includes(q)||(p.email||"").toLowerCase().includes(q)){
        var em=p.email, nm=p.name||em.split('@')[0];
        if(!matches.find(function(x){return x.email===em}))matches.push({email:em,name:nm})
      }
    }
    if(!matches.length){dd.style.display="none";return}
    dd.innerHTML="";matches.slice(0,8).forEach(function(u,i){
      var d=document.createElement("div");d.className="mention-dd-item"+(i===0?" hover":"");
      d.dataset.email=u.email;d.dataset.name=u.name;
      d.style.cssText="padding:6px 10px;border-radius:8px;cursor:pointer;display:flex;align-items:center;gap:8px;"+(i===0?"background:var(--c-sclo,#f1f5f9)":"");
      d.innerHTML='<span class="w-5 h-5 rounded-full bg-pf text-primary flex items-center justify-center font-bold text-[9px] flex-shrink-0">'+(u.name.charAt(0).toUpperCase()||"U")+'</span><span class="font-medium">'+escHtml(u.name)+'</span><span class="text-secondary text-[10px] ml-auto">'+escHtml(u.email.split('@')[0])+'</span>';
      d.onmouseenter=function(){dd.querySelectorAll(".mention-dd-item").forEach(function(x){x.classList.remove("hover");x.style.background=""});this.classList.add("hover");this.style.background="var(--c-sclo,#f1f5f9)"};
      d.onclick=function(){insertMention(ta,this.dataset.email,this.dataset.name);dd.style.display="none"};
      dd.appendChild(d)
    });
    var rect=ta.getBoundingClientRect();dd.style.left="0";dd.style.top=ta.scrollTop+"px";
    if(pos>0){var ta2=document.createElement("span");ta2.textContent=pre;ta2.style.cssText="font:inherit;visibility:hidden;position:absolute;white-space:pre";ta.parentElement.appendChild(ta2);dd.style.top=ta2.offsetHeight+"px";ta.parentElement.removeChild(ta2)}
    dd.style.display="block"
  });
  ta.addEventListener("blur",function(){setTimeout(function(){dd.style.display="none"},200)})
}
function insertMention(ta,email,name){
  var val=ta.value,pos=ta.selectionStart,pre=val.substring(0,pos);
  var idx=pre.lastIndexOf("@");if(idx===-1)return;
  ta.value=val.substring(0,idx)+"@"+name+" "+val.substring(pos);
  ta.selectionStart=ta.selectionEnd=idx+name.length+2;ta.focus()
}
function moveMentionHover(dd,key){
  var items=dd.querySelectorAll(".mention-dd-item");
  var cur=dd.querySelector(".mention-dd-item.hover");
  var ci=Array.from(items).indexOf(cur);
  items.forEach(function(x){x.classList.remove("hover");x.style.background=""});
  var ni=key==="ArrowDown"?Math.min(ci+1,items.length-1):Math.max(ci-1,0);
  items[ni].classList.add("hover");items[ni].style.background="var(--c-sclo,#f1f5f9)"
}
// Auto-setup mention on existing comment areas (ticket-cmt-input is setup dynamically in openTicketDetail)
document.addEventListener("DOMContentLoaded",function(){
  ["nt-body","fs-comment-input"].forEach(function(id){
    var el=document.getElementById(id);if(el)setupMentionAutocomplete(el)
  })
});
