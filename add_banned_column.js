var svcKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6Ymt0d3l1cnNraHZ0d2trbHp1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjMwMjA4MSwiZXhwIjoyMDk3ODc4MDgxfQ.D1M72cLrUwtYPU0UHQDlqDPYJgIVPYuUYJbMG_PTVac';
var base = 'https://fzbktwyurskhvtwkklzu.supabase.co';

async function run() {
  // Try creating the function via SQL
  var sql = "ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banned boolean DEFAULT false;";
  
  var resp = await fetch(base + '/rest/v1/rpc/pgquery', {
    method: 'POST',
    headers: {
      'apikey': svcKey,
      'Authorization': 'Bearer ' + svcKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({ query: sql })
  });
  var txt = await resp.text();
  console.log('SQL status:', resp.status, txt.substring(0, 500));
  
  if (resp.status !== 200) {
    // Try direct query on profiles to check if banned column exists
    var r2 = await fetch(base + '/rest/v1/profiles?select=id,banned&limit=1', {
      headers: {
        'apikey': svcKey,
        'Authorization': 'Bearer ' + svcKey,
        'Accept': 'application/json'
      }
    });
    var data = await r2.json();
    console.log('profiles query:', r2.status, JSON.stringify(data).substring(0, 200));
  }
}
run().catch(console.error);
