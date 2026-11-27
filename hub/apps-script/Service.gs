// Sandbox adapter service with dependency-injected mock tests; no production data.
function sandboxAuthorize_(mode, email, roleMapText) {
  if(mode!=="SANDBOX_ONLY")throw new Error("DISABLED");
  const id=String(email||"").trim().toLowerCase();
  let roles;try{roles=JSON.parse(roleMapText||"{}")}catch(e){throw new Error("DENIED")}
  if(!id||!roles||typeof roles!=="object"||!Object.prototype.hasOwnProperty.call(roles,id)||!["ADMIN","WORKER","VIEWER"].includes(roles[id]))throw new Error("DENIED");
  return {id,role:roles[id]};
}

function sandboxTransaction_(env,actor,req){
  if(!env.tryLock())return {ok:false,code:"BUSY"};
  try{
    const raw=env.read();
    if(!raw)return {ok:false,code:"NOT_INITIALIZED"};
    let state;try{state=JSON.parse(raw)}catch(e){return {ok:false,code:"BAD_STATE"}}
    if(!state||state.schema!==1||state.mode!=="SANDBOX_ONLY")return {ok:false,code:"BAD_STATE"};
    const result=env.core(state,actor,req,env.now(),env.token());
    if(!result||typeof result.ok!=="boolean")return {ok:false,code:"BAD_RESULT"};
    if(!result.ok)return result;
    const next=JSON.stringify(state);
    if(next!==raw){
      if(env.bytes(next)>8000)return {ok:false,code:"SANDBOX_CAPACITY_REACHED"};
      try{
        env.write(next);
        if(env.read()!==next)return {ok:false,code:"READBACK_UNCERTAIN"};
      }catch(e){return {ok:false,code:"READBACK_UNCERTAIN"}}
    }
    return result;
  }finally{env.release()}
}

function sandboxAdapterTests(){
  const results=[];const check=(name,ok)=>{if(!ok)throw Error("FAIL "+name);results.push(name)};
  const denied=(mode,email,roles)=>{try{sandboxAuthorize_(mode,email,roles);return false}catch(e){return true}};
  const roles='{"worker@example.invalid":"WORKER","viewer@example.invalid":"VIEWER"}';
  check("disabled by default",denied("", "worker@example.invalid",roles));
  check("missing identity denied",denied("SANDBOX_ONLY","",roles));
  check("unknown identity denied",denied("SANDBOX_ONLY","other@example.invalid",roles));
  check("malformed roles denied",denied("SANDBOX_ONLY","worker@example.invalid","{"));
  check("null roles denied",denied("SANDBOX_ONLY","worker@example.invalid","null"));
  check("prototype role denied",denied("SANDBOX_ONLY","constructor",roles));
  check("identity normalized",sandboxAuthorize_("SANDBOX_ONLY"," WORKER@EXAMPLE.INVALID ",roles).role==="WORKER");
  const actor=sandboxAuthorize_("SANDBOX_ONLY","worker@example.invalid",roles);
  const seed=JSON.stringify({schema:1,mode:"SANDBOX_ONLY",jobs:[],events:[]});
  function fake(opts={}){
    let raw=opts.raw===undefined?seed:opts.raw,locks=0,writes=0,releases=0;
    const env={tryLock:()=>{locks++;return !opts.busy},release:()=>{releases++},read:()=>opts.mismatch&&writes?seed:raw,write:x=>{writes++;if(opts.writeError)throw Error("mock write");raw=x},now:()=>1,token:()=>"mock-token",bytes:s=>opts.big?9001:s.length,core:(s,a,r)=>{if(opts.throwCore)throw Error("mock core");if(opts.failCore){s.events.push("must not write");return {ok:false,code:"DENIED"}}if(!opts.readOnly)s.events.push({id:r.request_id});return {ok:true,code:"OK"}}};
    return {env,stats:()=>({locks,writes,releases,raw})};
  }
  function run(opts){const f=fake(opts);const r=sandboxTransaction_(f.env,actor,{request_id:"synthetic-01"});return {r,...f.stats()}}
  let x=run({busy:true});check("lock busy no write or release",x.r.code==="BUSY"&&x.writes===0&&x.releases===0);
  x=run({raw:""});check("uninitialized released",x.r.code==="NOT_INITIALIZED"&&x.releases===1&&x.writes===0);
  x=run({raw:"{"});check("invalid JSON rejected",x.r.code==="BAD_STATE"&&x.releases===1);
  x=run({raw:'{"schema":1,"mode":"PRODUCTION"}'});check("production state rejected",x.r.code==="BAD_STATE"&&x.writes===0);
  x=run({readOnly:true});check("read-only no persistence",x.r.ok&&x.writes===0&&x.releases===1);
  x=run({failCore:true});check("denied mutation never committed",!x.r.ok&&x.raw===seed&&x.writes===0);
  x=run({big:true});check("capacity fail closed",x.r.code==="SANDBOX_CAPACITY_REACHED"&&x.writes===0);
  x=run({});check("successful write and readback",x.r.ok&&x.writes===1&&x.releases===1&&JSON.parse(x.raw).events.length===1);
  x=run({mismatch:true});check("readback mismatch reported",x.r.code==="READBACK_UNCERTAIN"&&x.releases===1);
  x=run({writeError:true});check("write error reported uncertain",x.r.code==="READBACK_UNCERTAIN"&&x.releases===1);
  const f=fake({throwCore:true});try{sandboxTransaction_(f.env,actor,{})}catch(e){}check("exception releases lock",f.stats().releases===1&&f.stats().writes===0);
  return {pass:results.length,tests:results};
}
