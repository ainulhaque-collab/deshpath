'use strict';
(() => {
  let promptEvent=null,registration=null,preparing=false;
  const tr=(b,e)=>window.DESH_I18N.tr(b,e),status=()=>document.querySelector('#offlineStatus');
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();promptEvent=event;});
  if('serviceWorker' in navigator&&window.isSecureContext)window.addEventListener('load',()=>{
    navigator.serviceWorker.register('./sw.js').then(value=>{registration=value;}).catch(()=>{});
  });
  document.addEventListener('click',async event=>{
    if(event.target.closest('#installDeshpath')){
      if(promptEvent){await promptEvent.prompt();await promptEvent.userChoice;promptEvent=null;}
      else if(status())status().textContent=tr('ব্রাউজারের মেনু থেকে “Install app” বা “Add to Home Screen” বেছে নিন।','Choose “Install app” or “Add to Home Screen” in your browser menu.');
    }
    if(!event.target.closest('#prepareOffline')||preparing)return;
    if(!('serviceWorker' in navigator)||!window.isSecureContext){if(status())status().textContent=tr('এই ব্রাউজারে অফলাইন অ্যাপ চালু করা যাচ্ছে না।','Offline app support is unavailable in this browser.');return;}
    preparing=true;const button=document.querySelector('#prepareOffline');button.disabled=true;
    try{if(!registration)registration=await navigator.serviceWorker.register('./sw.js');await navigator.serviceWorker.ready;const worker=registration.active;if(!worker)throw Error('WORKER');const channel=new MessageChannel();
      await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('TIMEOUT')),120000);channel.port1.onmessage=message=>{const result=message.data;if(result.error){clearTimeout(timeout);reject(Error('CACHE'));return;}if(status())status().textContent=result.complete?tr('ছবি, ম্যাপ ও গাইড অফলাইনের জন্য প্রস্তুত। লগইন ও অনলাইন সেবায় ইন্টারনেট লাগবে।','Photos, maps and guides are ready offline. Sign-in and online services still need a connection.'):tr('অফলাইনের প্রস্তুতি: '+result.done+' / '+result.total,'Preparing offline: '+result.done+' / '+result.total);if(result.complete){clearTimeout(timeout);resolve();}};worker.postMessage({type:'DESHPATH_OFFLINE'},[channel.port2]);});
    }catch{if(status())status().textContent=tr('অফলাইনের প্রস্তুতি সম্পূর্ণ হয়নি। ইন্টারনেট সংযোগ রেখে আবার চেষ্টা করুন।','Offline preparation did not finish. Connect to the internet and try again.');}finally{preparing=false;if(button.isConnected)button.disabled=false;}
  });
})();
