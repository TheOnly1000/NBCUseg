// ============================================================================
// 11.5 MANUAL PAGE
// ============================================================================

var manualTopics = [
    {
        id: "getting-started",
        title: "Getting Started",
        icon: "rocket_launch",
        sections: [
            { heading: "Login &amp; Authentication", text: 'Sign in with your work email. First-time users can request access via the "Request Access" link. After login you will see the Dashboard with recent assets.' },
            { heading: "Dashboard Overview", text: 'The Dashboard shows all synced assets. Use the year/month filters to narrow down. Toggle between grid and list view. Upcoming events assigned to you appear at the bottom with a Launch button.' }
        ]
    },
    {
        id: "assets",
        title: "Assets Library",
        icon: "inventory_2",
        sections: [
            { heading: "Browsing Assets", text: 'The Assets Catalog lists all media events. Click any row to open the full-screen detail view with MCR logs, glitch tracking, and report formats.' },
            { heading: "Creating Assets", text: 'Click "New Asset" in the sidebar or use Ctrl+N. Fill in Asset ID (e.g. TDA-EPL-1234), title, type (Record/Live), and date. Click Create &amp; Lock to begin editing.' },
            { heading: "Deleting Assets", text: 'From the full-screen view, click the Delete button. Only the locking user or the user the asset is handed over to can delete. Confirmation required.' },
            { heading: "Thumbnails", text: 'Thumbnails are fetched automatically from TVMaze, Wikipedia, and DuckDuckGo based on the show title. Assets with the same title share the same thumbnail to save storage.' }
        ]
    },
    {
        id: "editor",
        title: "Segment Editor",
        icon: "edit_square",
        sections: [
            { heading: "Editor Layout", text: 'The top section shows metadata (Asset ID, title, type, date). Below that is the segment grid where you add timecode rows. The right panel shows calculated totals and MCR format output.' },
            { heading: "Adding Segments", text: 'Click "Add Segment" or press Ctrl+Enter. Segments are lettered A-Z, then wrap to A1, B1 etc. Each segment has TC In, TC Out, duration (auto-calculated), breaks, comments, and glitch info.' },
            { heading: "Timecode Entry", text: 'Enter timecodes in HH:MM:SS or HH:MM:SS:FF format. Durations calculate automatically. Use Tab to quickly move between fields.' },
            { heading: "Glitch Tracking", text: 'Click the Glitch button on any segment to add technical anomalies (black frame, audio loss, etc.). Each glitch has type, time in/out, and auto-calculated lost duration.' },
            { heading: "Saving", text: 'Click "Sync &amp; Save" or press Ctrl+S. The system saves all segments to the Supabase database with upsert logic. Unsaved changes show a yellow indicator.' },
            { heading: "Auto-Save Draft", text: 'The editor auto-saves your work every 45 seconds to local storage. On page reload, the draft is restored automatically.' },
            { heading: "Asset Locking", text: 'When you load an asset, it becomes locked to your account. Other users see "Locked by [name]" and cannot edit until you release it via "End" or handover.' },
            { heading: "Handover", text: 'Click "Handover" to transfer editing rights to another user. The recipient gets a notification. Handover history is tracked in the asset metadata.' }
        ]
    },
    {
        id: "schedule",
        title: "Schedule &amp; Launch",
        icon: "calendar_month",
        sections: [
            { heading: "Syncing Schedule", text: 'Select a date and click "Sync from Sheet" to load the Google Sheet schedule. The system fetches the latest data and writes it to the database for all users.' },
            { heading: "Assigning Users", text: 'In the schedule table, use the Assign To dropdown to assign events to users. Assigned events appear in the assignee\'s upcoming events section.' },
            { heading: "Launching Assets", text: 'If you are assigned to an event, click the Launch button. The system auto-creates an asset with metadata from the schedule (title, type, timecodes, expected segment count) and opens it in the editor.' },
            { heading: "Segment Count from Sheet", text: 'The expected segment count is read from column 12 of the Google Sheet. When launching, this value is used as the target segment count in the editor.' }
        ]
    },
    {
        id: "report",
        title: "Reports &amp; MCR Logs",
        icon: "description",
        sections: [
            { heading: "Full Report View", text: 'Click "Full Report" from the full-screen asset view or from the editor. Shows duration comparison, glitch anomalies log, and MCR format output.' },
            { heading: "MCR Formats", text: 'Two formats are available: Detailed (full breakdown of each segment with glitches) and Short (compact format). Click "Copy Format" to copy to clipboard.' },
            { heading: "Status Panel", text: 'The report shows your actual duration vs expected duration. Green = perfect match, yellow = slight deviation, red = mismatch.' }
        ]
    },
    {
        id: "notifications",
        title: "Notifications",
        icon: "notifications",
        sections: [
            { heading: "Real-Time Alerts", text: 'Notifications appear for handover requests, asset assignments, and sync events. The bell icon shows an unread count badge.' },
            { heading: "Auto-Cleanup", text: 'Notifications referencing deleted assets are automatically removed on the next notification fetch. You can also clear individual or all notifications manually.' }
        ]
    },
    {
        id: "keyboard",
        title: "Keyboard Shortcuts",
        icon: "keyboard",
        sections: [
            { heading: "Global Shortcuts", text: 'Ctrl+K: Search, Ctrl+N: New Asset, Ctrl+S: Save, Ctrl+Enter: Add Segment, Ctrl+1/2/3: Navigate views, F1: Open Manual, Esc: Close modals, ?: Show shortcuts, Ctrl+Z: Undo segment delete.' },
            { heading: "Confirm / Cancel", text: 'Press Enter to confirm actions in dialogs (delete, handover, etc.). Press Esc to cancel and close any modal.' }
        ]
    },
    {
        id: "faq",
        title: "FAQ &amp; Troubleshooting",
        icon: "help",
        sections: [
            { heading: "Can\'t see my assets?", text: 'Make sure you are logged in with the correct email. Use the Sync DB button in the header to refresh all data.' },
            { heading: "Asset is locked by someone else", text: 'You can send a handover request from the notification or directly in the editor. The current editor will receive a notification to release the asset.' },
            { heading: "Schedule not loading?", text: 'Check that the Google Sheet ID is correct in the app_config table. Ensure the sheet is publicly accessible for read.' },
            { heading: "Thumbnails not showing?", text: 'Thumbnails are fetched asynchronously. Clicking Sync DB may trigger thumbnail fetching for loaded assets.' }
        ]
    }
];

function manualIllustration(sectionIdx, topicId) {
    var svgs = {
        "login": '<svg viewBox="0 0 200 120" class="w-full h-28 rounded-lg" style="background:var(--c-sclo)"><rect width="200" height="120" rx="12" fill="var(--c-scl)" stroke="var(--c-ov)" stroke-width="1"/><rect x="30" y="10" width="140" height="30" rx="6" fill="var(--c-pf)"/><text x="100" y="30" text-anchor="middle" font-size="11" font-weight="bold" fill="var(--c-primary)">SEGMENTOR</text><rect x="40" y="50" width="120" height="8" rx="4" fill="var(--c-sc)"/><rect x="40" y="65" width="120" height="8" rx="4" fill="var(--c-sc)"/><rect x="40" y="80" width="80" height="8" rx="4" fill="var(--c-primary)" opacity=".5"/><rect x="55" y="95" width="90" height="14" rx="7" fill="var(--c-primary)"/><text x="100" y="106" text-anchor="middle" font-size="8" font-weight="bold" fill="white">Sign In</text></svg>',
        "dashboard": '<svg viewBox="0 0 200 120" class="w-full h-28 rounded-lg" style="background:var(--c-sclo)"><rect width="200" height="120" rx="12" fill="var(--c-scl)" stroke="var(--c-ov)" stroke-width="1"/><rect x="10" y="10" width="86" height="45" rx="6" fill="var(--c-pf)" stroke="var(--c-primary)" stroke-width=".5"/><rect x="14" y="14" width="30" height="6" rx="2" fill="var(--c-primary)" opacity=".4"/><rect x="14" y="24" width="78" height="6" rx="2" fill="var(--c-sc)"/><rect x="14" y="34" width="55" height="6" rx="2" fill="var(--c-sc)"/><rect x="14" y="44" width="35" height="6" rx="2" fill="var(--c-sch)"/><rect x="104" y="10" width="86" height="45" rx="6" fill="var(--c-sclo)" stroke="var(--c-ov)" stroke-width=".5"/><rect x="108" y="14" width="30" height="6" rx="2" fill="var(--c-secondary)" opacity=".4"/><rect x="108" y="24" width="78" height="6" rx="2" fill="var(--c-sc)"/><rect x="108" y="34" width="55" height="6" rx="2" fill="var(--c-sc)"/><rect x="108" y="44" width="35" height="6" rx="2" fill="var(--c-sch)"/><rect x="10" y="62" width="86" height="45" rx="6" fill="var(--c-scl)" stroke="var(--c-ov)" stroke-width=".5"/><rect x="14" y="66" width="30" height="6" rx="2" fill="var(--c-secondary)" opacity=".4"/><rect x="104" y="62" width="86" height="45" rx="6" fill="var(--c-pf)" stroke="var(--c-primary)" stroke-width=".5"/><rect x="108" y="66" width="30" height="6" rx="2" fill="var(--c-primary)" opacity=".4"/><text x="147" y="97" text-anchor="middle" font-size="7" fill="var(--c-secondary)" font-weight="bold">UPCOMING EVENT</text></svg>',
        "editor_layout": '<svg viewBox="0 0 200 120" class="w-full h-28 rounded-lg" style="background:var(--c-sclo)"><rect width="200" height="120" rx="12" fill="var(--c-scl)" stroke="var(--c-ov)" stroke-width="1"/><rect x="8" y="8" width="120" height="16" rx="4" fill="var(--c-pf)"/><rect x="12" y="11" width="25" height="10" rx="2" fill="var(--c-primary)" opacity=".5"/><rect x="134" y="8" width="58" height="16" rx="4" fill="var(--c-sclo)"/><rect x="8" y="28" width="184" height="68" rx="6" fill="var(--c-sclo)" stroke="var(--c-ov)" stroke-width=".5"/><rect x="14" y="34" width="50" height="8" rx="3" fill="var(--c-sc)"/><rect x="70" y="34" width="50" height="8" rx="3" fill="var(--c-sc)"/><rect x="126" y="34" width="50" height="8" rx="3" fill="var(--c-sc)"/><rect x="14" y="48" width="50" height="8" rx="3" fill="var(--c-pf)"/><rect x="70" y="48" width="50" height="8" rx="3" fill="var(--c-pf)"/><rect x="126" y="48" width="50" height="8" rx="3" fill="var(--c-pf)"/><rect x="14" y="62" width="50" height="8" rx="3" fill="var(--c-sc)"/><rect x="70" y="62" width="50" height="8" rx="3" fill="var(--c-sc)"/><rect x="126" y="62" width="50" height="8" rx="3" fill="var(--c-sc)"/><rect x="14" y="76" width="50" height="8" rx="3" fill="var(--c-sch)"/><rect x="70" y="76" width="50" height="8" rx="3" fill="var(--c-sch)"/><rect x="126" y="76" width="50" height="8" rx="3" fill="var(--c-sch)"/><text x="100" y="110" text-anchor="middle" font-size="7" fill="var(--c-secondary)">TC In &nbsp; TC Out &nbsp; Duration &nbsp; Glitch</text></svg>',
        "schedule": '<svg viewBox="0 0 200 120" class="w-full h-28 rounded-lg" style="background:var(--c-sclo)"><rect width="200" height="120" rx="12" fill="var(--c-scl)" stroke="var(--c-ov)" stroke-width="1"/><rect x="8" y="8" width="100" height="16" rx="4" fill="var(--c-pf)"/><text x="14" y="19" font-size="8" font-weight="bold" fill="var(--c-primary)">CALENDAR</text><rect x="120" y="8" width="72" height="16" rx="4" fill="var(--c-primary)"/><text x="156" y="19" text-anchor="middle" font-size="7" font-weight="bold" fill="white">Sync</text><rect x="8" y="30" width="184" height="18" rx="4" fill="var(--c-sclo)"/><rect x="14" y="34" width="20" height="10" rx="2" fill="var(--c-secondary)" opacity=".3"/><rect x="40" y="34" width="30" height="10" rx="2" fill="var(--c-secondary)" opacity=".3"/><rect x="76" y="34" width="50" height="10" rx="2" fill="var(--c-primary)" opacity=".15"/><rect x="132" y="34" width="24" height="10" rx="2" fill="var(--c-secondary)" opacity=".3"/><rect x="162" y="34" width="24" height="10" rx="2" fill="var(--c-secondary)" opacity=".3"/><rect x="8" y="52" width="184" height="16" rx="4" fill="var(--c-scl)" stroke="var(--c-ov)" stroke-width=".5"/><rect x="14" y="56" width="55" height="8" rx="2" fill="var(--c-sc)"/><text x="75" y="63" font-size="6" fill="var(--c-secondary)">EPL Final</text><rect x="130" y="56" width="24" height="8" rx="4" fill="var(--c-pf)"/><text x="142" y="63" text-anchor="middle" font-size="5" fill="var(--c-primary)">S1 E2</text><rect x="160" y="56" width="24" height="8" rx="4" fill="var(--c-primary)"/><text x="172" y="63" text-anchor="middle" font-size="5" fill="white">LAUNCH</text><rect x="8" y="72" width="184" height="16" rx="4" fill="var(--c-scl)" stroke="var(--c-ov)" stroke-width=".5"/><rect x="14" y="76" width="55" height="8" rx="2" fill="var(--c-sc)"/><rect x="8" y="92" width="184" height="16" rx="4" fill="var(--c-scl)" stroke="var(--c-ov)" stroke-width=".5"/></svg>',
        "report": '<svg viewBox="0 0 200 120" class="w-full h-28 rounded-lg" style="background:var(--c-sclo)"><rect width="200" height="120" rx="12" fill="var(--c-scl)" stroke="var(--c-ov)" stroke-width="1"/><rect x="8" y="8" width="100" height="16" rx="4" fill="var(--c-pf)"/><text x="14" y="19" font-size="7" font-weight="bold" fill="var(--c-primary)">FULL REPORT</text><rect x="8" y="30" width="88" height="36" rx="6" fill="var(--c-sclo)" stroke="var(--c-ov)" stroke-width=".5"/><text x="52" y="45" text-anchor="middle" font-size="14" font-weight="bold" fill="var(--c-primary)">00:28:15</text><text x="52" y="57" text-anchor="middle" font-size="6" fill="var(--c-secondary)">Actual Duration</text><rect x="104" y="30" width="88" height="36" rx="6" fill="#f0fdf4" stroke="#bbf7d0" stroke-width="1"/><text x="148" y="45" text-anchor="middle" font-size="14" font-weight="bold" fill="#16a34a">00:30:00</text><text x="148" y="57" text-anchor="middle" font-size="6" fill="#15803d">Expected Duration</text><rect x="8" y="74" width="184" height="24" rx="4" fill="var(--c-sclo)" stroke="var(--c-ov)" stroke-width=".5"/><rect x="14" y="80" width="60" height="12" rx="3" fill="var(--c-ec)"/><text x="44" y="89" text-anchor="middle" font-size="6" font-weight="bold" fill="var(--c-error)">Glitch Log</text><text x="82" y="89" font-size="6" fill="var(--c-secondary)">Black Frame 00:01:30-00:01:35</text></svg>',
        "notifications": '<svg viewBox="0 0 200 120" class="w-full h-28 rounded-lg" style="background:var(--c-sclo)"><rect width="200" height="120" rx="12" fill="var(--c-scl)" stroke="var(--c-ov)" stroke-width="1"/><circle cx="176" cy="16" r="8" fill="var(--c-error)" stroke="var(--c-scl)" stroke-width="2"/><text x="176" y="19" text-anchor="middle" font-size="7" font-weight="bold" fill="white">2</text><rect x="8" y="12" width="100" height="16" rx="4" fill="var(--c-pf)"/><text x="14" y="23" font-size="7" font-weight="bold" fill="var(--c-primary)">NOTIFICATIONS</text><rect x="8" y="36" width="184" height="28" rx="6" fill="var(--c-pf)" stroke="var(--c-primary)" stroke-width=".5"/><circle cx="22" cy="50" r="8" fill="var(--c-primary)" opacity=".2"/><text x="22" y="54" text-anchor="middle" font-size="7" font-weight="bold" fill="var(--c-primary)">A</text><text x="38" y="48" font-size="7" fill="var(--c-on-surface)" font-weight="bold">Handover Request</text><text x="38" y="57" font-size="6" fill="var(--c-secondary)">From: John for asset TDA-EPL-1234</text><rect x="150" y="40" width="34" height="16" rx="4" stroke="var(--c-primary)" stroke-width="1" fill="none"/><text x="167" y="52" text-anchor="middle" font-size="6" font-weight="bold" fill="var(--c-primary)">Open</text><rect x="8" y="70" width="184" height="28" rx="6" fill="var(--c-pf)" stroke="var(--c-primary)" stroke-width=".5"/><circle cx="22" cy="84" r="8" fill="var(--c-primary)" opacity=".2"/><text x="22" y="88" text-anchor="middle" font-size="7" font-weight="bold" fill="var(--c-primary)">M</text><text x="38" y="82" font-size="7" fill="var(--c-on-surface)" font-weight="bold">Asset Assigned</text><text x="38" y="91" font-size="6" fill="var(--c-secondary)">TDA-EPL-5678 has been assigned to you</text></svg>',
        "keyboard": '<svg viewBox="0 0 200 120" class="w-full h-28 rounded-lg" style="background:var(--c-sclo)"><rect width="200" height="120" rx="12" fill="var(--c-scl)" stroke="var(--c-ov)" stroke-width="1"/><rect x="10" y="15" width="180" height="60" rx="8" fill="var(--c-sclo)" stroke="var(--c-ov)" stroke-width=".5"/><rect x="18" y="22" width="22" height="16" rx="3" fill="var(--c-sc)"/><text x="29" y="34" text-anchor="middle" font-size="6" fill="var(--c-secondary)" font-weight="bold">Esc</text><rect x="45" y="22" width="22" height="16" rx="3" fill="var(--c-pf)"/><text x="56" y="34" text-anchor="middle" font-size="6" fill="var(--c-primary)" font-weight="bold">F1</text><rect x="72" y="22" width="22" height="16" rx="3" fill="var(--c-sc)"/><text x="83" y="34" text-anchor="middle" font-size="5" fill="var(--c-secondary)" font-weight="bold">Ins</text><rect x="140" y="22" width="50" height="16" rx="3" fill="var(--c-sc)"/><text x="165" y="34" text-anchor="middle" font-size="6" fill="var(--c-secondary)" font-weight="bold">Backspace</text><rect x="18" y="43" width="75" height="16" rx="3" fill="var(--c-sc)"/><text x="55" y="55" text-anchor="middle" font-size="6" fill="var(--c-secondary)" font-weight="bold">Space</text><rect x="98" y="43" width="22" height="16" rx="3" fill="var(--c-pf)"/><text x="109" y="55" text-anchor="middle" font-size="6" fill="var(--c-primary)" font-weight="bold">Ctrl</text><rect x="125" y="43" width="22" height="16" rx="3" fill="var(--c-sc)"/><text x="136" y="55" text-anchor="middle" font-size="6" fill="var(--c-secondary)" font-weight="bold">Alt</text><rect x="152" y="43" width="38" height="16" rx="3" fill="var(--c-pf)"/><text x="171" y="55" text-anchor="middle" font-size="6" fill="var(--c-primary)" font-weight="bold">Enter</text><rect x="18" y="80" width="90" height="24" rx="6" fill="var(--c-pf)" stroke="var(--c-primary)" stroke-width=".5"/><text x="63" y="96" text-anchor="middle" font-size="7" fill="var(--c-primary)" font-weight="bold">Ctrl+N = New As...</text></svg>'
    };
    var keys = Object.keys(svgs);
    return svgs[keys[sectionIdx % keys.length]] || "";
}

function renderManual() {
    var contentEl = document.getElementById("manual-content");
    var tocEl = document.getElementById("manual-toc-list");
    if (!contentEl) return;
    var html = "";
    var tocHtml = "";
    var searchQ = (document.getElementById("manual-search")?.value || "").toLowerCase();
    var topicIdx = 0;
    manualTopics.forEach(function(topic) {
        if (searchQ && topic.title.toLowerCase().indexOf(searchQ) < 0 && topic.sections.every(function(s) { return s.heading.toLowerCase().indexOf(searchQ) < 0 && s.text.toLowerCase().indexOf(searchQ) < 0; })) return;
        html += '<div class="card bg-scl overflow-hidden" id="manual-' + topic.id + '">';
        html += '<div class="flex items-center gap-3 p-5 border-b border-ov/50 bg-sclo">';
        html += '<span class="ms text-[22px] text-primary">' + topic.icon + '</span>';
        html += '<h2 class="font-bold text-[18px] text-on-surface">' + topic.title + '</h2></div>';
        html += '<div class="p-5 flex flex-col gap-5">';
        topic.sections.forEach(function(section, secIdx) {
            var svgKey = topic.id + "_" + secIdx;
            var customSvgs = { "0_0": "login", "1_0": "dashboard", "2_0": "editor_layout", "3_0": "schedule", "4_0": "report", "5_0": "notifications", "6_0": "keyboard" };
            var svgId = customSvgs[topicIdx + "_" + secIdx] || "";
            var svgHtml = svgId ? manualIllustration(secIdx, svgId) : "";
            if (!svgHtml) svgHtml = manualIllustration(secIdx, topic.id);
            html += '<div class="manual-section bg-scl border border-ov/30 rounded-xl overflow-hidden" data-search="' + section.heading.toLowerCase() + ' ' + section.text.toLowerCase() + '">';
            html += '<div class="flex flex-col lg:flex-row">';
            html += '<div class="lg:w-2/3 p-5">';
            html += '<h3 class="font-bold text-[14px] text-primary mb-2 flex items-center gap-2"><span class="ms text-[16px]">chevron_right</span>' + section.heading + '</h3>';
            html += '<p class="text-sm text-secondary leading-relaxed">' + section.text + '</p>';
            html += '</div>';
            html += '<div class="lg:w-1/3 p-3 flex items-start justify-center bg-sclo/50">';
            html += svgHtml;
            html += '</div></div></div>';
        });
        html += '</div></div>';
        tocHtml += '<button onclick="document.getElementById(\'manual-' + topic.id + '\').scrollIntoView({behavior:\'smooth\',block:\'start\'});document.querySelector(\'#manual-toc-list .active\')?.classList.remove(\'active\');this.classList.add(\'active\')" class="text-left px-3 py-2 rounded-lg text-xs font-medium text-secondary hover:bg-sclo hover:text-on-surface sm flex items-center gap-2" style="transition:all .15s"><span class="ms text-[14px] text-primary">' + topic.icon + '</span>' + topic.title + '</button>';
        topicIdx++;
    });
    contentEl.innerHTML = html;
    if (tocEl) tocEl.innerHTML = tocHtml;
}

function filterManualTopics(query) {
    renderManual();
}
