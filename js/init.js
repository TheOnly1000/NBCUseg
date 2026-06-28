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
        
        var savedAccent = localStorage.getItem('seg_accent_color');
        if (savedAccent) setAccentColor(savedAccent);
        // Clean up dark mode leftovers
        localStorage.removeItem('theme');
        localStorage.removeItem('seg_dark_style');
        document.documentElement.classList.remove('dark');
        document.documentElement.style.colorScheme = 'light';

        var sessionRes = await Promise.race([
            sb.auth.getSession(),
            new Promise(function(_, reject) { setTimeout(function() { reject(new Error("getSession timed out")); }, 10000); })
        ]);
        var session = sessionRes.data ? sessionRes.data.session : null;
        if (session) {
            currentUser = { id: session.user.id, email: session.user.email, name: session.user.user_metadata?.name || session.user.email.split('@')[0], avatar: session.user.user_metadata?.avatar || "" };
            var { data: banCheck } = await sb.from("profiles").select("banned").eq("id", session.user.id).maybeSingle();
            if (banCheck?.banned) {
                await sb.auth.signOut();
                window.location.href = "ban.html";
                return;
            }
            updateSidebarProfile();
            var themeMsg = document.getElementById("theme-username");
            if (themeMsg) themeMsg.textContent = currentUser.name;
            var lastView = "dashboard";
            try { var saved = localStorage.getItem('seg_last_view'); if (saved) lastView = saved; } catch(e) {}
            loadThumbnails();
            nav(lastView);
            loadAllSegments();
            fetchNotifications();
            loadUserProfiles();
            loadScheduleFromDb(true);
            subscribeRealTime();
        } else {
            nav("login");
        }

        sb.auth.onAuthStateChange(function(event, session) {
            if (event === "SIGNED_OUT") {
                if (segChannel) sb.removeChannel(segChannel);
                if (notifChannel) sb.removeChannel(notifChannel);
                if (profilesChannel) sb.removeChannel(profilesChannel);
                if (scheduleChannel) sb.removeChannel(scheduleChannel);
                if (schedulePollTimer) { clearInterval(schedulePollTimer); schedulePollTimer = null; }
                nav("login");
            }
        });
        
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
    // Ctrl+C removed - users can now copy any text freely. MCR copy icons still available in each view.
    // Dark mode shortcut removed
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
