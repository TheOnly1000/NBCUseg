// ============================================================================
// 1. CONFIGURATION & GLOBAL STATE
// ============================================================================

const APP_VERSION = "2.0.1";
const SUPABASE_URL = "https://fzbktwyurskhvtwkklzu.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6Ymt0d3l1cnNraHZ0d2trbHp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzMDIwODEsImV4cCI6MjA5Nzg3ODA4MX0.MEZzsQ7BHs_Jh2wozEkJVml43T599w0PkG9GH8aAyUM";
var sb = null;
try { sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY); } catch(e) { console.error("Supabase init failed", e); }

// Force hide boot-loader after 8s regardless (safety net)
setTimeout(function() { var b = document.getElementById("boot-loader"); if(b) { b.style.opacity = "0"; setTimeout(function() { b.style.display = "none"; }, 500); } }, 8000);
let globalSegments = {};
let userProfiles = {}; // email -> { name, avatar, email }
var schedulePollTimer = null;
var _lastNotifCount = 0;
var _pendingHandoverRequestAsset = null;
var _pendingScheduleLaunch = null;
var _syncDebounceTimer = null;
let currentUser = { id: "", email: "", name: "", avatar: "" };
let timelineSegments = []; 
let currentFullscreenAssetId = null;

let unsavedChanges = false;
let autoSaveTimer = null;
let undoStack = []; 
let searchResultIndex = 0;
let searchResultsList = [];
let dragSourceElement = null;

let segmentGlitches = {};
let currentActiveGlitchSegment = null;
const GLITCH_OPTIONS_HTML = `
    <option value="None">None</option>
    <option value="Black Frame">Black Frame</option>
    <option value="Black screen">Black screen</option>
    <option value="Color bars">Color bars</option>
    <option value="Audio loss">Audio loss</option>
    <option value="Freeze frame">Freeze frame</option>
    <option value="No signal">No signal</option>
    <option value="Visual Glitch">Visual Glitch</option>
`;
