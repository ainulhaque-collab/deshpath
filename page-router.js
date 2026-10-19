/* Hash pages keep the existing feature DOM, drafts and authentication URLs. */
(function(global){
  'use strict';
  const ROUTES=['home','my-map','explore','planner','worldAtlas','travelPassport','games','community','profile','admin','saved'];
  const canonical=new Map(ROUTES.map(route=>[route.toLowerCase(),route]));
  const labels={home:['শুরু','Home'],'my-map':['আমার মানচিত্র','My map'],explore:['ঘুরে দেখুন','Explore Bangladesh'],planner:['ট্রিপ প্ল্যানার','Trip planner'],worldAtlas:['বিশ্ব মানচিত্র','World atlas'],travelPassport:['ভ্রমণ পাসপোর্ট','Travel passport'],games:['খেলার ঘর','Games'],community:['নতুন খোঁজ','Community discoveries'],profile:['আমার প্রোফাইল','My profile'],admin:['সম্পাদকের কক্ষ','Editorial desk'],saved:['পছন্দের জায়গা','Saved places']};
  function parse(value){const match=/^#?([a-z][a-z0-9-]{0,60})$/i.exec(String(value||''));if(!match)return null;const route=canonical.get(match[1].toLowerCase());return route===match[1]?route:null;}
  global.initDeshPages=function initDeshPages({onSaved}={}){
    global.DESH_PAGES?.destroy?.();
    const doc=global.document,main=doc.querySelector('#main')||doc.querySelector('main');
    if(!main)return null;
    let current=null,destroyed=false,scheduled=false,frame=null;
    const initial=new Map();
    const html=doc.documentElement,oldPage=html.getAttribute('data-current-page');
    const hadClass=html.classList.contains('desh-pages');html.classList.add('desh-pages');
    const announcer=doc.createElement('div');announcer.className='page-route-announcer';announcer.setAttribute('role','status');announcer.setAttribute('aria-live','polite');announcer.setAttribute('aria-atomic','true');doc.body.append(announcer);
    const translated=route=>labels[route]?.[global.DESH_I18N?.lang==='en'?1:0]||labels.home[0];
    function keep(node){if(!initial.has(node))initial.set(node,{hidden:node.hidden,aria:node.getAttribute('aria-hidden'),inert:node.hasAttribute('inert'),pageClass:node.classList.contains('desh-page')});node.classList.add('desh-page');}
    function show(node,visible){keep(node);node.hidden=!visible;node.setAttribute('aria-hidden',visible?'false':'true');if(visible)node.removeAttribute('inert');else node.setAttribute('inert','');}
    function collect(){
      const groups=new Map();
      for(const node of doc.querySelectorAll('[data-page]')){
        const values=String(node.getAttribute('data-page')||'').split(/\s+/).filter(Boolean);
        if(values.includes('all')){groups.set(node,['all']);continue;}
        const routes=values.map(parse).filter(Boolean);if(routes.length)groups.set(node,routes);
      }
      for(const route of ROUTES){const node=doc.getElementById(route);if(node&&!groups.has(node))groups.set(node,[route]);}
      for(const node of initial.keys())if(!node.isConnected)initial.delete(node);
      return groups;
    }
    function pageNode(route){return doc.getElementById(route)||[...doc.querySelectorAll('[data-page]')].find(node=>String(node.getAttribute('data-page')||'').split(/\s+/).some(value=>parse(value)===route));}
    function focusPage(route){
      if(destroyed||current!==route)return;
      // Modal controls retain their focus and event lifecycle while a feature
      // link or auth callback updates the page beneath them.
      if(!doc.querySelector('dialog[open]')){
        const page=pageNode(route)||main,target=page.querySelector('h1,h2,h3,[data-page-heading]')||page;
        if(!target.hasAttribute('tabindex'))target.setAttribute('tabindex','-1');
        try{target.focus({preventScroll:true});}catch{target.focus();}
      }
      global.scrollTo?.({top:0,left:0,behavior:'auto'});
    }
    function linkRoute(link){
      try{const target=new URL(link.getAttribute('href'),global.location.href),here=new URL(global.location.href);return target.origin===here.origin&&target.pathname===here.pathname&&target.search===here.search?parse(target.hash):null;}catch{return null;}
    }
    function navigation(route){
      for(const link of doc.querySelectorAll('a[href]')){
        const destination=linkRoute(link);if(!destination)continue;
        const active=destination===route;
        if(active)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');
        if(link.classList.contains('nav-link'))link.classList.toggle('active',active);
      }
      const menu=doc.querySelector('#mainNav'),button=doc.querySelector('#menuBtn');menu?.classList.remove('open');button?.setAttribute('aria-expanded','false');
    }
    function apply({focus=false}={}){
      if(destroyed)return;
      let route=parse(global.location.hash)||(global.location.hash==='#main'&&current?current:'home');
      const groups=collect();if(!pageNode(route)&&route!=='home')route='home';
      const previous=current,changed=route!==previous;current=route;
      for(const [node,routes]of groups)show(node,routes.includes('all')||routes.includes(route));
      const world=doc.querySelector('#worldPassportRoot');if(world)show(world,route==='worldAtlas'||route==='travelPassport');
      html.setAttribute('data-current-page',route);main.setAttribute('data-current-page',route);navigation(route);
      const english=global.DESH_I18N?.lang==='en';doc.title=route==='home'?(english?'Deshpath — Your Bangladesh travel journal':'দেশপথ — আপনার ভ্রমণের খাতা'):translated(route)+' | '+(english?'Deshpath':'দেশপথ');
      if(changed){
        if(route==='saved')onSaved?.();
        if(previous!==null)announcer.textContent=translated(route);
        global.dispatchEvent?.(new CustomEvent('deshpath:pagechange',{detail:{page:route,previous}}));
        if(focus&&previous!==null){
          if(frame!==null)global.cancelAnimationFrame?.(frame);
          if(global.requestAnimationFrame)frame=global.requestAnimationFrame(()=>{frame=null;focusPage(route);});else focusPage(route);
        }
      }
      return route;
    }
    function refresh(){return apply();}
    function navigate(value){const route=parse(value);if(!route||destroyed)return false;if(parse(global.location.hash)===route){apply();return true;}global.location.hash=route;return true;}
    function onLocation(){apply({focus:true});}
    function onClick(event){
      if(event.defaultPrevented||event.button!==undefined&&event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
      const link=event.target.closest?.('a[href]');if(!link||link.hasAttribute('download')||link.getAttribute('target')&&link.getAttribute('target')!=='_self')return;
      if(link.getAttribute('href')==='#main'){
        event.preventDefault();if(!main.hasAttribute('tabindex'))main.setAttribute('tabindex','-1');try{main.focus({preventScroll:true});}catch{main.focus();}global.scrollTo?.({top:0,left:0,behavior:'auto'});return;
      }
      const route=linkRoute(link);if(!route)return;event.preventDefault();navigate(route);
    }
    function scheduleRefresh(){if(scheduled||destroyed)return;scheduled=true;Promise.resolve().then(()=>{scheduled=false;if(!destroyed)refresh();});}
    const observer=global.MutationObserver?new global.MutationObserver(scheduleRefresh):null;observer?.observe(main,{childList:true,subtree:true});
    global.addEventListener('hashchange',onLocation);global.addEventListener('popstate',onLocation);doc.addEventListener('click',onClick);
    global.addEventListener('deshpath:routechange',scheduleRefresh);
    global.DESH_I18N?.onChange(scheduleRefresh);
    const api={navigate,refresh,current:()=>current,destroy(){
      if(destroyed)return;destroyed=true;observer?.disconnect();if(frame!==null)global.cancelAnimationFrame?.(frame);global.removeEventListener('hashchange',onLocation);global.removeEventListener('popstate',onLocation);global.removeEventListener('deshpath:routechange',scheduleRefresh);doc.removeEventListener('click',onClick);announcer.remove();
      for(const [node,state]of initial){node.hidden=state.hidden;if(state.aria===null)node.removeAttribute('aria-hidden');else node.setAttribute('aria-hidden',state.aria);if(state.inert)node.setAttribute('inert','');else node.removeAttribute('inert');if(!state.pageClass)node.classList.remove('desh-page');}
      if(!hadClass)html.classList.remove('desh-pages');if(oldPage===null)html.removeAttribute('data-current-page');else html.setAttribute('data-current-page',oldPage);main.removeAttribute('data-current-page');
    }};
    global.DESH_PAGES=Object.freeze(api);apply();return global.DESH_PAGES;
  };
})(window);
