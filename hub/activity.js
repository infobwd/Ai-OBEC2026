// Public activity projection. No real identity, no write API, no lease data.
function activityView(data,now){
  const fail=reason=>({state:"UNKNOWN",station:null,step:null,job:null,phase:null,reason});
  const jobs=["P0","P1","D1","D2","D3","D4","D5","D6","CERT","SANDBOX","P1-MEDIA","D1-MEDIA","D2-MEDIA","D3-MEDIA","D4-MEDIA","D5-MEDIA","D6-MEDIA","CERT-MEDIA","SANDBOX-MEDIA","P5"];
  const phases={EVIDENCE:["EVIDENCE",1],DESIGN:["KNOWLEDGE",2],PRODUCE_KNOWLEDGE:["KNOWLEDGE",3],PRODUCE_MEDIA:["MEDIA",3],QA:["QA",4],DELIVERY:["QA",5]};
  const terminal=["DELIVERED_INTERNAL","BLOCKED","NO_CHANGE","PARTIAL"];
  const exact=(obj,keys)=>obj&&typeof obj==="object"&&!Array.isArray(obj)&&Object.keys(obj).length===keys.length&&keys.every(k=>Object.prototype.hasOwnProperty.call(obj,k));
  const iso=x=>typeof x==="string"&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(x)&&Number.isFinite(Date.parse(x));
  const day=x=>typeof x==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x));
  if(!Number.isFinite(now)||!exact(data,["schema_version","mode","state","job","phase","reported_at","expires_at","last_completed"])||data.schema_version!==1||data.mode!=="REPORTED_ACTIVITY")return fail("SCHEMA");
  const last=data.last_completed;
  if(last!==null&&(!exact(last,["job","date","result"])||!jobs.includes(last.job)||!day(last.date)||last.result!=="DELIVERED_INTERNAL"))return fail("SCHEMA");
  if(data.state==="NO_CONFIRMED_ACTIVITY"){
    if(data.job!==null||data.phase!==null||data.reported_at!==null||data.expires_at!==null)return fail("SCHEMA");
    return {state:data.state,station:null,step:null,job:null,phase:null,last_completed:last};
  }
  if(!jobs.includes(data.job)||!iso(data.reported_at))return fail("SCHEMA");
  const at=Date.parse(data.reported_at);if(at>now+60000)return fail("FUTURE");
  if(terminal.includes(data.state)){
    if(data.phase!==null||data.expires_at!==null)return fail("SCHEMA");
    return {state:data.state,station:null,step:null,job:data.job,phase:null,reported_at:data.reported_at,last_completed:last};
  }
  if(data.state!=="RUNNING"||!Object.prototype.hasOwnProperty.call(phases,data.phase)||!iso(data.expires_at))return fail("SCHEMA");
  const exp=Date.parse(data.expires_at);
  if(exp<=at||exp-at>15*60000)return fail("TTL");
  if(data.phase==="PRODUCE_MEDIA"&&!data.job.endsWith("-MEDIA"))return fail("TRACK");
  if(data.phase==="PRODUCE_KNOWLEDGE"&&data.job.endsWith("-MEDIA"))return fail("TRACK");
  if(now>=exp)return {...fail("EXPIRED"),last_completed:last};
  return {state:"RUNNING",station:phases[data.phase][0],step:phases[data.phase][1],job:data.job,phase:data.phase,reported_at:data.reported_at,expires_at:data.expires_at,last_completed:last};
}

function activityViewTests(){
  const t=Date.parse("2026-11-28T01:00:00Z"),iso=x=>new Date(x).toISOString();
  const initial={schema_version:1,mode:"REPORTED_ACTIVITY",state:"NO_CONFIRMED_ACTIVITY",job:null,phase:null,reported_at:null,expires_at:null,last_completed:{job:"D2",date:"2026-11-27",result:"DELIVERED_INTERNAL"}};
  const run=(phase,job="D3")=>({...initial,state:"RUNNING",job,phase,reported_at:iso(t),expires_at:iso(t+600000)});
  const tests=[];const check=(n,p)=>{if(!p)throw Error(n);tests.push(n)};
  check("unconfirmed never active",activityView(initial,t).station===null);
  for(const [phase,station,step,job] of [["EVIDENCE","EVIDENCE",1,"D3"],["DESIGN","KNOWLEDGE",2,"D3"],["PRODUCE_KNOWLEDGE","KNOWLEDGE",3,"D3"],["PRODUCE_MEDIA","MEDIA",3,"P1-MEDIA"],["QA","QA",4,"D3"],["DELIVERY","QA",5,"D3"]]){const r=activityView(run(phase,job),t);check(phase,r.station===station&&r.step===step&&r.state==="RUNNING")}
  check("expiry clears active",activityView(run("EVIDENCE"),t+600000).reason==="EXPIRED");
  check("max TTL",activityView({...run("EVIDENCE"),expires_at:iso(t+900001)},t).reason==="TTL");
  check("future report rejected",activityView({...run("EVIDENCE"),reported_at:iso(t+61000)},t).reason==="FUTURE");
  check("media wrong job rejected",activityView(run("PRODUCE_MEDIA"),t).reason==="TRACK");
  check("academic wrong job rejected",activityView(run("PRODUCE_KNOWLEDGE","P1-MEDIA"),t).reason==="TRACK");
  check("unknown job rejected",activityView(run("EVIDENCE","TEST-A"),t).reason==="SCHEMA");
  check("unknown phase rejected",activityView(run("ACTIVE"),t).reason==="SCHEMA");
  check("sandbox mode rejected",activityView({...run("EVIDENCE"),mode:"SANDBOX_ONLY"},t).reason==="SCHEMA");
  check("extra personal fields rejected",activityView({...run("EVIDENCE"),email:"x@example.invalid"},t).reason==="SCHEMA");
  check("unconfirmed with job rejected",activityView({...initial,job:"D3"},t).reason==="SCHEMA");
  for(const state of ["DELIVERED_INTERNAL","BLOCKED","NO_CHANGE","PARTIAL"])check(state,activityView({...initial,state,job:"D3",reported_at:iso(t)},t).station===null);
  check("malformed feed",activityView(null,t).reason==="SCHEMA");
  return {pass:tests.length,tests};
}
