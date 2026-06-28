var fs=require('fs');
var { createClient }=require('@supabase/supabase-js');
var svcKey=process.env.SUPABASE_SERVICE_KEY;
if(!svcKey){console.error("Set SUPABASE_SERVICE_KEY env var");process.exit(1)}
var sb=createClient("https://fzbktwyurskhvtwkklzu.supabase.co",svcKey);

var csv=fs.readFileSync("NBCU Telemundo Segmentation Sheet - 2026.csv","utf8");
var lines=csv.split(/\r?\n/);
var segs=[],batch=[];
var currentDate="",currentAsset="",currentTitle="",currentType="";

function parseDate(str){
  if(!str)return"";
  str=str.trim().replace(/^"|"$/g,"");
  if(!str)return"";
  var d=new Date(str);
  if(!isNaN(d))return d.toISOString().split("T")[0];
  var p=str.split("/");
  if(p.length===3)return p[2]+"-"+p[0].padStart(2,"0")+"-"+p[1].padStart(2,"0");
  return str;
}

function cleanCell(v){
  if(!v)return"";
  v=String(v).trim().replace(/^"|"$/g,"");
  if(v==="--"||v==="---"||v==="-"||v==="#N/A"||v==="#VALUE!"||v==="0:00:00"||v==="12/30/1899"||v==="00:00:00"||v==="0:00"||v==="0")return"";
  return v;
}

for(var i=1;i<lines.length;i++){
  var line=lines[i].trim();
  if(!line||line.startsWith("TOTAL DURATION"))continue;
  // Split CSV respecting quotes
  var cols=[],cur="",inq=false;
  for(var c=0;c<line.length;c++){
    var ch=line[c];
    if(ch==='"'&&!inq){inq=true;continue}
    if(ch==='"'&&inq){inq=false;continue}
    if(ch===","&&!inq){cols.push(cur);cur="";continue}
    cur+=ch;
  }
  cols.push(cur);
  if(cols.length<5)continue;

  var dateRaw=cols[0]||"";
  var assetRaw=cols[1]||"";
  var titleRaw=cols[2]||"";
  var typeRaw=cols[3]||"";
  var segRaw=cols[4]||"";

  // Track current event context from non-empty columns
  var d=parseDate(dateRaw);
  if(d)currentDate=d;
  var a=cleanCell(assetRaw);
  if(a)currentAsset=a;
  var t=cleanCell(titleRaw);
  if(t)currentTitle=t;
  var ty=cleanCell(typeRaw);
  if(ty)currentType=ty;

  var seg=cleanCell(segRaw);
  if(!seg||!seg.match(/^[A-Za-z]\d*$/))continue;
  if(!currentAsset)continue;

  var tcIn=cleanCell(cols[5]||"");
  var tcOut=cleanCell(cols[6]||"");
  var glitch=cleanCell(cols[7]||"");
  var comment=cleanCell(cols[8]||"");
  var duration=cleanCell(cols[9]||"");
  var breaks=cleanCell(cols[10]||"");
  var mcr=cleanCell(cols[11]||"");

  segs.push({
    date:currentDate||"2025-01-01",
    asset_id:currentAsset,
    title:currentTitle||"Untitled",
    type:currentType||"Record",
    seg:seg,
    tc_in:tcIn,
    tc_out:tcOut,
    glitch:glitch,
    comment:comment,
    duration:duration,
    breaks:breaks,
    mcr_fmt:mcr,
    created_by:"import",
    status:"Ended",
    locked_by:""
  });
}

console.log("Parsed",segs.length,"segment rows");

// Deduplicate: for same asset_id+seg, keep last occurrence
var seen={};
var unique=[];
for(var i=segs.length-1;i>=0;i--){
  var key=segs[i].asset_id+"_"+segs[i].seg;
  if(!seen[key]){seen[key]=true;unique.push(segs[i])}
}
unique.reverse();
console.log("Unique segments:",unique.length);

// Group by asset
var assets={};
unique.forEach(function(s){
  if(!assets[s.asset_id])assets[s.asset_id]={asset:s.asset_id,title:s.title,type:s.type,date:s.date,segs:[],totalDuration:""};
  assets[s.asset_id].segs.push(s);
  // Also populate top-level metadata from last occurrence
  if(s.title)assets[s.asset_id].title=s.title;
  if(s.type!="Record")assets[s.asset_id].type=s.type;
});
var assetList=Object.keys(assets).map(function(k){return assets[k]});
console.log("Unique assets:",assetList.length);

// Batch insert - delete existing then insert all
(async function(){
  // First check which assets already exist
  var existing=await sb.from("segments").select("asset_id").in("asset_id",assetList.map(function(a){return a.asset}));
  if(existing.data&&existing.data.length){
    var existingIds=[...new Set(existing.data.map(function(r){return r.asset_id}))];
    console.log("Deleting",existingIds.length,"existing assets");
    for(var id of existingIds){
      await sb.from("segments").delete().eq("asset_id",id);
    }
  }

  // Insert all segments
  var inserted=0;
  for(var aObj of assetList){
    var rows=aObj.segs.map(function(s){
      var yearVal=parseInt(s.date.split("-")[0])||2025;
      return{
        year:yearVal,
        date:s.date,
        asset_id:s.asset_id,
        title:aObj.title,
        type:aObj.type,
        seg:s.seg,
        tc_in:s.tc_in,
        tc_out:s.tc_out,
        glitch:s.glitch,
        comment:s.comment,
        duration:s.duration,
        breaks:s.breaks,
        mcr_fmt:s.mcr_fmt||(s.asset_id+s.seg+" - "+s.duration),
        created_by:"import",
        status:"Ended",
        locked_by:""
      };
    });
    var res=await sb.from("segments").upsert(rows,{onConflict:"asset_id, seg",ignoreDuplicates:false});
    if(res.error){console.error("Insert error for",aObj.asset,":",res.error.message)}else{inserted+=rows.length;console.log("Imported",aObj.asset,"-",rows.length,"segs")}
  }
  console.log("Done. Inserted",inserted,"segments across",assetList.length,"assets");
})();
