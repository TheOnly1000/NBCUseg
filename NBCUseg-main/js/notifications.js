// ============================================================================
// 11a. NOTIFICATIONS, HANDOVER & END SHOW
// ============================================================================

function playNotifSound() {
    try {
        var ctx = new (window.AudioContext || window.webkitAudioContext)();
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 523.25;
        osc.type = "sine";
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
        setTimeout(function() {
            var osc2 = ctx.createOscillator();
            var gain2 = ctx.createGain();
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.frequency.value = 659.25;
            osc2.type = "sine";
            gain2.gain.setValueAtTime(0.3, ctx.currentTime);
            gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
            osc2.start(ctx.currentTime);
            osc2.stop(ctx.currentTime + 0.3);
        }, 150);
    } catch(e) {}
}

function requestNotifPermission() {
    if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
    }
}

function sendBrowserNotif(title, body) {
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") {
        new Notification(title, { body: body, icon: "/assets/logo.png" });
    }
}

function fetchNotifications() {
    if (!currentUser || !currentUser.email) return;
    sb.from("notifications").select("*").eq("target_email", currentUser.email).order("created_at", { ascending: false }).limit(50).then(function(r) {
        if (r.error) { console.warn("Notification fetch error:", r.error); return; }
        var notifs = r.data || [];
        // Auto-clean notifications whose referenced assets no longer exist
        var toDelete = [];
        notifs.forEach(function(n) {
            if (n.asset_id && !globalSegments[n.asset_id]) {
                toDelete.push(n.id);
            }
        });
        if (toDelete.length > 0) {
            sb.from("notifications").delete().in("id", toDelete).then(function() {
                notifs = notifs.filter(function(n) { return toDelete.indexOf(n.id) < 0; });
            });
        }
        // Batch-load read receipts for all notifications
        var ids = notifs.map(function(n){return n.id});
        if (ids.length) {
            sb.from("notification_reads").select("*").in("notification_id", ids).then(function(cr){
                if (!cr.error && cr.data) {
                    var readsByNotif = {};
                    cr.data.forEach(function(row){
                        if (!readsByNotif[row.notification_id]) readsByNotif[row.notification_id] = [];
                        var p = userProfiles[row.user_email];
                        readsByNotif[row.notification_id].push({email: row.user_email, name: p ? p.name : row.user_email});
                    });
                    notifs.forEach(function(n){
                        n._readers = readsByNotif[n.id] || [];
                    });
                }
                finishNotifRender(notifs);
            });
        } else {
            finishNotifRender(notifs);
        }
    });
}
function finishNotifRender(notifs) {
    var unreadCount = notifs.filter(function(n) { return !n.read; }).length;
    if (unreadCount > _lastNotifCount && _lastNotifCount > 0 && !document.hidden) playNotifSound();
    _lastNotifCount = unreadCount;
    renderNotifications(notifs);
    var hasSync = notifs.some(function(n) { return n.sync_needed && !n.read; });
    if (hasSync) loadAllSegments();
}

function renderNotifications(notifs) {
    var list = document.getElementById("notif-list");
    var badge = document.getElementById("notif-badge");
    if (!list) return;
    if (!notifs.length) {
        list.innerHTML = '<div style="text-align:center;color:var(--c-secondary);font-size:13px;padding:24px">No notifications.</div>';
        if (badge) badge.classList.add("hidden");
        return;
    }
    var unreadCount = 0;
    list.innerHTML = notifs.map(function(n) {
        var isUnread = !n.read;
        if (isUnread) unreadCount++;
        var fromName = n.from_user || "";
        var nid = n.id;
        var aid = n.asset_id || "";
        var tid = n.ticket_id || "";
        var ts = fmtTimeIST(n.created_at);
        var bgStyle = isUnread ? "background:var(--c-pf);border:1px solid var(--c-primary)" : "background:var(--c-scl);border:1px solid var(--c-ov)";
        var readStyle = isUnread ? "" : "opacity:0.6";
        var notifTypeIcon = n.notification_type === "handover_request" ? '<span class="ms" style="font-size:14px;vertical-align:middle;color:#d97706">forward</span>' :
            n.notification_type === "handover_accepted" ? '<span class="ms" style="font-size:14px;vertical-align:middle;color:#16a34a">check</span>' :
            n.notification_type === "handover_given" ? '<span class="ms" style="font-size:14px;vertical-align:middle;color:#2563eb">forward</span>' :
            n.notification_type === "ticket_comment" ? '<span class="ms" style="font-size:14px;vertical-align:middle;color:#8b5cf6">chat</span>' :
            n.notification_type === "ticket" ? '<span class="ms" style="font-size:14px;vertical-align:middle;color:#f59e0b">confirmation_number</span>' :
            n.notification_type === "schedule_assignment" ? '<span class="ms" style="font-size:14px;vertical-align:middle;color:#3b82f6">assignment</span>' :
            n.notification_type === "schedule_alert" ? '<span class="ms" style="font-size:14px;vertical-align:middle;color:#ef4444">timer</span>' : '';
        var readersHtml = "";
        if (n._readers && n._readers.length) {
            var maxReaders = 5;
            var shown = n._readers.slice(0, maxReaders);
            shown.forEach(function(r){
                readersHtml += getUserAvatarHtml(r.email || r.user_email || "", r.name || r.user_email || "", 20);
            });
            if (n._readers.length > maxReaders) readersHtml += '<span class="text-[9px] text-secondary font-bold" style="margin-left:2px">+'+(n._readers.length - maxReaders)+'</span>';
            if (readersHtml) readersHtml = '<div style="display:flex;align-items:center;gap:2px;margin-top:4px">' + readersHtml + '</div>';
        }
        var onClick = "handleNotifClick(" + JSON.stringify(nid) + "," + JSON.stringify(aid||"") + "," + JSON.stringify(tid||"") + "," + JSON.stringify(n.notification_type||"") + ")";
        return '<div onclick="' + onClick + '" style="cursor:pointer;display:flex;align-items:flex-start;gap:12px;padding:12px;border-radius:12px;' + bgStyle + '" class="' + (isUnread ? "" : "read-notif") + '">' +
            getUserAvatarHtml(n.from_email || "", fromName, 32) +
            '<div style="flex:1;min-width:0;' + readStyle + '"><p style="font-size:13px;font-weight:500">' + notifTypeIcon + ' ' + sanitizeHTML(n.message) + '</p>' +
            '<p style="font-size:10px;color:var(--c-secondary);margin-top:2px">' + ts + '</p>' + readersHtml +
            (n.notification_type === "handover_request" ? '<button onclick="event.stopPropagation();directHandoverFromNotif(\'' + aid + '\',\'' + escHtml(n.from_email || "") + '\')" class="btn-primary text-xs px-3 py-1 mt-2">Give Handover</button>' : "") +
            (n.notification_type === "handover_given" ? '<button onclick="event.stopPropagation();directTakeHandover(\'' + aid + '\')" class="btn-primary text-xs px-3 py-1 mt-2">Take Handover</button>' : "") +
            (n.notification_type === "ticket" || n.notification_type === "ticket_comment" ? '<button onclick="event.stopPropagation();directOpenTicket(\'' + tid + '\')" class="btn-primary text-xs px-3 py-1 mt-2">' + (n.notification_type === "ticket_comment" ? "Open" : "Open Ticket") + '</button>' : "") +
            (n.notification_type === "schedule_assignment" || n.notification_type === "schedule_alert" ? '<button onclick="event.stopPropagation();nav(\'schedule\')" class="btn-secondary text-xs px-3 py-1 mt-2">Open Schedule</button>' : "") +
            '</div>' +
            '<span onclick="event.stopPropagation();clearNotif(\'' + nid + '\')" style="font-size:16px;color:var(--c-secondary);cursor:pointer;flex-shrink:0" title="Dismiss" class="ms">close</span>' +
        '</div>';
    }).join('');
    if (badge) {
        if (unreadCount > 0) { badge.classList.remove("hidden"); }
        else { badge.classList.add("hidden"); }
    }
}

function directHandoverFromNotif(assetId, fromEmail) {
    if (!assetId || !fromEmail) { showToast("Missing asset or user.", "e"); return; }
    closeModal("m-notif");
    showGlobalLoader(true);
    var now = new Date().toISOString();
    var fromName = getUserInfo(fromEmail)?.name || fromEmail.split("@")[0];
    var myName = currentUser.name || (currentUser.email || "").split("@")[0];
    sb.from("segments").select("id, metadata, locked_by").eq("asset_id", assetId).then(function(r) {
        if (r.error || !r.data || !r.data.length) {
            showGlobalLoader(false); showToast("No segments found.", "e"); return;
        }
        var curLock = r.data[0].locked_by || "";
        if (curLock.toLowerCase() !== (currentUser.email || "").toLowerCase()) {
            showGlobalLoader(false); showToast("Asset no longer locked by you — already handed over.", "e"); return;
        }
        var promises = r.data.map(function(seg) {
            var meta = seg.metadata || {};
            if (!meta.transfers) meta.transfers = [];
            meta.transfers.push({ from: myName, toEmail: fromEmail, toName: fromName, at: now });
            return sb.from("segments").update({
                status: "Handed Over",
                handover_by: currentUser.email,
                handover_to: fromEmail,
                handover_at: now,
                locked_by: fromEmail,
                locked_at: now,
                updated_at: now,
                metadata: meta
            }).eq("id", seg.id);
        });
        Promise.all(promises).then(function() {
            sb.from("notifications").insert({
                target_email: fromEmail, from_user: myName, from_email: currentUser.email, asset_id: assetId,
                message: myName + " handed over " + assetId + " to you.",
                notification_type: "handover_given",
                created_at: now, read: false, sync_needed: true
            }).then(function() {
                showGlobalLoader(false);
                showToast("Handed over " + assetId + " to " + fromName, "s");
                loadAllSegments();
                fetchNotifications();
            });
        }).catch(function(err) {
            showGlobalLoader(false); showToast("Handover failed: " + err.message, "e");
        });
    });
}

function directOpenTicket(ticketId) {
    if (!ticketId) return;
    closeModal("m-notif");
    nav("tickets");
    var found = ticketsCache.find(function(t){return String(t.id)===String(ticketId)||String(t.ticket_id)===String(ticketId)});
    if (found) {
        setTimeout(function(){openTicketDetail(ticketId)}, 300);
    } else {
        loadTickets().then(function(){
            setTimeout(function(){openTicketDetail(ticketId)}, 300);
        });
    }
}

function directTakeHandover(assetId) {
    if (!assetId) return;
    closeModal("m-notif");
    nav("editor");
    loadToEditor(assetId);
}

function handleNotifClick(notifId, assetId, ticketId, notifType) {
    closeModal("m-notif");
    // Auto mark as read with read receipt
    sb.from("notification_reads").insert({notification_id: Number(notifId), user_email: currentUser.email||""}).then(function(){});
    sb.from("notifications").update({read: true}).eq("id", notifId).then(function(){});
    // Redirect based on content type
    if (notifType === "schedule_assignment" || notifType === "schedule_alert") {
        nav("schedule");
    } else if (assetId && assetId !== "null" && assetId !== "undefined") {
        nav("editor");
        loadToEditor(assetId);
        if (notifType === "handover_request" || notifType === "handover_given") {
            setTimeout(function(){openHandoverModal()}, 800);
        }
    } else if (ticketId && ticketId !== "null" && ticketId !== "undefined") {
        nav("tickets");
        var numId = Number(ticketId);
        var found = ticketsCache.find(function(t){return Number(t.id)===numId});
        if (found) {
            setTimeout(function(){openTicketDetail(ticketId)}, 300);
        } else {
            loadTickets().then(function(){
                setTimeout(function(){openTicketDetail(ticketId)}, 300);
            });
        }
    } else if (notifType === "schedule_assignment" || notifType === "schedule_alert") {
        nav("schedule");
    } else {
        nav("dashboard");
    }
}

function ackAndLoad(notifId, assetId) {
    closeModal("m-notif");
    sb.from("notifications").update({ read: true }).eq("id", notifId).then(function() {});
    if (assetId) loadToEditor(assetId);
}

function clearNotif(notifId) {
    sb.from("notification_reads").delete().eq("notification_id", notifId).then(function(){});
    sb.from("notifications").delete().eq("id", notifId).then(function(r) {
        if (r.error) { showToast("Failed to clear: " + r.error.message, "e"); return; }
        fetchNotifications();
    });
}

function clearAllNotifs() {
    sb.from("notifications").select("id").eq("target_email", currentUser.email).then(function(r){
        if(r.error||!r.data||!r.data.length){fetchNotifications();return}
        var ids=r.data.map(function(n){return n.id});
        sb.from("notification_reads").delete().in("notification_id",ids).then(function(){});
        sb.from("notifications").delete().in("id",ids).then(function(r2){
            if(r2.error){showToast("Failed to clear all: "+r2.error.message,"e");return}
            fetchNotifications();showToast("All notifications cleared.","s")
        })
    })
}

function openHandoverModal() {
    const aid = document.getElementById("metaAssetId")?.value.trim();
    if (!aid) { showToast("Load an asset first.", "w"); return; }
    document.getElementById("handover-asset-label").textContent = "Handover: " + aid;
    const select = document.getElementById("handover-user-select");
    if (!select) return;
    select.innerHTML = '<option value="">Loading users...</option>';
    closeModal("m-handover");
    
    sb.from("profiles").select("id, name, email").then(function(r) {
        if (r.error) {
            console.warn("Profiles query error:", r.error);
            select.innerHTML = '<option value="">Error loading users</option>';
            openModal("m-handover");
            return;
        }
        var users = r.data || [];
        var opts = '<option value="">Select user...</option>';
        for (var i = 0; i < users.length; i++) {
            var uEmail = users[i].email;
            if (!uEmail) continue;
            if (uEmail.toLowerCase() === (currentUser.email || "").toLowerCase()) continue;
            var uName = users[i].name || uEmail.split('@')[0];
            opts += '<option value="' + uEmail + '">' + sanitizeHTML(uName) + ' (' + sanitizeHTML(uEmail) + ')</option>';
        }
        if (opts === '<option value="">Select user...</option>') {
            opts = '<option value="">No other users found</option>';
        }
        select.innerHTML = opts;
        openModal("m-handover");
    });
}

function confirmHandover() {
    var select = document.getElementById("handover-user-select");
    var toEmail = select ? select.value : "";
    if (!toEmail) { showToast("Select a user to handover to.", "w"); return; }
    var aid = document.getElementById("metaAssetId")?.value.trim();
    if (!aid) { showToast("No asset loaded.", "e"); return; }
    closeModal("m-handover");
    pauseEditorTimer();
    showGlobalLoader(true);
    saveSegmentsToDb("Handed Over", { hoBy: currentUser.name, hoTo: toEmail, callback: function() {
        sb.from("notifications").insert({
            target_email: toEmail, from_user: currentUser.name, from_email: currentUser.email, asset_id: aid,
            message: currentUser.name + " handed over " + aid + " to you.",
            notification_type: "handover_given",
            created_at: new Date().toISOString(), read: false, sync_needed: true
        }).then(function() {
            showGlobalLoader(false);
            showToast("Handed over to " + toEmail, "s");
            clearEditor();
            nav("dashboard");
        });
    }});
}

function sendHandoverRequest() {
    var aid = _pendingHandoverRequestAsset;
    if (!aid) { showToast("No asset selected.", "e"); closeModal("m-request-ho"); return; }
    closeModal("m-request-ho");

    var assetData = grpAssets().find(function(a) { return a.id === aid; });
    var lockedByEmail = assetData ? (assetData.lockedBy || "") : "";
    if (!lockedByEmail) { showToast("Asset is no longer locked.", "i"); return; }

    sb.from("notifications").insert({
        target_email: lockedByEmail,
        from_user: currentUser.name,
        from_email: currentUser.email,
        asset_id: aid,
        message: currentUser.name + " requested handover of " + aid + ". Please handover or release.",
        notification_type: "handover_request",
        created_at: new Date().toISOString(),
        read: false,
        sync_needed: false
    }).then(function() {
        showToast("Handover request sent to the current editor.", "s");
    });
}
