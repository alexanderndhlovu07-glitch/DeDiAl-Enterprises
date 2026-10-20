import {createServerClient} from '@supabase/ssr';

const PREFIX='/api/v1/auth/';
const POST_ROUTES=new Set(['signup','login','logout']);
const GET_ROUTES=new Set(['session','config','google/start','callback']);
const ROLES=new Set(['customer','owner','operator']);

export function publicUser(user) {
  if(!user) return null;
  // app_metadata is controlled by the identity service, unlike user-editable metadata.
  const role=ROLES.has(user.app_metadata?.role)?user.app_metadata.role:'customer';
  const name=String(user.user_metadata?.name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Your account').slice(0,100);
  return {id:user.id,email:user.email||'',name,role,provider:user.app_metadata?.provider==='google'?'google':'email'};
}

export function configuration(env) {
  if(!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY || !env.APP_ORIGIN) throw new Error('Missing authentication settings.');
  const provider=new URL(env.SUPABASE_URL), app=new URL(env.APP_ORIGIN);
  if(provider.protocol!=='https:' || provider.username || provider.password || provider.pathname!=='/' || provider.search || provider.hash) throw new Error('Invalid provider origin.');
  if(app.protocol!=='https:' || app.username || app.password || app.pathname!=='/' || app.search || app.hash) throw new Error('Invalid application origin.');
  return {provider:provider.origin,key:env.SUPABASE_ANON_KEY,origin:app.origin,google:env.ENABLE_GOOGLE_AUTH==='true'};
}

function cookies(header='') {
  return String(header).split(';').flatMap(part=>{
    const index=part.indexOf('=');
    if(index<1) return [];
    const name=part.slice(0,index).trim();
    try {return [{name,value:decodeURIComponent(part.slice(index+1).trim())}];} catch {return [];}
  });
}

function cookieString({name,value,options={}}) {
  if(!/^[\w.-]+$/.test(name)) throw new Error('Invalid cookie name.');
  let result=`${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax`;
  if(options.maxAge!==undefined) result+=`; Max-Age=${Math.floor(options.maxAge)}`;
  if(options.expires) result+=`; Expires=${new Date(options.expires).toUTCString()}`;
  return result;
}

function reply(res,status,data) {
  res.statusCode=status;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}
function redirect(res,url) {res.statusCode=303;res.setHeader('Location',url);res.end();}
function error(res,status,message,code='unavailable') {reply(res,status,{message,code});}
function authStatus(err) {return err?.status===429?429:err?.status>=500?503:400;}

export function createAuthHandler({env=process.env,createClient=createServerClient}={}) {
  return async function handler(req,res) {
    res.setHeader('Cache-Control','no-store, private');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Vary','Cookie');
    let config;
    try {config=configuration(env);} catch {return error(res,503,'Sign-in is not configured. Add the authentication settings in Vercel.','configuration');}
    const requestUrl=new URL(req.url,config.origin);
    const route=requestUrl.pathname.startsWith(PREFIX)?requestUrl.pathname.slice(PREFIX.length):'';
    if(!POST_ROUTES.has(route) && !GET_ROUTES.has(route)) return error(res,404,'Not found.','not_found');
    const method=POST_ROUTES.has(route)?'POST':'GET';
    if(req.method!==method) {res.setHeader('Allow',method);return error(res,405,'Method not allowed.','method');}
    let body;
    if(method==='POST') {
      if(req.headers.origin!==config.origin || req.headers['sec-fetch-site']==='cross-site') return error(res,403,'This request must come from DeDiAl.','origin');
      if(String(req.headers['content-type']||'').split(';')[0].trim().toLowerCase()!=='application/json') return error(res,415,'Send JSON.','content_type');
      try {
        if(Number(req.headers['content-length']||0)>8192) throw new Error();
        body=typeof req.body==='string'?JSON.parse(req.body):req.body;
        if(!body || typeof body!=='object' || Array.isArray(body) || Buffer.byteLength(JSON.stringify(body))>8192) throw new Error();
      } catch {return error(res,400,'Invalid request.','validation');}
    }
    const cookieJar=new Map(cookies(req.headers.cookie).map(c=>[c.name,c.value]));
    const outgoing=new Map();
    const client=createClient(config.provider,config.key,{
      cookieOptions:{path:'/',httpOnly:true,secure:true,sameSite:'lax'},
      cookies:{
        getAll:()=>[...cookieJar].map(([name,value])=>({name,value})),
        setAll:values=>{
          for(const item of values) {cookieJar.set(item.name,item.value);outgoing.set(item.name,cookieString(item));}
          res.setHeader('Set-Cookie',[...outgoing.values()]);
        }
      }
    });
    try {
      if(route==='config') return reply(res,200,{googleClientId:null,googleNonce:null,googleOAuthUrl:config.google?PREFIX+'google/start':null});
      if(route==='session') {
        const {data,error:failure}=await client.auth.getUser();
        if(failure && failure.name!=='AuthSessionMissingError' && ![400,401,403].includes(failure.status)) return error(res,503,'We could not verify your session. Please retry.','provider');
        return reply(res,200,{user:failure?null:publicUser(data?.user)});
      }
      if(route==='logout') {
        const {error:failure}=await client.auth.signOut({scope:'local'});
        if(failure) return error(res,503,'Sign-out could not be completed. Please retry.','provider');
        return reply(res,200,{user:null});
      }
      if(route==='google/start') {
        if(!config.google) return error(res,503,'Google sign-in is not configured. Use email instead.','configuration');
        const {data,error:failure}=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo:config.origin+PREFIX+'callback',skipBrowserRedirect:true}});
        if(failure || !data?.url) return redirect(res,config.origin+'/?auth_error=provider#login');
        const target=new URL(data.url);
        if(target.origin!==config.provider) return error(res,503,'Unexpected identity provider response.','provider');
        return redirect(res,target.href);
      }
      if(route==='callback') {
        if(requestUrl.searchParams.has('error')) return redirect(res,config.origin+'/?auth_error=provider#login');
        const code=requestUrl.searchParams.get('code');
        if(!code || code.length>2048) return redirect(res,config.origin+'/?auth_error=missing_code#login');
        const {error:failure}=await client.auth.exchangeCodeForSession(code);
        return redirect(res,config.origin+(failure?'/?auth_error=exchange#login':'/#account'));
      }
      const {email,password,name}=body;
      if(typeof email!=='string' || email.length>254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || typeof password!=='string' || password.length>128 || !password.length) return error(res,400,'Enter a valid email and password.','validation');
      if(route==='signup') {
        if(typeof name!=='string' || !name.trim() || name.trim().length>100 || password.length<12) return error(res,400,'Enter your name and a password of at least 12 characters.','validation');
        const {data,error:failure}=await client.auth.signUp({email:email.trim(),password,options:{data:{name:name.trim()},emailRedirectTo:config.origin+PREFIX+'callback'}});
        if(failure) return error(res,authStatus(failure),failure.status===429?'Too many attempts. Please try again later.':'Account creation could not be completed. Check your details or try logging in.','signup');
        return reply(res,200,{user:data?.session?publicUser(data.user):null,verificationRequired:!data?.session});
      }
      const {data,error:failure}=await client.auth.signInWithPassword({email:email.trim(),password});
      if(failure || !data?.user) return error(res,failure?.status===429?429:failure?.status>=500?503:401,failure?.status===429?'Too many attempts. Please try again later.':'We could not sign you in. Check your email, password and account confirmation.','login');
      return reply(res,200,{user:publicUser(data.user)});
    } catch {
      // Never put provider responses, credentials or tokens into logs or the response.
      if(route==='callback') return redirect(res,config.origin+'/?auth_error=exchange#login');
      return error(res,503,'Authentication is temporarily unavailable. Please try again.','provider');
    }
  };
}

export default createAuthHandler();
