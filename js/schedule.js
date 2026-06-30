// ===================== SCHEDULE FUNCTIONS =====================

var scheduleEntries = [];
var _dashUpcomingTimer = null;

function getTypeInfo(typeVal) {
    if (!typeVal) return { display: "RECORD", isLive: false };
    var et = typeVal.toUpperCase();
    if (et.indexOf("LIVE") >= 0) return { display: "LIVE", isLive: true };
    return { display: "RECORD", isLive: false };
}

function gvizCellValue(cell) {
    if (!cell) return "";
    if (cell.f) return cell.f.trim();
    if (cell.v === null || cell.v === undefined) return "";
    return String(cell.v).trim();
}

function normDate(d) {
    if (!d) return "";
    if (typeof d === "string") return d.slice(0, 10);
    if (d instanceof Date) return d.getFullYear() + "-" + ("0"+(d.getMonth()+1)).slice(-2) + "-" + ("0"+d.getDate()).slice(-2);
    return String(d).slice(0, 10);
}

function scheduleDbRead(dateFilter) {
    return sb.from("schedule_entries").select("*").eq("schedule_date", dateFilter).then(function(result) {
        if (result.error) {
            if (result.error.message && result.error.message.indexOf("does not exist") >= 0) {
                console.warn("schedule_entries table not found - run the SQL setup");
            }
            return [];
        }
        return (result.data || []).map(function(r) { r.schedule_date = normDate(r.schedule_date); return r; });
    });
}

function scheduleDbWrite() {
    var rows = scheduleEntries;
    if (rows.length === 0) return Promise.resolve();
    // Collect unique dates in the buffer
    var dateSet = {};
    rows.forEach(function(e) { dateSet[normDate(e.schedule_date)] = true; });
    var dates = Object.keys(dateSet);
    
    // Build insert payload (no id — let DB auto-generate)
    var payload = rows.map(function(e) {
        return {
            row_index: e.row_index,
            schedule_date: normDate(e.schedule_date),
            ist_date: e.ist_date || normDate(e.schedule_date),
            event_type: e.event_type,
            series_name: e.series_name || "",
            episode_title: e.episode_title || "",
            season_no: e.season_no,
            episode_no: e.episode_no,
            sheet_asset_id: e.sheet_asset_id || "",
            start_time_edt: e.start_time_edt,
            end_time_edt: e.end_time_edt,
            start_time_ist: e.start_time_ist || "",
            end_time_ist: e.end_time_ist || "",
            assigned_to: e.assigned_to || "",
            status: e.status || "pending",
            launched_asset_id: e.launched_asset_id || "",
            segment_count: e.segment_count || ""
        };
    });
    
    // Step 1: Save any assigned/launched entries from OUTSIDE the window before wiping everything
    return sb.from("schedule_entries").select("*").then(function(allRes) {
        var preserved = [];
        if (!allRes.error) {
            var cutoff = addDays(todayEdt(), -7);
            allRes.data.forEach(function(r) {
                var rDate = normDate(r.schedule_date);
                if ((r.assigned_to || r.launched_asset_id) && dates.indexOf(rDate) < 0 && rDate >= cutoff) {
                    preserved.push(r);
                }
            });
        }
        return preserved;
    }).then(function(preserved) {
        // Step 2: Delete EVERYTHING from the table (clean slate)
        return sb.from("schedule_entries").delete().gt("id", -1).then(function(delRes) {
            if (delRes.error) throw new Error("Schedule delete all failed: " + delRes.error.message);
            return preserved;
        });
    }).then(function(preserved) {
        // Step 3: Insert current window data
        var chain = Promise.resolve();
        if (payload.length) {
            chain = sb.from("schedule_entries").insert(payload).select().then(function(insResult) {
                if (insResult.error) throw new Error("Schedule insert failed: " + insResult.error.message);
            });
        }
        // Step 4: Re-insert preserved assigned/launched entries from outside the window
        if (preserved.length) {
            var reInsert = preserved.map(function(r) {
                return { row_index: r.row_index, schedule_date: r.schedule_date, ist_date: r.ist_date || r.schedule_date, event_type: r.event_type, series_name: r.series_name || "", episode_title: r.episode_title || "", season_no: r.season_no, episode_no: r.episode_no, sheet_asset_id: r.sheet_asset_id || "", start_time_edt: r.start_time_edt, end_time_edt: r.end_time_edt, start_time_ist: r.start_time_ist || "", end_time_ist: r.end_time_ist || "", assigned_to: r.assigned_to || "", status: r.status || "pending", launched_asset_id: r.launched_asset_id || "", segment_count: r.segment_count || "" };
            });
            chain = chain.then(function() {
                return sb.from("schedule_entries").insert(reInsert);
            });
        }
        return chain.then(function() {
            return preserved;
        });
    }).then(function() {
        // Step 5: Reload from DB to get fresh IDs for current window
        return sb.from("schedule_entries").select("*").in("schedule_date", dates);
    }).then(function(loadResult) {
        if (loadResult.error) throw new Error("Schedule reload failed: " + loadResult.error.message);
        if (loadResult.data) {
            scheduleEntries.forEach(function(e) {
                var match = loadResult.data.find(function(r) {
                    return r.row_index === e.row_index && r.schedule_date === normDate(e.schedule_date);
                });
                if (match && match.id) e.id = match.id;
            });
        }
        return loadResult;
    }).catch(function(err) {
        if (err && err.message && err.message.indexOf("policy") >= 0) {
            showToast("DB permission error. Run DELETE RLS policy SQL.", "e", 8000);
        }
        throw err;
    });
}

function fetchGoogleSheet(sheetId, gid) {
    return new Promise(function(resolve, reject) {
        // Intercept the gviz JSONP callback
        var old = window.google && window.google.visualization && window.google.visualization.Query && window.google.visualization.Query.setResponse;
        window.google = window.google || {};
        window.google.visualization = window.google.visualization || {};
        window.google.visualization.Query = window.google.visualization.Query || {};
        window.google.visualization.Query.setResponse = function(data) {
            window.google.visualization.Query.setResponse = old || function(){};
            console.log("GViz response received, parsedNumHeaders:", data && data.table && data.table.parsedNumHeaders, "rows:", data && data.table && data.table.rows && data.table.rows.length);
            resolve(data);
        };
        var to = setTimeout(function() { reject("Timeout"); }, 30000);
        var s = document.createElement("script");
        s.src = "https://docs.google.com/spreadsheets/d/" + sheetId + "/gviz/tq?tqx=out:json&tq=&gid=" + gid;
        s.onerror = function() { clearTimeout(to); reject("Network error"); };
        document.body.appendChild(s);
    });
}

function parseSheetDate(dateVal, year) {
    var cleanDate = "";
    var dateMatch = dateVal.match(/Date\((\d+),(\d+),(\d+)\)/);
    if (dateMatch) {
        var mo2 = parseInt(dateMatch[2]) + 1;
        var da2 = parseInt(dateMatch[3]);
        cleanDate = parseInt(dateMatch[1]) + "-" + ("0"+mo2).slice(-2) + "-" + ("0"+da2).slice(-2);
    } else {
        var dp = dateVal.split("/");
        if (dp.length >= 2) {
            var mo2 = parseInt(dp[0]), da2 = parseInt(dp[1]);
            if (mo2 && da2) cleanDate = year + "-" + ("0"+mo2).slice(-2) + "-" + ("0"+da2).slice(-2);
        }
    }
    return cleanDate;
}

function sortEntriesForDisplay(entries) {
    entries.sort(function(a, b) {
        var aKey = (a.ist_date || a.schedule_date) + " " + a.start_time_ist;
        var bKey = (b.ist_date || b.schedule_date) + " " + b.start_time_ist;
        return aKey.localeCompare(bKey);
    });
    return entries;
}

function fetchScheduleFromSheet() {
    return fetchGoogleSheet("1yf8W7oDGmUlTMmRxDcgCTD8D-zHUH3lsYgZ5jVdaSXY", "0").then(function(data) {
        if (!data || !data.table || !data.table.rows) return [];
        var rows = data.table.rows;
        var startIdx = 0;
        var today = new Date();
        var yr = today.getFullYear();
        // If a date filter is set, center the window on that date; otherwise use today
        var dp = document.getElementById("schedule-date-filter");
        var centerDate = dp && dp.value ? dp.value : todayEdt();
        var edtStart = addDays(centerDate, -1);
        var edtEnd = addDays(centerDate, 1);
        console.log("fetchScheduleFromSheet: total rows=" + rows.length + ", startIdx=" + startIdx + ", parsedNumHeaders=" + data.table.parsedNumHeaders + ", centerDate=" + centerDate + ", edtWindow=" + edtStart + " to " + edtEnd);
        var entryByRow = {};
        // First, load existing entries by row_index so we can merge
        if (scheduleEntries.length) {
            scheduleEntries.forEach(function(e) { if (e.row_index) entryByRow[e.row_index] = e; });
        }
        
        var entries = [];
        var _debug = { skippedLen: 0, skippedNoDate: 0, skippedEdt: 0, skippedNoSeries: 0 };
        
        for (var i = startIdx; i < rows.length; i++) {
            var rc = rows[i].c;
            if (!rc || rc.length < 6) { _debug.skippedLen++; continue; }
            var dateVal = rc[0] ? gvizCellValue(rc[0]) : "";
            var typeVal = rc[1] ? gvizCellValue(rc[1]) : "";
            var seriesVal = rc[2] ? gvizCellValue(rc[2]) : "";
            var episodeTitle = rc[3] ? gvizCellValue(rc[3]) : "";
            var seasonVal = rc[4] ? gvizCellValue(rc[4]) : "";
            var epNumVal = rc[5] ? gvizCellValue(rc[5]) : "";
            var segCountVal = rc[11] ? gvizCellValue(rc[11]) : "";
            var timeInFmt = rc[7] ? gvizCellValue(rc[7]) : "";
            var timeOutFmt = rc[8] ? gvizCellValue(rc[8]) : "";
            var sheetAssetId = rc[13] ? gvizCellValue(rc[13]) : "";
            if (!dateVal || !seriesVal) { _debug.skippedNoSeries++; if (!dateVal) _debug.skippedNoDate++; continue; }
            var cleanDate = parseSheetDate(dateVal, yr);
            // Filter by EDT date range (wider to cover IST shift)
            if (!cleanDate || cleanDate < edtStart || cleanDate > edtEnd) { _debug.skippedEdt++; continue; }
            
            var timeIn24 = time12to24(timeInFmt);
            var timeOut24 = time12to24(timeOutFmt);
            var istInfo = timeIn24 ? edtToIstFull(cleanDate, timeIn24) : { istDate: cleanDate, istTime: "" };
            var endIstInfo = timeOut24 ? edtToIstFull(cleanDate, timeOut24) : { istDate: cleanDate, istTime: "" };
            var existing = entryByRow[i];
            entries.push({
                id: existing ? existing.id : null,
                row_index: i,
                schedule_date: cleanDate,
                ist_date: istInfo.istDate,
                event_type: typeVal,
                series_name: seriesVal,
                episode_title: episodeTitle || seriesVal,
                season_no: seasonVal,
                episode_no: epNumVal,
                sheet_asset_id: sheetAssetId,
                start_time_edt: timeInFmt,
                end_time_edt: timeOutFmt,
                start_time_ist: istInfo.istTime,
                end_time_ist: endIstInfo.istTime,
                assigned_to: existing ? (existing.assigned_to || "") : "",
                status: existing ? (existing.launched_asset_id ? "launched" : (existing.assigned_to ? "assigned" : "pending")) : "pending",
                launched_asset_id: existing ? (existing.launched_asset_id || "") : "",
                segment_count: segCountVal
            });
        }
        console.log("fetchScheduleFromSheet: entries=" + entries.length, _debug);
        return entries;
    });
}

function syncScheduleFromSheet() {
    showGlobalLoader(true);
    var hideLoader = function(){try{showGlobalLoader(false)}catch(e){}};
    
    // Capture all existing assignments before merging
    var oldByRow = {};
    scheduleEntries.forEach(function(e) { if (e.row_index) oldByRow[e.row_index] = e; });
    
    // Fetch all sheet data for the buffer window
    fetchScheduleFromSheet().then(function(entries) {
        if (entries.length === 0) { hideLoader(); showToast("No entries found in the buffer window.", "e"); return; }
        
        // Merge with existing entries — only keep those still within the buffer window
        var _edtStart = addDays(todayEdt(), -1);
        var _edtEnd = addDays(todayEdt(), 1);
        var merged = {};
        entries.forEach(function(e) { merged[e.row_index] = e; });
        // Keep existing entries still within the EDT buffer window (preserves assignments)
        scheduleEntries.forEach(function(e) {
            if (e.row_index && !merged[e.row_index] && e.schedule_date >= _edtStart && e.schedule_date <= _edtEnd) {
                merged[e.row_index] = e;
            }
        });
        
        scheduleEntries = sortEntriesForDisplay(Object.values(merged));
        
        // Write to DB (also cleans up stale entries outside the window)
        scheduleDbWrite().then(function() {
            hideLoader();
            renderSchedule(); renderDash();
            // Count per date for the toast
            var dateCounts = {};
            entries.forEach(function(e) { var d = e.schedule_date; dateCounts[d] = (dateCounts[d] || 0) + 1; });
            var countsStr = Object.keys(dateCounts).sort().map(function(d) { return d + ": " + dateCounts[d]; }).join(", ");
            showToast("Synced " + entries.length + " entries (" + countsStr + ")", "s");
        }).catch(function(err) {
            hideLoader();
            renderSchedule(); renderDash();
            console.error("syncScheduleFromSheet error:", err); showToast("Failed to sync schedule.", "e", 8000);
            console.error("syncScheduleFromSheet error:", err);
        });
    }).catch(function(err) {
        hideLoader(); showToast("Sheet fetch failed: " + err, "e");
    });
}

function scheduleCleanupWindow() {
    var edtStart = addDays(todayEdt(), -1);
    // Delete entries older than EDT window from DB only if not assigned/launched
    return sb.from("schedule_entries").select("id,row_index,schedule_date,assigned_to,launched_asset_id,status").then(function(r) {
        if (r.error) return;
        var toDelete = (r.data || []).filter(function(dbEntry) {
            var schedDate = dbEntry.schedule_date || "";
            if (!schedDate || schedDate >= edtStart) return false; // keep if in window
            // Delete only if not assigned/launched
            var assigned = dbEntry.assigned_to || "";
            var launched = dbEntry.launched_asset_id || "";
            return !assigned && !launched;
        }).map(function(e) { return e.id; });
        
        if (toDelete.length) {
            return sb.from("schedule_entries").delete().in("id", toDelete).then(function(dr) {
                if (!dr.error) console.log("schedule cleanup: deleted", toDelete.length, "old entries");
                // Also remove from local cache
                scheduleEntries = scheduleEntries.filter(function(e) { return toDelete.indexOf(e.id) < 0; });
            });
        }
    }).catch(function(e) { console.warn("scheduleCleanupWindow error:", e); });
}

function time12to24(str) {
    if (!str) return "";
    str = str.trim();
    var lower = str.toLowerCase().replace(/[\s\u202f]/g, "");
    var isPM = lower.indexOf("p.m.") >= 0 || lower.indexOf("pm") >= 0;
    var isAM = lower.indexOf("a.m.") >= 0 || lower.indexOf("am") >= 0;
    str = str.replace(/[ap]\.?\s*m\.?/gi, "").trim();
    var parts = str.split(":");
    var h = parseInt(parts[0]) || 0;
    var m = parseInt(parts[1]) || 0;
    if (isPM && h < 12) h += 12;
    if (isAM && h === 12) h = 0;
    return ("0"+h).slice(-2) + ":" + ("0"+m).slice(-2);
}

function upsertScheduleEntriesForDate(entries, dateFilter) {
    var existingMap = {};
    scheduleEntries.forEach(function(e) {
        existingMap[e.row_index] = e;
    });
    entries.forEach(function(en) {
        var existing = existingMap[en.row_index];
        if (existing) {
            en.assigned_to = existing.assigned_to || en.assigned_to;
            en.status = existing.launched_asset_id ? "launched" : (existing.assigned_to ? "assigned" : "pending");
            en.launched_asset_id = existing.launched_asset_id || "";
        }
    });
    // Clear local cache entirely and replace with fresh data
    scheduleEntries = [];
    entries.forEach(function(en) { scheduleEntries.push(en); });
    scheduleEntries.sort(function(a, b) {
        return (a.schedule_date + " " + a.start_time_ist).localeCompare(b.schedule_date + " " + b.start_time_ist);
    });
    scheduleDbWrite().then(function() {
        return loadScheduleFromDb(true);
    }).then(function() {
        renderSchedule();
        renderDash();
        showToast("Synced " + entries.length + " entries for " + dateFilter + ".", "s");
    }).catch(function(err) {
        renderSchedule();
        renderDash();
        console.error("upsertScheduleEntriesForDate error:", err); showToast("Failed to save schedule.", "e", 8000);
        console.error("upsertScheduleEntriesForDate DB error:", err);
    });
}

function scheduleRenderAll() {
    var sv=document.getElementById("vp-schedule");
    if(sv&&sv.classList.contains("on"))renderSchedule();
    renderDashUpcoming();
}

function clearScheduleFilter() {
  var dp = document.getElementById("schedule-date-filter");
  if (dp) {
    dp.value = "";
  }
  renderSchedule();
}

function filterDay(offset) {
  var dp = document.getElementById("schedule-date-filter");
  if (!dp) return;
  var d = new Date();
  d.setDate(d.getDate() + offset);
  dp.value = d.getFullYear() + "-" + ("0"+(d.getMonth()+1)).slice(-2) + "-" + ("0"+d.getDate()).slice(-2);
  renderSchedule();
}

// Wire date filter onchange: just re-render with the new window
(function() {
  var dp = document.getElementById("schedule-date-filter");
  if (dp) {
    dp.addEventListener("change", renderSchedule);
  }
})();

function loadScheduleFromDb(silent) {
    if(!silent)showGlobalLoader(true);
    if(!sb){if(!silent)showGlobalLoader(false);scheduleRenderAll();return Promise.resolve()}
    return sb.from("schedule_entries").select("*").order("row_index", { ascending: true }).then(function(result) {
        if (result.error) { console.warn("Load schedule error:", result.error); return; }
        if ((result.data||[]).length > 0) console.log("schedule loaded:", (result.data||[]).length, "entries");
        scheduleEntries = (result.data||[]).map(function(r) {
            var istDate = r.ist_date || (r.start_time_edt ? edtToIstFull(r.schedule_date || "", r.start_time_edt || "").istDate : normDate(r.schedule_date));
            return {
                id: r.id,
                row_index: r.row_index,
                schedule_date: normDate(r.schedule_date),
                ist_date: istDate,
                event_type: r.event_type,
                series_name: r.series_name || "",
                episode_title: r.episode_title || "",
                season_no: r.season_no,
                episode_no: r.episode_no,
                sheet_asset_id: r.sheet_asset_id || "",
                start_time_edt: r.start_time_edt,
                end_time_edt: r.end_time_edt,
                start_time_ist: r.start_time_ist || edtToIst(r.schedule_date || "", r.start_time_edt || ""),
                end_time_ist: r.end_time_ist || edtToIst(r.schedule_date || "", r.end_time_edt || ""),
                assigned_to: r.assigned_to || "",
                status: r.status || "pending",
                launched_asset_id: r.launched_asset_id || "",
                segment_count: r.segment_count || ""
            };
        });
        sortEntriesForDisplay(scheduleEntries);
        if(!silent)showGlobalLoader(false);
    }).catch(function(e){console.warn("loadScheduleFromDb error:",e);if(!silent)showGlobalLoader(false)}).then(function(){scheduleRenderAll()});
}



function renderSchedule() {
    var tbody = document.getElementById("schedule-tbody");
    var empty = document.getElementById("schedule-empty");
    var upcomingCards = document.getElementById("schedule-upcoming-cards");
    if (!tbody) { hideSkel("schedule"); return; }
    
    // If a date is selected, show 3-day window centered on it; otherwise show today's buffer
    var dp = document.getElementById("schedule-date-filter");
    var filterDate = dp && dp.value ? dp.value : "";
    var center = filterDate || todayEdt();
    var winStart = addDays(center, -1);
    var winEnd = addDays(center, 1);
    var filtered = scheduleEntries.filter(function(e) {
        return e.schedule_date >= winStart && e.schedule_date <= winEnd;
    });
    
    if (filtered.length === 0) {
        tbody.innerHTML = "";
        if (empty) empty.style.display = "block";
        if (upcomingCards) {
            upcomingCards.innerHTML = '<div class="text-secondary text-sm col-span-full text-center py-8">No entries in the current buffer window. Sync from sheet to load data.</div>';
        }
        hideSkel("schedule");
        return;
    }
    if (empty) empty.style.display = "none";
    
    renderScheduleTable(filtered);
}

function formatDateShort(dateStr) {
    if (!dateStr) return "";
    var parts = dateStr.split("-");
    if (parts.length === 3) {
        var months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
        return parseInt(parts[2]) + " " + months[parseInt(parts[1]) - 1] + " " + parts[0];
    }
    return dateStr;
}

function getCurrentUserDisplayName() {
    if (!currentUser || !currentUser.email) return "";
    var email = currentUser.email.toLowerCase();
    var profile = userProfiles[email];
    if (profile && profile.name) return profile.name;
    for (var k in userProfiles) {
        if (userProfiles[k].email && userProfiles[k].email.toLowerCase() === email && userProfiles[k].name) return userProfiles[k].name;
    }
    return email.split("@")[0];
}

function updateScheduleAssignment(rowIndex, assignedTo) {
    var entry = null;
    for (var i = 0; i < scheduleEntries.length; i++) {
        if (scheduleEntries[i].row_index === rowIndex) {
            entry = scheduleEntries[i];
            break;
        }
    }
    if (!entry) return;
    var prevAssigned = entry.assigned_to;
    var curEmail = (currentUser && currentUser.email || "").toLowerCase();
    entry.assigned_to = assignedTo;
    entry.status = assignedTo ? "assigned" : "pending";
    var assignerName = getUserInfo(curEmail)?.name || currentUser?.name || curEmail.split("@")[0];
    sb.from("schedule_entries").update({ assigned_to: assignedTo, status: entry.status, updated_at: new Date().toISOString() })
        .eq("row_index", rowIndex).eq("schedule_date", entry.schedule_date)
        .then(function(result) {
            if (result.error) { console.error("updateScheduleAssignment error:", result.error); showToast("Failed to update assignment.", "e"); return; }
            // Notify newly assigned user (skip self-assignment)
            var assignEmail = (assignedTo || "").toLowerCase();
            if (assignedTo && assignEmail !== curEmail && assignEmail !== (prevAssigned || "").toLowerCase()) {
                var assigneeName = getUserInfo(assignEmail)?.name || assignEmail.split("@")[0];
                var title = entry.episode_title || entry.series_name || "Schedule entry";
                var msg = "Hey " + assigneeName + ", " + assignerName + " assigned you \"" + title + "\" on " + (entry.schedule_date || "");
                sb.from("notifications").insert({
                    target_email: assignEmail,
                    from_user: assignerName,
                    from_email: curEmail,
                    asset_id: entry.sheet_asset_id || entry.launched_asset_id || "",
                    message: msg,
                    notification_type: "schedule_assignment",
                    created_at: new Date().toISOString(),
                    read: false
                });
            }
        });
    renderSchedule();
    renderDash();
}

function launchFromSchedule(rowIndex) {
    _pendingScheduleLaunch = null;
    var entry = null;
    for (var i = 0; i < scheduleEntries.length; i++) {
        if (scheduleEntries[i].row_index === rowIndex) {
            entry = scheduleEntries[i];
            break;
        }
    }
    if (!entry) { showToast("Entry not found.", "e"); return; }

    var userEmailForLaunch = (currentUser && currentUser.email || "").toLowerCase();
    if (!entry.assigned_to) { showToast("Not assigned to anyone.", "e"); return; }
    if (entry.assigned_to.toLowerCase().replace(' (deleted)', '') !== userEmailForLaunch) {
        showToast("This entry is assigned to someone else.", "e");
        return;
    }

    var assetId = entry.launched_asset_id || entry.sheet_asset_id || "";
    if (!assetId) {
        var isLive = entry.event_type && entry.event_type.toUpperCase().indexOf("LIVE") >= 0;
        var prefix = isLive ? "L" : "R";
        var datePart = (entry.schedule_date || "").replace(/-/g, "");
        var sn = (entry.season_no || "0").toString().replace(/\.0$/, "");
        var en2 = (entry.episode_no || "0").toString().replace(/\.0$/, "");
        assetId = prefix + datePart + "-S" + sn + "E" + en2;
    }
    if (globalSegments[assetId]) {
        showToast("Asset " + assetId + " already exists.", "e");
        return;
    }

    // Auto-create the asset directly without showing a modal
    var titleVal = entry.episode_title || entry.series_name || "New Event";
    var typeVal = entry.event_type || "Record";
    var dateVal = entry.schedule_date || new Date().toISOString().split("T")[0];
    var ownerName = currentUser.name && currentUser.name.trim() !== "" ? currentUser.name : (currentUser.email || "").split('@')[0];
    var nowISO = new Date().toISOString();
    var tcInVal = entry.start_time_ist ? entry.start_time_ist + ":00" : "";
    var tcOutVal = entry.end_time_ist ? entry.end_time_ist + ":00" : "";
    var expectedDur = (tcInVal && tcOutVal) ? tcStr(Math.max(0, toSec(tcOutVal) - toSec(tcInVal))) : "00:30:00";
    var expectedSeg = (entry.segment_count && entry.segment_count !== "") ? parseInt(entry.segment_count) || 0 : 4;

    showGlobalLoader(true);

    sb.from("segments").insert({
        year: new Date(dateVal).getFullYear() || new Date().getFullYear(),
        date: dateVal,
        asset_id: assetId,
        title: titleVal,
        type: typeVal,
        seg: "A",
        tc_in: "",
        tc_out: "",
        glitch: "",
        comment: "",
        duration: "",
        breaks: "",
        mcr_fmt: "",
        created_by: ownerName,
        status: "In Progress",
        handover_by: "",
        handover_to: "",
        handover_at: null,
        locked_by: currentUser.email,
        locked_at: nowISO
    }).then(function(result) {
        if (result.error) {
            console.error("launchFromSchedule error:", result.error); showToast("Failed to launch asset.", "e");
            showGlobalLoader(false);
            return;
        }

        fetchThumbnailForTitle(titleVal);

        entry.launched_asset_id = assetId;
        entry.status = "launched";
        sb.from("schedule_entries")
            .update({ launched_asset_id: assetId, status: "launched", updated_at: nowISO })
            .eq("row_index", rowIndex)
            .eq("schedule_date", entry.schedule_date)
            .then(function() {
                renderSchedule();
                renderDash();
            });

        loadAllSegments().then(function() {
            showGlobalLoader(false);
            loadToEditor(assetId).then(function(){
                var expDurEl = document.getElementById("metaExpDur");
                if (expDurEl) expDurEl.value = expectedDur;
                var expSegEl = document.getElementById("metaExpSeg");
                if (expSegEl) expSegEl.value = expectedSeg;
                calcGrid();
            });
            showToast(assetId + " launched from schedule. Duration: " + expectedDur + ", Segments: " + expectedSeg + ".", "s");
        });
    });
}

function renderDashUpcoming() {
    if (_dashUpcomingTimer) clearTimeout(_dashUpcomingTimer);
    _dashUpcomingTimer = setTimeout(_renderDashUpcomingImpl, 200);
}

function _renderDashUpcomingImpl() {
    var upcomingSection = document.getElementById("dash-upcoming-events");
    var upcomingCards = document.getElementById("dash-upcoming-cards");
    if (!upcomingSection || !upcomingCards) return;

    var userEmail = (currentUser && currentUser.email || "").toLowerCase();

    if (scheduleEntries.length > 0) {
        renderDashUpcomingCards(scheduleEntries, userEmail);
    } else {
        upcomingSection.style.display = "none";
    }
}

function renderUpcomingCardsGrouped(entries, containerId, userEmail) {
    var container = document.getElementById(containerId);
    if (!container) return { upcomingToday: 0, totalUpcoming: 0 };

    if (entries.length === 0) {
        container.innerHTML = '<div class="text-secondary text-sm col-span-full text-center py-8">No schedule entries yet.</div>';
        return { upcomingToday: 0, totalUpcoming: 0 };
    }

    var groups = {};
    var today = todayEdt();
    var upcomingToday = 0;
    var totalUpcoming = 0;

    entries.forEach(function(entry) {
        var d = entry.schedule_date;
        if (!d) return;
        if (!groups[d]) groups[d] = [];
        groups[d].push(entry);

        var ct = getCountdownText(entry);
        var isUpcoming = ct && ct !== "ENDED";
        if (isUpcoming) totalUpcoming++;
        if (d === today && isUpcoming) upcomingToday++;
    });

    var sortedDates = Object.keys(groups).sort();
    var html = "";

    sortedDates.forEach(function(dateStr) {
        var groupEntries = sortEntriesForDisplay(groups[dateStr]);
        var niceDate = formatDateShort(dateStr);

        html += "<div class='col-span-full mb-1 mt-3 first:mt-0'>";
        html += "<h3 class='text-sm font-bold text-on-surface flex items-center gap-2'>";
        html += "<span class='ms text-[16px] text-primary'>calendar_month</span>";
        html += niceDate + " IST";
        html += " <span class='text-xs text-secondary font-normal'>(" + groupEntries.length + " events)</span>";
        html += "</h3></div>";

        groupEntries.forEach(function(entry) {
        var isAssignedToMe = entry.assigned_to && entry.assigned_to.toLowerCase().replace(' (deleted)', '') === userEmail;
        var assetExists = entry.launched_asset_id ? !!globalSegments[entry.launched_asset_id] : false;
        var _ctEnded = getCountdownText(entry) === "ENDED";
        if (isAssignedToMe && !assetExists && _ctEnded) console.log("Launch blocked: countdown ENDED for row", entry.row_index, entry.episode_title, entry.start_time_ist, entry.ist_date);
        if (isAssignedToMe && !_ctEnded && assetExists) console.log("Launch blocked: asset exists in globalSegments for row", entry.row_index, entry.launched_asset_id);
        var canLaunch = isAssignedToMe && !assetExists && !_ctEnded;
            var istD2 = entry.ist_date || entry.schedule_date;
            var cid2 = "cd-" + entry.row_index + "-" + istD2;
            var ti = getTypeInfo(entry.event_type);

            html += "<div class='card bg-scl border border-ov/50 p-4 flex flex-col gap-2'>";
            html += "<div class='flex items-center justify-between'><span class='text-xs font-bold text-primary'>" + niceDate + " IST</span><span class='text-[10px] font-bold px-2 py-0.5 rounded-full " + (ti.isLive ? "bg-error/10 text-error" : "bg-primary/10 text-primary") + "'>" + ti.display + "</span></div>";
            html += "<div class='font-bold text-sm text-on-surface truncate' title='" + escHtml(entry.episode_title) + "'>" + escHtml(entry.episode_title) + "</div>";
            html += "<div class='text-xs text-secondary'>S" + escHtml(entry.season_no) + " E" + escHtml(entry.episode_no) + (entry.segment_count ? " · " + entry.segment_count + " seg" : "") + "</div>";
            html += "<div class='text-xs font-mono text-secondary'>" + (entry.sheet_asset_id ? escHtml(entry.sheet_asset_id) : "—") + "</div>";
            html += "<div class='text-xs font-mono text-on-surface'>" + (entry.start_time_ist || entry.start_time_edt) + " - " + (entry.end_time_ist || entry.end_time_edt) + " IST</div>";
            var ct2 = getCountdownText(entry);
            var ct2Class = ct2 === "ENDED" ? "text-[10px] font-mono border border-secondary/30 px-2 py-0.5 rounded text-secondary" : (ct2 === "RUNNING" ? "text-[10px] font-bold border border-error/30 px-2 py-0.5 rounded text-error" : (ct2 ? "text-[10px] font-mono border border-primary/30 px-2 py-0.5 rounded text-primary" : ""));
            var ct2Display = ct2 === "ENDED" ? "ENDED" : (ct2 === "RUNNING" ? "RUNNING" : (ct2 ? "upcoming in " + ct2 : ""));
            html += "<div class='" + ct2Class + "' id='" + cid2 + "'>" + ct2Display + "</div>";
            if (canLaunch) {
                html += "<button onclick='launchFromSchedule(" + entry.row_index + ")' class='btn-primary text-xs px-3 py-1.5 mt-1 ripple-host flex items-center gap-1 justify-center'><span class='ms text-[14px]'>rocket_launch</span>Launch</button>";
            } else if (assetExists) {
                html += "<button onclick=\"nav('editor'); loadToEditor('" + escHtml(entry.launched_asset_id) + "');\" class='btn-secondary text-xs px-3 py-1.5 mt-1 ripple-host flex items-center gap-1 justify-center'><span class='ms text-[14px]'>open_in_new</span>Open</button>";
            } else if (entry.assigned_to && !isAssignedToMe) {
                var assignedName = entry.assigned_to;
                var assignedInfo = getUserInfo(entry.assigned_to);
                if (assignedInfo && assignedInfo.name) assignedName = assignedInfo.name;
                html += "<div class='text-xs text-secondary mt-1 text-center'>Assigned to " + escHtml(assignedName) + "</div>";
            } else if (entry.assigned_to) {
                html += "<div class='text-xs text-secondary mt-1 text-center italic'>Assigned to you</div>";
            } else {
                html += "<div class='text-xs text-secondary mt-1 text-center italic'>Unassigned</div>";
            }
            html += "</div>";
        });
    });

    container.innerHTML = html;
    return { upcomingToday: upcomingToday, totalUpcoming: totalUpcoming };
}

function renderDashUpcomingCards(entries, userEmail) {
    var upcomingSection = document.getElementById("dash-upcoming-events");
    var upcomingCards = document.getElementById("dash-upcoming-cards");
    if (!upcomingSection || !upcomingCards) return;

    if (entries.length > 0) {
        upcomingSection.style.display = "block";
        renderUpcomingCardsGrouped(entries, "dash-upcoming-cards", userEmail);
    } else {
        upcomingSection.style.display = "none";
    }
}

// Patch renderDash to include upcoming events
var origRenderDash = renderDash;
renderDash = function() {
    origRenderDash();
    renderDashUpcoming();
};

// ============ SCHEDULE COUNTDOWN TIMER ============
var _countdown5minWarned = {};

function getCountdownText(entry) {
    var startIst = entry.start_time_ist || entry.start_time_edt || "";
    var endIst = entry.end_time_ist || entry.end_time_edt || "";
    var istDate = entry.ist_date || entry.schedule_date || "";
    if (!startIst || !istDate) return "";
    var now = Date.now();
    
    // Start target
    var sp = startIst.split(":");
    var sh = parseInt(sp[0]) || 0, sm = parseInt(sp[1]) || 0;
    var startTarget = new Date(istDate + "T" + ("0"+sh).slice(-2) + ":" + ("0"+sm).slice(-2) + ":00+05:30");
    var startDiff = startTarget.getTime() - now;
    
    // Before start → countdown
    if (startDiff > 0) {
        var secs = Math.floor(startDiff / 1000);
        return ("0"+Math.floor(secs/3600)).slice(-2) + ":" + ("0"+Math.floor((secs%3600)/60)).slice(-2) + ":" + ("0"+secs%60).slice(-2);
    }
    
    // After start → check end time
    if (endIst) {
        var ep = endIst.split(":");
        var eh = parseInt(ep[0]) || 0, em = parseInt(ep[1]) || 0;
        var endTarget = new Date(istDate + "T" + ("0"+eh).slice(-2) + ":" + ("0"+em).slice(-2) + ":00+05:30");
        // If end time ≤ start time, end is on the next IST day
        if (endTarget <= startTarget) endTarget = new Date(endTarget.getTime() + 86400000);
        if (endTarget.getTime() > now) return "RUNNING";
    }
    
    return "ENDED";
}

function shouldWarn5min(entry) {
    var startIst = entry.start_time_ist || entry.start_time_edt || "";
    var istDate = entry.ist_date || entry.schedule_date || "";
    if (!startIst || !istDate) return false;
    if (_countdown5minWarned[entry.row_index + "|" + istDate]) return false;
    var parts = startIst.split(":");
    var h = parseInt(parts[0]) || 0;
    var m = parseInt(parts[1]) || 0;
    var target = new Date(istDate + "T" + ("0"+h).slice(-2) + ":" + ("0"+m).slice(-2) + ":00+05:30");
    var diff = target.getTime() - Date.now();
    var minsLeft = diff / 60000;
    if (minsLeft <= 5 && minsLeft > 4.5) {
        _countdown5minWarned[entry.row_index + "|" + entry.schedule_date] = true;
        return true;
    }
    return false;
}

function updateCountdowns() {
    var now = Date.now();
    var userEmail = (currentUser && currentUser.email || "").toLowerCase();
    scheduleEntries.forEach(function(entry) {
        if (shouldWarn5min(entry)) {
            playNotifSound();
            var msg = "Schedule alert: \"" + (entry.episode_title || entry.series_name || "Event") + "\" starts in 5 minutes!";
            var title = (entry.episode_title || entry.series_name || "Event") + " starts in 5 min";
            var aid = entry.launched_asset_id || entry.sheet_asset_id || "";
            if (entry.assigned_to) {
                // Notify assigned user
                sb.from("notifications").insert({
                    target_email: entry.assigned_to.toLowerCase().replace(' (deleted)', ''),
                    from_user: "System", message: msg,
                    notification_type: "schedule_alert", asset_id: aid, read: false
                });
                if (entry.assigned_to.toLowerCase().replace(' (deleted)', '') === userEmail) {
                    showToast("🔔 " + (entry.episode_title || entry.series_name) + " starts in 5 minutes!", "w", 8000);
                    if (document.hidden) sendBrowserNotif(title, msg);
                }
            } else {
                // Notify all users
                for (var _k in userProfiles) {
                    var _p = userProfiles[_k];
                    var _em = _p.email || _k;
                    sb.from("notifications").insert({
                        target_email: _em.toLowerCase(),
                        from_user: "System", message: msg,
                        notification_type: "schedule_alert", asset_id: aid, read: false
                    });
                }
                showToast("🔔 " + (entry.episode_title || entry.series_name) + " starts in 5 minutes! (notifying all users)", "w", 8000);
                if (document.hidden) sendBrowserNotif(title, msg);
            }
        }
        // Update countdown spans (schedule + dashboard)
        var istD3 = entry.ist_date || entry.schedule_date;
        var ids = ["cd-" + entry.row_index + "-" + istD3, "cd-" + entry.row_index + "-" + istD3 + "-dash"];
        ids.forEach(function(cid) {
            var el = document.getElementById(cid);
            if (el) {
                var text = getCountdownText(entry);
                if (entry.launched_asset_id && globalSegments[entry.launched_asset_id]) {
                    el.textContent = "Launched";
                    el.className = "text-[10px] text-success font-bold border border-success/30 px-2 py-0.5 rounded";
                } else if (text === "ENDED") {
                    el.textContent = "ENDED";
                    el.className = "text-[10px] text-secondary font-mono border border-secondary/30 px-2 py-0.5 rounded";
                } else if (text === "RUNNING") {
                    el.textContent = "RUNNING";
                    el.className = "text-[10px] text-error font-bold border border-error/30 px-2 py-0.5 rounded";
                } else if (text) {
                    el.textContent = "upcoming in " + text;
                    el.className = "text-[10px] text-primary font-mono border border-primary/30 px-2 py-0.5 rounded";
                } else {
                    el.textContent = "";
                }
            }
        });
    });
}

// Start countdown timer on init
var _countdownTimer = setInterval(updateCountdowns, 1000);

function renderScheduleTable(entries) {
    sortEntriesForDisplay(entries);
    var tbody = document.getElementById("schedule-tbody");
    var empty = document.getElementById("schedule-empty");
    var upcomingCards = document.getElementById("schedule-upcoming-cards");
    if (!tbody) { hideSkel("schedule"); return; }
    
    if (entries.length === 0) {
        tbody.innerHTML = "";
        if (empty) empty.style.display = "block";
        if (upcomingCards) upcomingCards.innerHTML = '<div class="text-secondary text-sm col-span-full text-center py-8">No entries in the current buffer window.</div>';
        hideSkel("schedule");
        return;
    }
    if (empty) empty.style.display = "none";
    var userEmail = (currentUser && currentUser.email || "").toLowerCase();
    
    var html = "";
    entries.forEach(function(entry, idx) {
        var isAssignedToMe = entry.assigned_to && entry.assigned_to.toLowerCase().replace(' (deleted)', '') === userEmail;
        var assetExists = entry.launched_asset_id ? !!globalSegments[entry.launched_asset_id] : false;
        var _ctEnded2 = getCountdownText(entry) === "ENDED";
        var canLaunch = isAssignedToMe && !assetExists && !_ctEnded2;
        var launched = assetExists;
        var istDate = entry.ist_date || entry.schedule_date;
        var cid = "cd-" + entry.row_index + "-" + istDate;
        html += "<tr class='hover:bg-sclo smooth border-b border-ov/20'>";
        html += "<td class='p-3 pl-4 text-secondary font-mono text-xs'>" + (idx + 1) + "</td>";
        html += "<td class='p-3 text-on-surface font-medium whitespace-nowrap'>" + formatDateShort(istDate) + "</td>";
        html += "<td class='p-3 text-on-surface'>" + escHtml(entry.episode_title) + "</td>";
        html += "<td class='p-3 text-secondary font-mono text-xs'>" + (entry.sheet_asset_id ? escHtml(entry.sheet_asset_id) : "—") + "</td>";
        html += "<td class='p-3 text-secondary font-mono text-xs'>S" + escHtml(entry.season_no) + "/E" + escHtml(entry.episode_no) + "</td>";
        html += "<td class='p-3 text-center font-mono text-xs text-secondary'>" + (entry.segment_count || "—") + "</td>";
        var ct = getCountdownText(entry);
        var ctClass = ct === "ENDED" ? "text-secondary border border-secondary/30 px-2 py-0.5 rounded" : (ct === "RUNNING" ? "text-error font-bold border border-error/30 px-2 py-0.5 rounded" : (ct ? "text-primary font-mono border border-primary/30 px-2 py-0.5 rounded" : ""));
        var ctDisplay = ct === "ENDED" ? "ENDED" : (ct === "RUNNING" ? "RUNNING" : (ct ? "upcoming in " + ct : ""));
html += "<td class='p-3 text-on-surface font-mono text-xs whitespace-nowrap'><span class='text-primary'>" + (entry.start_time_ist || entry.start_time_edt) + " - " + (entry.end_time_ist || entry.end_time_edt) + " IST</span><br><span id='" + cid + "' class='text-[10px] " + ctClass + "'>" + ctDisplay + "</span></td>";
        var ti2 = getTypeInfo(entry.event_type);
        html += "<td class='p-3'><span class='text-[11px] font-bold px-2 py-0.5 rounded-full " + (ti2.isLive ? "bg-error/10 text-error" : "bg-primary/10 text-primary") + "'>" + ti2.display + "</span></td>";
        html += "<td class='p-3'><select onchange='updateScheduleAssignment(" + entry.row_index + ", this.value)' class='sel text-xs py-1 w-[130px]'" + (launched ? " disabled" : "") + ">";
        html += "<option value=''>— Unassigned —</option>";
        for (var emailKey in userProfiles) {
            var p = userProfiles[emailKey];
            var pEmail = p.email || emailKey;
            var pName = p.name || pEmail.split('@')[0];
            var sel = (entry.assigned_to && entry.assigned_to.toLowerCase().replace(' (deleted)', '') === pEmail.toLowerCase()) ? " selected" : "";
            html += "<option value='" + escHtml(pEmail) + "'" + sel + ">" + escHtml(pName) + " (" + escHtml(pEmail) + ")</option>";
        }
        html += "</select></td>";
        html += "<td class='p-3 text-center'>";
        if (launched) {
            html += "<span class='text-[11px] font-bold text-success'>Launched</span>";
        } else if (entry.assigned_to && entry.status === "assigned") {
            html += "<span class='text-[11px] font-bold text-primary'>Assigned</span>";
        } else {
            html += "<span class='text-[11px] font-bold text-secondary'>Pending</span>";
        }
        html += "</td>";
        html += "<td class='p-3 text-right'>";
        if (canLaunch) {
            html += "<button onclick='launchFromSchedule(" + entry.row_index + ")' class='btn-primary text-xs px-3 py-1.5 ripple-host flex items-center gap-1 ml-auto'><span class='ms text-[14px]'>rocket_launch</span>Launch</button>";
        } else if (launched) {
            html += "<button onclick=\"nav('editor'); loadToEditor('" + escHtml(entry.launched_asset_id) + "');\" class='btn-secondary text-xs px-3 py-1.5 ripple-host flex items-center gap-1 ml-auto'><span class='ms text-[14px]'>open_in_new</span>Open</button>";
        } else if (entry.assigned_to && !isAssignedToMe) {
            var assignedName = entry.assigned_to;
            var assignedInfo = getUserInfo(entry.assigned_to);
            if (assignedInfo && assignedInfo.name) assignedName = assignedInfo.name;
            html += "<span class='text-xs text-secondary'>Assigned to " + escHtml(assignedName) + "</span>";
        } else if (entry.assigned_to) {
            html += "<span class='text-xs text-secondary italic'>Assigned to you</span>";
        }
        html += "</td>";
        html += "</tr>";
    });
    tbody.innerHTML = html;
    
    // Upcoming cards grouped by date (same filtered window as table)
    var userEmail2 = (currentUser && currentUser.email || "").toLowerCase();
    var stats = renderUpcomingCardsGrouped(entries, "schedule-upcoming-cards", userEmail2);
    var statsEl = document.getElementById("schedule-stats");
    if (statsEl) {
        statsEl.textContent = stats.upcomingToday + " upcoming today · " + stats.totalUpcoming + " total upcoming";
    }
    hideSkel("schedule");
}


