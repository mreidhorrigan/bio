// coi-serviceworker's settings (public/vendor/coi-serviceworker/, its documented `window.coi`), read by it as it loads,
// so the page's ahead of it. Its own reload comes as its worker is found, before that worker can serve the page: the
// page loaded again uncontrolled, then claimed with no headers set, never isolated, and never reloaded again. Here the
// page is reloaded once its worker controls it, so its next load comes through the worker, isolated. And every browser
// is given require-corp: everything the page loads is its own site's, and Safari takes no credentialless.
window.coi={
  coepCredentialless:()=>false,
  doReload:()=>{const workers=navigator.serviceWorker;
    if(workers.controller)location.reload();else workers.addEventListener('controllerchange',()=>location.reload(),{once:true})},
};
