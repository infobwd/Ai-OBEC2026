// H3 queue core V0.1: synthetic sandbox only. No production data.
function queueCore(state, actor, req, now, token) {
  const fail = code => ({ok:false,code});
  if (!actor || !["WORKER","ADMIN","VIEWER"].includes(actor.role) || typeof actor.id!=="string" || !actor.id) return fail("DENIED");
  if (!state || state.schema!==1 || state.mode!=="SANDBOX_ONLY" || !Array.isArray(state.jobs) || !Array.isArray(state.events)) return fail("BAD_STATE");
  if (!req || typeof req!=="object" || !Number.isFinite(now)) return fail("BAD_REQUEST");
  const jobs=state.jobs;
  if (jobs.some(j=>!/^TEST-[A-Z0-9-]{1,40}$/.test(j.id)) || new Set(jobs.map(j=>j.id)).size!==jobs.length) return fail("BAD_STATE");
  if (req.action==="list") return {ok:true,code:"OK",jobs:jobs.map(j=>({id:j.id,track:j.track,state:j.state,expiresAt:j.expiresAt||null}))};
  if (!["WORKER","ADMIN"].includes(actor.role)) return fail("DENIED");
  if (!["claim","start","submit","block","reconcile","renew"].includes(req.action)) return fail("BAD_ACTION");
  if (req.action==="reconcile" && actor.role!=="ADMIN") return fail("DENIED");
  if (typeof req.request_id!=="string" || !/^[A-Za-z0-9_-]{8,80}$/.test(req.request_id) || typeof req.expected_job_id!=="string" || !/^TEST-[A-Z0-9-]{1,40}$/.test(req.expected_job_id)) return fail("BAD_REQUEST");
  const signature=JSON.stringify([req.action,req.expected_job_id,req.track||"",req.lease_token||""]);
  const prior=state.events.find(e=>e.requestId===req.request_id);
  if(prior) return prior.actor===actor.id&&prior.signature===signature ? JSON.parse(JSON.stringify(prior.response)) : fail("REQUEST_ID_CONFLICT");
  const j=jobs.find(j=>j.id===req.expected_job_id);
  if(!j)return fail("EXPECTED_JOB_NOT_FOUND");
  const active=x=>["CLAIMED","PRODUCING"].includes(x.state);
  const finish=(code, fields={})=>{
    const response={ok:true,code,job_id:j.id,state:j.state,...fields};
    state.events.push({requestId:req.request_id,actor:actor.id,signature,action:req.action,jobId:j.id,at:now,response});
    return response;
  };
  if(req.action==="claim"){
    if(!["ACADEMIC","MEDIA"].includes(req.track)||req.track!==j.track)return fail("TRACK_MISMATCH");
    if(jobs.some(active))return fail(jobs.some(x=>active(x)&&x.expiresAt<=now)?"RECONCILIATION_REQUIRED":"ACTIVE_LEASE_EXISTS");
    const next=jobs.filter(x=>x.track===req.track&&x.state==="QUEUED").sort((a,b)=>a.priority-b.priority||a.id.localeCompare(b.id))[0];
    if(!next||next.id!==j.id)return fail("NOT_NEXT_ELIGIBLE");
    if(typeof token!=="string"||token.length<16)return fail("TOKEN_REQUIRED");
    j.state="CLAIMED";j.owner=actor.id;j.lease=token;j.expiresAt=now+30*60*1000;
    return finish("CLAIMED",{lease_token:j.lease,expires_at:j.expiresAt});
  }
  if(req.action==="reconcile"){
    if(!active(j)||j.expiresAt>now)return fail("NOT_EXPIRED");
    j.state="BLOCKED";j.owner="";j.lease="";j.expiresAt=0;
    return finish("BLOCKED_REVIEW_REQUIRED");
  }
  if(!active(j)||j.owner!==actor.id||typeof req.lease_token!=="string"||!req.lease_token||req.lease_token!==j.lease)return fail("LEASE_MISMATCH");
  if(j.expiresAt<=now)return fail("LEASE_EXPIRED");
  if(req.action==="start"){
    if(j.state!=="CLAIMED")return fail("INVALID_TRANSITION");
    j.state="PRODUCING";return finish("STARTED");
  }
  if(req.action==="renew"){j.expiresAt=now+30*60*1000;return finish("RENEWED",{expires_at:j.expiresAt});}
  if(req.action==="submit"&&j.state!=="PRODUCING")return fail("INVALID_TRANSITION");
  j.state=req.action==="submit"?"TECH_QA":"BLOCKED";
  j.owner="";j.lease="";j.expiresAt=0;
  return finish(j.state==="TECH_QA"?"SUBMITTED_FOR_QA":"BLOCKED");
}

function queueCoreTests() {
  const fresh=()=>({schema:1,mode:"SANDBOX_ONLY",jobs:[{id:"TEST-A",track:"ACADEMIC",priority:1,state:"QUEUED"},{id:"TEST-B",track:"ACADEMIC",priority:2,state:"QUEUED"},{id:"TEST-M",track:"MEDIA",priority:1,state:"QUEUED"},{id:"TEST-R",track:"ACADEMIC",priority:0,state:"PENDING_REVIEW"}],events:[]});
  const w={id:"worker-1",role:"WORKER"},w2={id:"worker-2",role:"WORKER"},admin={id:"admin",role:"ADMIN"},viewer={id:"viewer",role:"VIEWER"};
  const token="synthetic-lease-token-0001",t=1000000;
  let s=fresh(),out=[];
  const req=(action,id,n,extra={})=>({action,expected_job_id:id,request_id:"request-"+n,...extra});
  const claim=req("claim","TEST-A","001",{track:"ACADEMIC"});
  const check=(name,condition)=>{if(!condition)throw Error("FAIL "+name);out.push(name)};
  const run=(actor,r,time=t)=>queueCore(s,actor,r,time,token);
  check("deny unknown identity",run(null,claim).code==="DENIED");
  check("deny viewer writes",run(viewer,claim).code==="DENIED");
  check("allow viewer read without token",run(viewer,{action:"list"}).jobs.every(j=>!("lease" in j)));
  check("reject production ID",run(w,req("claim","D3","000",{track:"ACADEMIC"})).code==="BAD_REQUEST");
  check("expected ID guard",run(w,req("claim","TEST-B","002",{track:"ACADEMIC"})).code==="NOT_NEXT_ELIGIBLE");
  check("pending review cannot claim",run(w,req("claim","TEST-R","003",{track:"ACADEMIC"})).code==="NOT_NEXT_ELIGIBLE");
  check("wrong track",run(w,req("claim","TEST-A","004",{track:"MEDIA"})).code==="TRACK_MISMATCH");
  let c=run(w,claim);check("claim exactly one",c.ok&&s.jobs[0].state==="CLAIMED"&&s.events.length===1);
  check("idempotent retry",JSON.stringify(run(w,claim))===JSON.stringify(c)&&s.events.length===1);
  check("request collision",run(w2,claim).code==="REQUEST_ID_CONFLICT");
  check("no parallel lease",run(w2,req("claim","TEST-M","005",{track:"MEDIA"})).code==="ACTIVE_LEASE_EXISTS");
  check("other worker cannot start",run(w2,req("start","TEST-A","006",{lease_token:token})).code==="LEASE_MISMATCH");
  check("wrong token denied",run(w,req("start","TEST-A","007",{lease_token:"bad"})).code==="LEASE_MISMATCH");
  check("submit before start denied",run(w,req("submit","TEST-A","008",{lease_token:token})).code==="INVALID_TRANSITION");
  check("start",run(w,req("start","TEST-A","009",{lease_token:token})).code==="STARTED");
  check("renew",run(w,req("renew","TEST-A","010",{lease_token:token}),t+1000).expires_at===t+1000+1800000);
  check("submit only to QA",run(w,req("submit","TEST-A","011",{lease_token:token}),t+2000).state==="TECH_QA"&&s.jobs[0].lease==="");
  check("cannot self-approve",run(w,req("approve","TEST-A","012")).code==="BAD_ACTION");
  check("next claim after submit",run(w,req("claim","TEST-B","013",{track:"ACADEMIC"}),t+3000).ok);
  check("expired lease cannot start",run(w,req("start","TEST-B","014",{lease_token:token}),t+1804000).code==="LEASE_EXPIRED");
  check("expired lease prevents other claim",run(w,req("claim","TEST-M","015",{track:"MEDIA"}),t+1804000).code==="RECONCILIATION_REQUIRED");
  check("worker cannot reconcile",run(w,req("reconcile","TEST-B","016"),t+1804000).code==="DENIED");
  check("admin blocks expired job",run(admin,req("reconcile","TEST-B","017"),t+1804000).code==="BLOCKED_REVIEW_REQUIRED");
  check("media claim after reconciliation",run(w,req("claim","TEST-M","018",{track:"MEDIA"}),t+1804001).ok);
  check("manual block",run(w,req("block","TEST-M","019",{lease_token:token}),t+1804002).state==="BLOCKED");
  check("bad mode fails closed",queueCore({...fresh(),mode:"PRODUCTION"},w,claim,t,token).code==="BAD_STATE");
  check("duplicate job IDs rejected",queueCore({...fresh(),jobs:[fresh().jobs[0],fresh().jobs[0]]},w,claim,t,token).code==="BAD_STATE");
  return {pass:out.length,tests:out};
}
