export class AuthError extends Error {
  constructor(message,status=0,code='unavailable'){super(message);this.status=status;this.code=code;}
}
export async function authRequest(path,{method='GET',body}={}){
  let response;
  try {response=await fetch('/api/v1/auth/'+path,{method,credentials:'same-origin',cache:'no-store',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});}
  catch {throw new AuthError('We could not reach DeDiAl. Please try again.');}
  let data;try{data=await response.json();}catch{throw new AuthError('We could not complete that request. Please try again.',response.status);}
  if(!response.ok)throw new AuthError(data.message||'Please try again.',response.status,data.code);
  return data;
}
let sdkPromise;
export function loadGoogleSdk(){
  if(window.google?.accounts?.id)return Promise.resolve(window.google.accounts.id);
  if(sdkPromise)return sdkPromise;
  sdkPromise=new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;
    const timer=setTimeout(()=>{script.remove();sdkPromise=null;reject(new AuthError('Google sign-in could not load. Please use email or try again.'));},12000);
    script.onload=()=>{clearTimeout(timer);if(window.google?.accounts?.id)resolve(window.google.accounts.id);else{sdkPromise=null;reject(new AuthError('Google sign-in could not load. Please use email or try again.'));}};
    script.onerror=()=>{clearTimeout(timer);script.remove();sdkPromise=null;reject(new AuthError('Google sign-in could not load. Please use email or try again.'));};
    document.head.append(script);
  });
  return sdkPromise;
}
