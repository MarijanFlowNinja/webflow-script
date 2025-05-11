// Version: 1.0.0
// Description: This script handles the population and validation of Eloqua forms on the DOMO website.
;(function() {
  // --- HELPERS ---
  function getCookie(name) {
    const v = `; ${document.cookie}`;
    const parts = v.split(`; ${name}=`);
    return parts.length === 2 ? parts.pop().split(';').shift() : "";
  }
  function setCookie(name, value, days) {
    let expires = "";
    if (days) {
      const d = new Date();
      d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
      expires = "; expires=" + d.toUTCString();
    }
    document.cookie = name + "=" + (value || "") + expires + "; path=/";
  }
  function getUrlParam(name) {
    return new URLSearchParams(window.location.search).get(name) || "";
  }
  async function hashSHA1(input) {
    const enc = new TextEncoder().encode(input);
    const buf = await crypto.subtle.digest("SHA-1", enc);
    return Array.from(new Uint8Array(buf))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");
  }
  async function getUniqueFFID() {
    const p = getUrlParam("unique_ffid") || getUrlParam("uniqueFFID");
    if (p) return p;
    const domo = getUrlParam("domo_id") || getCookie("did") || "";
    return await hashSHA1(crypto.randomUUID() + "|" + domo);
  }
  function generateDomoID() {
    const t = Math.floor(Date.now() / 1000);
    const r = Math.floor(Math.random() * 1e8);
    return (t * r).toString().slice(0, 10);
  }
  function getOrCreateDomoID() {
    let d = getCookie("did");
    if (!d || d === "undefined" || d.length < 10 || +d === 0) {
      d = generateDomoID();
      setCookie("did", d, 3650);
    }
    return d;
  }
  function getGaClientId() {
    const c = document.cookie.split("; ").find(r => r.startsWith("_ga="));
    return c ? c.split("=")[1] : "";
  }
  function getCanadaConsent(form) {
    const cb = form.querySelector('input[name="consent"]');
    if (cb) return cb.checked ? 1 : 0;
    const hid = form.querySelector('input[name="sFDCCanadaEmailOptIn1"]');
    if (hid) {
      const v = hid.value;
      return ["1","Yes","true",1,true].includes(v) ? 1 : 0;
    }
    return 1;
  }

  // --- UINFO COOKIE ---
  function setUInfoCookie(form) {
    const domo = getCookie("did") || "";
    const getV = name => form.querySelector(`[name="${name}"]`)?.value.trim() || "";
    const params = new URLSearchParams({
      domoid:    domo,
      firstname: getV("first_name"),
      lastname:  getV("last_name"),
      email:     getV("email"),
      phone:     getV("phone"),
      selected:  getV("department")
    });
    const exp = new Date(Date.now() + 30*24*60*60*1000).toUTCString();
    document.cookie = `uinfo=${params.toString()}; expires=${exp}; path=/`;
  }

  // --- POPULATORS ---
  function populateUtmFields(form) {
    const map = {
      utm_source:   "utmSource1",
      utm_medium:   "utmMedium1",
      utm_campaign: "utmCampaign1",
      campid:       "utmCampid1",
      utm_campid:   "utmCampid1",
      gclid:        "gCLID1",
      gadposition:  "utmGadposition1",
      gcreative:    "utmGcreative1",
      gdevice:      "utmGdevice1",
      gnetwork:     "utmGnetwork1",
      gkeyword:     "utmGkeyword1",
      gplacement:   "utmGplacement1",
      gmatchtype:   "utmGmatchtype1",
      gtarget:      "utmGtarget1",
      utm_orgid:    "utmOrgid1"
    };
    const url = new URLSearchParams(window.location.search);
    const ck  = new URLSearchParams(getCookie("_pubweb_utm"));
    Object.entries(map).forEach(([p,n]) => {
      const v = url.get(p) || ck.get(p) || "";
      form.querySelector(`input[name="${n}"]`)?.value = v;
    });
  }
  function populateSubmissionFields(form) {
    const origin = window.location.origin;
    form.querySelector('input[name="contentURL1"]')?.value =
      origin + form.querySelector('input[name="contentURL1"]')?.value;
    form.querySelector('input[name="pathName1"]')?.value = window.location.href;
    const Q = window.location.search.substring(1);
    form.querySelector('input[name="rFCDMJunkReason1"]')?.value = Q;
    form.querySelector('input[name="originalUtmquerystring1"]')?.value = Q;
    form.querySelector('input[name="utmquerystring1"]')?.value =
      (Q.match(/campid.*$/) || [""])[0];
    const ts = new Date();
    const tsStr =
      ("0"+(ts.getMonth()+1)).slice(-2)+"/"+
      ("0"+ts.getDate()).slice(-2)+"/"+
      ts.getFullYear()+" "+
      ("0"+ts.getHours()).slice(-2)+":"+
      ("0"+ts.getMinutes()).slice(-2)+":"+
      ("0"+ts.getSeconds()).slice(-2);
    form.querySelector('input[name="formSubmit1"]')?.value = tsStr;
    form.querySelector('input[name="language"]')?.value = navigator.language || "";
    const emailVal = form.querySelector('input[name="email"]')?.value || "";
    form.querySelector('input[name="company"]')?.value =
      emailVal.split("@")[1] || "";
    form.querySelector('input[name="sFDCCanadaEmailOptInOutDate1"]')?.value =
      new Date().toISOString().split("T")[0];
    form.querySelector('input[name="sFDCCanadaEmailOptIn1"]')?.value =
      getCanadaConsent(form);
  }
  async function populateUniqueFFID(form) {
    const id = await getUniqueFFID();
    form.querySelectorAll('input[name="uniqueFFID"]').forEach(i => i.value = id);
  }
  function populateDomoID(form) {
    const id = getOrCreateDomoID();
    form.querySelectorAll('input[name="domo_id"]').forEach(i => i.value = id);
  }
  function populateGaClientId(form) {
    const id = getGaClientId();
    form.querySelectorAll('input[name="g_id"]').forEach(i => i.value = id);
  }
  async function populateAll(form) {
    populateUtmFields(form);
    populateDomoID(form);
    populateGaClientId(form);
    await populateUniqueFFID(form);
  }

  // --- VALIDATION ---
  const VALIDATION_RULES = {
    first_name: { type:"name",  min:2, required:true, messages:{ required:"First name is required.", min:"At least 2 chars.", invalid:"Invalid name." }},
    last_name:  { type:"name",  min:2, required:true, messages:{ required:"Last name is required.",  min:"At least 2 chars.", invalid:"Invalid name." }},
    email:      { type:"email",           required:true, messages:{ required:"Email is required.",    invalid:"Bad format.",        business:"Use business email." }},
    phone:      { type:"phone", min:10, required:true, messages:{ required:"Phone is required.",     min:"At least 10 digits.", invalid:"Invalid phone." }},
    title:      { type:"title",           required:true, messages:{ required:"Job title is required.",              invalid:"Invalid title." }}
  };
  function validateField(cfg) {
    const v = cfg.element.value.trim();
    let ok = false, err;
    switch (cfg.type) {
      case "name":
        if (!v) err="required";
        else if (v.length<cfg.min) err="min";
        else if (!/^[a-zA-Z\s]+$/.test(v)) err="invalid";
        else ok=true;
        break;
      case "email":
        if (!v) err="required";
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) err="invalid";
        else if (["gmail.com","yahoo.com","outlook.com","hotmail.com","aol.com","msn.com","ymail.com","comcast.net","live.com","protonmail.com"].includes(v.split("@")[1])) err="business";
        else ok=true;
        break;
      case "phone":
        const digs = v.replace(/\D/g,"");
        if (!v) err="required";
        else if (digs.length<cfg.min) err="min";
        else if (!/^(?!\+?(\d)\1+$)\+?\d{8,15}$/.test(v)) err="invalid";
        else ok=true;
        break;
      case "title":
        if (!v) err=cfg.required?"required":null;
        else if (!/^[a-zA-Z\s]+$/.test(v)||/(.)\1{3,}/.test(v)) err="invalid";
        else ok=true;
        break;
    }
    const ct = cfg.element.parentElement;
    const nx = ct.nextElementSibling;
    if (!ok) {
      if (!nx || !nx.classList.contains("error-message")) {
        const e = document.createElement("div");
        e.className = "error-message";
        e.textContent = cfg.messages[err];
        ct.insertAdjacentElement("afterend", e);
      } else nx.textContent = cfg.messages[err];
    } else if (nx && nx.classList.contains("error-message")) {
      nx.remove();
    }
    return ok;
  }
  function validateSelect(sel) {
    const v = sel.value;
    const ct = sel.parentElement;
    const nx = ct.nextElementSibling;
    const name = sel.getAttribute("errorlabel")||sel.name;
    const msg = `Please enter a valid ${name}.`;
    if (!v) {
      if (!nx || !nx.classList.contains("error-message")) {
        const e = document.createElement("div");
        e.className = "error-message";
        e.textContent = msg;
        ct.insertAdjacentElement("afterend", e);
      } else nx.textContent = msg;
      return false;
    } else if (nx && nx.classList.contains("error-message")) {
      nx.remove();
    }
    return true;
  }
  function attachValidation(form) {
    Object.entries(VALIDATION_RULES).forEach(([n,r]) => {
      const el = form.querySelector(`[name="${n}"]`);
      if (el) {
        const cfg = { element:el, type:r.type, min:r.min, required:r.required, messages:r.messages };
        el.addEventListener("blur", () => validateField(cfg));
      }
    });
    form.querySelectorAll("select[required]").forEach(sel => {
      sel.addEventListener("change", () => validateSelect(sel));
      sel.addEventListener("blur",   () => validateSelect(sel));
    });
  }

  // --- CONTACT US DYNAMIC FIELDS ---
  function initContactUsDynamic(form) {
    if (form.querySelector('input[name="elqFormName"]').value !== "website_cta_contactus") return;
    const subjectSelect = form.querySelector('select[name="subject"]');
    if (!subjectSelect) return;
    function addFields() {
      const wrap = subjectSelect.closest('.form-input-wrap');
      if (!form.querySelector('div[job-title-wrap]')) {
        wrap.insertAdjacentHTML('afterend', `
<div job-title-wrap class="form-input-wrap">
  <div class="form-input-inner-wrap">
    <select name="title" required class="input-relative" errorlabel="job title">
      <option value="">Job title</option><option>CXO/EVP</option><option>SVP/VP</option>
      <option>Director</option><option>Manager</option><option>Individual Contributor</option>
      <option>Student</option>
    </select>
  </div>
</div>`);
      }
      const afterJob = form.querySelector('div[job-title-wrap]');
      if (!form.querySelector('div[department-wrap]')) {
        afterJob.insertAdjacentHTML('afterend', `
<div department-wrap class="form-input-wrap">
  <div class="form-input-inner-wrap">
    <select name="department" required class="input-relative" errorlabel="department">
      <option value="">Department</option><option>BI</option><option>Customer Service &amp; Support</option>
      <option>Engineering/Product Development</option><option>Developer/Engineering</option>
      <option>Human Resources</option><option>IT</option><option>Marketing</option>
      <option>Operations</option><option>Sales</option><option>Finance</option><option>Other</option>
    </select>
  </div>
</div>`);
      }
    }
    function removeFields() {
      form.querySelector('div[job-title-wrap]')?.remove();
      form.querySelector('div[department-wrap]')?.remove();
    }
    function updateFields() {
      subjectSelect.value === "Sales" ? addFields() : removeFields();
    }
    subjectSelect.addEventListener('change', updateFields);
    form.addEventListener('submit', updateFields);
    updateFields();
  }

  // --- SUBMIT HANDLER ---
  async function handleSubmit(e) {
    e.preventDefault();
    e.stopPropagation();
    const form = e.target;
    let ok = true;
    Object.entries(VALIDATION_RULES).forEach(([n,r]) => {
      const el = form.querySelector(`[name="${n}"]`);
      if (r.required && !validateField({ element:el, type:r.type, min:r.min, required:r.required, messages:r.messages })) ok = false;
    });
    form.querySelectorAll("select[required]").forEach(sel => { if (!validateSelect(sel)) ok = false; });
    if (!ok) return console.log("Please fix errors");

    await populateAll(form);
    populateSubmissionFields(form);

    // set uinfo cookie only on watch-demo form, just before redirect
    const elqName = form.querySelector('input[name="elqFormName"]')?.value;
    if (elqName === "website_cta_videodemorequest") {
      setUInfoCookie(form);
    }

    const payload = new URLSearchParams(new FormData(form));
    fetch(form.action, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: payload
    })
    .then(res => {
      if (!res.ok) throw new Error(res.status);
      console.log("[Form] Eloqua submission successful");
      const redirectUrl = form.querySelector('input[name="contentURL1"]')?.value || window.location.origin;
      window.location.href = redirectUrl;
    })
    .catch(err => console.error("[Form] Submission error", err));
  }

  // --- INIT ---
  function initForm(form) {
    populateAll(form);
    attachValidation(form);
    initContactUsDynamic(form);
    form.addEventListener("submit", handleSubmit);
  }
  function init() {
    document.querySelectorAll("form[eloquaform='true']").forEach(initForm);
  }
  document.addEventListener("DOMContentLoaded", init);
})();

