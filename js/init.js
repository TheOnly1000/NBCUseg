// ============================================================================
// 5. INITIALIZATION & SHORTCUTS
// ============================================================================

async function initApp() {
    try {
        if (!sb) {
            showToast("Supabase failed to initialize. Check internet connection.", "e", 10000);
            nav("login");
            var boot = document.getElementById("boot-loader");
            if(boot) { boot.style.opacity = "0"; setTimeout(function() { boot.style.display = "none"; }, 500); }
            return;
        }
        
        var isDark = localStorage.getItem('theme') === 'dark';
        if (isDark) {
            document.documentElement.classList.add('dark');
            document.documentElement.style.colorScheme = 'dark';
            if(document.getElementById('theme-toggle')) document.getElementById('theme-toggle').checked = true;
            var modeToggle = document.getElementById('theme-mode-toggle');
            if (modeToggle) modeToggle.checked = true;
        } else {
            document.documentElement.style.colorScheme = 'light';
        }
        updateThemeUI(isDark);
        var darkStyleEl = document.getElementById('theme-dark-style');
        if (darkStyleEl) darkStyleEl.disabled = !isDark;

        var savedAccent = localStorage.getItem('seg_accent_color');
        if (savedAccent) setAccentColor(savedAccent);
        
        var savedDarkStyle = localStorage.getItem('seg_dark_style');
        if (savedDarkStyle && document.documentElement.classList.contains('dark')) {
            var styleSelect = document.getElementById('theme-dark-style');
            if (styleSelect) styleSelect.value = savedDarkStyle;
            setDarkStyle(savedDarkStyle);
        }

        var sessionRes = await Promise.race([
            sb.auth.getSession(),
            new Promise(function(_, reject) { setTimeout(function() { reject(new Error("getSession timed out")); }, 10000); })
        ]);
        var session = sessionRes.data ? sessionRes.data.session : null;
        if (session) {
            currentUser = { id: session.user.id, email: session.user.email, name: session.user.user_metadata?.name || session.user.email.split('@')[0], avatar: session.user.user_metadata?.avatar || "" };
            updateSidebarProfile();
            var lastView = "dashboard";
            try { var saved = localStorage.getItem('seg_last_view'); if (saved) lastView = saved; } catch(e) {}
            nav(lastView);
            loadAllSegments();
            loadThumbnails();
            fetchNotifications();
            loadUserProfiles();
            loadScheduleFromDb().then(function() {
                // Poll schedule every 15s for cross-user sync
                if (schedulePollTimer) clearInterval(schedulePollTimer);
                schedulePollTimer = setInterval(function() {
                    loadScheduleFromDb().then(function() {
                        var on = document.querySelector(".vp.on");
                        if (on && on.id === "vp-schedule") renderSchedule();
                        else if (on && on.id === "vp-dashboard") renderDash();
                    });
                }, 15000);
            });
            subscribeRealTime();
        } else {
            nav("login");
        }
        
        var boot = document.getElementById("boot-loader");
        if(boot) boot.style.opacity = "0";
        setTimeout(function() { if(boot) boot.style.display = "none"; }, 500);
        
        var metaDateEl = document.getElementById("metaDate");
        if(metaDateEl) metaDateEl.value = new Date().toISOString().split("T")[0];
        
        var grid = document.getElementById("segmentGrid");
        if (grid && !grid.children.length) addSeg();
        
        document.addEventListener("keydown", handleGlobalKeys);
        document.querySelectorAll(".ripple-host").forEach(function(el) { el.addEventListener("mousedown", triggerRipple); });
        
        autoSaveTimer = setInterval(autoSaveDraft, 45000);
        restoreLocalDraft(); 
        updateDualClocks();
        
        setInterval(function() {
            if (currentUser && currentUser.email) fetchNotifications();
        }, 30000);
        
        setInterval(function() {
            if (currentUser && currentUser.email) loadAllSegments();
        }, 60000);

    } catch(err) {
        console.error("Startup Error:", err);
        var boot2 = document.getElementById("boot-loader");
        if(boot2) { boot2.style.opacity = "0"; setTimeout(function() { boot2.style.display = "none"; }, 500); }
    }
}

function handleGlobalKeys(event) {
    const activeTag = document.activeElement?.tagName.toLowerCase() || "";
    const isTyping = ["input", "textarea", "select"].includes(activeTag);
    const modKey = event.metaKey || event.ctrlKey;
    
    if (event.key === "Escape") { closeFso(); closeModal("m-profile"); closeModal("m-newasset"); closeModal("m-confirm"); closeModal("m-shortcuts"); closeModal("m-search"); closeModal("m-glitches"); closeModal("m-about"); closeModal("m-theme"); closeModal("m-handover"); closeModal("m-notif"); closeModal("m-manual"); closeSidebar(); return; }
    if (event.key === "Enter" && !isTyping) {
        var confirmModal = document.getElementById("m-confirm");
        if (confirmModal && confirmModal.classList.contains("on")) {
            event.preventDefault();
            var okBtn = document.getElementById("confirm-ok");
            if (okBtn) okBtn.click();
            return;
        }
        var notifModal = document.getElementById("m-notif");
        if (notifModal && notifModal.classList.contains("on")) {
            var firstAction = document.querySelector("#notif-list button:first-of-type");
            if (firstAction) firstAction.click();
            return;
        }
    }
    if (modKey && event.key.toLowerCase() === "k") { event.preventDefault(); openModal("m-search"); setTimeout(() => document.getElementById("qsearch")?.focus(), 80); return; }
    if (event.altKey && event.key.toLowerCase() === "n" && !isTyping) { event.preventDefault(); openNewAsset(); return; }
    if (modKey && event.key.toLowerCase() === "s" && !event.shiftKey && !isTyping) { event.preventDefault(); saveToSheets(); return; }
    if (modKey && event.key.toLowerCase() === "s" && event.shiftKey && !isTyping) { event.preventDefault(); saveSegmentsToDb(); return; }
    if (modKey && event.key === "Enter" && !isTyping) { event.preventDefault(); addSeg(); return; }
    if (modKey && event.key.toLowerCase() === "c" && !isTyping) { event.preventDefault(); copyEditorMcr(); return; }
    if (modKey && event.key.toLowerCase() === "d" && !isTyping) { event.preventDefault(); toggleDarkMode(); return; }
    if (modKey && event.key === "1" && !isTyping) { event.preventDefault(); nav("dashboard"); return; }
    if (modKey && event.key === "2" && !isTyping) { event.preventDefault(); nav("assets"); return; }
    if (modKey && event.key === "3" && !isTyping) { event.preventDefault(); nav("editor"); return; }
    if (modKey && event.key === "5" && !isTyping) { event.preventDefault(); nav("schedule"); return; }
    if (modKey && event.key === "6" && !isTyping) { event.preventDefault(); nav("manual"); return; }
    if (modKey && event.key === "7" && !isTyping) { event.preventDefault(); nav("billing"); return; }
    if (event.key === "?" && !isTyping) { openModal("m-shortcuts"); return; }
    if (event.key === "F1" && !isTyping) { event.preventDefault(); nav("manual"); return; }
}

document.addEventListener("DOMContentLoaded", initApp);
