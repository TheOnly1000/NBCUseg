// ============ EDITOR WORKING TIMER ============
var editorTimerData = {assetId: null, startTime: null, elapsed: {}, tickInterval: null};
function startEditorTimer(assetId) {
  if (!assetId) return;
  editorTimerData = {
    assetId: assetId,
    startTime: Date.now(),
    elapsed: {},
    tickInterval: null
  };
  // Also try to load working time from server metadata (handover continuity)
  try {
    var seg = globalSegments && globalSegments[assetId];
    if (seg && seg.rows && seg.rows[0] && seg.rows[0][19]) {
      var meta = seg.rows[0][19];
      if (meta.working_time) {
        for (var wtEmail in meta.working_time) {
          if (!editorTimerData.elapsed[wtEmail] || editorTimerData.elapsed[wtEmail] < meta.working_time[wtEmail]) {
            editorTimerData.elapsed[wtEmail] = meta.working_time[wtEmail];
          }
        }
      }
    }
  } catch(e) {}
  // Ensure current user has entry
  var curEmail = currentUser.email || "unknown";
  if (!editorTimerData.elapsed[curEmail]) editorTimerData.elapsed[curEmail] = 0;
  // Show and start ticker
  var el = document.getElementById("editor-timer");
  if (el) el.classList.remove("hidden");
  var userLabel = document.getElementById("editor-timer-user");
  if (userLabel) userLabel.textContent = currentUser.name || curEmail;
  if (editorTimerData.tickInterval) clearInterval(editorTimerData.tickInterval);
  editorTimerData.tickInterval = setInterval(function(){updateTimerDisplay()}, 1000);
  updateTimerDisplay();
}
function stopEditorTimer() {
  if (editorTimerData.tickInterval) { clearInterval(editorTimerData.tickInterval); editorTimerData.tickInterval = null; }
  updateElapsedTime();
  var el = document.getElementById("editor-timer");
  if (el) el.classList.add("hidden");
}
function pauseEditorTimer() {
  if (editorTimerData.tickInterval) { clearInterval(editorTimerData.tickInterval); editorTimerData.tickInterval = null; }
  updateElapsedTime();
}
function resumeEditorTimer() {
  if (editorTimerData.assetId) {
    editorTimerData.startTime = Date.now();
    if (editorTimerData.tickInterval) clearInterval(editorTimerData.tickInterval);
    editorTimerData.tickInterval = setInterval(function(){updateTimerDisplay()}, 1000);
    updateTimerDisplay();
  }
}
function updateElapsedTime() {
  if (editorTimerData.assetId && editorTimerData.startTime) {
    var curEmail = currentUser.email || "unknown";
    var added = Math.floor((Date.now() - editorTimerData.startTime) / 1000);
    if (!editorTimerData.elapsed[curEmail]) editorTimerData.elapsed[curEmail] = 0;
    editorTimerData.elapsed[curEmail] += added;
    editorTimerData.startTime = Date.now();
  }
}
function updateTimerDisplay() {
  var display = document.getElementById("editor-timer-display");
  if (!display) return;
  var curEmail = currentUser.email || "unknown";
  var base = editorTimerData.elapsed[curEmail] || 0;
  if (editorTimerData.startTime) base += Math.floor((Date.now() - editorTimerData.startTime) / 1000);
  var h = Math.floor(base / 3600);
  var m = Math.floor((base % 3600) / 60);
  var s = base % 60;
  display.textContent = (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
}
function getWorkingTimeSummary() {
  updateElapsedTime();
  return editorTimerData.elapsed || {};
}
function getWorkingTimeTotal() {
  var e = getWorkingTimeSummary();
  var total = 0;
  for (var k in e) total += e[k];
  return total;
}
// ============================================================================
// 12. TIMECODE MATH & TIMEZONE ENGINE
// ============================================================================

function fmtIn(element, isCsv = false) {
    if(!element) return;
    if (!isCsv) {
        const rawNums = element.value.replace(/\D/g, "");
        let formatted = "";
        for (let i = 0; i < rawNums.length; i++) {
            if (i === 2 || i === 4) formatted += ":";
            formatted += rawNums[i];
        }
        element.value = formatted.substring(0, 8);
    } else {
        const commaChunks = element.value.replace(/[^0-9,]/g, "").split(",");
        element.value = commaChunks.map(chunk => {
            const rawNums = chunk.replace(/\D/g, "");
            let formatted = "";
            for (let i = 0; i < rawNums.length; i++) {
                if (i === 2 || i === 4) formatted += ":";
                formatted += rawNums[i];
            }
            return formatted.substring(0, 8);
        }).join(", ");
    }
    calcGrid();
    markUnsaved();
}

function convertISTtoEDT(timeStr, dateStr) {
    if (!timeStr || timeStr === "-" || timeStr === "--") return timeStr;
    const parts = timeStr.split(':');
    if (parts.length < 2) return timeStr;
    
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const s = parts.length > 2 ? parseInt(parts[2], 10) : 0;
    
    if (isNaN(h) || isNaN(m)) return timeStr;
    
    let targetDate = new Date(dateStr);
    if (isNaN(targetDate)) targetDate = new Date(); 
    
    // IST is UTC + 5:30. Subtract 5 hours and 30 minutes to get to UTC
    targetDate.setUTCHours(h - 5, m - 30, s, 0);
    
    const formatOptions = { 
        timeZone: 'America/New_York', 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit', 
        hour12: false, 
        timeZoneName: 'short' 
    };
    
    try {
        return new Intl.DateTimeFormat('en-US', formatOptions).format(targetDate);
    } catch(err) {
        return timeStr + " EST";
    }
}

// ============================================================================
// 13. UNLIMITED GLITCHES ENGINE
// ============================================================================

function openGlitchModal(segName) {
    currentActiveGlitchSegment = segName;
    const lbl = document.getElementById("glitch-modal-seg");
    if(lbl) lbl.textContent = segName;
    
    if (!segmentGlitches[segName]) {
        segmentGlitches[segName] = [];
    }
    
    const tbody = document.getElementById("glitch-modal-tbody");
    if(tbody) {
        tbody.innerHTML = "";
        
        if (segmentGlitches[segName].length === 0) {
            addGlitchRowToModal(); 
        } else {
            segmentGlitches[segName].forEach(g => addGlitchRowToModal(g));
        }
    }
    
    openModal("m-glitches");
}

function addGlitchRowToModal(glitchObj = { type: "None", in: "", out: "" }) {
    const tbody = document.getElementById("glitch-modal-tbody");
    if(!tbody) return;
    
    const tr = document.createElement("tr");
    tr.className = "hover:bg-sclo smooth";
    
    tr.innerHTML = `
        <td class="p-2"><select class="gi g-type">${GLITCH_OPTIONS_HTML}</select></td>
        <td class="p-2"><input type="text" class="gi g-in font-mono text-center" placeholder="IN" value="${glitchObj.in}" oninput="fmtIn(this)"></td>
        <td class="p-2"><input type="text" class="gi g-out font-mono text-center" placeholder="OUT" value="${glitchObj.out}" oninput="fmtIn(this)"></td>
        <td class="p-2 text-center text-error font-bold font-mono g-dur">--</td>
        <td class="p-2 text-center"><button onclick="this.closest('tr').remove()" class="text-outline hover:text-error sm"><span class="ms text-[17px]">delete</span></button></td>
    `;
    
    const typeSelect = tr.querySelector('.g-type');
    if(typeSelect) typeSelect.value = glitchObj.type || "None";
    
    tr.querySelectorAll('input, select').forEach(el => {
        el.addEventListener('input', () => {
            const inVal = tr.querySelector('.g-in')?.value || "";
            const outVal = tr.querySelector('.g-out')?.value || "";
            const typeVal = tr.querySelector('.g-type')?.value || "None";
            const durLabel = tr.querySelector('.g-dur');
            
            if(durLabel) {
                if (inVal.length === 8 && outVal.length === 8 && typeVal !== "None") {
                    durLabel.textContent = tcStr(Math.max(0, toSec(outVal) - toSec(inVal)));
                } else {
                    durLabel.textContent = "--";
                }
            }
        });
    });
    
    tbody.appendChild(tr);
    
    if (glitchObj.in) {
        tr.querySelector('.g-in')?.dispatchEvent(new Event('input'));
    }
}

function addGlitchRow() {
    addGlitchRowToModal();
}

function saveGlitchModal() {
    if (!currentActiveGlitchSegment) return;
    
    const rows = document.querySelectorAll("#glitch-modal-tbody tr");
    let mappedGlitches = [];
    
    rows.forEach(r => {
        const tVal = r.querySelector('.g-type')?.value;
        const inVal = r.querySelector('.g-in')?.value;
        const outVal = r.querySelector('.g-out')?.value;
        
        if (tVal && tVal !== "None" && inVal && outVal) {
            let durationSeconds = Math.max(0, toSec(outVal) - toSec(inVal));
            mappedGlitches.push({ type: tVal, in: inVal, out: outVal, dur: durationSeconds });
        }
    });
    
    segmentGlitches[currentActiveGlitchSegment] = mappedGlitches;
    closeModal("m-glitches");
    calcGrid();
    markUnsaved();
    showToast(`Glitches saved for Segment ${currentActiveGlitchSegment}`, "s");
}

function formatGlitchesForSheet(segId) {
    const glts = segmentGlitches[segId] || [];
    if (glts.length === 0) return "-";
    return glts.map(g => `${g.type} (${g.in}-${g.out})`).join(" | ");
}

function parseGlitchesFromSheet(segId, rawString) {
    segmentGlitches[segId] = [];
    if (!rawString || rawString === "-" || rawString === "--") return;
    
    const parts = rawString.split(" | ");
    parts.forEach(p => {
        let match = p.match(/(.+) \(([\d:]+)-([\d:]+)\)/);
        if (match) {
            let typeStr = match[1].trim();
            let inStr = match[2];
            let outStr = match[3];
            let durationSecs = Math.max(0, toSec(outStr) - toSec(inStr));
            segmentGlitches[segId].push({ type: typeStr, in: inStr, out: outStr, dur: durationSecs });
        }
    });
}

// ============================================================================
// 14. SMART SUBSEGMENTS & DRAG/DROP
// ============================================================================

function nextSeg(isSubsegment = false) {
    if (!timelineSegments.length) return "A";
    
    if (isSubsegment) {
        const lastSeg = timelineSegments[timelineSegments.length - 1];
        const prefix = lastSeg.replace(/[0-9]/g, "");
        const numStr = lastSeg.replace(prefix, "");
        const num = parseInt(numStr) || 0;
        
        if (num === 0) {
            renameDOMRow(lastSeg, prefix + "1");
            timelineSegments[timelineSegments.length - 1] = prefix + "1";
            return prefix + "2";
        } else {
            return prefix + (num + 1);
        }
    }
    
    const chars = timelineSegments[timelineSegments.length - 1].replace(/[0-9]/g, "").split("");
    for (let i = chars.length - 1; i >= 0; i--) {
        if (chars[i] === "Z") {
            chars[i] = "A";
            if (i === 0) return "A" + chars.join("");
        } else {
            chars[i] = String.fromCharCode(chars[i].charCodeAt(0) + 1);
            return chars.join("");
        }
    }
}

function renameDOMRow(oldName, newName) {
    let rowEl = document.querySelector(`.segment-row[data-seg="${oldName}"]`);
    if (rowEl) {
        rowEl.setAttribute('data-seg', newName);
        let badgeEl = rowEl.querySelector('td:nth-child(2) span');
        let tdEl = rowEl.querySelector('td:nth-child(2)');
        
        if (badgeEl) badgeEl.innerText = newName;
        
        let isSub = /\d/.test(newName);
        if (isSub) {
            if(tdEl) tdEl.className = "py-2.5 pl-8";
            if(badgeEl) badgeEl.className = "bg-sc text-secondary text-[11px] px-2.5 py-1 rounded-md font-mono";
        } else {
            if(tdEl) tdEl.className = "py-2.5 pl-4";
            if(badgeEl) badgeEl.className = "bg-pf text-primary font-bold text-[12px] shadow-sm px-2.5 py-1 rounded-md font-mono border border-primary/10";
        }
        
        let glitchBtn = rowEl.querySelector('button[onclick^="openGlitchModal"]');
        if (glitchBtn) glitchBtn.setAttribute("onclick", `openGlitchModal('${newName}')`);
        
        let delBtn = rowEl.querySelector('button[onclick^="askDelSeg"]');
        if (delBtn) delBtn.setAttribute("onclick", `askDelSeg(this,'${newName}')`);
        
        // Transfer glitches
        if (segmentGlitches[oldName]) {
            segmentGlitches[newName] = segmentGlitches[oldName];
            delete segmentGlitches[oldName];
        }
    }
}

function normalizeSegments() {
    let groups = {};
    let requiresUpdate = false;
    
    timelineSegments.forEach(s => {
        let prefix = s.replace(/[0-9]/g, '');
        if (!groups[prefix]) groups[prefix] = [];
        groups[prefix].push(s);
    });
    
    let normalizedArray = [];
    
    for (let prefix in groups) {
        let members = groups[prefix];
        
        if (members.length === 1) {
            let oldName = members[0];
            if (oldName !== prefix) {
                renameDOMRow(oldName, prefix);
                requiresUpdate = true;
            }
            normalizedArray.push(prefix);
        } else {
            members.forEach((oldName, idx) => {
                let newName = prefix + (idx + 1);
                if (oldName !== newName) {
                    renameDOMRow(oldName, newName);
                    requiresUpdate = true;
                }
                normalizedArray.push(newName);
            });
        }
    }
    
    timelineSegments = normalizedArray;
    
    if (requiresUpdate) {
        calcGrid();
        markUnsaved();
    }
}

function onDragStart(event, row) {
    dragSourceElement = row;
    row.classList.add("dragging");
    event.dataTransfer.effectAllowed = "move";
}

function onDragOver(event, row) {
    event.preventDefault();
    if (row === dragSourceElement) return;
    document.querySelectorAll(".drag-over").forEach(r => r.classList.remove("drag-over"));
    row.classList.add("drag-over");
}

function onDrop(event, row) {
    event.preventDefault();
    if (row === dragSourceElement) return;
    const grid = document.getElementById("segmentGrid");
    if(grid) grid.insertBefore(dragSourceElement, row);
    
    timelineSegments = [...document.querySelectorAll(".segment-row")].map(r => r.getAttribute("data-seg"));
    normalizeSegments();
}

function onDragEnd(event, row) {
    row.classList.remove("dragging");
    document.querySelectorAll(".drag-over").forEach(r => r.classList.remove("drag-over"));
    dragSourceElement = null;
}

// ============================================================================
// 15. EDITOR ROWS (ADD/DELETE)
// ============================================================================

function mkRow(segName, isSub, vals = {}) {
    const padClass = isSub ? "pl-8" : "pl-4";
    const badgeClass = isSub ? "bg-sc text-secondary text-[11px]" : "bg-pf text-primary font-bold text-[12px] shadow-sm border border-primary/10";
    
    return `
    <tr class="border-b border-ov/20 hover:bg-sclo/80 segment-row group sm seg-enter" data-seg="${segName}" draggable="true" ondragstart="onDragStart(event,this)" ondragover="onDragOver(event,this)" ondrop="onDrop(event,this)" ondragend="onDragEnd(event,this)">
        <td class="py-2 pl-2 pr-1 w-6 text-center">
            <span class="ms text-[15px] drag-handle text-secondary cursor-grab">drag_indicator</span>
        </td>
        <td class="py-2.5 ${padClass}">
            <span class="${badgeClass} px-2.5 py-1 rounded-md font-mono">${segName}</span>
        </td>
        <td class="p-3"><input type="text" class="tc-in gi placeholder:text-ov/50" value="${sanitizeHTML(vals.in || "")}" placeholder="HH:MM:SS" oninput="fmtIn(this)"></td>
        <td class="p-3"><input type="text" class="tc-out gi placeholder:text-ov/50" value="${sanitizeHTML(vals.out || "")}" placeholder="HH:MM:SS" oninput="fmtIn(this)"></td>
        <td class="p-3">
            <button onclick="openGlitchModal('${segName}')" class="w-full btn-secondary py-1.5 px-3 text-[11px] flex items-center justify-center gap-1 ripple-host">
                <span class="ms text-[14px]">build</span> <span class="g-summary font-mono">Manage Glitches</span>
            </button>
        </td>
        <td class="p-3 text-center font-mono font-bold text-error tc-g-dur text-[13.5px]">--</td>
        <td class="p-3"><input type="text" class="tc-breaks gi text-[11px] font-mono placeholder:text-ov/50" value="${sanitizeHTML(vals.breaks || "")}" placeholder="HH:MM:SS" oninput="fmtIn(this,true)"></td>
        <td class="p-3"><input type="text" class="tc-comments gi text-[12.5px] placeholder:text-ov/50" value="${sanitizeHTML(vals.cmts || "")}" placeholder="Note..." oninput="markUnsaved()"></td>
        <td class="p-3 text-right font-mono text-primary font-black tc-duration text-[15px]">--</td>
        <td class="p-3 text-center">
            <button onclick="askDelSeg(this,'${segName}')" class="w-8 h-8 rounded-lg flex items-center justify-center text-ov hover:text-error opacity-0 group-hover:opacity-100 sm hover:bg-ec border border-transparent hover:border-error/20">
                <span class="ms text-[17px]">delete</span>
            </button>
        </td>
    </tr>`;
}

function addSeg() {
    const newName = nextSeg(false);
    timelineSegments.push(newName);
    segmentGlitches[newName] = [];
    const grid = document.getElementById("segmentGrid");
    if(grid) grid.insertAdjacentHTML("beforeend", mkRow(newName, false));
    updateSegCount();
    calcGrid();
    markUnsaved();
}

function addSubSeg() {
    if (!timelineSegments.length) {
        showToast("Add a main segment first.", "w");
        return;
    }
    const newName = nextSeg(true);
    timelineSegments.push(newName);
    segmentGlitches[newName] = [];
    const grid = document.getElementById("segmentGrid");
    if(grid) grid.insertAdjacentHTML("beforeend", mkRow(newName, true));
    updateSegCount();
    calcGrid();
    markUnsaved();
}

function askDelSeg(buttonEl, segName) {
    const rowEl = buttonEl.closest("tr");
    if(!rowEl) return;
    
    // Push deep copy of glitch data to stack for undo
    undoStack.push({
        nm: segName,
        html: rowEl.outerHTML,
        idx: [...rowEl.parentElement.children].indexOf(rowEl),
        glts: JSON.parse(JSON.stringify(segmentGlitches[segName] || []))
    });
    
    rowEl.style.opacity = "0";
    rowEl.style.transform = "translateX(8px)";
    rowEl.style.transition = "all .25s";
    
    setTimeout(() => {
        rowEl.remove();
        timelineSegments = timelineSegments.filter(s => s !== segName);
        delete segmentGlitches[segName];
        normalizeSegments();
        updateSegCount();
        calcGrid();
        markUnsaved();
    }, 220);
    
    showToast(`Segment ${segName} deleted`, "i", 4000, { label: "Undo", fn: "undoLastDelete" });
    
    setTimeout(() => {
        undoStack = undoStack.filter(u => u.nm !== segName);
    }, 5000);
}

function undoLastDelete() {
    const lastDel = undoStack.pop();
    if (!lastDel) {
        showToast("Nothing to undo.", "i");
        return;
    }
    
    const gridEl = document.getElementById("segmentGrid");
    if(!gridEl) return;
    
    const childRows = [...gridEl.children];
    
    if (lastDel.idx >= childRows.length) {
        gridEl.insertAdjacentHTML("beforeend", lastDel.html);
    } else {
        childRows[lastDel.idx].insertAdjacentHTML("beforebegin", lastDel.html);
    }
    
    timelineSegments.splice(lastDel.idx, 0, lastDel.nm);
    segmentGlitches[lastDel.nm] = lastDel.glts;
    
    normalizeSegments();
    updateSegCount();
    calcGrid();
    markUnsaved();
    
    showToast(`Restored ${lastDel.nm}.`, "s");
}

function clearEditor() {
    requestConfirmation("Clear all segments?", "This will remove all segments from the timeline. Metadata will be preserved.", () => {
        const grid = document.getElementById("segmentGrid");
        if(grid) grid.innerHTML = "";
        timelineSegments = [];
        segmentGlitches = {};
        const badge = document.getElementById("seg-count-badge");
        if(badge) badge.textContent = "0 segments";
        calcGrid();
        markUnsaved();
        showToast("Editor cleared.", "i");
    }, "Clear All", "delete_sweep");
}

function updateSegCount() {
    const grid = document.getElementById("segmentGrid");
    const count = grid ? grid.children.length : 0;
    const badge = document.getElementById("seg-count-badge");
    if(badge) badge.textContent = `${count} segments`;
}

// ============================================================================
// 16. EDITOR CALCULATIONS & REPORT GENERATION
// ============================================================================

function buildDetailedSlackReport(assetId, title, type, dateStr, parsedSegsData, totalSecs) {
    let logString = `Hi Team,\n\n${assetId}\n:: ${title}\n[EVENT TYPE: ${type}]\nAll segments are uploaded in the UI.\n■ SEGMENT LOG\n`;
    let recordedAnomalies = [];
    
    parsedSegsData.forEach(s => {
        logString += `${s.seg}: ~${tcStr(s.fd)} | [ UPLOADED ]\n`;
        
        if (s.glitches && s.glitches.length > 0) {
            s.glitches.forEach(g => {
                let tzIn = convertISTtoEDT(g.in, dateStr);
                let tzOut = convertISTtoEDT(g.out, dateStr);
                
                let timeInFmt = tzIn.match(/(\d{2}:\d{2}:\d{2})/) ? tzIn.match(/(\d{2}:\d{2}:\d{2})/)[1] : g.in;
                let timeOutFmt = tzOut.match(/(\d{2}:\d{2}:\d{2})/) ? tzOut.match(/(\d{2}:\d{2}:\d{2})/)[1] : g.out;
                let tzCode = tzIn.match(/([A-Z]{3,4})/) ? tzIn.match(/([A-Z]{3,4})/)[0] : "EDT";
                
                recordedAnomalies.push(`SEGMENT ${s.seg}\nIssue: ${g.type}\nTime: from ${timeInFmt} to ${timeOutFmt} ${tzCode}\nDuration: ${g.dur} seconds\nAction: [ REMOVED ]`);
            });
        }
    });
    
    if (recordedAnomalies.length > 0) {
        logString += `\n▼ TECHNICAL ANOMALIES\n` + recordedAnomalies.join('\n\n') + `\n`;
    }
    
    let totalMins = (totalSecs / 60).toFixed(2);
    let minsFloor = Math.floor(totalSecs / 60);
    let secsRem = totalSecs % 60;
    
    logString += `\n◆ RUNTIME METRICS\nFinal Output (HH:MM:SS): ~${tcStr(totalSecs)}\nDecimal Runtime: ~${totalMins} Minutes (${minsFloor} minutes and ${secsRem} seconds)`;
    
    return logString;
}

function calcGrid() {
    try {
        const assetId = document.getElementById("metaAssetId")?.value || "ASSET";
        const title = document.getElementById("metaTitle")?.value || "Title";
        const type = document.getElementById("metaType")?.value || "Record";
        const dateStr = document.getElementById("metaDate")?.value || "";
        
        const rows = document.querySelectorAll(".segment-row");
        let totalDuration = 0;
        let countMainSegs = 0;
        let parsedSegsData = [];
        let totalGlitchesDetected = 0;
        
        const rptGlitchTableBody = document.getElementById("rptGlitchTbody");
        if (rptGlitchTableBody) rptGlitchTableBody.innerHTML = "";

        rows.forEach(row => {
            const segName = row.getAttribute("data-seg"); 
            if (!/\d/.test(segName)) countMainSegs++;
            
            const timeIn = row.querySelector(".tc-in")?.value || "";
            const timeOut = row.querySelector(".tc-out")?.value || "";
            
            let glts = segmentGlitches[segName] || [];
            let totalGlitchDur = 0;
            
            glts.forEach(g => { 
                totalGlitchDur += g.dur; 
                totalGlitchesDetected++;
                
                if (rptGlitchTableBody) {
                    let edtIn = convertISTtoEDT(g.in, dateStr);
                    let edtOut = convertISTtoEDT(g.out, dateStr);
                    
                    rptGlitchTableBody.innerHTML += `
                        <tr class="hover:bg-sclo smooth border-b border-ov/20">
                            <td class="p-3 pl-5 font-bold text-primary">${segName}</td>
                            <td class="p-3 text-on-surface">${g.type}</td>
                            <td class="p-3 font-mono text-on-surface">${edtIn}</td>
                            <td class="p-3 font-mono text-on-surface">${edtOut}</td>
                            <td class="p-3 font-bold text-error font-mono">${g.dur}s</td>
                        </tr>
                    `;
                }
            });
            
            const btnGlitchSummary = row.querySelector(".g-summary");
            const tcGDur = row.querySelector(".tc-g-dur");
            
            if (glts.length > 0) {
                if(tcGDur) tcGDur.textContent = tcStr(totalGlitchDur);
                if(btnGlitchSummary) btnGlitchSummary.innerHTML = `<span class="text-error font-bold">${glts.length} Glitch${glts.length > 1 ? 'es' : ''}</span>`;
            } else { 
                if(tcGDur) tcGDur.textContent = "--"; 
                if(btnGlitchSummary) btnGlitchSummary.innerText = "Manage Glitches"; 
            }
            
            let finalDur = 0;
            const tcDuration = row.querySelector(".tc-duration");
            if (timeIn.length === 8 && timeOut.length === 8) {
                var rawDiff = toSec(timeOut) - toSec(timeIn);
                if (rawDiff <= 0) rawDiff += 86400;
                finalDur = Math.max(0, rawDiff - totalGlitchDur);
                totalDuration += finalDur; 
                if(tcDuration) tcDuration.textContent = tcStr(finalDur); 
            } else { 
                if(tcDuration) tcDuration.textContent = "--"; 
            }
            
            parsedSegsData.push({ seg: segName, fd: finalDur, glitches: glts });
        });
        
        const rptGltCount = document.getElementById("rptGlitchCount");
        if (rptGltCount) {
            rptGltCount.textContent = `${totalGlitchesDetected} Glitches`;
            if (totalGlitchesDetected === 0 && rptGlitchTableBody) {
                rptGlitchTableBody.innerHTML = `<tr><td colspan="5" class="p-5 text-center text-secondary font-medium">No glitches detected.</td></tr>`;
            }
        }
        
        const detailedMcrStr = buildDetailedSlackReport(assetId, title, type, dateStr, parsedSegsData, totalDuration);
        const shortMcrStr = parsedSegsData.map(s => `${assetId}${s.seg} - ${tcStr(s.fd)}`).join("\n");

        const edDet = document.getElementById("mcrOut-detailed");
        const edSht = document.getElementById("mcrOut-short");
        if (edDet) edDet.innerHTML = detailedMcrStr.replace(/\n/g, "<br>");
        if (edSht) edSht.innerHTML = shortMcrStr.replace(/\n/g, "<br>");
        
        const rptDet = document.getElementById("rptMcr-detailed");
        const rptSht = document.getElementById("rptMcr-short");
        if (rptDet) rptDet.innerHTML = detailedMcrStr.replace(/\n/g, "<br>");
        if (rptSht) rptSht.innerHTML = shortMcrStr.replace(/\n/g, "<br>");

        const sumActDur = document.getElementById("sumActDur");
        if(sumActDur) sumActDur.textContent = tcStr(totalDuration);
        calcSummary(totalDuration, countMainSegs);
    } catch(err) {
        console.error("Calculation Error:", err);
    }
}

function calcSummary(actualSeconds = 0, loggedSegmentsCount = 0) {
    const expStr = document.getElementById("metaExpDur")?.value || "00:30:00";
    const expectedSegments = parseInt(document.getElementById("metaExpSeg")?.value) || 0;
    
    if(document.getElementById("sumExpDur")) document.getElementById("sumExpDur").textContent = expStr;
    
    const expSeconds = toSec(expStr);
    const remSeconds = expSeconds - actualSeconds;
    const remSegments = expectedSegments - loggedSegmentsCount;
    
    const idealEl = document.getElementById("idealSeg");
    const mathEl = document.getElementById("sumSegMath");
    
    const statusIcon = document.getElementById("rptStatusIcon");
    const statusTxt = document.getElementById("rptStatusText");
    const statusSub = document.getElementById("rptStatusSub");
    const statusPanel = document.getElementById("rptStatusPanel");

    if(!idealEl || !mathEl) return;

    if (remSegments > 0) {
        idealEl.textContent = tcStr(remSeconds > 0 ? remSeconds / remSegments : 0);
        idealEl.style.color = "var(--c-primary)";
        mathEl.textContent = `${remSegments} segments remaining`;
        
        if (statusPanel) {
            if(statusIcon) { statusIcon.textContent = "schedule"; statusIcon.style.color = "#d97706"; }
            if(statusTxt) { statusTxt.textContent = "Under Expected Time"; statusTxt.style.color = "#b45309"; }
            if(statusSub) { statusSub.textContent = `${remSegments} segments remaining. Target: ${tcStr(remSeconds)}.`; statusSub.style.color = "#b45309"; }
            statusPanel.style.background = "#fffbeb"; 
            statusPanel.style.borderColor = "#fde68a";
        }
    } else if (remSegments === 0) {
        idealEl.textContent = "DONE ✓"; 
        idealEl.style.color = "#16a34a"; 
        mathEl.textContent = "All segments complete";
        
        if (statusPanel) {
            if(statusIcon) { statusIcon.textContent = "verified_user"; statusIcon.style.color = "#16a34a"; }
            if(statusTxt) { statusTxt.textContent = "Perfect Duration"; statusTxt.style.color = "#166534"; }
            if(statusSub) { statusSub.textContent = "Timeline exactly matches expected segment count."; statusSub.style.color = "#15803d"; }
            statusPanel.style.background = "#f0fdf4"; 
            statusPanel.style.borderColor = "#bbf7d0";
        }
    } else {
        idealEl.textContent = "OVER LIMIT!"; 
        idealEl.style.color = "var(--c-error)"; 
        mathEl.textContent = `${Math.abs(remSegments)} segments over limit`;
        
        if (statusPanel) {
            if(statusIcon) { statusIcon.textContent = "error"; statusIcon.style.color = "var(--c-error)"; }
            if(statusTxt) { statusTxt.textContent = "Overtime Alert"; statusTxt.style.color = "var(--c-oec)"; }
            if(statusSub) { statusSub.textContent = `You are ${Math.abs(remSegments)} segments over expected duration.`; statusSub.style.color = "var(--c-error)"; }
            statusPanel.style.background = "var(--c-ec)"; 
            statusPanel.style.borderColor = "var(--c-oec)";
        }
    }
}

// ============================================================================
// 17. LOAD, CREATE, & SAVE API
// ============================================================================

async function loadToEditor(assetId) {
    const targetRow = flatData().find(r => r[1] === assetId);
    if (!targetRow) {
        showToast("Asset not found in database.", "e");
        return;
    }
    
    // Check access control
    var assetData = grpAssets().find(function(a) { return a.id === assetId; });
    if (assetData) {
        var assetStatus2 = assetData.status || "In Progress";
        var lockedBy2 = assetData.lockedBy || "";
        var currentEmail = (currentUser.email || "").toLowerCase();
        
        // Check if asset is Ended
        if (assetStatus2 === "Ended") {
            showToast("This show has ended. No further edits allowed.", "e");
            return;
        }
        
        // Check if locked by another user
        if (lockedBy2 && lockedBy2.toLowerCase() !== currentEmail) {
            var lockedUserInfo = getUserInfo(lockedBy2);
            var lockedName = lockedUserInfo ? lockedUserInfo.name : lockedBy2;
            _pendingHandoverRequestAsset = assetId;
            showToast("'" + assetId + "' is locked by " + lockedName + ". Request handover or wait.", "w", 8000, { label: "Request", fn: "openHandoverRequestModal" });
            window.openHandoverRequestModal = function() {
                document.getElementById("request-ho-info").textContent = "Asset '" + assetId + "' is currently being edited by " + lockedName + ". Send them a handover request.";
                openModal("m-request-ho");
            };
            return;
        }
    }
    
    if(document.getElementById("metaAssetId")) document.getElementById("metaAssetId").value = targetRow[1] || ""; 
    if(document.getElementById("metaTitle")) document.getElementById("metaTitle").value = targetRow[2] || ""; 
    if(document.getElementById("metaType")) document.getElementById("metaType").value = targetRow[3] || "";
    
    const dateObj = new Date(cleanDateString(targetRow[0])); 
    if (!isNaN(dateObj) && document.getElementById("metaDate")) {
        document.getElementById("metaDate").value = dateObj.toISOString().split("T")[0];
    }
    // Populate editor thumbnail
    var edTitle = targetRow[2] || "";
    var edThumbRow = document.getElementById("editor-thumb-row");
    var edThumb = document.getElementById("editor-thumb");
    if (edThumbRow && edThumb) {
        var edThumbUrl = getThumbnailUrl(edTitle);
        if (edThumbUrl) {
            edThumb.style.background = "url(" + edThumbUrl + ") center/cover no-repeat";
            edThumb.className = "";
            edThumbRow.style.display = "block";
        } else {
            edThumb.style.background = "";
            edThumb.className = "skeleton";
            edThumbRow.style.display = "block";
            if (edTitle) fetchThumbnailForTitle(edTitle);
        }
    }
    
    const grid = document.getElementById("segmentGrid");
    if(grid) grid.innerHTML = "";
    
    timelineSegments = [];
    segmentGlitches = {};
    
    const groupedAsset = grpAssets().find(a => a.id === assetId);
    if(groupedAsset && grid) {
        groupedAsset.rows.forEach(r => {
            const segName = r[4];
            timelineSegments.push(segName);
            
            const isSub = /\d/.test(segName);
            parseGlitchesFromSheet(segName, r[7]);
            
            const valuesObj = {
                in: cleanDateString(r[5]) || "",
                out: cleanDateString(r[6]) || "",
                breaks: (cleanDateString(r[10]) && cleanDateString(r[10]) !== "-") ? cleanDateString(r[10]) : "",
                cmts: (r[8] && r[8] !== "-") ? r[8] : ""
            };
            
            grid.insertAdjacentHTML("beforeend", mkRow(segName, isSub, valuesObj));
        });
    }
    
    updateSegCount();
    calcGrid();
    clearUnsaved();
    localStorage.removeItem("seg_draft");
    nav("editor");
    startEditorTimer(assetId);
    
    // Lock this asset for current user
    sb.from("segments").update({ locked_by: currentUser.email, locked_at: new Date().toISOString() }).eq("asset_id", assetId).then(function() {});
    
    showToast(`Loaded ${assetId} into editor.`, "s");
}

async function createNewAsset() {
    const idVal = document.getElementById("na-id")?.value.trim().toUpperCase() || "";
    const titleVal = document.getElementById("na-title")?.value.trim() || "New Event";
    const typeVal = document.getElementById("na-type")?.value || "Record";
    const dateVal = document.getElementById("na-date")?.value || new Date().toISOString().split("T")[0];
    
    if (!idVal) {
        showToast("Asset ID is required.", "w");
        return;
    }
    
    closeModal("m-newasset");

    // Check if asset_id already exists
    var existingAsset = grpAssets().find(function(a) { return a.id === idVal; });
    if (existingAsset) {
        showToast("Asset ID '" + idVal + "' already exists! Duplicate not allowed.", "e");
        showGlobalLoader(false);
        return;
    }

    showGlobalLoader(true);
    
    var ownerName = currentUser.name && currentUser.name.trim() !== "" ? currentUser.name : (currentUser.email || "").split('@')[0];
    var nowISO = new Date().toISOString();
    var { error: insErr } = await sb.from("segments").insert({
        year: new Date().getFullYear(), date: dateVal, asset_id: idVal, title: titleVal, type: typeVal,
        seg: "A", tc_in: "", tc_out: "", glitch: "", comment: "", duration: "", breaks: "", mcr_fmt: "",
        created_by: ownerName, status: "In Progress",
        handover_by: "", handover_to: "", handover_at: null,
        locked_by: currentUser.email, locked_at: nowISO
    });
    if (insErr) {
        showToast("Create failed: " + insErr.message, "e");
        showGlobalLoader(false);
        return;
    }
    
    // Fire-and-forget thumbnail fetch
    fetchThumbnailForTitle(titleVal);
    
    await loadAllSegments();
    
    showGlobalLoader(false);
    
    if(document.getElementById("metaAssetId")) document.getElementById("metaAssetId").value = idVal; 
    if(document.getElementById("metaTitle")) document.getElementById("metaTitle").value = titleVal; 
    if(document.getElementById("metaType")) document.getElementById("metaType").value = typeVal; 
    if(document.getElementById("metaDate")) document.getElementById("metaDate").value = dateVal;
    
    const grid = document.getElementById("segmentGrid");
    if(grid) grid.innerHTML = "";
    timelineSegments = [];
    segmentGlitches = {};
    
    addSeg();
    updateSegCount();
    calcGrid();
    clearUnsaved();

    if (_pendingScheduleLaunch && _pendingScheduleLaunch.assetId === idVal) {
        var psl = _pendingScheduleLaunch;
        psl.entry.launched_asset_id = idVal;
        psl.entry.status = "launched";

        sb.from("schedule_entries")
            .update({ launched_asset_id: idVal, status: "launched", updated_at: nowISO })
            .eq("row_index", psl.rowIndex)
            .eq("schedule_date", psl.entry.schedule_date)
            .then(function() {});

        var segRows = document.querySelectorAll("#segmentGrid .segment-row");
        if (segRows.length > 0) {
            var firstSeg = segRows[0];
            var tcInInput = firstSeg.querySelector(".tc-in");
            var tcOutInput = firstSeg.querySelector(".tc-out");
            var parsedIn = time12to24(psl.startTimeEdt);
            var parsedOut = time12to24(psl.endTimeEdt);
            if (tcInInput && parsedIn) {
                tcInInput.value = parsedIn + ":00";
            }
            if (tcOutInput && parsedOut) {
                tcOutInput.value = parsedOut + ":00";
            }
        }

        renderSchedule();
        renderDash();
        _pendingScheduleLaunch = null;
    }

    nav("editor");
    showToast(`${idVal} created and ready.`, "s");
}

async function saveSegmentsToDb(saveStatus, extra) {
    if (window._saving) { showToast("Already saving...", "w"); return; }
    window._saving = true;
    var rows = document.querySelectorAll(".segment-row");
    if (!rows.length) { window._saving = false; if (extra && extra.callback) extra.callback(); return; }
    var aid = document.getElementById("metaAssetId")?.value.trim() || "";
    var title = document.getElementById("metaTitle")?.value.trim() || "";
    var type = document.getElementById("metaType")?.value || "";
    var date = document.getElementById("metaDate")?.value || "";
    var ownerName = currentUser.name && currentUser.name.trim() !== "" ? currentUser.name : (currentUser.email || "").split('@')[0];
    var now = new Date().toISOString();
    var yearVal = new Date().getFullYear();

    var existingMeta = {};
    var dbCreator = "";
    if (aid) {
        var { data: metaData } = await sb.from("segments").select("metadata,handover_by,handover_to,handover_at,created_by").eq("asset_id", aid).limit(1).maybeSingle();
        if (metaData) {
            if (metaData.metadata) existingMeta = metaData.metadata;
            dbCreator = metaData.created_by || "";
            if ((!existingMeta.transfers || existingMeta.transfers.length === 0) && metaData.handover_by && metaData.handover_to) {
                var backFrom = (function(e){ var u=getUserInfo(e); return u?u.name:e.split('@')[0]; })(metaData.handover_by);
                var backToName = (function(e){ var u=getUserInfo(e); return u?u.name:e.split('@')[0]; })(metaData.handover_to);
                existingMeta.transfers = [{
                    from: backFrom,
                    toEmail: metaData.handover_to,
                    toName: backToName,
                    at: metaData.handover_at || ""
                }];
                if (dbCreator && backToName && dbCreator === backToName && backFrom && dbCreator !== backFrom) {
                    dbCreator = backFrom;
                }
            }
        }
    }
    if (dbCreator && dbCreator.trim() !== "") ownerName = dbCreator;

    if (extra && extra.hoTo) {
        if (!existingMeta.transfers) existingMeta.transfers = [];
        existingMeta.transfers.push({
            from: extra.hoBy || currentUser.name,
            toEmail: extra.hoTo,
            toName: (function(e){ var u=getUserInfo(e); return u?u.name:e.split('@')[0]; })(extra.hoTo),
            at: now
        });
    }

    var segRows = [];
    rows.forEach(function(row) {
        var segName = row.getAttribute("data-seg") || "";
        var tcIn = row.querySelector(".tc-in")?.value || "";
        var tcOut = row.querySelector(".tc-out")?.value || "";
        var brks = row.querySelector(".tc-breaks")?.value || "";
        var cmts = row.querySelector(".tc-comments")?.value || "";
        var finalDur = row.querySelector(".tc-duration")?.textContent || "";
        var glitchStr = formatGlitchesForSheet(segName);
        segRows.push({
            year: yearVal, date: date, asset_id: aid, title: title, type: type,
            seg: segName, tc_in: tcIn, tc_out: tcOut, glitch: glitchStr, comment: cmts,
            duration: finalDur, breaks: brks, mcr_fmt: aid + segName + " - " + finalDur,
            created_by: ownerName, status: saveStatus || "In Progress",
            handover_by: (extra && extra.hoBy) || "", handover_to: (extra && extra.hoTo) || "",
            handover_at: (extra && extra.hoTo) ? now : null, updated_at: now,
            locked_by: (saveStatus === "Ended") ? "" : (extra && extra.hoTo) || (currentUser.email || ""),
            locked_at: (saveStatus === "Ended") ? null : now,
            metadata: Object.assign({},existingMeta,{working_time:getWorkingTimeSummary()}),
        });
    });

    showGlobalLoader(true);
    if (saveStatus === "Handed Over" && extra && extra.hoTo) {
        var { data: curLock } = await sb.from("segments").select("locked_by").eq("asset_id", aid).limit(1).maybeSingle();
        if (curLock && curLock.locked_by && curLock.locked_by.toLowerCase() !== (currentUser.email || "").toLowerCase()) {
            showGlobalLoader(false); window._saving = false;
            showToast("Asset was already handed over by another session.", "e");
            if (extra && extra.callback) extra.callback(); return;
        }
    }
    var { error: upsErr } = await sb.from("segments").upsert(segRows, { onConflict: "asset_id, seg", ignoreDuplicates: false });
    showGlobalLoader(false);
    if (upsErr) { window._saving = false; showToast("Save error: " + upsErr.message, "e"); if (extra && extra.callback) extra.callback(); return; }
    var currentSegs = {};
    segRows.forEach(function(sr) { currentSegs[sr.seg] = true; });
    var { data: dbSegs } = await sb.from("segments").select("seg").eq("asset_id", aid);
    if (dbSegs) {
        var removedSegs = dbSegs.filter(function(dbr) { return !currentSegs[dbr.seg]; }).map(function(dbr) { return dbr.seg; });
        for (var ri2 = 0; ri2 < removedSegs.length; ri2++) {
            await sb.from("segments").delete().eq("asset_id", aid).eq("seg", removedSegs[ri2]);
        }
    }
    if(saveStatus==="Ended"&&aid){
      sb.from("tickets").update({status:"resolved",resolved_at:new Date().toISOString(),resolved_by:currentUser.email||""}).eq("asset_id",aid).eq("status","open").then(function(rt){
        if(!rt.error&&rt.data)loadTickets()
      })
    }
    window._saving = false;
    clearUnsaved();
    localStorage.removeItem("seg_draft");
    loadAllSegments();
    if (extra && extra.callback) extra.callback();
}

function saveToSheetsWithStatus(status, callback) { saveSegmentsToDb(status, { callback: callback }); }

function endShow() {
    var aid = document.getElementById("metaAssetId")?.value.trim();
    if (!aid) { showToast("Load an asset first.", "w"); return; }

    var rows = document.querySelectorAll(".segment-row");
    var hasEmptyTC = false;
    rows.forEach(function(row) {
        var tcIn = row.querySelector(".tc-in")?.value || "";
        var tcOut = row.querySelector(".tc-out")?.value || "";
        if (!tcIn || !tcOut) hasEmptyTC = true;
    });
    if (hasEmptyTC) {
        showToast("All segments must have TC In and TC Out filled before ending the show.", "e");
        return;
    }

    stopEditorTimer();
    showGlobalLoader(true);
    saveSegmentsToDb("Ended", { callback: function() {
        showGlobalLoader(false);
        showToast("Show ended: " + aid, "s");
        clearEditor();
        nav("dashboard");
    }});
}

function saveToSheets() {
    if (window._saving) { showToast("Already saving...", "w"); return; }
    var aid = document.getElementById("metaAssetId")?.value.trim() || "";
    if (!aid) { showToast("Asset ID required.", "w"); return; }
    saveSegmentsToDb("In Progress");
}

// ============================================================================
// 18. AUTOSAVE & CLEANUP DRAFT LOGIC
// ============================================================================

function markUnsaved() {
    unsavedChanges = true;
    const ind = document.getElementById("unsaved-indicator");
    const dot = document.getElementById("unsaved-dot-editor");
    const dotInd = document.getElementById("unsaved-dot-indicator");
    const textEl = document.getElementById("unsaved-text");
    if(ind) {
        ind.classList.remove("hidden", "saved", "syncing");
        ind.classList.add("unsaved");
        ind.style.display = "flex";
        if(textEl) textEl.textContent = "Unsaved";
    }
    if(dotInd) { dotInd.className = "unsaved-dot"; dotInd.style.background = "#f59e0b"; }
    if(dot) dot.classList.remove("hidden");
    saveDraft();
}

function clearUnsaved() {
    unsavedChanges = false;
    const ind = document.getElementById("unsaved-indicator");
    const dot = document.getElementById("unsaved-dot-editor");
    const dotInd = document.getElementById("unsaved-dot-indicator");
    const textEl = document.getElementById("unsaved-text");
    if(ind) {
        ind.classList.remove("unsaved", "syncing");
        ind.classList.add("saved");
        ind.style.display = "flex";
        if(textEl) textEl.textContent = "Saved";
    }
    if(dotInd) { dotInd.className = "unsaved-dot saved"; dotInd.style.background = "#22c55e"; }
    if(dot) dot.classList.add("hidden");
}

function showSyncingStatus() {
    const ind = document.getElementById("unsaved-indicator");
    const textEl = document.getElementById("unsaved-text");
    if(ind) {
        ind.classList.remove("hidden", "unsaved", "saved");
        ind.classList.add("syncing");
        ind.style.display = "flex";
        if(textEl) textEl.textContent = "Syncing...";
    }
}

function saveDraft() {
    const rows = document.querySelectorAll(".segment-row");
    const draftData = {
        metaDate: document.getElementById("metaDate")?.value || "",
        metaAssetId: document.getElementById("metaAssetId")?.value || "",
        metaTitle: document.getElementById("metaTitle")?.value || "",
        metaType: document.getElementById("metaType")?.value || "",
        metaExpSeg: document.getElementById("metaExpSeg")?.value || "",
        metaExpDur: document.getElementById("metaExpDur")?.value || "",
        segmentGlitches: segmentGlitches,
        segs: [...rows].map(r => ({
            seg: r.getAttribute("data-seg") || "",
            tcIn: r.querySelector(".tc-in")?.value || "",
            tcOut: r.querySelector(".tc-out")?.value || "",
            breaks: r.querySelector(".tc-breaks")?.value || "",
            cmts: r.querySelector(".tc-comments")?.value || ""
        }))
    };
    localStorage.setItem("seg_draft", JSON.stringify(draftData));
}

function restoreLocalDraft() {
    const rawData = localStorage.getItem("seg_draft"); 
    if (!rawData) return;
    try {
        const parsedDraft = JSON.parse(rawData); 
        if (!parsedDraft.metaAssetId) return;
        
        const restoreFn = () => {
            if(document.getElementById("metaDate")) document.getElementById("metaDate").value = parsedDraft.metaDate || "";
            if(document.getElementById("metaAssetId")) document.getElementById("metaAssetId").value = parsedDraft.metaAssetId || "";
            if(document.getElementById("metaTitle")) document.getElementById("metaTitle").value = parsedDraft.metaTitle || "";
            if(document.getElementById("metaType")) document.getElementById("metaType").value = parsedDraft.metaType || "Record";
            if(document.getElementById("metaExpSeg")) document.getElementById("metaExpSeg").value = parsedDraft.metaExpSeg || 4;
            if(document.getElementById("metaExpDur")) document.getElementById("metaExpDur").value = parsedDraft.metaExpDur || "00:30:00";
            
            const grid = document.getElementById("segmentGrid");
            if(grid) grid.innerHTML = ""; 
            timelineSegments = [];
            segmentGlitches = parsedDraft.segmentGlitches || {};
            
            if(grid) {
                (parsedDraft.segs || []).forEach(s => {
                    timelineSegments.push(s.seg);
                    const isSub = /\d/.test(s.seg);
                    grid.insertAdjacentHTML("beforeend", mkRow(s.seg, isSub, {
                        in: s.tcIn,
                        out: s.tcOut,
                        breaks: s.breaks,
                        cmts: s.cmts
                    }));
                });
            }
            
            calcGrid(); 
            markUnsaved();
            showToast(`Draft restored: ${sanitizeHTML(parsedDraft.metaAssetId)}`, "i", 4000, {label: "Dismiss", fn: "clearUnsaved"});
        };
        
        showToast(`Unsaved draft found: ${sanitizeHTML(parsedDraft.metaAssetId)}`, "w", 8000, {label: "Restore", fn: "restoreDraftNow"});
        window.restoreDraftNow = restoreFn;
    } catch(err) {
        localStorage.removeItem("seg_draft");
    }
}

function autoSaveDraft() {
    if (!unsavedChanges) return; 
    saveDraft();
    const badgeElement = document.getElementById("autosave-badge");
    if(badgeElement) {
        badgeElement.textContent = "auto-saved just now"; 
        badgeElement.style.opacity = "1";
        setTimeout(() => { badgeElement.style.opacity = "0"; }, 3000);
    }
}

// ============================================================================
// CUSTOM RIGHT-CLICK CONTEXT MENU
// ============================================================================

var contextMenuTarget = null;

function showContextMenu(e) {
    e.preventDefault();
    var menu = document.getElementById("ctx-menu");
    if (!menu) return;
    var card = e.target.closest(".ac");
    var row = e.target.closest(".asset-row");
    if (!card && !row) return;
    
    var assetId = card ? (card._assetId || "") : (row ? (row.dataset.assetId || "") : "");
    if (!assetId) return;
    
    var ended = card ? (card.classList.contains("ended") || false) : false;
    
    var showDelete = canEdit();
    menu.innerHTML = '<div class="ctx-item" data-action="view-asset"><span class="ms text-[18px]">visibility</span> View Asset</div>' +
        '<div class="ctx-item" data-action="view-report"><span class="ms text-[18px]">description</span> View Report</div>' +
        '<div class="ctx-item" data-action="edit-asset"><span class="ms text-[18px]">edit</span> Edit</div>' +
        (showDelete ? '<div class="ctx-divider"></div><div class="ctx-item ctx-danger" data-action="delete-asset"><span class="ms text-[18px]">delete</span> Delete</div>' : '');
    
    contextMenuTarget = assetId;
    menu._assetId = assetId;
    menu._ended = ended;
    
    var x = Math.min(e.clientX, window.innerWidth - 200);
    var y = Math.min(e.clientY, window.innerHeight - 200);
    menu.style.left = x + "px";
    menu.style.top = y + "px";
    menu.classList.add("on");
}

document.addEventListener("contextmenu", showContextMenu);

document.addEventListener("click", function(e) {
    var menu = document.getElementById("ctx-menu");
    if (!menu) { return; }
    menu.classList.remove("on");
    var item = e.target.closest(".ctx-item");
    if (!item) { return; }
    var aid = contextMenuTarget || menu._assetId || "";
    if (!aid) { return; }
    var action = item.dataset.action;
    if (action === "view-asset") { openFso(aid); }
    else if (action === "view-report") { closeFso(); nav("editor"); loadToEditor(aid); setTimeout(function() { nav("report"); }, 300); }
    else if (action === "edit-asset") { closeFso(); nav("editor"); loadToEditor(aid); }
    else if (action === "delete-asset") {
        performDeleteAsset(aid);
    }
});

