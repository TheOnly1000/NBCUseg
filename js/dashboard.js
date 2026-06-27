// ============================================================================
// 9. UI RENDERING (Search, Dashboard, Assets)
// ============================================================================

function liveSearch(query) {
    const q = query.trim().toLowerCase();
    const resultsContainer = document.getElementById("search-results");
    if(!resultsContainer) return;
    
    searchResultsList = [];
    
    if (!q) {
        resultsContainer.innerHTML = `<div class="px-4 py-8 text-center text-sm text-secondary">Type to search assets…</div>`;
        return;
    }
    
    searchResultsList = grpAssets()
        .filter(a => a.id.toLowerCase().includes(q) || a.title.toLowerCase().includes(q) || (a.owner || "").toLowerCase().includes(q))
        .slice(0, 8);
        
    if (!searchResultsList.length) {
        resultsContainer.innerHTML = `<div class="px-4 py-8 text-center text-sm text-secondary">No assets found for "<strong>${sanitizeHTML(q)}</strong>"</div>`;
        return;
    }
    
    searchResultIndex = 0;
    resultsContainer.innerHTML = searchResultsList.map((asset, index) => {
        const isLive = (asset.type || "").toLowerCase() === "live";
        const activeClass = index === 0 ? "bg-pf text-primary" : "";
        const badgeClass = isLive ? "bg-error text-white" : "bg-sc text-secondary";
        
        return `
            <div class="search-result flex items-center gap-4 px-5 py-3 cursor-pointer rounded-xl mx-2 ${activeClass}" data-idx="${index}" onclick="selectSearchResult(${index})">
                <div class="w-12 h-8 rounded-md flex-shrink-0 border border-ov/30 flex items-center justify-center text-[10px] font-bold text-white font-mono" style="background:${assetThumbnail(asset.id,asset.title).gradient}">${getShowCode(asset.id)}</div>
                <div class="flex-1 min-w-0">
                    <div class="font-bold font-mono text-sm">${sanitizeHTML(asset.id)}</div>
                    <div class="text-xs truncate text-secondary">${sanitizeHTML(asset.title)}</div>
                </div>
                <span class="text-[10px] font-bold px-2 py-1 rounded font-mono uppercase ${badgeClass}">${sanitizeHTML(asset.type || "REC")}</span>
            </div>
        `;
    }).join("");
}

function qSearchKeys(event) {
    if (event.key === "ArrowDown") {
        event.preventDefault();
        searchResultIndex = Math.min(searchResultIndex + 1, searchResultsList.length - 1);
        highlightSearchResult();
    } else if (event.key === "ArrowUp") {
        event.preventDefault();
        searchResultIndex = Math.max(searchResultIndex - 1, 0);
        highlightSearchResult();
    } else if (event.key === "Enter") {
        event.preventDefault();
        selectSearchResult(searchResultIndex, event.shiftKey);
    }
}

function highlightSearchResult() {
    document.querySelectorAll(".search-result").forEach((el, index) => {
        if (index === searchResultIndex) {
            el.classList.add("bg-pf", "text-primary");
            el.scrollIntoView({ block: "nearest" });
        } else {
            el.classList.remove("bg-pf", "text-primary");
        }
    });
}

function selectSearchResult(index, viewOnly = false) {
    const selectedAsset = searchResultsList[index];
    if (!selectedAsset) return;
    closeModal("m-search");
    if (viewOnly) openFso(selectedAsset.id);
    else loadToEditor(selectedAsset.id);
}

function renderDash() {
    const selectedYear = document.getElementById("d-yr")?.value || "All";
    const selectedMonth = document.getElementById("d-mo")?.value || "All";
    const gridContainer = document.getElementById("dgrid");
    if(!gridContainer) return;
    
    gridContainer.innerHTML = "";
    const filteredAssets = grpAssets(selectedYear, selectedMonth);
    
    if (!filteredAssets.length) {
        gridContainer.innerHTML = `
            <div class="col-span-full flex flex-col items-center py-24 text-center au">
                <div class="w-20 h-20 rounded-2xl bg-sc flex items-center justify-center mb-5">
                    <span class="ms text-[40px] text-secondary">inventory_2</span>
                </div>
                <p class="font-bold text-[18px]">No assets found</p>
                <p class="text-secondary text-sm mt-2 max-w-sm">Sync the database or adjust your filters.</p>
                <button onclick="loadAllSegments()" class="btn-primary mt-6 flex items-center gap-2 text-sm ripple-host">
                    <span class="ms text-[16px]">sync</span>Sync Database
                </button>
            </div>
        `;
        return;
    }
    
    var countEl = document.getElementById("dash-count");
    if (countEl) countEl.textContent = filteredAssets.length + " total asset" + (filteredAssets.length !== 1 ? "s" : "");
    
    const showAll = gridContainer.dataset.showAll === "true";
    const displayAssets = showAll ? filteredAssets : filteredAssets.slice(0, 12);
    
    displayAssets.forEach((asset, i) => {
        const isLive = (asset.type || "").toLowerCase() === "live";
        const badgeStyle = isLive ? "bg-error text-white" : "bg-pf text-primary border border-primary/20";
        const hasGlitch = asset.rows.some(r => r[7] && r[7] !== "-" && r[7] !== "--");
        const totalDurationSecs = asset.rows.reduce((sum, r) => sum + toSec(r[9] || ""), 0);
        const { gradient, code } = assetThumbnail(asset.id, asset.title);
        var assetStatus = asset.rows[0] ? (asset.rows[0][13] || "In Progress") : "In Progress";
        var lockedByEmail = asset.rows[0] ? (asset.rows[0][17] || "") : "";
        var lockedUserInfo2 = lockedByEmail ? getUserInfo(lockedByEmail) : null;
        var lockedDisplayName = lockedUserInfo2 ? lockedUserInfo2.name : (lockedByEmail ? lockedByEmail.split('@')[0] : "");
        var statusBadgeHtml = "";
        if (assetStatus === "Ended") statusBadgeHtml = '<div class="absolute top-3 right-3 bg-ec text-error px-1.5 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-0.5 shadow-sm border border-error/20"><span class="ms" style="font-size:11px">stop</span>Ended</div>';
        else if (assetStatus === "Handed Over" || assetStatus === "Handover") statusBadgeHtml = '<div class="absolute top-3 right-3 bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-0.5 shadow-sm border border-amber-300"><span class="ms" style="font-size:11px">forward</span>Handover</div>';
        else if (assetStatus === "In Progress" && lockedDisplayName) statusBadgeHtml = '<div class="absolute top-3 right-3 bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-0.5 shadow-sm border border-blue-300"><span class="ms" style="font-size:11px">lock</span>' + sanitizeHTML(lockedDisplayName) + '</div>';
        else if (assetStatus === "In Progress") statusBadgeHtml = '<div class="absolute top-3 right-3 bg-green-100 text-green-700 px-1.5 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-0.5 shadow-sm border border-green-300"><span class="ms" style="font-size:11px">play_arrow</span>In Progress</div>';
        
        const cardEl = document.createElement("div");
        cardEl.className = "ac au ripple-host";
        cardEl.style.animationDelay = `${Math.min(i * 35, 350)}ms`;
        
        var thumbUrl = getThumbnailUrl(asset.title);
        var thumbBgStyle = thumbUrl ? "background:url(" + thumbUrl + ") center/cover no-repeat" : "background:" + gradient;
        cardEl.innerHTML = `
            <div class="ct h-[135px] relative overflow-hidden" style="${thumbBgStyle}">
                <div class="absolute inset-0" style="background:linear-gradient(180deg,rgba(0,0,0,.08) 0%,rgba(0,0,0,.75) 100%)"></div>
                <div class="absolute top-3 left-3 ${badgeStyle} px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider shadow-sm">${sanitizeHTML(asset.type || "EVENT")}</div>
                ${hasGlitch && assetStatus !== "Ended" && assetStatus !== "Handed Over" && assetStatus !== "Handover" ? `<div class="absolute top-3 right-3 bg-ec text-error px-1.5 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-0.5 shadow-sm border border-error/20"><span class="ms" style="font-size:11px">warning</span>Glitch</div>` : ""}
                ${statusBadgeHtml}
                <div class="absolute bottom-2.5 left-3 text-[18px] font-black text-white/40 font-mono tracking-widest">${code}</div>
                <div class="absolute bottom-2.5 right-3 text-[10px] font-mono" style="color:rgba(255,255,255,.7)">${fmtD(asset.date)}</div>
            </div>
            <div class="cb p-5 bg-scl">
                <div>
                    <h3 class="font-bold text-[15px] truncate text-on-surface mb-1">${sanitizeHTML(asset.title)}</h3>
                    <p class="text-[12px] font-mono text-secondary mb-4">${sanitizeHTML(asset.id)}</p>
                </div>
                <div class="flex justify-between items-center pt-3 mt-3 border-t border-ov/30 gap-2">
                    <div class="flex items-center min-w-0">
                        ${asset.ownerChain ? asset.ownerChain.map(function(oname, oi) {
                            var oinfo = getUserInfo(oname);
                            var oemail = oinfo ? oinfo.email : "";
                            return getUserAvatarHtml(oemail, oname, 22);
                        }).join('<span style="margin-left:-6px"></span>') : getUserAvatarHtml("", asset.owner, 24)}
                        <span class="truncate text-[13px] font-medium text-secondary" style="margin-left:6px">${sanitizeHTML(asset.allOwners || asset.owner)}</span>
                    </div>
                    <div class="flex items-center gap-2 flex-shrink-0 text-[12px] font-mono text-on-surface">
                        <span class="text-primary font-bold">${asset.rows.length}S</span> ${tcStr(totalDurationSecs)}
                    </div>
                </div>
            </div>
        `;
        
        cardEl._assetId = asset.id;
        if (assetStatus === "Ended") cardEl.classList.add("ended");
        cardEl.addEventListener("mousedown", triggerRipple);
        cardEl.onclick = () => openFso(asset.id);
        gridContainer.appendChild(cardEl);
    });
    
    if (filteredAssets.length > 12) {
        var toggleBtn = document.createElement("div");
        toggleBtn.className = "col-span-full flex justify-center mt-6";
        toggleBtn.innerHTML = '<button onclick="toggleDashShowAll()" class="btn-secondary flex items-center gap-2 text-sm px-6 py-2.5 rounded-xl ripple-host"><span class="ms text-[18px]">' + (showAll ? 'unfold_less' : 'unfold_more') + '</span>' + (showAll ? 'Show Less' : 'See All (' + filteredAssets.length + ' assets)') + '</button>';
        gridContainer.appendChild(toggleBtn);
    }
}

function toggleDashShowAll() {
    var grid = document.getElementById("dgrid");
    if (!grid) return;
    grid.dataset.showAll = grid.dataset.showAll === "true" ? "false" : "true";
    renderDash();
}

function renderAssets() {
    const selectedYear = document.getElementById("a-yr")?.value || "All";
    const selectedMonth = document.getElementById("a-mo")?.value || "All";
    const tbody = document.getElementById("atbody");
    if(!tbody) return;
    
    tbody.innerHTML = "";
    const filteredAssets = grpAssets(selectedYear, selectedMonth);
    
    if(document.getElementById("cat-cnt")) {
        document.getElementById("cat-cnt").textContent = `${filteredAssets.length} total media events.`;
    }
    
    if (!filteredAssets.length) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-10 text-center text-secondary font-bold text-[16px]">No assets match this filter.</td></tr>`;
        return;
    }
    
    filteredAssets.forEach((asset, i) => {
        const isLive = (asset.type || "").toLowerCase() === "live";
        const badgeHtml = isLive ? `<span class="px-2 py-1 bg-error text-white rounded-md text-[10px] font-bold font-mono uppercase">LIVE</span>` : `<span class="px-2 py-1 bg-pf text-primary rounded-md text-[10px] font-bold font-mono border border-primary/20">REC</span>`;
        const totalDurationSecs = asset.rows.reduce((sum, r) => sum + toSec(r[9] || ""), 0);
        const { gradient, code } = assetThumbnail(asset.id, asset.title);
        
        const tr = document.createElement("tr");
        tr.className = "hover:bg-sclo smooth group cursor-pointer au asset-row";
        tr.style.animationDelay = `${Math.min(i * 20, 200)}ms`;
        tr.dataset.assetId = asset.id;
        
        var tThumbUrl = getThumbnailUrl(asset.title);
        var tThumbStyle = tThumbUrl ? "background:url(" + tThumbUrl + ") center/cover no-repeat" : "background:" + gradient;
        tr.innerHTML = `
            <td class="py-4 px-2"><input type="checkbox" class="asset-select cursor-pointer" onchange="toggleAssetSelect('${asset.id}',this.checked)" onclick="event.stopPropagation()"></td>
            <td class="py-4 px-6"><div class="w-14 h-9 rounded-lg border border-ov/40 shadow-sm overflow-hidden relative flex items-center justify-center text-white font-bold text-[10px] font-mono" style="${tThumbStyle}">${tThumbUrl ? "" : code}</div></td>
            <td class="py-4 px-6">
                <div class="font-bold text-primary font-mono text-[15px]">${sanitizeHTML(asset.id)}</div>
                <div class="text-[13px] font-medium truncate max-w-[200px] mt-1 text-secondary">${sanitizeHTML(asset.title)}</div>
            </td>
            <td class="py-4 px-6 text-[13px] text-secondary font-mono">${fmtD(asset.date, {day:"2-digit", month:"short", year:"numeric"})}</td>
            <td class="py-4 px-6">
                ${badgeHtml}
                ${asset.status === "Ended" ? '<span class="ml-1 px-1.5 py-0.5 bg-ec text-error rounded text-[9px] font-bold font-mono">ENDED</span>' : asset.lockedBy ? '<span class="ml-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[9px] font-bold font-mono">LOCKED</span>' : ''}
            </td>
            <td class="py-4 px-6">
                <div class="flex items-center gap-1.5">
                    ${asset.ownerChain ? asset.ownerChain.map(function(oname, oi) {
                        var oinfo = getUserInfo(oname);
                        var oemail = oinfo ? oinfo.email : "";
                        return getUserAvatarHtml(oemail, oname, 24);
                    }).join('<span style="margin-left:-4px"></span>') : getUserAvatarHtml("", asset.owner, 24)}
                    <span class="text-[13px] text-secondary truncate max-w-[180px] font-medium" style="margin-left:4px">${sanitizeHTML(asset.allOwners || asset.owner)}</span>
                </div>
            </td>
            <td class="py-4 px-6 text-right">
                <div class="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 smooth">
                    <span class="text-[12px] font-mono text-on-surface font-bold mr-3 hidden sm:inline">${tcStr(totalDurationSecs)}</span>
                    <button onclick="event.stopPropagation(); openFso('${asset.id}')" class="w-9 h-9 rounded-xl text-secondary hover:text-primary hover:bg-sc flex items-center justify-center border border-transparent hover:border-ov/50 ripple-host" title="View Detail"><span class="ms text-[18px]">visibility</span></button>
                    <button onclick="event.stopPropagation(); loadToEditor('${asset.id}')" class="w-9 h-9 rounded-xl text-secondary hover:text-primary hover:bg-sc flex items-center justify-center border border-transparent hover:border-ov/50 ripple-host" title="Edit"><span class="ms text-[18px]">edit</span></button>
                </div>
            </td>
        `;
        
        tr.onclick = () => openFso(asset.id);
        tr.ondblclick = (function(aid, rowEl){
          return function(e){
            e.stopPropagation();
            var cb=rowEl.querySelector(".asset-select");
            if(cb){cb.checked=!cb.checked;toggleAssetSelect(aid,cb.checked);rowEl.style.background=cb.checked?"var(--c-pf)":"transparent"}
          }
        })(asset.id, tr);
        tbody.appendChild(tr);
    });
}
