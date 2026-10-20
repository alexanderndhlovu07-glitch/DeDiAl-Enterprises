import test from 'node:test';
import assert from 'node:assert/strict';
import {createServerClient} from '@supabase/ssr';
import {createAuthHandler,publicUser} from '../platform/server/auth.js';

const env={SUPABASE_URL:'https://identity.example.test',SUPABASE_ANON_KEY:'test-public-key',APP_ORIGIN:'https://platform.example.test',ENABLE_GOOGLE_AUTH:'true'};
const account={id:'user-1',email:'person@example.test',user_metadata:{name:'Person',role:'operator'},app_metadata:{provider:'email'}};
const credentials={email:account.email,password:'Long-local-test-password'};
function response() {return {headers:{},statusCode:200,setHeader(k,v){this.headers[k.toLowerCase()]=v;},end(value=''){this.body=value;}};}
async function call(handler,route,{method='GET',body,origin=env.APP_ORIGIN,headers={}}={}) {
  const res=response();
  await handler({url:'/api/v1/auth/'+route,method,body,headers:{origin,'content-type':'application/json',...headers}},res);
  return {...res,json:res.body?JSON.parse(res.body):null};
}
function fake(auth={}) {
  const calls=[];
  const createClient=(url,key,options)=>{
    calls.push({url,key,options});
    return {auth:{
      getUser:async()=>({data:{user:account},error:null}),
      signInWithPassword:async()=>{options.cookies.setAll([{name:'auth.session',value:'secret-cookie-value',options:{maxAge:60}}]);return {data:{user:account},error:null};},
      signUp:async()=>({data:{user:account,session:null},error:null}),
      signOut:async()=>{options.cookies.setAll([{name:'auth.session',value:'',options:{maxAge:0}}]);return {error:null};},
      signInWithOAuth:async()=>({data:{url:env.SUPABASE_URL+'/auth/v1/authorize?provider=google'},error:null}),
      exchangeCodeForSession:async()=>({error:null}),
      ...auth
    }};
  };
  return {handler:createAuthHandler({env,createClient}),calls};
}

test('missing configuration fails closed without exposing provider values',async()=>{
  const result=await call(createAuthHandler({env:{}}),'session');
  assert.equal(result.statusCode,503);
  assert.equal(result.json.code,'configuration');
});
test('verified role ignores user-editable privilege claims',()=>{
  assert.equal(publicUser(account).role,'customer');
  assert.equal(publicUser({...account,app_metadata:{role:'operator'}}).role,'operator');
});
test('login returns identity without tokens and sets secure HttpOnly cookies',async()=>{
  const {handler}=fake();
  const result=await call(handler,'login',{method:'POST',body:credentials});
  assert.equal(result.statusCode,200);
  assert.equal(result.json.user.role,'customer');
  assert.ok(!result.body.includes('secret-cookie-value'));
  assert.match(result.headers['set-cookie'][0],/HttpOnly; Secure; SameSite=Lax/);
  assert.equal(result.headers['cache-control'],'no-store, private');
});
test('signup confirmation retains the recovered frontend response contract',async()=>{
  let values;
  const {handler}=fake({signUp:async input=>{values=input;return {data:{user:account,session:null},error:null};}});
  const result=await call(handler,'signup',{method:'POST',body:{...credentials,name:'Person',role:'operator'}});
  assert.equal(result.json.verificationRequired,true);
  assert.equal(result.json.user,null);
  assert.deepEqual(values.options.data,{name:'Person'});
  assert.equal(values.options.emailRedirectTo,env.APP_ORIGIN+'/api/v1/auth/callback');
});
test('cross-site, missing origin, invalid content type, and invalid input are rejected',async()=>{
  const {handler,calls}=fake();
  assert.equal((await call(handler,'login',{method:'POST',body:credentials,origin:'https://other.test'})).statusCode,403);
  assert.equal((await call(handler,'login',{method:'POST',body:credentials,headers:{origin:undefined}})).statusCode,403);
  assert.equal((await call(handler,'login',{method:'POST',body:credentials,origin:''})).statusCode,403);
  assert.equal((await call(handler,'login',{method:'POST',body:credentials,headers:{'content-type':'text/plain'}})).statusCode,415);
  assert.equal((await call(handler,'signup',{method:'POST',body:{...credentials,name:'Person',password:'short'}})).statusCode,400);
  assert.equal((await call(handler,'login',{method:'POST',body:[]})).statusCode,400);
  assert.equal(calls.length,1); // Only the well-formed JSON signup reaches client initialization.
});
test('authentication outage is distinct from an anonymous session',async()=>{
  const outage=fake({getUser:async()=>({data:{user:null},error:{status:503,name:'ProviderFailure'}})});
  assert.equal((await call(outage.handler,'session')).statusCode,503);
  const anonymous=fake({getUser:async()=>({data:{user:null},error:{name:'AuthSessionMissingError'}})});
  assert.deepEqual((await call(anonymous.handler,'session')).json,{user:null});
});
test('bad password and provider rate limiting return safe messages',async()=>{
  for(const [status,expected] of [[400,401],[429,429],[503,503]]) {
    const {handler}=fake({signInWithPassword:async()=>({data:{user:null},error:{status,message:'sensitive-provider-diagnostic'}})});
    const result=await call(handler,'login',{method:'POST',body:credentials});
    assert.equal(result.statusCode,expected);
    assert.ok(!result.body.includes('sensitive-provider-diagnostic'));
  }
});
test('logout clears the cookie through the provider cookie adapter',async()=>{
  const {handler}=fake();
  const result=await call(handler,'logout',{method:'POST',body:{}});
  assert.equal(result.json.user,null);
  assert.match(result.headers['set-cookie'][0],/Max-Age=0/);
});
test('OAuth uses the canonical callback and prevents arbitrary provider redirects',async()=>{
  let input;
  const {handler}=fake({signInWithOAuth:async value=>{input=value;return {data:{url:env.SUPABASE_URL+'/auth/v1/authorize'},error:null};}});
  const result=await call(handler,'google/start?next=https://untrusted.test');
  assert.equal(result.statusCode,303);
  assert.equal(input.options.redirectTo,env.APP_ORIGIN+'/api/v1/auth/callback');
  const bad=fake({signInWithOAuth:async()=>({data:{url:'https://untrusted.test/'},error:null})});
  assert.equal((await call(bad.handler,'google/start')).statusCode,503);
});
test('OAuth callback success and errors return to fixed local screens',async()=>{
  const {handler}=fake();
  assert.equal((await call(handler,'callback?code=test-code&next=https://untrusted.test')).headers.location,env.APP_ORIGIN+'/#account');
  assert.equal((await call(handler,'callback')).headers.location,env.APP_ORIGIN+'/?auth_error=missing_code#login');
  assert.equal((await call(handler,'callback?error=access_denied')).headers.location,env.APP_ORIGIN+'/?auth_error=provider#login');
});
test('unknown routes and incorrect methods are rejected',async()=>{
  const {handler}=fake();
  assert.equal((await call(handler,'private')).statusCode,404);
  const result=await call(handler,'login');
  assert.equal(result.statusCode,405);
  assert.equal(result.headers.allow,'POST');
});
test('real Supabase SSR client accepts missing cookies as anonymous without any remote request',async()=>{
  let fetched=false;
  const handler=createAuthHandler({env,createClient:(url,key,options)=>createServerClient(url,key,{
    ...options,global:{fetch:async()=>{fetched=true;throw new Error('Unexpected network call');}}
  })});
  const result=await call(handler,'session');
  assert.equal(result.statusCode,200);
  assert.deepEqual(result.json,{user:null});
  assert.equal(fetched,false);
});
test('real Supabase SSR login persists a session and validates it on the next request',async()=>{
  const calls=[];
  const providerUser={...account,aud:'authenticated',created_at:new Date().toISOString()};
  const providerFetch=async(url,options)=>{
    const endpoint=new URL(url).pathname;
    calls.push(endpoint);
    if(endpoint.endsWith('/token')) return Response.json({access_token:'test-access-token',refresh_token:'test-refresh-token',token_type:'bearer',expires_in:3600,user:providerUser});
    if(endpoint.endsWith('/user')) {
      assert.equal(new Headers(options.headers).get('authorization'),'Bearer test-access-token');
      return Response.json(providerUser);
    }
    throw new Error('Unexpected provider endpoint: '+endpoint);
  };
  const handler=createAuthHandler({env,createClient:(url,key,options)=>createServerClient(url,key,{...options,global:{fetch:providerFetch}})});
  const login=await call(handler,'login',{method:'POST',body:credentials});
  assert.equal(login.statusCode,200);
  const cookie=login.headers['set-cookie'].map(value=>value.split(';')[0]).join('; ');
  assert.ok(cookie.includes('auth-token='));
  assert.ok(!login.body.includes('test-access-token'));
  const session=await call(handler,'session',{headers:{cookie}});
  assert.equal(session.statusCode,200);
  assert.equal(session.json.user.id,account.id);
  assert.deepEqual(calls,['/auth/v1/token','/auth/v1/user']);
});
test('real Supabase SDK refreshes an expired session and returns updated cookies',async()=>{
  const providerUser={...account,aud:'authenticated',created_at:new Date().toISOString()};
  let refreshing=false;
  const providerFetch=async(url,options)=>{
    const endpoint=new URL(url).pathname;
    if(endpoint.endsWith('/token')) {
      const request=JSON.parse(options.body);
      if(request.refresh_token) {
        refreshing=true;
        assert.equal(request.refresh_token,'original-refresh-token');
      }
      return Response.json({access_token:refreshing?'renewed-access-token':'original-access-token',refresh_token:refreshing?'renewed-refresh-token':'original-refresh-token',token_type:'bearer',expires_in:3600,user:providerUser});
    }
    if(endpoint.endsWith('/user')) {
      assert.equal(new Headers(options.headers).get('authorization'),'Bearer renewed-access-token');
      return Response.json(providerUser);
    }
    throw new Error('Unexpected endpoint.');
  };
  const handler=createAuthHandler({env,createClient:(url,key,options)=>createServerClient(url,key,{...options,global:{fetch:providerFetch}})});
  const login=await call(handler,'login',{method:'POST',body:credentials});
  const original=login.headers['set-cookie'].find(value=>value.includes('auth-token='));
  const pair=original.split(';')[0], index=pair.indexOf('=');
  const encoded=decodeURIComponent(pair.slice(index+1));
  assert.ok(encoded.startsWith('base64-'));
  const session=JSON.parse(Buffer.from(encoded.slice(7),'base64url').toString());
  session.expires_at=Math.floor(Date.now()/1000)-60;
  const cookie=pair.slice(0,index+1)+encodeURIComponent('base64-'+Buffer.from(JSON.stringify(session)).toString('base64url'));
  const result=await call(handler,'session',{headers:{cookie}});
  assert.equal(result.statusCode,200);
  assert.equal(result.json.user.id,account.id);
  assert.equal(refreshing,true);
  assert.ok(result.headers['set-cookie'].some(value=>value.includes('auth-token=')));
});
