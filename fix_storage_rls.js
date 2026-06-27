var svcKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6Ymt0d3l1cnNraHZ0d2trbHp1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjMwMjA4MSwiZXhwIjoyMDk3ODc4MDgxfQ.D1M72cLrUwtYPU0UHQDlqDPYJgIVPYuUYJbMG_PTVac';
var url = 'https://fzbktwyurskhvtwkklzu.supabase.co';

async function run() {
  // Check if policies already exist
  var resp = await fetch(url + '/rest/v1/storage/policies?select=name,action', {
    headers: {
      'apikey': svcKey,
      'Authorization': 'Bearer ' + svcKey,
      'Accept': 'application/json',
      'Accept-Profile': 'storage'
    }
  });
  var existing = await resp.json();
  console.log('Policies response:', JSON.stringify(existing).substring(0, 500));
  
  if (Array.isArray(existing)) {
    var hasInsert = existing.some(function(p) { return p.action === 'INSERT' && (p.name || '').includes('thumbnails'); });
    var hasSelect = existing.some(function(p) { return p.action === 'SELECT' && (p.name || '').includes('thumbnails'); });
    console.log('Has INSERT policy:', hasInsert, 'Has SELECT policy:', hasSelect);
    if (hasInsert && hasSelect) { console.log('All policies exist'); return; }
  }
  
  // Insert policies directly
  var pols = [
    { name: 'anon_upload_thumbnails', definition: "(bucket_id = 'thumbnails'::text)", buckets: ['thumbnails'], action: 'INSERT', owner: '', public: true },
    { name: 'anon_select_thumbnails', definition: "(bucket_id = 'thumbnails'::text)", buckets: ['thumbnails'], action: 'SELECT', owner: '', public: true }
  ];
  
  for (var p of pols) {
    var r = await fetch(url + '/rest/v1/storage/policies', {
      method: 'POST',
      headers: {
        'apikey': svcKey,
        'Authorization': 'Bearer ' + svcKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Profile': 'storage',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(p)
    });
    var txt = await r.text();
    console.log('Create ' + p.name + ': status ' + r.status + ' ' + (txt || 'ok').substring(0, 200));
  }
}
run().catch(console.error);
