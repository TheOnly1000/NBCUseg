// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function sanitizeHTML(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function escHtml(str) {
    if (!str) return "";
    var d = document.createElement("div");
    d.appendChild(document.createTextNode(String(str)));
    return d.innerHTML;
}

function cleanDateString(val) {
    if (!val) return "";
    let str = String(val);
    if (str.includes("1899-12-30T")) { 
        let timePart = str.split("T")[1]; 
        return timePart ? timePart.substring(0, 8) : str; 
    }
    return str;
}

function toSec(timeCodeStr) {
    if (!timeCodeStr || timeCodeStr === "--") return 0;
    const cleanStr = timeCodeStr.replace(/:/g, "").padStart(6, "0");
    const h = parseInt(cleanStr.substring(0, 2) || 0);
    const m = parseInt(cleanStr.substring(2, 4) || 0);
    const s = parseInt(cleanStr.substring(4, 6) || 0);
    if (h >= 24) return 86400;
    return (h * 3600) + (m * 60) + s;
}

function tcStr(seconds) {
    if (isNaN(seconds)) seconds = 0;
    const sign = seconds < 0 ? "-" : "";
    seconds = Math.abs(seconds);
    const h = String(Math.floor(seconds / 3600)).padStart(2, "0");
    const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
    const s = String(Math.round(seconds % 60)).padStart(2, "0");
    return `${sign}${h}:${m}:${s}`;
}

function fmtD(rawDateStr, options = { day: "2-digit", month: "short" }) {
    const dateObj = new Date(cleanDateString(rawDateStr));
    return isNaN(dateObj) ? rawDateStr : dateObj.toLocaleDateString("en-IN", options);
}

function fmtTimeIST(dateStr) {
    if (!dateStr) return "";
    try {
        var s = String(dateStr).replace(" ", "T");
        var d = new Date(s);
        if (isNaN(d)) {
            var tMatch = String(dateStr).match(/(\d{2}:\d{2}:\d{2})/);
            return tMatch ? tMatch[1] + " IST" : "";
        }
        return d.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false }) + ' IST';
    } catch(e) { return ""; }
}

function edtToIst(dateStr, timeStr) {
    if (!dateStr || !timeStr) return timeStr || "";
    return edtToIstFull(dateStr, timeStr).istTime;
}

function edtToIstFull(dateStr, timeStr) {
    if (!dateStr || !timeStr) return { istDate: dateStr || "", istTime: timeStr || "" };
    var t = timeStr.trim();
    var tl = t.toLowerCase().replace(/[\s\u202f]/g, "");
    var isPM = /pm/.test(tl);
    var isAM = /am/.test(tl);
    t = t.replace(/[ap]\.?\s*m\.?/gi, "").trim();
    var parts = t.split(":");
    var h = parseInt(parts[0]) || 0;
    var m = parseInt(parts[1]) || 0;
    if (isPM && h < 12) h += 12;
    if (isAM && h === 12) h = 0;
    var dp = dateStr.split("-");
    var y = parseInt(dp[0]);
    var mo = parseInt(dp[1]) - 1;
    var dd = parseInt(dp[2]);
    // Check DST for this date (2nd Sunday Mar → 1st Sunday Nov)
    var mar1 = new Date(y, 2, 1);
    var marSun = mar1.getDay();
    mar1.setDate(1 + ((7 - marSun) % 7) + 7);
    var nov1 = new Date(y, 10, 1);
    var novSun = nov1.getDay();
    nov1.setDate(1 + ((7 - novSun) % 7));
    var checkD = new Date(y, mo, dd);
    var isEdt = checkD >= mar1 && checkD < nov1;
    // EDT=UTC-4, EST=UTC-5, IST=UTC+5:30
    var utcMs = Date.UTC(y, mo, dd, h + (isEdt ? 4 : 5), m);
    var istMs = utcMs + (5.5 * 3600 * 1000);
    var istD = new Date(istMs);
    return {
        istDate: istD.getUTCFullYear() + "-" + ("0"+(istD.getUTCMonth()+1)).slice(-2) + "-" + ("0"+istD.getUTCDate()).slice(-2),
        istTime: ("0" + istD.getUTCHours()).slice(-2) + ":" + ("0" + istD.getUTCMinutes()).slice(-2)
    };
}

function todayIst() {
    var d = new Date();
    return d.getFullYear() + "-" + ("0"+(d.getMonth()+1)).slice(-2) + "-" + ("0"+d.getDate()).slice(-2);
}

function addDays(dateStr, n) {
    var d = new Date(dateStr);
    d.setDate(d.getDate() + n);
    return d.getFullYear() + "-" + ("0"+(d.getMonth()+1)).slice(-2) + "-" + ("0"+d.getDate()).slice(-2);
}

function daysBetween(a, b) {
    var da = new Date(a), db = new Date(b);
    return Math.round((db - da) / 86400000);
}
