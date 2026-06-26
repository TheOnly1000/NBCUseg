// ===================== SCHEDULE FUNCTIONS =====================

var scheduleEntries = [];

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

function scheduleDbRead(dateFilter) {
    return sb.from("schedule_entries").select("*").eq("schedule_date", dateFilter).then(function(result) {
        if (result.error) {
            if (result.error.message && result.error.message.indexOf("does not exist") >= 0) {
                console.warn("schedule_entries table not found - run the SQL setup");
            }
            return [];
        }
        return result.data || [];
    });
}

function scheduleDbWrite(dateFilter) {
    var rows = scheduleEntries.filter(function(e) { return e.schedule_date === dateFilter; });
    if (rows.length === 0) return Promise.resolve();
    var payload = rows.map(function(e) {
        return {
            row_index: e.row_index,
            schedule_date: e.schedule_date,
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
    // Get existing IDs for this date, then delete by PK and insert fresh
    return sb.from("schedule_entries").select("id").eq("schedule_date", dateFilter).then(function(idResult) {
        if (idResult.error) throw new Error("Read existing IDs failed: " + idResult.error.message);
        var existingIds = (idResult.data || []).map(function(r){return r.id});
        var delPromise = existingIds.length ? sb.from("schedule_entries").delete().in("id", existingIds) : Promise.resolve({error:null});
        return delPromise.then(function(delResult) {
            if (delResult && delResult.error) throw new Error("Delete by ID failed: " + delResult.error.message);
            return sb.from("schedule_entries").insert(payload);
        });
    }).then(function(insResult) {
        if (insResult.error) throw new Error("Schedule insert failed: " + insResult.error.message);
        return insResult;
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

function fetchScheduleFromSheet(dateFilter) {
    return fetchGoogleSheet("1yf8W7oDGmUlTMmRxDcgCTD8D-zHUH3lsYgZ5jVdaSXY", "0").then(function(data) {
        if (!data || !data.table || !data.table.rows) return [];
        var rows = data.table.rows;
        var startIdx = data.table.parsedNumHeaders || 5;
        var entries = [];
        for (var i = startIdx; i < rows.length; i++) {
            var rc = rows[i].c;
            if (!rc || rc.length < 6) continue;
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
            if (!dateVal || !seriesVal) continue;
            var yr = parseInt(dateFilter.split("-")[0]) || new Date().getFullYear();
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
                    if (mo2 && da2) cleanDate = yr + "-" + ("0"+mo2).slice(-2) + "-" + ("0"+da2).slice(-2);
                }
            }
            if (!cleanDate || cleanDate !== dateFilter) continue;
            var timeIn24 = time12to24(timeInFmt);
            var timeOut24 = time12to24(timeOutFmt);
            var startIst = timeIn24 ? edtToIst(cleanDate, timeIn24) : "";
            var endIst = timeOut24 ? edtToIst(cleanDate, timeOut24) : "";
            entries.push({
                id: null,
                row_index: i,
                schedule_date: cleanDate,
                event_type: typeVal,
                series_name: seriesVal,
                episode_title: episodeTitle || seriesVal,
                season_no: seasonVal,
                episode_no: epNumVal,
                sheet_asset_id: sheetAssetId,
                start_time_edt: timeInFmt,
                end_time_edt: timeOutFmt,
                start_time_ist: startIst,
                end_time_ist: endIst,
                assigned_to: "",
                status: "pending",
                launched_asset_id: "",
                segment_count: segCountVal
            });
        }
        return entries;
    });
}

function syncScheduleFromSheet() {
    var dateFilter = document.getElementById("schedule-date-filter")?.value || "";
    if (!dateFilter) { showToast("Please select a date first.", "e"); return; }
    showGlobalLoader(true);
    var hideLoader = function(){try{showGlobalLoader(false)}catch(e){}};
    // Capture current assignments for this date before overwriting
    var oldAssignments = {};
    scheduleEntries.forEach(function(e) {
        if (e.schedule_date === dateFilter) {
            oldAssignments[e.row_index] = e;
        }
    });
    // Also read any DB assignments made by other users
    scheduleDbRead(dateFilter).then(function(dbRows) {
        dbRows.forEach(function(r) {
            if (!oldAssignments[r.row_index] || !oldAssignments[r.row_index].assigned_to) {
                oldAssignments[r.row_index] = r;
            }
        });
        // Now fetch fresh from sheet
        fetchScheduleFromSheet(dateFilter).then(function(entries) {
            if (entries.length === 0) { hideLoader(); showToast("No entries found for " + dateFilter + ".", "e"); return; }
            // Merge sheet data with preserved assignments
            entries.forEach(function(e) {
                var old = oldAssignments[e.row_index];
                if (old) {
                    e.assigned_to = old.assigned_to || "";
                    e.status = old.launched_asset_id ? "launched" : (old.assigned_to ? "assigned" : "pending");
                    e.launched_asset_id = old.launched_asset_id || "";
                }
            });
            // Replace in-memory cache for this date
            scheduleEntries = scheduleEntries.filter(function(e) { return e.schedule_date !== dateFilter; });
            entries.forEach(function(e) { scheduleEntries.push(e); });
            scheduleEntries.sort(function(a, b) {
                return (a.schedule_date + " " + a.start_time_ist).localeCompare(b.schedule_date + " " + b.start_time_ist);
            });
            // Always delete old data and write fresh (full replace)
            scheduleDbWrite(dateFilter).then(function() {
                return loadScheduleFromDb();
            }).then(function() {
                hideLoader();
                renderSchedule(); renderDash();
                showToast("Synced " + entries.length + " entries for " + dateFilter + ".", "s");
            }).catch(function(err) {
                hideLoader();
                renderSchedule(); renderDash();
                showToast("Schedule loaded but DB save failed: " + (err && err.message ? err.message : err), "e", 8000);
                console.error("scheduleDbWrite error:", err);
            });
        }).catch(function(err) {
            hideLoader(); showToast("Sheet fetch failed: " + err, "e");
        });
    });
}

function time12to24(str) {
    if (!str) return "";
    str = str.trim();
    var lower = str.toLowerCase();
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
    // Remove old entries for this date from local cache
    scheduleEntries = scheduleEntries.filter(function(e) { return e.schedule_date !== dateFilter; });
    entries.forEach(function(en) { scheduleEntries.push(en); });
    scheduleEntries.sort(function(a, b) {
        return (a.schedule_date + " " + a.start_time_ist).localeCompare(b.schedule_date + " " + b.start_time_ist);
    });
    var dbPayload = entries.map(function(e) {
        return {
            row_index: e.row_index,
            schedule_date: e.schedule_date,
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
            launched_asset_id: e.launched_asset_id || ""
        };
    });
    scheduleDbWrite(dateFilter).then(function() {
        return loadScheduleFromDb();
    }).then(function() {
        renderSchedule();
        renderDash();
        showToast("Synced " + entries.length + " entries for " + dateFilter + ".", "s");
    }).catch(function(err) {
        renderSchedule();
        renderDash();
        showToast("Schedule loaded but DB save failed: " + (err && err.message ? err.message : err), "e", 8000);
        console.error("upsertScheduleEntriesForDate DB error:", err);
    });
}

function loadScheduleFromDb() {
    showGlobalLoader(true);
    return sb.from("schedule_entries").select("*").order("row_index", { ascending: true }).then(function(result) {
        if (result.error) { console.warn("Load schedule error:", result.error); return; }
        if (result.data && result.data.length > 0) {
            // Build lookup of current in-memory values to preserve fields not yet in DB
            var existingMap = {};
            scheduleEntries.forEach(function(e) {
                existingMap[e.row_index + "|" + e.schedule_date] = e;
            });
            scheduleEntries = result.data.map(function(r) {
                var key = r.row_index + "|" + r.schedule_date;
                var existing = existingMap[key];
                return {
                    id: r.id,
                    row_index: r.row_index,
                    schedule_date: r.schedule_date,
                    event_type: r.event_type,
                    series_name: r.series_name || "",
                    episode_title: r.episode_title,
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
                    segment_count: r.segment_count || (existing ? existing.segment_count : "") || ""
                };
            });
            scheduleEntries.sort(function(a, b) {
                return (a.schedule_date + " " + a.start_time_ist).localeCompare(b.schedule_date + " " + b.start_time_ist);
            });
        }
        showGlobalLoader(false);
    }).catch(function(){showGlobalLoader(false)});
}



function renderSchedule() {
    var tbody = document.getElementById("schedule-tbody");
    var empty = document.getElementById("schedule-empty");
    var upcomingCards = document.getElementById("schedule-upcoming-cards");
    var dp = document.getElementById("schedule-date-filter");
    if (dp && !dp.value) {
        var today = new Date();
        dp.value = today.getFullYear() + "-" + ("0"+(today.getMonth()+1)).slice(-2) + "-" + ("0"+today.getDate()).slice(-2);
    }
    if (!tbody) return;
    var dateFilter = dp ? dp.value : "";
    if (!dateFilter) { tbody.innerHTML = ""; if (empty) empty.style.display = "block"; return; }
    // Render directly from cache — schedule-rt subscription or poll already loaded fresh data from DB
    var filtered = scheduleEntries.filter(function(e) { return e.schedule_date === dateFilter; });
    if (filtered.length === 0) {
        tbody.innerHTML = "";
        if (empty) empty.style.display = "block";
        if (upcomingCards) upcomingCards.innerHTML = '<div class="text-secondary text-sm col-span-full text-center py-8">Click <strong>Sync from Sheet</strong> to load schedule data.</div>';
        return;
    }
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
    entry.assigned_to = assignedTo;
    entry.status = assignedTo ? "assigned" : "pending";
    sb.from("schedule_entries").update({ assigned_to: assignedTo, status: entry.status, updated_at: new Date().toISOString() })
        .eq("row_index", rowIndex).eq("schedule_date", entry.schedule_date)
        .then(function(result) {
            if (result.error) { showToast("Failed to update assignment: " + result.error.message, "e"); return; }
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
    if (entry.assigned_to.toLowerCase() !== userEmailForLaunch) {
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
    var parsedIn = time12to24(entry.start_time_edt || "");
    var parsedOut = time12to24(entry.end_time_edt || "");
    var tcInVal = parsedIn ? parsedIn + ":00" : "";
    var tcOutVal = parsedOut ? parsedOut + ":00" : "";
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
            showToast("Create failed: " + result.error.message, "e");
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
            // Fill expected duration and segments into editor metadata
            var expDurEl = document.getElementById("metaExpDur");
            if (expDurEl) expDurEl.value = expectedDur;
            var expSegEl = document.getElementById("metaExpSeg");
            if (expSegEl) expSegEl.value = expectedSeg;
            loadToEditor(assetId);
            showToast(assetId + " launched from schedule. Expected duration: " + expectedDur + ", Segments: " + expectedSeg + ".", "s");
        });
    });
}

function renderDashUpcoming() {
    var upcomingSection = document.getElementById("dash-upcoming-events");
    var upcomingCards = document.getElementById("dash-upcoming-cards");
    if (!upcomingSection || !upcomingCards) return;
    
    var userEmail = (currentUser && currentUser.email || "").toLowerCase();
    var today = new Date();
    var todayStr = today.getFullYear() + "-" + ("0"+(today.getMonth()+1)).slice(-2) + "-" + ("0"+today.getDate()).slice(-2);
    
    // Try DB first (other users may have synced)
    scheduleDbRead(todayStr).then(function(dbRows) {
        if (dbRows.length > 0) {
            // Merge into cache
            scheduleEntries = scheduleEntries.filter(function(e) { return e.schedule_date !== todayStr; });
            dbRows.forEach(function(r) {
                scheduleEntries.push({
                    id: r.id, row_index: r.row_index, schedule_date: r.schedule_date, event_type: r.event_type,
                    series_name: r.series_name || "", episode_title: r.episode_title, season_no: r.season_no,
                    episode_no: r.episode_no, sheet_asset_id: r.sheet_asset_id || "",
                    start_time_edt: r.start_time_edt, end_time_edt: r.end_time_edt,
                    start_time_ist: r.start_time_ist || "", end_time_ist: r.end_time_ist || "",
                    assigned_to: r.assigned_to || "", status: r.status || "pending", launched_asset_id: r.launched_asset_id || "",
                    segment_count: r.segment_count || ""
                });
            });
            renderDashUpcomingCards(dbRows, userEmail);
        } else {
            // Fallback to cache
            var cached = scheduleEntries.filter(function(e) { return e.schedule_date === todayStr; });
            if (cached.length > 0) {
                renderDashUpcomingCards(cached, userEmail);
            } else {
                upcomingSection.style.display = "none";
            }
        }
    }).catch(function() {
        var cached = scheduleEntries.filter(function(e) { return e.schedule_date === todayStr; });
        if (cached.length > 0) renderDashUpcomingCards(cached, userEmail);
        else upcomingSection.style.display = "none";
    });
}

function renderDashUpcomingCards(entries, userEmail) {
    var upcomingSection = document.getElementById("dash-upcoming-events");
    var upcomingCards = document.getElementById("dash-upcoming-cards");
    if (!upcomingSection || !upcomingCards) return;
    
    entries.sort(function(a, b) {
        return a.start_time_ist.localeCompare(b.start_time_ist);
    });
    
    if (entries.length > 0) {
        upcomingSection.style.display = "block";
        var html = "";
        entries.forEach(function(entry) {
            var isAssignedToMe = entry.assigned_to && entry.assigned_to.toLowerCase() === userEmail;
            var ti = getTypeInfo(entry.event_type);
            var cid3 = "cd-" + entry.row_index + "-" + entry.schedule_date + "-dash";
            html += "<div class='card bg-scl border border-ov/50 p-4 flex flex-col gap-2 min-w-0'>";
            html += "<div class='flex items-center justify-between'><span class='text-xs font-bold text-primary'>" + formatDateShort(entry.schedule_date) + "</span><span class='text-[10px] font-bold px-2 py-0.5 rounded-full " + (ti.isLive ? "bg-error/10 text-error" : "bg-primary/10 text-primary") + "'>" + ti.display + "</span></div>";
            html += "<div class='font-bold text-sm text-on-surface truncate'>" + escHtml(entry.episode_title) + "</div>";
            html += "<div class='text-xs text-secondary'>S" + escHtml(entry.season_no) + " E" + escHtml(entry.episode_no) + "</div>";
            html += "<div class='text-xs font-mono text-secondary'>" + (entry.sheet_asset_id ? escHtml(entry.sheet_asset_id) : "—") + "</div>";
            html += "<div class='text-xs font-mono text-on-surface'>" + (entry.start_time_ist || entry.start_time_edt) + " - " + (entry.end_time_ist || entry.end_time_edt) + " IST</div>";
            html += "<div class='text-[10px] font-mono' id='" + cid3 + "'>" + getCountdownText(entry) + "</div>";
            if (isAssignedToMe) {
                html += "<button onclick='launchFromSchedule(" + entry.row_index + ")' class='btn-primary text-xs px-3 py-1.5 mt-1 ripple-host flex items-center gap-1 justify-center'><span class='ms text-[14px]'>rocket_launch</span>Launch</button>";
            } else if (entry.assigned_to) {
                var aName = entry.assigned_to;
                var aInfo = getUserInfo(entry.assigned_to);
                if (aInfo && aInfo.name) aName = aInfo.name;
                html += "<div class='text-xs text-secondary mt-1 text-center'>Assigned to " + escHtml(aName) + "</div>";
            } else {
                html += "<div class='text-xs text-secondary mt-1 text-center italic'>Unassigned</div>";
            }
            html += "</div>";
        });
        upcomingCards.innerHTML = html;
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
    if (!startIst || !entry.schedule_date) return "";
    var parts = startIst.split(":");
    var h = parseInt(parts[0]) || 0;
    var m = parseInt(parts[1]) || 0;
    var target = new Date(entry.schedule_date + "T" + ("0"+h).slice(-2) + ":" + ("0"+m).slice(-2) + ":00");
    var diff = target.getTime() - Date.now();
    if (diff <= 0) return "LIVE";
    var secs = Math.floor(diff / 1000);
    var hh = Math.floor(secs / 3600);
    var mm = Math.floor((secs % 3600) / 60);
    var ss = secs % 60;
    return ("0"+hh).slice(-2) + ":" + ("0"+mm).slice(-2) + ":" + ("0"+ss).slice(-2);
}

function shouldWarn5min(entry) {
    var startIst = entry.start_time_ist || entry.start_time_edt || "";
    if (!startIst || !entry.schedule_date) return false;
    if (_countdown5minWarned[entry.row_index + "|" + entry.schedule_date]) return false;
    var parts = startIst.split(":");
    var h = parseInt(parts[0]) || 0;
    var m = parseInt(parts[1]) || 0;
    var target = new Date(entry.schedule_date + "T" + ("0"+h).slice(-2) + ":" + ("0"+m).slice(-2) + ":00");
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
        // Check 5-min warning for assigned entries
        if (entry.assigned_to && entry.assigned_to.toLowerCase() === userEmail && shouldWarn5min(entry)) {
            sb.from("notifications").insert({
                target_email: userEmail,
                from_user: "System",
                message: "Schedule alert: \"" + (entry.episode_title || entry.series_name || "Event") + "\" starts in 5 minutes!",
                notification_type: "schedule_alert",
                asset_id: entry.launched_asset_id || entry.sheet_asset_id || "",
                read: false
            }).then(function() {
                showToast("🔔 " + (entry.episode_title || entry.series_name) + " starts in 5 minutes!", "w", 8000);
            });
        }
        // Update countdown spans (schedule + dashboard)
        var ids = ["cd-" + entry.row_index + "-" + entry.schedule_date, "cd-" + entry.row_index + "-" + entry.schedule_date + "-dash"];
        ids.forEach(function(cid) {
            var el = document.getElementById(cid);
            if (el) {
                var text = getCountdownText(entry);
                if (entry.launched_asset_id && globalSegments[entry.launched_asset_id]) {
                    el.textContent = "Launched";
                    el.className = "text-[10px] text-success font-bold";
                } else if (text === "LIVE") {
                    el.textContent = "LIVE";
                    el.className = "text-[10px] text-error font-bold animate-pulse";
                } else if (text) {
                    el.textContent = "in " + text;
                    el.className = "text-[10px] text-primary font-mono";
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
    entries.sort(function(a, b) {
        return (a.schedule_date + " " + a.start_time_ist).localeCompare(b.schedule_date + " " + b.start_time_ist);
    });
    var tbody = document.getElementById("schedule-tbody");
    var empty = document.getElementById("schedule-empty");
    var upcomingCards = document.getElementById("schedule-upcoming-cards");
    if (!tbody) return;
    
    if (entries.length === 0) {
        tbody.innerHTML = "";
        if (empty) empty.style.display = "block";
        if (upcomingCards) upcomingCards.innerHTML = '<div class="text-secondary text-sm col-span-full text-center py-8">No entries for this date.</div>';
        return;
    }
    if (empty) empty.style.display = "none";
    var userEmail = (currentUser && currentUser.email || "").toLowerCase();
    
    var html = "";
    entries.forEach(function(entry, idx) {
        var isAssignedToMe = entry.assigned_to && entry.assigned_to.toLowerCase() === userEmail;
        var assetExists = entry.launched_asset_id ? !!globalSegments[entry.launched_asset_id] : false;
        var canLaunch = isAssignedToMe && !assetExists;
        var launched = assetExists;
        var cid = "cd-" + entry.row_index + "-" + entry.schedule_date;
        html += "<tr class='hover:bg-sclo smooth border-b border-ov/20'>";
        html += "<td class='p-3 pl-4 text-secondary font-mono text-xs'>" + (idx + 1) + "</td>";
        html += "<td class='p-3 text-on-surface font-medium whitespace-nowrap'>" + formatDateShort(entry.schedule_date) + "</td>";
        html += "<td class='p-3 text-on-surface max-w-[200px] truncate' title='" + escHtml(entry.episode_title) + "'>" + escHtml(entry.episode_title) + "</td>";
        html += "<td class='p-3 text-secondary font-mono text-xs'>" + (entry.sheet_asset_id ? escHtml(entry.sheet_asset_id) : "—") + "</td>";
        html += "<td class='p-3 text-secondary font-mono text-xs'>S" + escHtml(entry.season_no) + "/E" + escHtml(entry.episode_no) + "</td>";
        html += "<td class='p-3 text-center font-mono text-xs text-secondary'>" + (entry.segment_count || "—") + "</td>";
        html += "<td class='p-3 text-on-surface font-mono text-xs whitespace-nowrap'>" + (entry.start_time_ist || entry.start_time_edt) + " - " + (entry.end_time_ist || entry.end_time_edt) + "<br><span id='" + cid + "' class='text-[10px] text-primary font-mono'>" + getCountdownText(entry) + "</span></td>";
        var ti2 = getTypeInfo(entry.event_type);
        html += "<td class='p-3'><span class='text-[11px] font-bold px-2 py-0.5 rounded-full " + (ti2.isLive ? "bg-error/10 text-error" : "bg-primary/10 text-primary") + "'>" + ti2.display + "</span></td>";
        html += "<td class='p-3'><select onchange='updateScheduleAssignment(" + entry.row_index + ", this.value)' class='sel text-xs py-1 w-[130px]'" + (launched ? " disabled" : "") + ">";
        html += "<option value=''>— Unassigned —</option>";
        for (var emailKey in userProfiles) {
            var p = userProfiles[emailKey];
            var pEmail = p.email || emailKey;
            var pName = p.name || pEmail.split('@')[0];
            var sel = (entry.assigned_to && entry.assigned_to.toLowerCase() === pEmail.toLowerCase()) ? " selected" : "";
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
        }
        html += "</td>";
        html += "</tr>";
    });
    tbody.innerHTML = html;
    
    // Upcoming cards for assigned to current user
    if (upcomingCards) {
        var myUpcoming = scheduleEntries.filter(function(e) {
            var eAssetExists = e.launched_asset_id ? !!globalSegments[e.launched_asset_id] : false;
            return !eAssetExists && e.assigned_to && e.assigned_to.toLowerCase() === userEmail;
        });
        if (myUpcoming.length > 0) {
            var cardsHtml = "";
            myUpcoming.forEach(function(entry) {
                var cid2 = "cd-" + entry.row_index + "-" + entry.schedule_date;
                cardsHtml += "<div class='card bg-scl border border-ov/50 p-4 flex flex-col gap-2'>";
                var ti = getTypeInfo(entry.event_type);
                cardsHtml += "<div class='flex items-center justify-between'><span class='text-xs font-bold text-primary'>" + formatDateShort(entry.schedule_date) + "</span><span class='text-[10px] font-bold px-2 py-0.5 rounded-full " + (ti.isLive ? "bg-error/10 text-error" : "bg-primary/10 text-primary") + "'>" + ti.display + "</span></div>";
                cardsHtml += "<div class='font-bold text-sm text-on-surface truncate'>" + escHtml(entry.episode_title) + "</div>";
                cardsHtml += "<div class='text-xs text-secondary'>S" + escHtml(entry.season_no) + " E" + escHtml(entry.episode_no) + "</div>";
                cardsHtml += "<div class='text-xs font-mono text-secondary'>" + (entry.sheet_asset_id ? escHtml(entry.sheet_asset_id) : "—") + "</div>";
                cardsHtml += "<div class='text-xs font-mono text-on-surface'>" + (entry.start_time_ist || entry.start_time_edt) + " - " + (entry.end_time_ist || entry.end_time_edt) + " IST</div>";
                cardsHtml += "<div class='text-[10px] font-mono text-primary' id='" + cid2 + "'>" + getCountdownText(entry) + "</div>";
                cardsHtml += "<button onclick='launchFromSchedule(" + entry.row_index + ")' class='btn-primary text-xs px-3 py-1.5 mt-1 ripple-host flex items-center gap-1 justify-center'><span class='ms text-[14px]'>rocket_launch</span>Launch</button>";
                cardsHtml += "</div>";
            });
            upcomingCards.innerHTML = cardsHtml;
        } else {
            upcomingCards.innerHTML = '<div class="text-secondary text-sm col-span-full text-center py-8">No upcoming events assigned to you.</div>';
        }
    }
}


