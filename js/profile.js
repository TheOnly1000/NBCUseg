// ============================================================================
// 6. PROFILE & AVATAR COMPRESSION
// ============================================================================

function handleAvatarUpload(event) {
    const file = event.target.files[0]; 
    if (!file) return;
    if (!file.type.match('image.*')) { showToast("Please upload a valid image file (JPG, PNG).", "w"); return; }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement("canvas");
            const MAX_WIDTH = 80; const MAX_HEIGHT = 80;
            let width = img.width, height = img.height;
            if (width > height) { if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; } } 
            else { if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; } }
            
            canvas.width = width; canvas.height = height;
            canvas.getContext("2d").drawImage(img, 0, 0, width, height);
            
            const base64DataUrl = canvas.toDataURL("image/jpeg", 0.7); 
            const prev = document.getElementById('avatar-preview');
            const icon = document.getElementById('avatar-icon');
            if(prev) prev.style.backgroundImage = `url(${base64DataUrl})`;
            if(icon) icon.style.display = 'none';
            currentUser.avatar = base64DataUrl;
            
            showToast("Photo processed! Click 'Save Profile' to upload.", "i");
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function openProfileModal() {
    const pName = document.getElementById("pname");
    const pEmail = document.getElementById("pemail");
    if(pName) pName.value = currentUser.name || ""; 
    if(pEmail) pEmail.value = sanitizeHTML(currentUser.email);
    
    const prev = document.getElementById('avatar-preview');
    const icon = document.getElementById('avatar-icon');
    
    if (currentUser.avatar) { 
        if(prev) prev.style.backgroundImage = `url(${currentUser.avatar})`; 
        if(icon) icon.style.display = 'none'; 
    } else { 
        if(prev) prev.style.backgroundImage = 'none'; 
        if(icon) icon.style.display = 'block'; 
    }
    openModal("m-profile");
}

async function saveUserProfile() {
    const newName = document.getElementById("pname")?.value.trim();
    if (!newName) { showToast("Name cannot be empty.", "w"); return; }
    
    currentUser.name = newName;
    updateSidebarProfile(); 
    closeModal("m-profile");
    
    try {
        sb.from("profiles").update({ name: newName, avatar: currentUser.avatar || "" }).eq("id", currentUser.id).then(function(r) {
            if (r.error) console.warn("Profile sync failed.", r.error);
        });
    } catch(err) { console.warn("Profile sync failed.", err); }
    showToast("Profile updated successfully.", "s");
    if (currentUser.email) {
        userProfiles[currentUser.email.toLowerCase()] = { name: newName, avatar: currentUser.avatar || "", email: currentUser.email };
    }
}

function updateSidebarProfile() {
    const displayName = currentUser.name || currentUser.email.split("@")[0]; 
    const sbNm = document.getElementById("sb-nm");
    if(sbNm) sbNm.textContent = displayName;
    
    const avatarContainer = document.getElementById("sb-av");
    if (!avatarContainer) return;
    
    if (currentUser.avatar) { 
        avatarContainer.textContent = ""; 
        avatarContainer.style.backgroundImage = `url(${currentUser.avatar})`; 
        avatarContainer.style.backgroundSize = "cover"; 
    } else { 
        avatarContainer.textContent = displayName.charAt(0).toUpperCase(); 
        avatarContainer.style.backgroundImage = "none"; 
    }
}

function loadUserProfiles() {
    sb.from("profiles").select("id, name, avatar, email").then(function(r) {
        if (r.error) { console.warn("Profiles load error:", r.error); return; }
        userProfiles = {};
        (r.data || []).forEach(function(p) {
            if (p.email) {
                userProfiles[p.email.toLowerCase()] = { name: p.name || p.email.split('@')[0], avatar: p.avatar || "", email: p.email };
            }
        });
        // Also pull unique user names from assets for assignment dropdown
        sb.from("assets").select("created_by").then(function(ar) {
            if (!ar.error && ar.data) {
                ar.data.forEach(function(a) {
                    if (a.created_by) {
                        var key = a.created_by.toLowerCase();
                        if (!userProfiles[key]) {
                            userProfiles[key] = { name: a.created_by, avatar: "", email: a.created_by };
                        }
                    }
                });
            }
            if (currentUser && currentUser.email) {
                var profile = userProfiles[currentUser.email.toLowerCase()];
                if (profile) {
                    currentUser.name = profile.name;
                    currentUser.avatar = profile.avatar;
                    updateSidebarProfile();
                }
            }
            refreshCurrentView();
        });
    });
}

function getUserInfo(emailOrName) {
    if (!emailOrName) return null;
    var key = emailOrName.toLowerCase();
    if (userProfiles[key]) return userProfiles[key];
    for (var k in userProfiles) {
        if (k.toLowerCase() === key) return userProfiles[k];
    }
    for (var k in userProfiles) {
        if (userProfiles[k].name && userProfiles[k].name.toLowerCase() === key) return userProfiles[k];
    }
    return null;
}

function getUserAvatarHtml(email, name, size) {
    if (!size) size = 24;
    if (!name && !email) return '<div class=\"rounded-full bg-sc text-secondary flex items-center justify-center font-bold flex-shrink-0\" style=\"width:'+size+'px;height:'+size+'px;font-size:'+Math.round(size*0.45)+'px;line-height:1\">?</div>';
    var displayName = name || (email ? email.split('@')[0] : "?");
    var profile = email ? getUserInfo(email) : null;
    if (!profile && name) profile = getUserInfo(name);
    if (profile && profile.avatar) {
        return '<div class=\"rounded-full flex-shrink-0 bg-cover bg-center\" style=\"width:'+size+'px;height:'+size+'px;background-image:url('+profile.avatar+');background-size:cover;background-position:center\"></div>';
    }
    var initial = displayName.charAt(0).toUpperCase();
    return '<div class=\"rounded-full bg-pf text-primary flex items-center justify-center font-bold flex-shrink-0 border border-primary/20\" style=\"width:'+size+'px;height:'+size+'px;font-size:'+Math.round(size*0.45)+'px;line-height:1\">'+initial+'</div>';
}

async function deleteUserAccount() {
    showGlobalLoader(true);
    var email = currentUser.email || "";
    var uid = currentUser.id;
    // Clean up user's data (keep segments, assets, tickets, schedule)
    await sb.from("ticket_comments").delete().eq("user_email", email);
    await sb.from("notifications").delete().eq("target_email", email);
    await sb.from("notification_reads").delete().eq("user_email", email);
    await sb.from("comment_views").delete().eq("user_email", email);
    await sb.from("ticket_views").delete().eq("user_email", email);
    // Delete profile
    await sb.from("profiles").delete().eq("id", uid);
    // Delete from auth.users via RPC
    try { await sb.rpc("admin_delete_user", { uid: uid }); } catch(e) { /* best-effort */ }
    showGlobalLoader(false);
    showToast("Account deleted. Signing out...", "s", 3000);
    setTimeout(function() { processLogout(); }, 2000);
}
