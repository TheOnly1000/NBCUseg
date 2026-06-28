// ============================================================================
// 4. AUTHENTICATION
// ============================================================================

function toggleAuthScreens(type) {
    const loginForm = document.getElementById("lform"), signupForm = document.getElementById("sform");
    const headerTitle = document.getElementById("auth-h"), headerSub = document.getElementById("auth-s");
    
    if (!loginForm || !signupForm) return;
    
    if (type === "signup") {
        loginForm.style.display = "none"; signupForm.style.display = "flex";
        if(headerTitle) headerTitle.textContent = "Create Account"; 
        if(headerSub) headerSub.textContent = "Create your Segmentor account";
    } else {
        signupForm.style.display = "none"; loginForm.style.display = "flex";
        if(headerTitle) headerTitle.textContent = "Segmentor"; 
        if(headerSub) headerSub.textContent = "Enterprise Broadcast Pipeline";
    }
}

function handleForgotPassword() {
    var email = document.getElementById("l-em")?.value.trim();
    if (!email) { showToast("Enter your email address first.", "w"); return; }
    sb.auth.resetPasswordForEmail(email).then(function(r) {
        if (r.error) {
            showToast("Failed: " + r.error.message, "e");
        } else {
            showToast("Password reset link sent to " + email, "s", 8000);
        }
    });
}

async function handleUserLogin(event) {
    event.preventDefault();
    const emailInput = document.getElementById("l-em")?.value.toLowerCase().trim();
    const passwordInput = document.getElementById("l-pw")?.value;
    const loginBtn = document.getElementById("l-btn");
    
    if (!emailInput || !passwordInput) { showToast("Please fill all fields.", "w"); return; }
    if(loginBtn) { loginBtn.textContent = "Authenticating…"; loginBtn.disabled = true; }
    startProgressBar();
    
    var { data, error } = await sb.auth.signInWithPassword({ email: emailInput, password: passwordInput });
    
    if (error) {
        if (error.message && error.message.toLowerCase().indexOf("email not confirmed") >= 0) {
            showToast("Email not confirmed yet. Check your inbox for the confirmation link.", "w", 8000);
        } else {
            showToast("Login failed: " + error.message, "e");
        }
        if(loginBtn) { loginBtn.textContent = "Sign In"; loginBtn.disabled = false; }
        finishProgressBar();
        return;
    }
    
    currentUser = { id: data.user.id, email: data.user.email, name: data.user.user_metadata?.name || emailInput.split('@')[0], avatar: data.user.user_metadata?.avatar || "" };
    updateSidebarProfile(); 
    finishProgressBar();
    showWelcomeScreen(currentUser.name, true);
    setTimeout(function() {
        var lastView = "dashboard";
        try { var saved = localStorage.getItem('seg_last_view'); if (saved) lastView = saved; } catch(e) {}
        nav(lastView); 
        loadAllSegments();
        fetchNotifications();
        loadUserProfiles();
        loadScheduleFromDb(true).then(function() {
            if (schedulePollTimer) clearInterval(schedulePollTimer);
            schedulePollTimer = setInterval(function() {
                loadScheduleFromDb(true).then(function() {
                    var on = document.querySelector(".vp.on");
                    if (on && on.id === "vp-schedule") renderSchedule();
                    else if (on && on.id === "vp-dashboard") renderDash();
                });
                scheduleCleanupWindow();
            }, 30000);
        });
        subscribeRealTime();
    }, 400);
    if(loginBtn) { loginBtn.textContent = "Sign In"; loginBtn.disabled = false; }
}

var _signupCooldown = false;
async function handleUserSignup(event) {
    event.preventDefault();
    if (_signupCooldown) { showToast("Please wait before trying again.", "w"); return; }
    const emailInput = document.getElementById("s-em")?.value.toLowerCase().trim();
    const passwordInput = document.getElementById("s-pw")?.value;
    const signupBtn = document.getElementById("s-btn");
    const nameInput = document.getElementById("s-nm")?.value.trim();
    
    if (!emailInput || !passwordInput || passwordInput.length < 6) { showToast("Password must be at least 6 characters.", "w"); return; }
    if(signupBtn) { signupBtn.textContent = "Requesting…"; signupBtn.disabled = true; }
    startProgressBar();
    
    var { data, error } = await sb.auth.signUp({
        email: emailInput,
        password: passwordInput,
        options: { data: { name: nameInput || emailInput.split('@')[0] }, emailRedirectTo: window.location.origin + window.location.pathname.substring(0, window.location.pathname.lastIndexOf("/") + 1) + "verified.html" }
    });
    
    if (error) {
        var msg = error.message;
        if (msg.toLowerCase().includes("rate limit") || msg.toLowerCase().includes("rate_limit")) {
            showToast("Signup rate limit hit. Wait 1-2 minutes or disable email confirm in Supabase Auth settings.", "e", 8000);
            _signupCooldown = true;
            setTimeout(function() { _signupCooldown = false; }, 120000);
        } else {
            showToast("Signup failed: " + msg, "e");
        }
        if(signupBtn) { signupBtn.textContent = "Submit Request"; signupBtn.disabled = false; }
        finishProgressBar();
        return;
    }
    
    showToast("Check your email for the confirmation link.", "s", 8000);
    toggleAuthScreens("login");
    if(signupBtn) { signupBtn.textContent = "Submit Request"; signupBtn.disabled = false; }
    finishProgressBar();
    
    // Auto-login if session created immediately (confirmation disabled)
    if (data && data.session) {
        currentUser = { id: data.session.user.id, email: data.session.user.email, name: data.session.user.user_metadata?.name || emailInput.split('@')[0], avatar: data.session.user.user_metadata?.avatar || "" };
        updateSidebarProfile();
        finishProgressBar();
        showWelcomeScreen(currentUser.name, true);
        setTimeout(function() {
            var lastView = "dashboard";
            try { var saved = localStorage.getItem('seg_last_view'); if (saved) lastView = saved; } catch(e) {}
            nav(lastView); 
            loadAllSegments();
            fetchNotifications();
            loadUserProfiles();
            loadScheduleFromDb(true).then(function() {
                if (schedulePollTimer) clearInterval(schedulePollTimer);
                schedulePollTimer = setInterval(function() {
                    loadScheduleFromDb(true).then(function() {
                        var on = document.querySelector(".vp.on");
                        if (on && on.id === "vp-schedule") renderSchedule();
                        else if (on && on.id === "vp-dashboard") renderDash();
                    });
                }, 15000);
            });
            subscribeRealTime();
        }, 400);
    }
}

function processLogout() {
    sb.auth.signOut();
    if (segChannel) sb.removeChannel(segChannel);
    if (notifChannel) sb.removeChannel(notifChannel);
    if (profilesChannel) sb.removeChannel(profilesChannel);
    if (scheduleChannel) sb.removeChannel(scheduleChannel);
    if (schedulePollTimer) { clearInterval(schedulePollTimer); schedulePollTimer = null; }
    if (_syncDebounceTimer) clearTimeout(_syncDebounceTimer);
    globalSegments = {};
    userProfiles = {};
    currentUser = null;
    timelineSegments = [];
    segmentGlitches = {};

    var grid = document.getElementById("segmentGrid");
    if(grid) grid.innerHTML = "";
    clearInterval(autoSaveTimer);
    nav("login");
}
