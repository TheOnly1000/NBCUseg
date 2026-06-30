// ============================================================================
// REAL-TIME SUBSCRIPTIONS (Supabase)
// ============================================================================

var segChannel = null;
var notifChannel = null;
var profilesChannel = null;
var scheduleChannel = null;

function subscribeRealTime() {
    if (segChannel) sb.removeChannel(segChannel);
    segChannel = sb.channel("segments-rt")
        .on("postgres_changes", { event: "*", schema: "public", table: "segments" }, function(payload) {
            if (payload.eventType === "INSERT") {
                var r = payload.new;
                var aid = r.asset_id;
                if (!globalSegments[aid]) globalSegments[aid] = { id: aid, title: r.title, type: r.type, date: r.date, year: r.year, rows: [] };
                globalSegments[aid].title = r.title;
                globalSegments[aid].type = r.type;
                globalSegments[aid].date = r.date;
                globalSegments[aid].year = r.year;
                var rm = r.metadata || {};
                var rowArr = [r.date, r.asset_id, r.title, r.type, r.seg, r.tc_in||"", r.tc_out||"", r.glitch||"", r.comment||"", r.duration||"", r.breaks||"", r.mcr_fmt||"", r.created_by||"", r.status||"", r.handover_by||"", r.handover_to||"", r.handover_at||"", r.locked_by||"", r.locked_at||"", rm];
                var found = false;
                for (var i = 0; i < globalSegments[aid].rows.length; i++) {
                    if (globalSegments[aid].rows[i][4] === r.seg) {
                        globalSegments[aid].rows[i] = rowArr;
                        found = true; break;
                    }
                }
                if (!found) globalSegments[aid].rows.push(rowArr);
            } else if (payload.eventType === "UPDATE") {
                var r = payload.new;
                var aid = r.asset_id;
                if (!globalSegments[aid]) globalSegments[aid] = { id: aid, title: r.title, type: r.type, date: r.date, year: r.year, rows: [] };
                globalSegments[aid].title = r.title;
                globalSegments[aid].type = r.type;
                globalSegments[aid].date = r.date;
                globalSegments[aid].year = r.year;
                var rm2 = r.metadata || {};
                var rowArr = [r.date, r.asset_id, r.title, r.type, r.seg, r.tc_in||"", r.tc_out||"", r.glitch||"", r.comment||"", r.duration||"", r.breaks||"", r.mcr_fmt||"", r.created_by||"", r.status||"", r.handover_by||"", r.handover_to||"", r.handover_at||"", r.locked_by||"", r.locked_at||"", rm2];
                var found = false;
                for (var i = 0; i < globalSegments[aid].rows.length; i++) {
                    if (globalSegments[aid].rows[i][4] === r.seg) {
                        globalSegments[aid].rows[i] = rowArr;
                        found = true; break;
                    }
                }
                if (!found) globalSegments[aid].rows.push(rowArr);
            } else if (payload.eventType === "DELETE") {
                var aid = payload.old.asset_id;
                var segRemoved = payload.old.seg;
                if (globalSegments[aid]) {
                    globalSegments[aid].rows = globalSegments[aid].rows.filter(function(rr) { return rr[4] !== segRemoved; });
                    if (globalSegments[aid].rows.length === 0) {
                        delete globalSegments[aid];
                    }
                }
            }
            refreshCurrentView();
            if (currentFullscreenAssetId && payload.new && payload.new.asset_id === currentFullscreenAssetId) {
                openFso(currentFullscreenAssetId);
            } else if (currentFullscreenAssetId && payload.old && payload.old.asset_id === currentFullscreenAssetId) {
                openFso(currentFullscreenAssetId);
            }
            if (_syncDebounceTimer) clearTimeout(_syncDebounceTimer);
            _syncDebounceTimer = setTimeout(function() {
                if (currentUser && currentUser.email) loadAllSegments();
            }, 2000);
        })
        .subscribe(function(status) { if (status !== "SUBSCRIBED") console.warn("segments-rt channel status:", status); });

    if (!currentUser) return;
    if (notifChannel) sb.removeChannel(notifChannel);
    notifChannel = sb.channel("notifications-rt")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: "target_email=eq." + currentUser.email }, function(payload) {
            var n = payload.new;
            showToast(n.message, "i", 5000);
            sendBrowserNotif("Segmentor", n.message || "New notification");
            fetchNotifications();
            if (n.sync_needed) loadAllSegments();
        })
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "notifications", filter: "target_email=eq." + currentUser.email }, function(payload) {
            fetchNotifications();
        })
        .subscribe(function(status) { if (status !== "SUBSCRIBED") console.warn("notifications-rt channel status:", status); });

    if (profilesChannel) sb.removeChannel(profilesChannel);
    profilesChannel = sb.channel("profiles-rt")
        .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, function(payload) {
            loadUserProfiles();
            if (currentUser && payload.eventType === "DELETE" && payload.old && payload.old.id === currentUser.id) {
                sb.auth.signOut().then(function() { showToast("Your account has been removed.", "w", 4000); nav("login"); });
            }
            if (payload.eventType === "UPDATE" && payload.new && currentUser && payload.new.id === currentUser.id && payload.new.banned) {
                sb.auth.signOut().then(function() { window.location.href = "ban.html"; });
            }
        })
        .subscribe(function(status) { if (status !== "SUBSCRIBED") console.warn("profiles-rt channel status:", status); });

    if (window.ticketCommentsChannel) sb.removeChannel(window.ticketCommentsChannel);
    window.ticketCommentsChannel = sb.channel("ticket-comments-rt")
        .on("postgres_changes", { event: "*", schema: "public", table: "ticket_comments" }, function(payload) {
            var rec = payload.new || payload.old;
            if (rec && rec.asset_id && currentFullscreenAssetId === rec.asset_id) {
                loadFsComments(rec.asset_id);
            }
            if (rec && rec.ticket_id) {
                var parentTicket = ticketsCache.find(function(x){return String(x.id) === String(rec.ticket_id)});
                if (parentTicket && parentTicket.asset_id && currentFullscreenAssetId === parentTicket.asset_id) {
                    loadFsComments(currentFullscreenAssetId);
                }
            }
            if (rec && rec.ticket_id && window._openTicketDetailId === String(rec.ticket_id)) {
                sb.from("ticket_comments").select("*").eq("ticket_id", rec.ticket_id).order("created_at", {ascending: true}).then(function(cr){
                    if(!cr.error){
                        var t = ticketsCache.find(function(x){return String(x.id) === String(rec.ticket_id)});
                        if(t) t._comments = cr.data || [];
                        var ce = document.getElementById("ticket-detail-content");
                        if(ce){
                            var cmtSection = ce.querySelector(".cmts-section");
                            if(cmtSection){
                                cmtSection.innerHTML = "";
                                (cr.data || []).forEach(function(c){
                                    var ch = '<div class="mb-3 p-3 rounded-lg bg-sclo"><div class="flex justify-between text-xs text-secondary mb-1"><span>'+escHtml(c.user_name||c.user_email||"")+'</span><span>'+(c.created_at?new Date(c.created_at).toLocaleString():"")+'</span></div><p class="text-sm">'+escHtml(c.message||"")+'</p></div>';
                                    cmtSection.insertAdjacentHTML("beforeend", ch);
                                });
                            }
                        }
                    }
                });
            }
            var ticketsView = document.getElementById("vp-tickets");
            if (ticketsView && ticketsView.classList.contains("on")) loadTickets();
        })
        .subscribe(function(status) { if (status !== "SUBSCRIBED") console.warn("ticket-comments-rt channel status:", status); });

    if (window.ticketsChannel) sb.removeChannel(window.ticketsChannel);
    window.ticketsChannel = sb.channel("tickets-rt")
        .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, function(payload) {
            loadTickets();
            var aid = payload.new ? payload.new.asset_id : (payload.old ? payload.old.asset_id : null);
            if (aid && currentFullscreenAssetId === aid) {
                setTimeout(function(){loadFsComments(aid)},200);
            }
        })
        .subscribe(function(status) {
            if (status === "SUBSCRIBED") { if(window.ticketsRtOk)clearTimeout(window.ticketsRtOk); }
            else if (status === "CHANNEL_ERROR") { console.warn("tickets-rt channel error, will poll fallback"); }
        });
    if(window.ticketsPollTimer)clearInterval(window.ticketsPollTimer);
    window.ticketsPollTimer=setInterval(function(){
        var tv=document.getElementById("vp-tickets");
        if(tv&&tv.classList.contains("on"))loadTickets();
        if(currentFullscreenAssetId)loadFsComments(currentFullscreenAssetId);
    },30000);

    var _scheduleRtDebounce = null;
    if (scheduleChannel) sb.removeChannel(scheduleChannel);
    scheduleChannel = sb.channel("schedule-rt")
        .on("postgres_changes", { event: "*", schema: "public", table: "schedule_entries" }, function(payload) {
            if (_scheduleRtDebounce) clearTimeout(_scheduleRtDebounce);
            _scheduleRtDebounce = setTimeout(function() {
                loadScheduleFromDb(true);
            }, 400);
        })
        .subscribe(function(status) {
            if (status === "SUBSCRIBED") {
                console.log("schedule-rt SUBSCRIBED");
            } else if (status === "CHANNEL_ERROR") {
                console.warn("schedule-rt CHANNEL_ERROR, retrying in 5s");
                setTimeout(function() {
                    if (scheduleChannel) { sb.removeChannel(scheduleChannel); scheduleChannel = null; }
                    subscribeRealTime();
                }, 5000);
            } else {
                console.warn("schedule-rt channel status:", status);
            }
        });
    if(window.schedulePollTimer)clearInterval(window.schedulePollTimer);
    window.schedulePollTimer=setInterval(function(){
        loadScheduleFromDb(true);
    },30000);
}
