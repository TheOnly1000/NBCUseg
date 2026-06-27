function refreshCurrentView() {
    buildFilters();
    var on = document.querySelector(".vp.on");
    if (on) {
        var id2 = on.id.replace("vp-", "");
        if (id2 === "dashboard") renderDash();
        else if (id2 === "schedule") { renderSchedule(); loadScheduleFromDb(true) }
        else if (id2 === "assets") renderAssets();
        else if (id2 === "report" && currentFullscreenAssetId) nav("report");
        else if (id2 === "manual") renderManual();
        else if (id2 === "tickets") { try { renderTicketsView(); } catch(e) { console.error("renderTicketsView error:", e); } loadTickets(); }
        else if (id2 === "billing") renderBillingView();
        else if (id2 === "editor") {
            var ea3 = document.getElementById("metaAssetId")?.value.trim() || "";
            if (ea3 && !globalSegments[ea3]) {
                document.getElementById("metaAssetId").value = "";
                document.getElementById("metaTitle").value = "";
                document.getElementById("metaType").value = "Record";
                document.getElementById("metaDate").value = new Date().toISOString().split("T")[0];
                var grid3 = document.getElementById("segmentGrid");
                if(grid3) grid3.innerHTML = "";
                timelineSegments = [];
                segmentGlitches = {};
                var badge3 = document.getElementById("seg-count-badge");
                if(badge3) badge3.textContent = "0 segments";
                ["mcrOut-detailed","mcrOut-short","sumActDur","expectedDurationDisplay"].forEach(function(id){
                    var el=document.getElementById(id); if(el) el.innerHTML = "";
                });
                var em = document.getElementById("editor-main");
                var ee = document.getElementById("editor-empty");
                if (em) em.style.display = "none";
                if (ee) ee.style.display = "flex";
            }
        }
    }
    if (currentFullscreenAssetId && document.getElementById("fso")?.classList.contains("on")) {
        var targetAsset = grpAssets().find(function(a) { return a.id === currentFullscreenAssetId; });
        if (!targetAsset) {
            closeFso();
            showToast("This asset was deleted by another user.", "w");
        }
    }
}

function loadAllSegments() {
    return sb.from("segments").select("*").order("asset_id").order("seg").then(function(r) {
        if (r.error) { showToast("DB error: " + r.error.message, "e"); return; }
        globalSegments = {};
        (r.data || []).forEach(function(row) {
            var aid3 = row.asset_id;
            if (!globalSegments[aid3]) globalSegments[aid3] = { id: aid3, title: row.title, type: row.type, date: row.date, year: row.year || new Date(row.date).getFullYear() || "", rows: [] };
            var meta = row.metadata || {};
            globalSegments[aid3].rows.push([row.date, row.asset_id, row.title, row.type, row.seg, row.tc_in||"", row.tc_out||"", row.glitch||"", row.comment||"", row.duration||"", row.breaks||"", row.mcr_fmt||"", row.created_by||"", row.status||"", row.handover_by||"", row.handover_to||"", row.handover_at||"", row.locked_by||"", row.locked_at||"", meta, meta.artist||"", meta.song||"", meta.label||"", meta.program||"", meta.performance||"", meta.season_episode||"", meta.mcr_notes||""]);
        });
        renderDash();
        renderAssets();
        buildFilters();
    });
}


// ============================================================================
// 11. NAVIGATION & TABS
// ============================================================================

function nav(viewId) {
    closeSidebar();
    
    if (viewId === "login") {
        document.getElementById("screen-login")?.classList.add("on");
        document.getElementById("app-main")?.classList.remove("on");
        return;
    }
    
    try { localStorage.setItem('seg_last_view', viewId); } catch(e) {}
    
    document.getElementById("screen-login")?.classList.remove("on");
    document.getElementById("app-main")?.classList.add("on");
    
    var prevViewEl = document.querySelector(".vp.on");
    var prevViewId = prevViewEl ? prevViewEl.id.replace("vp-", "") : "";
    
    document.querySelectorAll(".vp").forEach(v => v.classList.remove("on", "enter"));
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("on"));
    document.querySelectorAll(".bn").forEach(b => b.classList.remove("on"));
    
    const targetView = document.getElementById("vp-" + viewId);
    if (targetView) {
        targetView.classList.add("on", "enter");
        targetView.scrollTop = 0;
    }
    
    const sidebarNavBtn = document.getElementById("nb-" + viewId);
    if (sidebarNavBtn) sidebarNavBtn.classList.add("on");
    
    const bottomNavBtn = document.getElementById("bn-" + viewId);
    if (bottomNavBtn) bottomNavBtn.classList.add("on");
    
    // Auto-clean editor when leaving to another view (skip report — it reads from editor data)
    if (viewId !== "editor" && viewId !== "report" && viewId !== "schedule" && viewId !== "manual" && prevViewId === "editor") {
        var curAid = document.getElementById("metaAssetId")?.value.trim() || "";
        if (curAid) {
            document.getElementById("metaAssetId").value = "";
            document.getElementById("metaTitle").value = "";
            document.getElementById("metaType").value = "Record";
            document.getElementById("metaDate").value = new Date().toISOString().split("T")[0];
            var exGrid = document.getElementById("segmentGrid");
            if(exGrid) exGrid.innerHTML = "";
            timelineSegments = [];
            segmentGlitches = {};
            var exBdg = document.getElementById("seg-count-badge");
            if(exBdg) exBdg.textContent = "0 segments";
            ["mcrOut-detailed","mcrOut-short","sumActDur","expectedDurationDisplay"].forEach(function(id){
                var el=document.getElementById(id); if(el) el.innerHTML = "";
            });
            showToast("Editor auto-cleared.", "i");
        }
    }
    
    if (viewId === "editor") {
        var ea2 = document.getElementById("metaAssetId")?.value.trim() || "";
        var editorMain = document.getElementById("editor-main");
        var editorEmpty = document.getElementById("editor-empty");
        // If asset was deleted by another user, clear editor
        if (ea2 && !globalSegments[ea2]) {
            if (editorMain) editorMain.style.display = "none";
            if (editorEmpty) editorEmpty.style.display = "flex";
            ea2 = "";
        }
        if (!ea2) {
            if (editorMain) editorMain.style.display = "none";
            if (editorEmpty) editorEmpty.style.display = "flex";
            if(document.getElementById("metaAssetId")) document.getElementById("metaAssetId").value = "";
            if(document.getElementById("metaTitle")) document.getElementById("metaTitle").value = "";
            if(document.getElementById("metaType")) document.getElementById("metaType").value = "Record";
            if(document.getElementById("metaDate")) document.getElementById("metaDate").value = new Date().toISOString().split("T")[0];
            var grid2 = document.getElementById("segmentGrid");
            if(grid2) grid2.innerHTML = "";
            timelineSegments = [];
            segmentGlitches = {};
            var badge2 = document.getElementById("seg-count-badge");
            if(badge2) badge2.textContent = "0 segments";
            ["mcrOut-detailed","mcrOut-short","sumActDur","expectedDurationDisplay"].forEach(function(id){
                var el=document.getElementById(id); if(el) el.innerHTML = "";
            });
        } else {
            if (editorMain) editorMain.style.display = "";
            if (editorEmpty) editorEmpty.style.display = "none";
        }
    }
    if (viewId === "report") {
        // Determine which asset to show
        var rptAid = document.getElementById("metaAssetId")?.value.trim() || currentFullscreenAssetId || "";
        var rptAsset = rptAid ? (globalSegments[rptAid] || null) : null;
        
        if (rptAsset) {
            var rptFirstRow = rptAsset.rows[0] || [];
            document.getElementById("rptId").textContent = rptAsset.id || "UNKNOWN";
            document.getElementById("rptTitle").textContent = rptAsset.title || "No Title";
            document.getElementById("rptType").textContent = (rptAsset.type || "RECORD").toUpperCase();
            // Thumbnail
            var rptThumbEl = document.getElementById("rpt-thumb");
            if (rptThumbEl) {
                var rptThumbUrl = getThumbnailUrl(rptAsset.title);
                if (rptThumbUrl) {
                    rptThumbEl.style.background = "url(" + rptThumbUrl + ") center/cover no-repeat";
                } else {
                    var rptThumbGrad = assetThumbnail(rptAsset.id, rptAsset.title).gradient;
                    rptThumbEl.style.background = rptThumbGrad;
                    if (rptAsset.title) fetchThumbnailForTitle(rptAsset.title);
                }
            }
            
            // Recalculate durations and MCR from asset data
            var rptTotalDuration = 0;
            var rptTotalGlitches = 0;
            var rptParsedData = [];
            var rptGlitchTbody = document.getElementById("rptGlitchTbody");
            if (rptGlitchTbody) rptGlitchTbody.innerHTML = "";
            rptAsset.rows.forEach(function(rr) {
                var rSeg = rr[4];
                var rIn = cleanDateString(rr[5]) || "";
                var rOut = cleanDateString(rr[6]) || "";
                var rGlitchRaw = rr[7] || "";
                var rGlts = [];
                if (rGlitchRaw && rGlitchRaw !== "-" && rGlitchRaw !== "None") {
                    rGlitchRaw.split(" | ").forEach(function(g) {
                        var match = g.match(/(.+) \(([\d:]+)-([\d:]+)\)/);
                        if (match) {
                            var gDur = Math.max(0, toSec(match[3]) - toSec(match[2]));
                            rGlts.push({ type: match[1].trim(), in: match[2], out: match[3], dur: gDur });
                        }
                    });
                }
                var rDur = 0;
                if (rIn.length === 8 && rOut.length === 8) {
                    var raw = toSec(rOut) - toSec(rIn);
                    if (raw <= 0) raw += 86400;
                    var gDur = 0;
                    rGlts.forEach(function(g) { gDur += g.dur || 0; });
                    rDur = Math.max(0, raw - gDur);
                    rptTotalDuration += rDur;
                }
                rptParsedData.push({ seg: rSeg, fd: rDur, glitches: rGlts });
                rptTotalGlitches += rGlts.length;
                // Populate glitch table
                if (rGlts.length > 0 && rptGlitchTbody) {
                    rGlts.forEach(function(g) {
                        rptGlitchTbody.innerHTML += '<tr class="hover:bg-sclo smooth border-b border-ov/20"><td class="p-3 pl-5 font-bold text-primary">' + rSeg + '</td><td class="p-3 text-on-surface">' + g.type + '</td><td class="p-3 font-mono text-on-surface">' + g.in + '</td><td class="p-3 font-mono text-on-surface">' + g.out + '</td><td class="p-3 font-bold text-error font-mono">' + g.dur + 's</td></tr>';
                    });
                }
            });
            
            // Glitch count
            var rptGltCount = document.getElementById("rptGlitchCount");
            if (rptGltCount) {
                rptGltCount.textContent = rptTotalGlitches + " Glitches";
                if (rptTotalGlitches === 0 && rptGlitchTbody) {
                    rptGlitchTbody.innerHTML = '<tr><td colspan="5" class="p-5 text-center text-secondary font-medium">No glitches detected.</td></tr>';
                }
            }
            
            document.getElementById("rptDur").textContent = tcStr(rptTotalDuration);
            
            // Generate MCR content
            var rptDetailed = buildDetailedSlackReport(rptAsset.id, rptAsset.title, rptAsset.type, rptAsset.date || "", rptParsedData, rptTotalDuration);
            var rptShort = rptParsedData.map(function(s) { return rptAsset.id + s.seg + " - " + tcStr(s.fd); }).join("\n");
            if (document.getElementById("rptMcr-detailed")) document.getElementById("rptMcr-detailed").innerHTML = rptDetailed.replace(/\n/g, "<br>");
            if (document.getElementById("rptMcr-short")) document.getElementById("rptMcr-short").innerHTML = rptShort.replace(/\n/g, "<br>");
            
            // Owner avatars and transfer history
            var rptOwnerMeta = rptAsset.rows[0] ? (rptAsset.rows[0][19] || {}) : {};
            var rptTransfers = rptOwnerMeta.transfers || [];
            var rptOwnerName = rptAsset.rows[0] ? (rptAsset.rows[0][12] || "Unknown") : "Unknown";
            var rptOwnerChain = [rptOwnerName];
            for (var rti = 0; rti < rptTransfers.length; rti++) {
                var rt = rptTransfers[rti];
                var rtName = rt.toName || (function(e){ var u=getUserInfo(e); return u?u.name:e.split('@')[0]; })(rt.toEmail || "");
                if (rtName && rptOwnerChain.indexOf(rtName) === -1) rptOwnerChain.push(rtName);
            }
            // Avatars
            var rptAvatarsEl = document.getElementById("rpt-owner-avatars");
            var rptAvatarsList = document.getElementById("rpt-owner-avatars-list");
            if (rptAvatarsEl && rptAvatarsList) {
                if (rptOwnerChain.length > 0) {
                    rptAvatarsList.innerHTML = rptOwnerChain.map(function(oname) {
                        var oInfo = Object.values(userProfiles).find(function(up) { return up.name === oname; });
                        var oAvatar = (oInfo && oInfo.avatar) || "";
                        var oInitial = (oname || "?").charAt(0).toUpperCase();
                        if (oAvatar) {
                            return '<div class="w-7 h-7 rounded-full border-2 border-scl overflow-hidden flex-shrink-0" style="margin-left:-4px" title="' + sanitizeHTML(oname) + '"><img src="' + oAvatar + '" class="w-full h-full object-cover" alt="' + sanitizeHTML(oname) + '" onerror="this.style.display=\'none\'"></div>';
                        }
                        return '<div class="w-7 h-7 rounded-full border-2 border-scl bg-primary/20 text-primary font-bold text-xs flex items-center justify-center flex-shrink-0" style="margin-left:-4px" title="' + sanitizeHTML(oname) + '">' + oInitial + '</div>';
                    }).join('');
                    rptAvatarsEl.style.display = "flex";
                } else {
                    rptAvatarsEl.style.display = "none";
                }
            }
            // Transfer history
            var rptTransferEl = document.getElementById("rpt-transfer-history");
            var rptTransferList = document.getElementById("rpt-transfer-list");
            if (rptTransferEl && rptTransferList) {
                if (rptTransfers.length > 0) {
                    rptTransferList.innerHTML = rptTransfers.map(function(t, ti) {
                        return (ti > 0 ? ' <span class="text-ov" style="margin:0 2px">&#8594;</span> ' : '') + '<span class="font-medium">' + sanitizeHTML(t.from || "") + '</span> <span class="text-ov">&#8594;</span> <span class="font-medium">' + sanitizeHTML(t.toName || t.toEmail || "") + '</span> <span class="font-mono text-secondary" style="font-size:10px">' + fmtTimeIST(t.at) + '</span>';
                    }).join('');
                    rptTransferEl.style.display = "flex";
                } else {
                    rptTransferEl.style.display = "none";
                }
            }
            
            // Handover bar
            var rptHoBar = document.getElementById("rpt-handover-bar");
            if (rptHoBar) {
                var found = false;
                for (var ri2 = 0; ri2 < rptAsset.rows.length; ri2++) {
                    if (rptAsset.rows[ri2][14] && rptAsset.rows[ri2][15]) {
                        document.getElementById("rpt-handover-by").textContent = rptAsset.rows[ri2][14] || "";
                        var hoToRpt = rptAsset.rows[ri2][15] || "";
                        document.getElementById("rpt-handover-to").textContent = (function(e){ var u=getUserInfo(e); return u?u.name:e.split('@')[0]; })(hoToRpt);
                        document.getElementById("rpt-handover-time").textContent = fmtTimeIST(rptAsset.rows[ri2][16]) || "N/A";
                        rptHoBar.style.display = "flex";
                        found = true;
                        break;
                    }
                }
                if (!found) rptHoBar.style.display = "none";
            }
            
            // Working time from metadata
            var rptTimerSection = document.getElementById("rpt-timer-section");
            var rptTimerUsers = document.getElementById("rpt-timer-users");
            if (rptTimerSection && rptTimerUsers) {
                var wt = rptOwnerMeta.working_time || {};
                var wtKeys = Object.keys(wt);
                if (wtKeys.length) {
                    rptTimerSection.classList.remove("hidden");
                    rptTimerUsers.innerHTML = wtKeys.map(function(em){
                        var total = wt[em] || 0;
                        var h = Math.floor(total / 3600);
                        var m = Math.floor((total % 3600) / 60);
                        var s = total % 60;
                        var ts = (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
                        var p = userProfiles[em];
                        var name = p ? p.name : em;
                        return '<div class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-sclo border border-ov/30 text-xs">' +
                            getUserAvatarHtml(em, name, 22) +
                            '<span class="font-bold">' + sanitizeHTML(name) + '</span>' +
                            '<span class="font-mono text-primary">' + ts + '</span></div>';
                    }).join('');
                } else {
                    rptTimerSection.classList.add("hidden");
                }
            }
            
            // Locked by
            var rptLockedEl = document.getElementById("rpt-locked-by");
            if (rptLockedEl) {
                if (rptAsset.rows[0] && rptAsset.rows[0][17]) {
                    rptLockedEl.textContent = "Currently edited by: " + rptAsset.rows[0][17];
                    rptLockedEl.style.display = "block";
                } else {
                    rptLockedEl.style.display = "none";
                }
            }
        } else {
            // Fallback: try reading from editor
            document.getElementById("rptId").textContent = document.getElementById("metaAssetId")?.value || "UNKNOWN";
            document.getElementById("rptTitle").textContent = document.getElementById("metaTitle")?.value || "No Title";
            document.getElementById("rptDur").textContent = document.getElementById("sumActDur")?.textContent || "00:00:00";
            document.getElementById("rptType").textContent = (document.getElementById("metaType")?.value || "RECORD").toUpperCase();
            var edDet = document.getElementById("mcrOut-detailed");
            var edSht = document.getElementById("mcrOut-short");
            if (edDet && document.getElementById("rptMcr-detailed")) document.getElementById("rptMcr-detailed").innerHTML = edDet.innerHTML;
            if (edSht && document.getElementById("rptMcr-short")) document.getElementById("rptMcr-short").innerHTML = edSht.innerHTML;
            var rptHoBar = document.getElementById("rpt-handover-bar");
            if (rptHoBar) rptHoBar.style.display = "none";
            var rptLockedEl = document.getElementById("rpt-locked-by");
            if (rptLockedEl) rptLockedEl.style.display = "none";
        }
    }
    if (viewId === "schedule") {
        loadScheduleFromDb(true);
    }
    if (viewId === "manual") {
        renderManual();
    }
    if (viewId === "billing") {
        renderBillingView();
    }
}

// V13-pattern: isolate tickets nav from main nav to avoid error cascade

function setLay(layoutType) {
    const gridEl = document.getElementById("dgrid");
    if(gridEl) gridEl.className = layoutType === "list" ? "lg-list" : "lg-grid";
    
    const btnG = document.getElementById("btn-g");
    const btnL = document.getElementById("btn-l");
    if(btnG) btnG.className = layoutType === "grid" ? "p-1.5 rounded-lg bg-sc text-primary sm" : "p-1.5 rounded-lg text-secondary hover:text-on-surface sm";
    if(btnL) btnL.className = layoutType === "list" ? "p-1.5 rounded-lg bg-sc text-primary sm" : "p-1.5 rounded-lg text-secondary hover:text-on-surface sm";
}

function switchTab(type) {
    document.getElementById('tab-detailed')?.classList.toggle('active', type === 'detailed');
    document.getElementById('tab-short')?.classList.toggle('active', type === 'short');
    
    document.getElementById('mcrOut-detailed')?.classList.toggle('hidden', type !== 'detailed');
    document.getElementById('mcrOut-short')?.classList.toggle('hidden', type !== 'short');
}

function switchRptTab(type) {
    document.getElementById('rpt-tab-detailed')?.classList.toggle('active', type === 'detailed');
    document.getElementById('rpt-tab-short')?.classList.toggle('active', type === 'short');
    
    document.getElementById('rptMcr-detailed')?.classList.toggle('hidden', type !== 'detailed');
    document.getElementById('rptMcr-short')?.classList.toggle('hidden', type !== 'short');
}

function switchFsTab(type) {
    document.getElementById('fs-tab-detailed')?.classList.toggle('active', type === 'detailed');
    document.getElementById('fs-tab-short')?.classList.toggle('active', type === 'short');
    
    document.getElementById('fs-mcr-detailed')?.classList.toggle('hidden', type !== 'detailed');
    document.getElementById('fs-mcr-short')?.classList.toggle('hidden', type !== 'short');
}

function copyEditorMcr() {
    const isDetailed = document.getElementById('tab-detailed')?.classList.contains('active');
    const tabName = isDetailed ? 'detailed' : 'short';
    const textContent = document.getElementById('mcrOut-' + tabName)?.innerText || "";
    
    navigator.clipboard.writeText(textContent)
        .then(() => showToast("Format copied!", "s"))
        .catch(() => showToast("Copy failed.", "e"));
}

function copyRptMcr(type = 'detailed') {
    const textContent = document.getElementById('rptMcr-' + type)?.innerText || "";
    navigator.clipboard.writeText(textContent)
        .then(() => showToast("Format copied!", "s"))
        .catch(() => showToast("Copy failed.", "e"));
}

function copyFsMcr() {
    const isDetailed = document.getElementById('fs-tab-detailed')?.classList.contains('active');
    const tabName = isDetailed ? 'detailed' : 'short';
    const rawValue = document.getElementById('fs-mcr-raw-' + tabName)?.value || "";
    
    navigator.clipboard.writeText(rawValue)
        .then(() => showToast("Format copied!", "s"))
        .catch(() => showToast("Copy failed.", "e"));
}

// V13-pattern: isolate tickets nav from main nav to avoid error cascade
var _segNav = nav;
nav = function(viewId) {
  if (viewId === "tickets") {
    closeSidebar();
    document.getElementById("screen-login")?.classList.remove("on");
    document.getElementById("app-main")?.classList.add("on");
    document.querySelectorAll(".vp").forEach(function(v) { v.classList.remove("on", "enter"); });
    document.querySelectorAll(".nav-btn,.bn").forEach(function(b) { b.classList.remove("on"); });
    var tv = document.getElementById("vp-tickets"); if (tv) { tv.classList.add("on", "enter"); tv.style.display = "block"; }
    var nb = document.getElementById("nb-tickets"); if (nb) nb.classList.add("on");
    var nb2 = document.getElementById("bn-tickets"); if (nb2) nb2.classList.add("on");
    try { renderTicketsView(); } catch(e) { console.error("renderTicketsView error:", e); }
    loadTickets();
    return;
  }
  _segNav(viewId);
};
