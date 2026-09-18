import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const enc=new TextEncoder();
const hex=(b:ArrayBuffer)=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');
const hmac=async(key:Uint8Array,msg:string)=>new Uint8Array(await crypto.subtle.sign('HMAC',await crypto.subtle.importKey('raw',key,{name:'HMAC',hash:'SHA-256'},false,['sign']),enc.encode(msg)));
const sha=async(s:string)=>hex(await crypto.subtle.digest('SHA-256',enc.encode(s)));
const amzDate=(d=new Date())=>d.toISOString().replace(/[:-]|\.\d{3}/g,'');
const cors={'access-control-allow-origin':'*','access-control-allow-headers':'content-type','access-control-allow-methods':'POST,OPTIONS','content-type':'application/json; charset=utf-8'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});

async function sendSes(to:string,confirmUrl:string){
  const access=Deno.env.get('AWS_ACCESS_KEY_ID'),secret=Deno.env.get('AWS_SECRET_ACCESS_KEY'),session=Deno.env.get('AWS_SESSION_TOKEN');
  if(!access||!secret) throw new Error('SES_CREDENTIALS_MISSING');
  const region=Deno.env.get('AWS_SES_REGION')||'eu-north-1'; const from=Deno.env.get('AWS_SES_FROM')||'Morgentidende <nyhedsbrev@morgentidende.dk>';
  const host=`email.${region}.amazonaws.com`; const endpoint=`https://${host}/v2/email/outbound-emails`;
  const payload=JSON.stringify({FromEmailAddress:from,Destination:{ToAddresses:[to]},Content:{Simple:{Subject:{Data:'Bekræft dit nyhedsbrev fra Morgentidende',Charset:'UTF-8'},Body:{Html:{Data:`<p>Tak for din tilmelding til Morgentidende.</p><p><a href="${confirmUrl}">Bekræft din e-mail</a></p><p>Hvis du ikke har tilmeldt dig, kan du ignorere denne mail.</p>`,Charset:'UTF-8'},Text:{Data:`Bekræft din e-mail: ${confirmUrl}\n\nHvis du ikke har tilmeldt dig, kan du ignorere denne mail.`,Charset:'UTF-8'}}}}});
  const now=amzDate(),day=now.slice(0,8),payloadHash=await sha(payload),extra=session?`x-amz-security-token:${session}\n`:'';
  const signed=session?'content-type;host;x-amz-date;x-amz-security-token':'content-type;host;x-amz-date';
  const headers=`content-type:application/json\nhost:${host}\nx-amz-date:${now}\n${extra}`;
  const canonical=`POST\n/v2/email/outbound-emails\n\n${headers}\n${signed}\n${payloadHash}`; const scope=`${day}/${region}/ses/aws4_request`; const sts=`AWS4-HMAC-SHA256\n${now}\n${scope}\n${await sha(canonical)}`;
  let k=await hmac(enc.encode('AWS4'+secret),day); k=await hmac(k,region); k=await hmac(k,'ses'); k=await hmac(k,'aws4_request');
  const sig=hex(await crypto.subtle.sign('HMAC',await crypto.subtle.importKey('raw',k,{name:'HMAC',hash:'SHA-256'},false,['sign']),enc.encode(sts)));
  const reqHeaders:Record<string,string>={'content-type':'application/json','x-amz-date':now,'authorization':`AWS4-HMAC-SHA256 Credential=${access}/${scope}, SignedHeaders=${signed}, Signature=${sig}`}; if(session) reqHeaders['x-amz-security-token']=session;
  const r=await fetch(endpoint,{method:'POST',headers:reqHeaders,body:payload}); if(!r.ok) throw new Error(`SES_${r.status}_${(await r.text()).slice(0,300)}`);
}

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS') return new Response(null,{status:204,headers:cors}); if(req.method!=='POST') return json({error:'METHOD_NOT_ALLOWED'},405);
  try{
    const body=await req.json(),action=String(body?.action||'subscribe');
    const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
    if(action==='subscribe'){
      if(!Deno.env.get('AWS_ACCESS_KEY_ID')||!Deno.env.get('AWS_SECRET_ACCESS_KEY')) return json({error:'NEWSLETTER_NOT_CONFIGURED'},503);
      const normalized=String(body?.email||'').trim().toLowerCase(); if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return json({error:'Ugyldig e-mail'},400);
      const {data:existing,error:readErr}=await db.from('v5_newsletter_subscribers').select('status,last_confirmation_sent_at').eq('email',normalized).maybeSingle(); if(readErr) throw readErr; if(existing?.status==='active') return json({ok:true});
      if(existing?.last_confirmation_sent_at && Date.now()-new Date(existing.last_confirmation_sent_at).getTime()<10*60*1000) return json({ok:true});
      const token=crypto.randomUUID()+crypto.randomUUID(),tokenHash=await sha(token),now=new Date().toISOString();
      const {error}=await db.from('v5_newsletter_subscribers').upsert({email:normalized,status:'pending',confirmation_token_hash:tokenHash,updated_at:now,last_confirmation_sent_at:now},{onConflict:'email'}); if(error) throw error;
      const {data:cfg}=await db.from('v5_runtime_config').select('value').eq('key','site_url').maybeSingle(); const site=cfg?.value||'https://morgentidende.dk';
      await sendSes(normalized,`${site.replace(/\/$/,'')}/nyhedsbrev/bekraeft?token=${encodeURIComponent(token)}`); return json({ok:true});
    }
    if(action==='confirm'){
      const token=String(body?.token||''); if(token.length<20) return json({ok:false},400); const tokenHash=await sha(token);
      const {data,error}=await db.from('v5_newsletter_subscribers').update({status:'active',confirmed_at:new Date().toISOString(),confirmation_token_hash:null,updated_at:new Date().toISOString()}).eq('confirmation_token_hash',tokenHash).eq('status','pending').select('manage_token').maybeSingle(); if(error) throw error;
      return json({ok:!!data,manage_token:data?.manage_token||null},data?200:404);
    }
    const manageToken=String(body?.manage_token||''); if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(manageToken)) return json({error:'INVALID_TOKEN'},400);
    if(action==='get_preferences'){ const {data,error}=await db.from('v5_newsletter_subscribers').select('daily_news,magazine_viden,magazine_liv,preferred_theme,status').eq('manage_token',manageToken).maybeSingle(); if(error) throw error; return data?json({ok:true,preferences:data}):json({ok:false},404); }
    if(action==='set_preferences'){ const theme=String(body?.preferred_theme||'system'); if(!['system','light','dark'].includes(theme)) return json({error:'INVALID_THEME'},400); const {data,error}=await db.from('v5_newsletter_subscribers').update({daily_news:!!body?.daily_news,magazine_viden:!!body?.magazine_viden,magazine_liv:!!body?.magazine_liv,preferred_theme:theme,updated_at:new Date().toISOString()}).eq('manage_token',manageToken).eq('status','active').select('id').maybeSingle(); if(error) throw error; return data?json({ok:true}):json({ok:false},404); }
    if(action==='unsubscribe'){ const {data,error}=await db.from('v5_newsletter_subscribers').update({status:'unsubscribed',updated_at:new Date().toISOString()}).eq('manage_token',manageToken).select('id').maybeSingle(); if(error) throw error; return data?json({ok:true}):json({ok:false},404); }
    return json({error:'UNKNOWN_ACTION'},400);
  }catch(e){ console.error(e); return json({error:'REQUEST_FAILED'},500); }
});
