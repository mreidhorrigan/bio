// coi-serviceworker's settings (public/vendor/coi-serviceworker/, its documented `window.coi`), read by it as it loads,
// so the page's ahead of it. Its own reload comes as its worker is found, before that worker can serve the page: the
// page loaded again uncontrolled, then claimed with no headers set, never isolated, and never reloaded again. Here the
// page is reloaded once its worker is active (`ready`), so its next load comes through the worker, isolated. Waiting
// for the worker to claim the page instead had left a hard reload (which passes the worker by) on one core for good:
// its worker active already, nothing claims the page again (the owner's site tab, 6 November 2026, one thread at 100%).
// Every load that comes past the worker is reloaded once, a hard reload whenever it comes; but not a load its own reload
// made (within RELOADED_WITHIN), so a browser whose worker never serves the page is not reloaded over and over. And
// every browser is given require-corp: everything the page loads is its own site's, and Safari takes no credentialless.
const COI_RELOADED='coi-reloaded',RELOADED_WITHIN=10e3;
window.coi={
  coepCredentialless:()=>false,
  doReload:()=>{
    try{if(Date.now()-Number(sessionStorage.getItem(COI_RELOADED))<RELOADED_WITHIN)return;sessionStorage.setItem(COI_RELOADED,String(Date.now()))}catch{}
    navigator.serviceWorker.ready.then(()=>location.reload());
  },
};
