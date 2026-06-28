// ============================================================================
// 7. DATABASE SYNCHRONIZATION
// ============================================================================

function flatData() {
    let result = [];
    for (const key in globalSegments) {
        result = result.concat(globalSegments[key].rows);
    }
    return result;
}

function grpAssets(filterYear = "All", filterMonth = "All") {
    let assets = {};
    
    for (const key in globalSegments) {
        const a = globalSegments[key];
        if (filterYear !== "All" && String(a.year) !== String(filterYear)) continue;
        
        let filteredRows = a.rows;
        if (filterMonth !== "All") {
            filteredRows = a.rows.filter(function(r) {
                const dateObj = new Date(cleanDateString(r[0]));
                if (isNaN(dateObj)) return false;
                return dateObj.toLocaleString("default", { month: "long" }) === filterMonth;
            });
        }
        if (!filteredRows.length) continue;
        
        var rowOwner = filteredRows[0][12] && String(filteredRows[0][12]).trim() !== "" ? String(filteredRows[0][12]).trim() : "Unknown";
        var meta = filteredRows[0][19] || {};
        var transfers = meta.transfers || [];
        // Build owner chain: creator + all transfer recipients
        var ownerChain = [rowOwner];
        for (var ti = 0; ti < transfers.length; ti++) {
            var t = transfers[ti];
            var tName = t.toName || (function(e){ var u=getUserInfo(e); return u?u.name:e.split('@')[0]; })(t.toEmail || "");
            if (tName && ownerChain.indexOf(tName) === -1) ownerChain.push(tName);
        }
        var allOwners = ownerChain.join(", ");
        var assetStatus = filteredRows[0] ? (filteredRows[0][13] || "In Progress") : "In Progress";
        var lockedBy = filteredRows[0] ? (filteredRows[0][17] || "") : "";
        assets[a.id] = { id: a.id, date: a.date, title: a.title, type: a.type, owner: rowOwner, ownerChain: ownerChain, allOwners: allOwners, status: assetStatus, lockedBy: lockedBy, rows: filteredRows };
    }
    
    var result = Object.values(assets);
    // Sort by date descending (most recent first)
    result.sort(function(a, b) {
        var da = a.date ? new Date(a.date) : new Date(0);
        var db = b.date ? new Date(b.date) : new Date(0);
        return db - da;
    });
    return result;
}

function buildFilters() {
    const years = new Set();
    const months = new Set();
    
    for (const key in globalSegments) {
        const a = globalSegments[key];
        if (a.year) years.add(String(a.year));
        a.rows.forEach(function(r) {
            const dateObj = new Date(cleanDateString(r[0]));
            if (!isNaN(dateObj)) months.add(dateObj.toLocaleString("default", { month: "long" }));
        });
    }
    
    const yearOptions = `<option value="All">All Years</option>` + [...years].sort().map(y => `<option value="${sanitizeHTML(y)}">${sanitizeHTML(y)}</option>`).join("");
    const monthOptions = `<option value="All">All Months</option>` + [...months].map(m => `<option value="${sanitizeHTML(m)}">${sanitizeHTML(m)}</option>`).join("");
    
    const dyr = document.getElementById("d-yr");
    const ayr = document.getElementById("a-yr");
    const dmo = document.getElementById("d-mo");
    const amo = document.getElementById("a-mo");
    
    if(dyr) dyr.innerHTML = yearOptions;
    if(ayr) ayr.innerHTML = yearOptions;
    const byr = document.getElementById("b-yr");
    if(byr) byr.innerHTML = yearOptions;
    if(dmo) dmo.innerHTML = monthOptions;
    if(amo) amo.innerHTML = monthOptions;
    const bmo = document.getElementById("b-mo");
    if(bmo) bmo.innerHTML = monthOptions;
}

function updateSug() {
    const sug = document.getElementById("sug");
    if(sug) sug.innerHTML = grpAssets().map(a => `<option value="${a.id} - ${a.title}">`).join("");
}

// ============================================================================
// 8. ASSET THUMBNAIL SYSTEM (Gradient-based, no external images)
// ============================================================================

function getShowCode(assetId) {
    if (!assetId || assetId.length < 6) return "GEN";
    return assetId.substring(3, 6).toUpperCase();
}

function getShowGradient(showCode) {
    let hash = 0;
    for (const char of showCode) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;

    const hue1 = hash % 360;
    const hue2 = (hash * 7 + 120) % 360;
    const sat1 = 55 + (hash % 30);
    const sat2 = 50 + ((hash >> 4) % 25);
    const light1 = 40 + (hash % 15);
    const light2 = 35 + ((hash >> 3) % 15);

    return `linear-gradient(135deg, hsl(${hue1},${sat1}%,${light1}%) 0%, hsl(${hue2},${sat2}%,${light2}%) 100%)`;
}

function assetThumbnail(assetId, title) {
    const showCode = getShowCode(assetId);
    const gradient = getShowGradient(showCode);
    return { gradient, code: showCode };
}

function applyAssetThumbnail(container, assetId, title) {
    if (!container) return;
    const { gradient, code } = assetThumbnail(assetId, title);
    container.style.background = gradient;
    const codeLabel = container.querySelector('.show-code-label');
    if (codeLabel) codeLabel.textContent = code;
}

// ============================================================================
// THUMBNAIL (Wikipedia image search)
// ============================================================================
window.thumbnailCache = {};

function normalizeShowName(title) {
    if (!title) return "";
    var t = title.trim();
    // Try splitting on common episode separators in order of priority
    var seps = [" — ", " – ", " - ", ": ", " #"];
    for (var si = 0; si < seps.length; si++) {
        var idx = t.indexOf(seps[si]);
        if (idx > 0) {
            var prefix = t.substring(0, idx).trim();
            // Only use prefix if it's reasonably long and the suffix looks like an episode detail
            if (prefix.length >= 3) return prefix;
        }
    }
    // For "Team vs. Team" format, extract team name (first team)
    var vsIdx = t.toLowerCase().indexOf(" vs.");
    if (vsIdx > 2) {
        var teamPrefix = t.substring(0, vsIdx).trim();
        if (teamPrefix.length >= 3) return teamPrefix;
    }
    return t;
}

// Thumbnail localStorage cache for fast loading
var THUMB_CACHE_KEY = "seg_thumb_cache";
var thumbCacheVersion = 1;

function loadThumbnailCache() {
    try {
        var raw = localStorage.getItem(THUMB_CACHE_KEY);
        if (raw) {
            var parsed = JSON.parse(raw);
            if (parsed && parsed.v === thumbCacheVersion && parsed.cache) {
                Object.assign(thumbnailCache, parsed.cache);
            }
        }
    } catch(e) { /* ignore */ }
}

function saveThumbnailCache() {
    try {
        localStorage.setItem(THUMB_CACHE_KEY, JSON.stringify({ v: thumbCacheVersion, cache: thumbnailCache }));
    } catch(e) { /* ignore */ }
}

async function loadThumbnails() {
    // Immediately populate from localStorage
    loadThumbnailCache();
    // Then fetch from DB to get any updates
    try {
        var { data } = await sb.from("asset_thumbnails").select("title,thumbnail_url");
        if (data) {
            var changed = false;
            data.forEach(function(t) {
                var key = t.title.toLowerCase();
                if (thumbnailCache[key] !== t.thumbnail_url) {
                    thumbnailCache[key] = t.thumbnail_url;
                    changed = true;
                }
            });
            if (changed) saveThumbnailCache();
        }
        refreshCurrentView();
    } catch(e) { console.warn("loadThumbnails error:", e); }
}

function getThumbnailUrl(title) {
    if (!title) return null;
    // Try exact title first, then normalized base name
    var key = title.toLowerCase();
    if (thumbnailCache[key]) return thumbnailCache[key];
    var norm = normalizeShowName(title).toLowerCase();
    return thumbnailCache[norm] || null;
}

function getThumbnailHtml(title, fallbackGradient, size) {
    if (!size) size = "full";
    var url = getThumbnailUrl(title);
    if (url) {
        var safeUrl = sanitizeHTML(url);
        if (size === "thumb") {
            return '<img src="' + safeUrl + '" class="w-14 h-9 rounded object-cover" alt="" loading="lazy" onerror="this.style.display=\'none\'">';
        }
        return '<img src="' + safeUrl + '" class="w-full h-full object-cover" alt="" loading="lazy" onerror="this.style.display=\'none\'">';
    }
    return '<div class="w-full h-full" style="background:' + (fallbackGradient || "linear-gradient(135deg,#667eea,#764ba2)") + '"></div>';
}

async function fetchThumbnailForTitle(title) {
    if (!title) return;
    var key = title.toLowerCase();
    var norm = normalizeShowName(title).toLowerCase();
    if (thumbnailCache[key] || thumbnailCache[norm]) return; // already cached
    
    try {
        var thumbnailSrc = null;
        
        // Use normalized name for API search (better results for base show)
        var searchTerm = norm || key;
        
        // Source 1: TVMaze (free, no key, great for TV shows)
        if (!thumbnailSrc) {
            var tvmUrl = "https://api.tvmaze.com/search/shows?q=" + encodeURIComponent(searchTerm);
            var tvmRes = await fetch(tvmUrl);
            var tvmData = await tvmRes.json();
            if (tvmData && tvmData.length > 0 && tvmData[0].show && tvmData[0].show.image) {
                thumbnailSrc = tvmData[0].show.image.medium || tvmData[0].show.image.original;
            }
        }
        
        // Source 3: Wikipedia (try multiple query variations)
        if (!thumbnailSrc) {
            var wikiQueries = [searchTerm, searchTerm + " TV series", searchTerm + " television show", searchTerm + " film"];
            for (var wqi2 = 0; wqi2 < wikiQueries.length && !thumbnailSrc; wqi2++) {
                var wikiSearch = "https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=" + encodeURIComponent(wikiQueries[wqi2]) + "&format=json&origin=*&srlimit=3";
                var wsRes = await fetch(wikiSearch);
                var wsData = await wsRes.json();
                var wsPages = wsData.query && wsData.query.search;
                if (wsPages && wsPages.length > 0) {
                    for (var wpi2 = 0; wpi2 < wsPages.length && !thumbnailSrc; wpi2++) {
                        var pageTitle = wsPages[wpi2].title;
                        var wikiImg = "https://en.wikipedia.org/w/api.php?action=query&titles=" + encodeURIComponent(pageTitle) + "&prop=pageimages&pithumbsize=300&format=json&origin=*";
                        var wiRes = await fetch(wikiImg);
                        var wiData = await wiRes.json();
                        var wiPages = wiData.query && wiData.query.pages;
                        if (wiPages) {
                            var firstKey = Object.keys(wiPages)[0];
                            if (firstKey !== "-1") {
                                thumbnailSrc = wiPages[firstKey].thumbnail && wiPages[firstKey].thumbnail.source;
                            }
                        }
                    }
                }
            }
        }
        
        // Source 4: DuckDuckGo Instant Answer (last resort)
        if (!thumbnailSrc) {
            var ddgUrl = "https://api.duckduckgo.com/?q=" + encodeURIComponent(searchTerm) + "&format=json&no_html=1&skip_disambig=1&t=segmentor_app";
            var ddgRes = await fetch(ddgUrl);
            var ddgData = await ddgRes.json();
            if (ddgData && ddgData.Image && ddgData.Image.indexOf("http") === 0) {
                thumbnailSrc = ddgData.Image;
            } else if (ddgData && ddgData.RelatedTopics) {
                for (var ri2 = 0; ri2 < ddgData.RelatedTopics.length && !thumbnailSrc; ri2++) {
                    var rt2 = ddgData.RelatedTopics[ri2];
                    if (rt2.Icon && rt2.Icon.URL && rt2.Icon.URL.indexOf("http") === 0) {
                        thumbnailSrc = rt2.Icon.URL;
                    } else if (rt2.Topics) {
                        for (var ti2 = 0; ti2 < rt2.Topics.length && !thumbnailSrc; ti2++) {
                            if (rt2.Topics[ti2].Icon && rt2.Topics[ti2].Icon.URL && rt2.Topics[ti2].Icon.URL.indexOf("http") === 0) {
                                thumbnailSrc = rt2.Topics[ti2].Icon.URL;
                            }
                        }
                    }
                }
            }
        }
        
        if (!thumbnailSrc) return;
        
        // Save to DB using normalized name as key
        var saveKey = norm;
        thumbnailCache[saveKey] = thumbnailSrc;
        // Also populate exact title key so lookups for this exact title work
        thumbnailCache[key] = thumbnailSrc;
        saveThumbnailCache();
        await sb.from("asset_thumbnails").upsert({ title: saveKey, thumbnail_url: thumbnailSrc }, { onConflict: "title" });
        
        // Update any visible UI that shows this thumbnail
        renderDash();
        renderAssets();
        // Update FSO thumbnail if open
        var fsThumbEl = document.getElementById("fs-title-gradient");
        if (fsThumbEl && document.getElementById("fso")?.classList.contains("on")) {
            var fsTitle = document.getElementById("fs-title")?.textContent || "";
            if (fsTitle.toLowerCase() === key) fsThumbEl.style.background = "url(" + thumbnailSrc + ") center/cover no-repeat";
        }
        // Update report thumbnail if visible
        var rptThumbEl = document.getElementById("rpt-thumb");
        if (rptThumbEl) {
            var rptTitleEl = document.getElementById("rptTitle");
            var rptTitle = rptTitleEl ? (rptTitleEl.textContent || "") : "";
            if (rptTitle.toLowerCase() === key) rptThumbEl.style.background = "url(" + thumbnailSrc + ") center/cover no-repeat";
        }
        // Update editor thumbnail if visible
        var edThumbEl = document.getElementById("editor-thumb");
        if (edThumbEl) {
            var edTitleEl = document.getElementById("metaTitle");
            var edTitle = edTitleEl ? (edTitleEl.value || "") : "";
            if (edTitle.toLowerCase() === key) {
                edThumbEl.style.background = "url(" + thumbnailSrc + ") center/cover no-repeat";
                edThumbEl.className = "";
                var edThumbRow = document.getElementById("editor-thumb-row");
                if (edThumbRow) edThumbRow.style.display = "block";
            }
        }
    } catch(e) {
        console.warn("fetchThumbnailForTitle error:", e);
    }
}

// ============================================================================
// 10. FULLSCREEN ASSET VIEWER
// ============================================================================

function openFso(assetId) {
    const targetAsset = grpAssets().find(a => a.id === assetId);
    if (!targetAsset) {
        showToast("Asset not found.", "e");
        return;
    }
    
    currentFullscreenAssetId = assetId;
    
    const fshGradient = document.getElementById("fs-title-gradient");
    if (fshGradient) {
        var fsThumbUrl = getThumbnailUrl(targetAsset.title);
        if (fsThumbUrl) {
            fshGradient.style.background = "url(" + fsThumbUrl + ") center/cover no-repeat";
        } else {
            const { gradient } = assetThumbnail(targetAsset.id, targetAsset.title);
            fshGradient.style.background = gradient;
        }
    }
    
    if (document.getElementById("fs-id")) document.getElementById("fs-id").textContent = targetAsset.id;
    if (document.getElementById("fs-title")) document.getElementById("fs-title").textContent = targetAsset.title;
    // Fetch thumbnail if not cached (fire-and-forget, UI updates when done)
    if (targetAsset.title && !getThumbnailUrl(targetAsset.title)) {
        fetchThumbnailForTitle(targetAsset.title);
    }
    
    const typeBadge = document.getElementById("fs-type");
    if (typeBadge) {
        const isLive = (targetAsset.type || "").toLowerCase() === "live";
        typeBadge.textContent = (targetAsset.type || "EVENT").toUpperCase();
        typeBadge.className = `px-3 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider font-mono ${isLive ? "bg-error text-white" : "bg-primary text-white border border-white/20 shadow-sm"}`;
    }
    
    // Owner + Status display
    var fsOwnerEl = document.getElementById("fs-owner-display");
    if (fsOwnerEl) fsOwnerEl.innerHTML = getUserAvatarHtml("", targetAsset.owner, 20) + ' <span>' + sanitizeHTML(targetAsset.owner) + '</span>';
    var fsStatusEl = document.getElementById("fs-status-badge");
    if (fsStatusEl) {
        var fsAssetStatus = targetAsset.status || "In Progress";
        fsStatusEl.textContent = fsAssetStatus;
        fsStatusEl.style.color = fsAssetStatus === "Ended" ? "var(--c-error)" : fsAssetStatus === "Handed Over" ? "#d97706" : "#2563eb";
    }
    var fsLockedEl = document.getElementById("fs-locked-display");
    var fsLockedByEmail = targetAsset.rows[0] ? (targetAsset.rows[0][17] || "") : "";
    if (fsLockedEl) {
        if (fsLockedByEmail) {
            var fsLockedInfo = getUserInfo(fsLockedByEmail);
            var fsLockedName = fsLockedInfo ? fsLockedInfo.name : fsLockedByEmail.split('@')[0];
            fsLockedEl.innerHTML = '<span class="ms" style="font-size:12px;color:var(--c-secondary)">lock</span> <span>by ' + sanitizeHTML(fsLockedName) + '</span>';
            fsLockedEl.style.display = "flex";
        } else {
            fsLockedEl.style.display = "none";
        }
    }
    
    var hoBy = targetAsset.rows[0] ? (targetAsset.rows[0][14] || "") : "";
    var hoTo = targetAsset.rows[0] ? (targetAsset.rows[0][15] || "") : "";
    var hoTime = targetAsset.rows[0] ? (targetAsset.rows[0][16] || "") : "";
    var metaFS = targetAsset.rows[0] ? (targetAsset.rows[0][19] || {}) : {};
    var transfersFS = metaFS.transfers || [];
    var hoBar = document.getElementById("fs-handover-bar");
    if (hoBar) {
        if (hoBy && hoTo) {
            document.getElementById("fs-handover-by").textContent = hoBy;
            document.getElementById("fs-handover-to").textContent = (function(e){ var u=getUserInfo(e); return u?u.name:e.split('@')[0]; })(hoTo);
            document.getElementById("fs-handover-time").textContent = fmtTimeIST(hoTime) || "";
            hoBar.style.display = "flex";
        } else {
            hoBar.style.display = "none";
        }
    }
    var fsTransferEl = document.getElementById("fs-transfer-history");
    var fsTransferList = document.getElementById("fs-transfer-list");
    if (fsTransferEl && fsTransferList) {
        if (transfersFS.length > 0) {
            var transferHtml = transfersFS.map(function(t, ti) {
                return (ti > 0 ? ' <span class="text-ov" style="margin:0 2px">&#8594;</span> ' : '') + '<span class="font-medium">' + sanitizeHTML(t.from || "") + '</span> <span class="text-ov">&#8594;</span> <span class="font-medium">' + sanitizeHTML(t.toName || t.toEmail || "") + '</span> <span class="font-mono text-secondary" style="font-size:10px">' + fmtTimeIST(t.at) + '</span>';
            }).join('');
            fsTransferList.innerHTML = transferHtml;
            fsTransferEl.style.display = "flex";
        } else {
            fsTransferEl.style.display = "none";
        }
    }
    
    let totalSeconds = 0;
    let totalGlitches = 0;
    let formattedSegmentsData = [];
    
    const tbody = document.getElementById("fs-grid");
    if (tbody) tbody.innerHTML = "";
    
    targetAsset.rows.forEach((row, i) => {
        const rowDuration = row[9] || "--";
        const isMainSegment = !/\d/.test(row[4]);
        
        let fdSecs = toSec(rowDuration);
        totalSeconds += fdSecs;
        
        let parsedGlitchArray = [];
        const rawGlitchData = row[7];
        
        if (rawGlitchData && rawGlitchData !== "-" && rawGlitchData !== "--") {
            const parts = rawGlitchData.split(" | ");
            parts.forEach(p => {
                let match = p.match(/(.+) \(([\d:]+)-([\d:]+)\)/);
                if (match) {
                    let typeStr = match[1].trim(), inStr = match[2], outStr = match[3];
                    parsedGlitchArray.push({
                        type: typeStr,
                        in: inStr,
                        out: outStr,
                        dur: Math.max(0, toSec(outStr) - toSec(inStr))
                    });
                }
            });
        }

        let glitchHtmlContent = "";
        if (parsedGlitchArray.length > 0) {
            totalGlitches += parsedGlitchArray.length;
            glitchHtmlContent = parsedGlitchArray.map(g => `<span class="inline-flex items-center gap-1.5 bg-ec text-error px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold shadow-sm border border-error/20 mb-1"><span class="ms" style="font-size:12px">warning</span>${sanitizeHTML(g.type)}</span>`).join(" ");
        } else {
            glitchHtmlContent = `<span class="text-secondary/40 text-[13px]">—</span>`;
        }
        
        formattedSegmentsData.push({
            seg: row[4],
            fd: fdSecs,
            glitches: parsedGlitchArray
        });

        if (tbody) {
            const tr = document.createElement("tr");
            tr.className = `border-b border-ov/20 sm au ${isMainSegment ? "hover:bg-sclo bg-scl" : "bg-sclo/80 hover:bg-sc"}`;
            tr.style.animationDelay = `${i * 25}ms`;
            
            tr.innerHTML = `
                <td class="p-4 text-center"><span class="${isMainSegment ? "bg-pf text-primary font-bold border border-primary/10 shadow-sm" : "bg-sc text-secondary"} px-3 py-1 rounded-lg text-[13px] font-mono">${sanitizeHTML(row[4])}</span></td>
                <td class="p-4 font-mono text-[14px] text-on-surface">${sanitizeHTML(cleanDateString(row[5]) || "—")}</td>
                <td class="p-4 font-mono text-[14px] text-on-surface">${sanitizeHTML(cleanDateString(row[6]) || "—")}</td>
                <td class="p-4 font-mono font-black text-primary text-[15px]">${sanitizeHTML(rowDuration)}</td>
                <td class="p-4">${glitchHtmlContent}</td>
                <td class="p-4 text-[13px] text-secondary max-w-[200px]">${sanitizeHTML((row[8] && row[8] !== "-") ? row[8] : "")}</td>
                <td class="p-4 text-[13px] font-mono text-secondary">${sanitizeHTML((cleanDateString(row[10]) && cleanDateString(row[10]) !== "-") ? cleanDateString(row[10]) : "")}</td>
            `;
            tbody.appendChild(tr);
        }
    });
    

    
    const detailedMcr = buildDetailedSlackReport(targetAsset.id, targetAsset.title, targetAsset.type || "EVENT", targetAsset.date, formattedSegmentsData, totalSeconds);
    const shortMcr = formattedSegmentsData.map(s => `${targetAsset.id}${s.seg} - ${tcStr(s.fd)}`).join("\n");
    
    if (document.getElementById("fs-mcr-detailed")) document.getElementById("fs-mcr-detailed").innerHTML = detailedMcr.replace(/\n/g, "<br>");
    if (document.getElementById("fs-mcr-short")) document.getElementById("fs-mcr-short").innerHTML = shortMcr.replace(/\n/g, "<br>");
    
    if (document.getElementById("fs-mcr-raw-detailed")) document.getElementById("fs-mcr-raw-detailed").value = detailedMcr;
    if (document.getElementById("fs-mcr-raw-short")) document.getElementById("fs-mcr-raw-short").value = shortMcr;
    
    document.getElementById("fso")?.classList.add("on");
    if (document.getElementById("fsb")) document.getElementById("fsb").scrollTop = 0;
}

function closeFso() {
    document.getElementById("fso")?.classList.remove("on");
    currentFullscreenAssetId = null;
}

function navFromFso(viewId) {
    const assetId = currentFullscreenAssetId;
    closeFso();
    if (viewId === 'editor' && assetId) {
        loadToEditor(assetId);
    } else if (viewId === 'report') {
        currentFullscreenAssetId = assetId; // preserve for report handler
        nav('editor');
        setTimeout(() => nav('report'), 100);
    }
}

async function performDeleteAsset(aid) {
    if (!await requireEdit()) { showToast("Viewers cannot delete assets.", "w"); return; }
    showGlobalLoader(true);
    var assetTitle = "";
    var assetData = grpAssets().find(function(a) { return a.id === aid; });
    if (assetData) assetTitle = assetData.title;

    sb.from("segments").select("locked_by,handover_to,status").eq("asset_id", aid).limit(1).then(function(r) {
        showGlobalLoader(false);
        if (r.error) { console.error("performDeleteAsset error:", r.error); showToast("Failed to delete asset.", "e"); return; }
        var row = r.data && r.data[0];
        if (!row) { showToast("Asset not found in database.", "e"); return; }
        var assetStatus = row.status || "In Progress";
        var lockedByRaw = row.locked_by || "";
        var hoToRaw = row.handover_to || "";
        var currentEmail = (currentUser.email || "").toLowerCase();
        if (assetStatus !== "Ended") {
            var ownerEmail = lockedByRaw || hoToRaw || "";
            if (ownerEmail && ownerEmail.toLowerCase() !== currentEmail) {
                showToast("This asset is currently held by another user. Only they can delete it.", "e");
                return;
            }
        }
        requestConfirmation("Delete Asset?", "This permanently deletes '" + aid + "' and all its segments. This cannot be undone.", function() {
            showGlobalLoader(true);
            sb.from("segments").delete().eq("asset_id", aid).then(function(r2) {
                showGlobalLoader(false);
                if (r2.error) { console.error("performDeleteAsset delete error:", r2.error); showToast("Failed to delete asset.", "e"); return; }
                showToast("Asset deleted: " + aid, "s");
                closeFso();
                loadAllSegments().then(function() {
                    if (assetTitle) {
                        var key = assetTitle.toLowerCase();
                        var otherWithSameTitle = Object.values(globalSegments).some(function(a) {
                            return a.title && a.title.toLowerCase() === key;
                        });
                        if (!otherWithSameTitle && thumbnailCache[key]) {
                            var thumbUrl = thumbnailCache[key];
                            var thumbFile = decodeURIComponent(thumbUrl.split("/").pop());
                            if (thumbFile.match(/^[a-zA-Z0-9_\-\.]+\.(png|jpg|jpeg|gif|webp|svg)$/i)) {
                                sb.from("asset_thumbnails").delete().eq("title", assetTitle).then(function() {});
                                sb.storage.from("thumbnails").remove([thumbFile]).then(function() {});
                                delete thumbnailCache[key];
                            }
                        }
                    }
                });
            });
        }, "Delete Asset", "delete");
    });
}

async function deleteAsset() {
    var aid = document.getElementById("fs-id")?.textContent.trim();
    if (!aid) { showToast("No asset selected.", "w"); return; }
    await performDeleteAsset(aid);
}
