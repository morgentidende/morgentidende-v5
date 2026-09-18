import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const hex=(b:ArrayBuffer)=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');
const sha256=async(s:string)=>hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));

function dims(bytes:Uint8Array,type:string):[number,number]|null{
  const dv=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  if(type==='image/png' && bytes.length>=24 && bytes[0]===0x89 && bytes[1]===0x50 && bytes[2]===0x4e && bytes[3]===0x47)
    return [dv.getUint32(16),dv.getUint32(20)];
  if(type==='image/gif' && bytes.length>=10 && bytes[0]===0x47 && bytes[1]===0x49 && bytes[2]===0x46)
    return [dv.getUint16(6,true),dv.getUint16(8,true)];
  if(type==='image/jpeg' && bytes.length>=4 && bytes[0]===0xff && bytes[1]===0xd8){
    let i=2;
    while(i+9<bytes.length){
      if(bytes[i]!==0xff){i++;continue;}
      const marker=bytes[i+1];
      if(marker===0xd8 || marker===0xd9){i+=2;continue;}
      if(i+3>=bytes.length) break;
      const len=(bytes[i+2]<<8)+bytes[i+3];
      if(len<2) break;
      if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker))
        return [(bytes[i+7]<<8)+bytes[i+8],(bytes[i+5]<<8)+bytes[i+6]];
      i+=len+2;
    }
    return null;
  }
  if(type==='image/webp' && bytes.length>=30 && String.fromCharCode(...bytes.slice(0,4))==='RIFF' && String.fromCharCode(...bytes.slice(8,12))==='WEBP'){
    const chunk=String.fromCharCode(...bytes.slice(12,16));
    if(chunk==='VP8X') return [1+bytes[24]+(bytes[25]<<8)+(bytes[26]<<16),1+bytes[27]+(bytes[28]<<8)+(bytes[29]<<16)];
    if(chunk==='VP8L' && bytes[20]===0x2f){
      const b1=bytes[21],b2=bytes[22],b3=bytes[23],b4=bytes[24];
      return [1+(((b2&0x3f)<<8)|b1),1+(((b4&0x0f)<<10)|(b3<<2)|((b2&0xc0)>>6))];
    }
    if(chunk==='VP8 ' && bytes[23]===0x9d && bytes[24]===0x01 && bytes[25]===0x2a)
      return [dv.getUint16(26,true)&0x3fff,dv.getUint16(28,true)&0x3fff];
  }
  return null;
}

function safeRemoteUrl(raw:string):URL{
  const u=new URL(raw);
  if(u.protocol!=='https:') throw new Error('HTTPS_REQUIRED');
  const h=u.hostname.toLowerCase();
  if(h==='localhost'||h.endsWith('.local')||h==='0.0.0.0'||h==='::1'||/^127\./.test(h)||/^10\./.test(h)||/^192\.168\./.test(h)||/^169\.254\./.test(h)) throw new Error('HOST_NOT_ALLOWED');
  const m=h.match(/^172\.(\d+)\./); if(m && Number(m[1])>=16 && Number(m[1])<=31) throw new Error('HOST_NOT_ALLOWED');
  return u;
}

function decodeBase64(data:string):Uint8Array{
  const raw=atob(data);
  const bytes=new Uint8Array(raw.length);
  for(let i=0;i<raw.length;i++) bytes[i]=raw.charCodeAt(i);
  return bytes;
}

Deno.serve(async(req)=>{
  let requestId:string|undefined;
  try{
    if(req.method!=='POST') return new Response('method',{status:405});
    const body=await req.json();
    requestId=body?.request_id;
    const capability=String(body?.capability||'');
    if(!requestId||!capability) return Response.json({ok:false,error:'BAD_REQUEST'},{status:400});

    const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
    const {data:r,error:e}=await db.from('v5_hero_ingest_requests').select('*').eq('id',requestId).eq('status','pending').maybeSingle();
    if(e||!r) return Response.json({ok:false,error:'NOT_FOUND'},{status:404});
    if(!r.capability_hash || await sha256(capability)!==r.capability_hash) return Response.json({ok:false,error:'FORBIDDEN'},{status:403});

    let bytes:Uint8Array;
    let ct:string;
    const inlineData=typeof body?.data_base64==='string' ? body.data_base64 : '';
    if(inlineData){
      ct=String(body?.mime_type||'').toLowerCase();
      if(!['image/jpeg','image/png','image/webp','image/gif'].includes(ct)) throw new Error('UNSUPPORTED_MIME');
      bytes=decodeBase64(inlineData);
    }else{
      const source=safeRemoteUrl(r.source_url);
      const fetched=await fetch(source,{redirect:'follow',headers:{'user-agent':'Morgentidende-v5/1.0','accept':'image/*'}});
      if(!fetched.ok) throw new Error(`FETCH_${fetched.status}`);
      safeRemoteUrl(fetched.url);
      ct=(fetched.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
      if(!['image/jpeg','image/png','image/webp','image/gif'].includes(ct)) throw new Error('NOT_IMAGE');
      bytes=new Uint8Array(await fetched.arrayBuffer());
    }

    if(bytes.byteLength===0||bytes.byteLength>15_000_000) throw new Error('INVALID_SIZE');
    const d=dims(bytes,ct); if(!d) throw new Error('DIMENSIONS_UNKNOWN');
    if(d[0]<800||d[1]<450) throw new Error('TOO_SMALL');

    const digest=hex(await crypto.subtle.digest('SHA-256',bytes));
    const ext=ct==='image/jpeg'?'jpg':ct.split('/')[1];
    const path=`${new Date().toISOString().slice(0,10)}/${digest}.${ext}`;
    const up=await db.storage.from('v5-heroes').upload(path,bytes,{contentType:ct,upsert:false});
    if(up.error&&!String(up.error.message).toLowerCase().includes('exists')) throw up.error;

    const publicUrl=db.storage.from('v5-heroes').getPublicUrl(path).data.publicUrl;
    const {data:asset,error:ae}=await db.from('v5_hero_assets').upsert({
      public_url:publicUrl,storage_path:path,source_url:r.source_url,rights_source_url:r.rights_source_url,
      license:r.license,credit:r.credit,mime_type:ct,width:d[0],height:d[1],sha256:digest
    },{onConflict:'public_url'}).select('id').single();
    if(ae) throw ae;

    await db.from('v5_hero_ingest_requests').update({
      status:'ready',hero_asset_id:asset.id,completed_at:new Date().toISOString(),capability_hash:null
    }).eq('id',requestId);
    return Response.json({ok:true,hero_asset_id:asset.id,public_url:publicUrl,width:d[0],height:d[1]});
  }catch(err){
    try{
      if(requestId){
        const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
        await db.from('v5_hero_ingest_requests').update({
          status:'failed',error:String(err).slice(0,500),completed_at:new Date().toISOString(),capability_hash:null
        }).eq('id',requestId).eq('status','pending');
      }
    }catch{}
    return Response.json({ok:false,error:String(err)},{status:422});
  }
});
