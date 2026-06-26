// ============================================================================
// 3. UI HELPERS (Loaders, Toasts, Modals)
// ============================================================================

function startProgressBar() { 
    const pbar = document.getElementById("pbar");
    if(pbar) pbar.className = "loading"; 
}

function finishProgressBar() { 
    const bar = document.getElementById("pbar"); 
    if(!bar) return;
    bar.className = "done"; 
    setTimeout(() => { bar.style.width = "0"; bar.className = ""; }, 400); 
}

function showWelcomeScreen(userName, isFirstLogin) {
    const overlay = document.getElementById("welcome-overlay");
    const nameEl = document.getElementById("welcome-name");
    const headingEl = document.getElementById("welcome-heading");
    if (!overlay) return;
    if (nameEl) nameEl.textContent = userName || "User";
    if (headingEl) headingEl.textContent = isFirstLogin ? "Welcome to Segmentor!" : "Welcome back!";
    overlay.style.display = "flex";
    overlay.style.transform = "translateY(100%)";
    overlay.style.transition = "none";
    requestAnimationFrame(() => {
        overlay.style.transition = "transform .6s cubic-bezier(.16,1,.3,1)";
        overlay.style.transform = "translateY(0)";
    });
    setTimeout(() => hideWelcomeScreen(), 2200);
}

function hideWelcomeScreen() {
    const overlay = document.getElementById("welcome-overlay");
    if (!overlay) return;
    overlay.style.transition = "transform .5s cubic-bezier(.4,0,.2,1)";
    overlay.style.transform = "translateY(100%)";
    setTimeout(() => {
        overlay.style.display = "none";
        overlay.style.transform = "translateY(100%)";
    }, 550);
}

function showGlobalLoader(show) {
    const loader = document.getElementById("gl");
    if(!loader) return;
    loader.style.display = show ? "flex" : "none";
}

function showToast(message, type = "i", durationMs = 4000, actionObj = null) {
    const icons = { s: "check_circle", e: "error", w: "warning", i: "info" };
    const toastElement = document.createElement("div"); 
    toastElement.className = `tk ${type}`;
    
    let actionHtml = "";
    if (actionObj) {
        actionHtml = `<button onclick="${actionObj.fn}()" style="margin-left:8px;font-size:11px;font-weight:800;text-transform:uppercase;color:var(--c-primary);background:none;border:none;cursor:pointer;padding:0">${actionObj.label}</button>`;
    }

    toastElement.innerHTML = `
        <span class="ms" style="font-size:18px;flex-shrink:0">${icons[type] || "info"}</span>
        <span style="flex:1">${sanitizeHTML(message)}</span>
        ${actionHtml}
    `;
    
    const trEl = document.getElementById("tr");
    if(trEl) trEl.appendChild(toastElement);
    
    setTimeout(() => {
        toastElement.style.opacity = "0";
        toastElement.style.transform = "translateX(14px)";
        setTimeout(() => toastElement.remove(), 320);
    }, durationMs);
}

function openNewAsset() {
    const dateEl = document.getElementById("na-date");
    if (dateEl) dateEl.value = new Date().toISOString().split("T")[0];
    openModal("m-newasset");
}

function triggerRipple(event) {
    const host = event.currentTarget;
    const wave = document.createElement("span"); wave.className = "ripple-wave";
    const rect = host.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height); 
    
    wave.style.width = size + "px"; wave.style.height = size + "px";
    wave.style.left = (event.clientX - rect.left - size / 2) + "px"; 
    wave.style.top = (event.clientY - rect.top - size / 2) + "px";
    
    host.appendChild(wave); 
    setTimeout(() => wave.remove(), 600);
}

function openModal(id) { 
    const el = document.getElementById(id);
    if(el) el.classList.add("on"); 
}

function closeModal(id) { 
    const el = document.getElementById(id);
    if(el) el.classList.remove("on"); 
}

function om(id) { openModal(id); }
function cm(id) { closeModal(id); }

function toggleSidebar() {
    document.getElementById("sidebar")?.classList.toggle("open");
    document.getElementById("sb-bd")?.classList.toggle("on");
}

function toggleSidebarDesktop() {
    const isMobile = window.innerWidth <= 767;
    if (isMobile) {
        toggleSidebar();
    } else {
        const sidebar = document.getElementById("sidebar");
        if (sidebar) {
            sidebar.classList.toggle("collapsed");
            const icon = document.getElementById("hamburger-icon");
            if (icon) {
                icon.textContent = sidebar.classList.contains("collapsed") ? "menu_open" : "menu";
            }
        }
    }
}

function closeSidebar() {
    document.getElementById("sidebar")?.classList.remove("open");
    document.getElementById("sb-bd")?.classList.remove("on");
}

function togglePasswordVisibility(inputId, buttonElement) {
    const input = document.getElementById(inputId);
    if (!input) return;
    if (input.type === "password") {
        input.type = "text";
        buttonElement.querySelector(".ms").textContent = "visibility";
    } else {
        input.type = "password";
        buttonElement.querySelector(".ms").textContent = "visibility_off";
    }
}

function requestConfirmation(title, message, callbackFn, buttonLabel = "Confirm", iconStr = "warning") {
    if(document.getElementById("confirm-title")) document.getElementById("confirm-title").textContent = title; 
    if(document.getElementById("confirm-msg")) document.getElementById("confirm-msg").textContent = message; 
    if(document.getElementById("confirm-icon")) document.getElementById("confirm-icon").textContent = iconStr;
    
    const iconWrap = document.getElementById("confirm-icon-wrap");
    if(iconWrap) iconWrap.style.background = "var(--c-ec)"; 
    if(document.getElementById("confirm-icon")) document.getElementById("confirm-icon").style.color = "var(--c-error)";
    
    const confirmOk = document.getElementById("confirm-ok");
    if(confirmOk) {
        confirmOk.textContent = buttonLabel; 
        confirmOk.onclick = () => {
            closeModal("m-confirm");
            callbackFn();
        };
    }
    openModal("m-confirm");
}

function updateDualClocks() {
    const now = new Date();
    const istClock = document.getElementById('clock-ist');
    const edtClock = document.getElementById('clock-edt');
    if (istClock) istClock.innerText = now.toLocaleTimeString('en-US', {timeZone: 'Asia/Kolkata', hour12: false});
    if (edtClock) edtClock.innerText = now.toLocaleTimeString('en-US', {timeZone: 'America/New_York', hour12: false});
}
setInterval(updateDualClocks, 1000);

function setAccentColor(color, el) {
    document.documentElement.style.setProperty('--c-primary', color);
    const rgb = hexToRgb(color);
    const ring = rgb ? `rgba(${rgb.r},${rgb.g},${rgb.b},0.15)` : 'rgba(0,62,199,0.15)';
    document.documentElement.style.setProperty('--c-input-focus-ring', ring);
    
    document.documentElement.style.setProperty('--c-pc', darkenColor(color, 10));
    document.documentElement.style.setProperty('--c-op', '#ffffff');
    document.documentElement.style.setProperty('--c-pf', lightenColor(color, 80));
    document.documentElement.style.setProperty('--c-opc', hexToRgba(color, 0.08));
    document.documentElement.style.setProperty('--c-primary-grad', darkenColor(color, 30));
    
    const picker = document.getElementById('theme-accent-picker');
    if (picker) picker.value = color;
    document.querySelectorAll('.tc-swatch').forEach(s => s.classList.toggle('active', s.dataset.color === color));
    
    localStorage.setItem('seg_accent_color', color);
}

function lightenColor(hex, percent) {
    var rgb = hexToRgb(hex);
    if (!rgb) return hex;
    var r = Math.min(255, rgb.r + Math.round(255 * percent / 100));
    var g = Math.min(255, rgb.g + Math.round(255 * percent / 100));
    var b = Math.min(255, rgb.b + Math.round(255 * percent / 100));
    return '#' + [r,g,b].map(function(c){ return c.toString(16).padStart(2,'0'); }).join('');
}

function darkenColor(hex, percent) {
    var rgb = hexToRgb(hex);
    if (!rgb) return hex;
    var r = Math.max(0, rgb.r - Math.round(255 * percent / 100));
    var g = Math.max(0, rgb.g - Math.round(255 * percent / 100));
    var b = Math.max(0, rgb.b - Math.round(255 * percent / 100));
    return '#' + [r,g,b].map(function(c){ return c.toString(16).padStart(2,'0'); }).join('');
}

function hexToRgba(hex, alpha) {
    var rgb = hexToRgb(hex);
    if (!rgb) return 'rgba(0,62,199,' + alpha + ')';
    return 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + alpha + ')';
}

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : null;
}


