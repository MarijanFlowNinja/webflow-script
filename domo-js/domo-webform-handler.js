(function () {
  // --- HELPERS ---
  function getCookie(name) {
    const parts = ("; " + document.cookie).split("; " + name + "=");
    return parts.length === 2 ? parts.pop().split(";").shift() : "";
  }

  function setCookie(name, value, days) {
    let expires = "";
    if (days) {
      const d = new Date();
      d.setTime(d.getTime() + days * 86400000);
      expires = "; expires=" + d.toUTCString();
    }
    document.cookie = name + "=" + (value || "") + expires + "; path=/";
  }

  function getUrlParam(name) {
    return new URLSearchParams(window.location.search).get(name) || "";
  }

  async function hashSHA1(input) {
    const encoder = new TextEncoder().encode(input);
    const hashBuffer = await crypto.subtle.digest("SHA-1", encoder);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
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
    const c = document.cookie.split("; ").find((row) => row.startsWith("_ga="));
    return c ? c.split("=")[1] : "";
  }

  function getCanadaConsent(form) {
    const cb = form.querySelector('input[name="consent"]');
    if (cb) return cb.checked ? 1 : 0;
    const hid = form.querySelector('input[name="sFDCCanadaEmailOptIn1"]');
    if (hid) return ["1", "Yes", "true", 1, true].includes(hid.value) ? 1 : 0;
    return 1;
  }

  // --- UINFO COOKIE ---
  function setUInfoCookie(form) {
    const domo = getCookie("did") || "";
    function val(name) {
      const el = form.querySelector('[name="' + name + '"]');
      return el ? el.value.trim() : "";
    }
    const params = new URLSearchParams({
      domoid: domo,
      firstname: val("first_name"),
      lastname: val("last_name"),
      email: val("email"),
      phone: val("phone"),
      selected: val("department"),
    });
    const exp = new Date(Date.now() + 30 * 86400000).toUTCString();
    document.cookie =
      "uinfo=" + params.toString() + "; expires=" + exp + "; path=/";
  }

  // --- POPULATORS ---
  function populateUtmFields(form) {
    const map = {
      utm_source: "utmSource1",
      utm_medium: "utmMedium1",
      utm_campaign: "utmCampaign1",
      campid: "utmCampid1",
      utm_campid: "utmCampid1",
      gclid: "gCLID1",
      gadposition: "utmGadposition1",
      utm_gadposition: "utmGadposition1",
      gcreative: "utmGcreative1",
      utm_gcreative: "utmGcreative1",
      gdevice: "utmGdevice1",
      utm_gdevice: "utmGdevice1",
      gnetwork: "utmGnetwork1",
      utm_gnetwork: "utmGnetwork1",
      gkeyword: "utmGkeyword1",
      utm_gkeyword: "utmGkeyword1",
      gplacement: "utmGplacement1",
      utm_gplacement: "utmGplacement1",
      gmatchtype: "utmGmatchtype1",
      utm_gmatchtype: "utmGmatchtype1",
      gtarget: "utmGtarget1",
      utm_gtarget: "utmGtarget1",
      utm_orgid: "utmOrgid1",
      orgid: "utmOrgid1",
    };

    const urlParams = new URLSearchParams(window.location.search);
    Object.entries(map).forEach(([param, inputName]) => {
      const value = urlParams.get(param) || "";
      const input = form.querySelector('input[name="' + inputName + '"]');
      console.log("[UTM DEBUG]", param, "->", value, "on element", input);
      if (input) {
        input.value = value;
        input.setAttribute("value", value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
  }

  async function populateAll(form) {
    populateUtmFields(form);

    // Domo ID
    form.querySelectorAll('input[name="domo_id"]').forEach((i) => {
      i.value = getOrCreateDomoID();
    });

    // GA client ID
    form.querySelectorAll('input[name="g_id"]').forEach((i) => {
      i.value = getGaClientId();
    });

    // uniqueFFID
    const ffid = await getUniqueFFID();
    form.querySelectorAll('input[name="uniqueFFID"]').forEach((i) => {
      i.value = ffid;
    });

    // Geo IP / Canada consent
    fetch("https://api.ipify.org?format=json")
      .then((r) => r.json())
      .then((d) =>
        fetch("https://max-mind-get-production.up.railway.app/getIp?ip=" + d.ip)
      )
      .then((r) => r.json())
      .then((data) => {
        form
          .querySelectorAll('input[name="geoip_country_code"]')
          .forEach((i) => {
            i.value = data.iso_code;
          });
        if (data.iso_code === "CA") {
          form.querySelectorAll(".consent-wrapper").forEach((w) => {
            const chk = w.querySelector("input");
            if (chk) chk.removeAttribute("checked");
            w.style.display = "flex";
          });
        }
      })
      .catch((e) => console.error("Error fetching Geo IP:", e));
  }

  function populateSubmissionFields(form) {
    const origin = window.location.origin;
    const cf = form.querySelector('input[name="contentURL1"]');
    if (cf) cf.value = origin + cf.value;
  
    // path only, no query
    const pf = form.querySelector('input[name="pathName1"]');
    if (pf) pf.value = window.location.pathname;
  
    // full query string
    const Q = window.location.search.substring(1);
    ['rFCDMJunkReason1','originalUtmquerystring1'].forEach(name => {
      const el = form.querySelector('input[name="' + name + '"]');
      if (el) el.value = Q;
    });
    const uq = form.querySelector('input[name="utmquerystring1"]');
    if (uq) uq.value = Q;
  
    // timestamp
    const tfi = form.querySelector('input[name="formSubmit1"]');
    if (tfi) {
      const ts = new Date();
      const D = String(ts.getDate()).padStart(2, '0');
      const M = String(ts.getMonth() + 1).padStart(2, '0');
      const Y = ts.getFullYear();
      const h = String(ts.getHours()).padStart(2, '0');
      const m = String(ts.getMinutes()).padStart(2, '0');
      const s = String(ts.getSeconds()).padStart(2, '0');
      tfi.value = M + '/' + D + '/' + Y + ' ' + h + ':' + m + ':' + s;
    }
  
    // language / company
    const li = form.querySelector('input[name="language"]');
    if (li) li.value = navigator.language || '';
    const em = form.querySelector('input[name="email"]');
    const co = form.querySelector('input[name="company"]');
    if (co) co.value = em ? em.value.split('@').pop() : '';
  
    // Canada date & consent
    const cod = form.querySelector('input[name="sFDCCanadaEmailOptInOutDate1"]');
    if (cod) cod.value = new Date().toISOString().split('T')[0];
    const ci1 = form.querySelector('input[name="sFDCCanadaEmailOptIn1"]');
    if (ci1) ci1.value = getCanadaConsent(form);
  }
  

  // --- VALIDATION ---
  const VALIDATION_RULES = {
    first_name: {
      type: "name",
      min: 2,
      required: true,
      messages: {
        required: "First name is a required field.",
        min: "Please enter two or more characters.",
        invalid: "Please enter a valid first name.",
      },
    },
    last_name: {
      type: "name",
      min: 2,
      required: true,
      messages: {
        required: "Last name is a required field.",
        min: "Please enter two or more characters.",
        invalid: "Please enter a valid last name.",
      },
    },
    email: {
      type: "email",
      required: true,
      messages: {
        required: "Email is a required field.",
        invalid:
          "Please make sure the email address is formatted as name@domain.com.",
        business:
          "Please enter a valid business email address. Personal emails such as Gmail are not accepted.",
      },
    },
    phone: {
      type: "phone",
      min: 10,
      required: true,
      messages: {
        required: "Phone number is a required field.",
        min: "Please enter a minimum of 10 digits.",
        invalid: "Please enter a valid phone number.",
      },
    },
    title: {
      type: "title",
      required: true,
      messages: {
        required: "Job title is required.",
        invalid: "Please enter a valid job title.",
      },
    },
  };

  function validateField(cfg) {
    const v = cfg.element.value.trim();
    let ok = false,
      err;
    switch (cfg.type) {
      case "name":
        if (!v) err = "required";
        else if (v.length < cfg.min) err = "min";
        else if (/(.)\1{3,}/.test(v)) err = "invalid";
        else if (!/^[A-Za-z\s]+$/.test(v)) err = "invalid";
        else ok = true;
        break;
      case "email":
        if (!v) err = "required";
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) err = "invalid";
        else if (
          [
            "gmail.com",
            "yahoo.com",
            "outlook.com",
            "hotmail.com",
            "aol.com",
            "msn.com",
            "ymail.com",
            "comcast.net",
            "live.com",
            "protonmail.com",
          ].includes(v.split("@")[1])
        )
          err = "business";
        else ok = true;
        break;
      case "phone":
        const digs = v.replace(/\D/g, "");
        if (!v) err = "required";
        else if (digs.length < cfg.min) err = "min";
        else if (!/^(?!\+?(\d)\1+$)\+?\d{8,15}$/.test(v)) err = "invalid";
        else ok = true;
        break;
      case "title":
        if (!v) err = cfg.required ? "required" : null;
        else if (!/^[A-Za-z\s]+$/.test(v) || /(.)\1{3,}/.test(v))
          err = "invalid";
        else ok = true;
        break;
    }
    const ct = cfg.element.parentElement,
      nx = ct.nextElementSibling;
    if (!ok) {
      if (!nx || !nx.classList.contains("error-message")) {
        const e = document.createElement("div");
        e.className = "error-message";
        e.textContent = cfg.messages[err];
        ct.insertAdjacentElement("afterend", e);
      } else {
        nx.textContent = cfg.messages[err];
      }
    } else if (nx && nx.classList.contains("error-message")) {
      nx.remove();
    }
    return ok;
  }

  function validateSelect(sel) {
    const v = sel.value,
      ct = sel.parentElement,
      nx = ct.nextElementSibling;
    const msg = (sel.getAttribute("errorlabel") || sel.name) + " is required.";
    if (!v) {
      if (!nx || !nx.classList.contains("error-message")) {
        const e = document.createElement("div");
        e.className = "error-message";
        e.textContent = msg;
        ct.insertAdjacentElement("afterend", e);
      } else {
        nx.textContent = msg;
      }
      return false;
    }
    if (nx && nx.classList.contains("error-message")) {
      nx.remove();
    }
    return true;
  }

  function attachValidation(form) {
    for (const [name, cfg] of Object.entries(VALIDATION_RULES)) {
      const el = form.querySelector('[name="' + name + '"]');
      if (el) {
        el.addEventListener("blur", () =>
          validateField({
            element: el,
            type: cfg.type,
            min: cfg.min,
            required: cfg.required,
            messages: cfg.messages,
          })
        );
      }
    }
    form.querySelectorAll("select[required]").forEach((sel) => {
      sel.addEventListener("change", () => validateSelect(sel));
      sel.addEventListener("blur", () => validateSelect(sel));
    });
  }

  // --- DYNAMIC CONTACT US ---
  function initContactUsDynamic(form) {
    const elq = form.querySelector('[name="elqFormName"]')?.value;
    if (elq !== "website_cta_contactus") return;
    const sub = form.querySelector('[name="subject"]');
    if (!sub) return;
    function addF() {
      const wrap = sub.closest(".form-input-wrap");
      if (!form.querySelector("div[job-title-wrap]")) {
        wrap.insertAdjacentHTML(
          "afterend",
          '<div job-title-wrap class="form-input-wrap"><div class="form-input-inner-wrap">' +
            '<select name="title" required class="input-relative" errorlabel="job title">' +
            '<option value="">Job title</option>' +
            '<option value="CXO/EVP">CXO/EVP</option>' +
            '<option value="SVP/VP">SVP/VP</option>' +
            '<option value="Director">Director</option>' +
            '<option value="Manager">Manager</option>' +
            '<option value="Individual Contributor">Individual Contributor</option>' +
            '<option value="Student">Student</option>' +
            "</select></div></div>"
        );
      }
      if (!form.querySelector("div[department-wrap]")) {
        form
          .querySelector("div[job-title-wrap]")
          .insertAdjacentHTML(
            "afterend",
            '<div department-wrap class="form-input-wrap"><div class="form-input-inner-wrap">' +
              '<select name="department" required class="input-relative" errorlabel="department">' +
              '<option value="">Department</option>' +
              '<option value="BI">BI</option>' +
              '<option value="Customer Service & Support">Customer Service & Support</option>' +
              '<option value="Engineering/Product Development">Engineering/Product Development</option>' +
              '<option value="Developer/Engineering">Developer/Engineering</option>' +
              '<option value="Human Resources">Human Resources</option>' +
              '<option value="IT">IT</option>' +
              '<option value="Marketing">Marketing</option>' +
              '<option value="Operations">Operations</option>' +
              '<option value="Sales">Sales</option>' +
              '<option value="Finance">Finance</option>' +
              '<option value="Other">Other</option>' +
              "</select></div></div>"
          );
      }
    }
    function remF() {
      form.querySelector("div[job-title-wrap]")?.remove();
      form.querySelector("div[department-wrap]")?.remove();
    }
    function upd() {
      sub.value === "Sales" ? addF() : remF();
    }
    sub.addEventListener("change", upd);
    form.addEventListener("submit", upd);
    upd();
  }

  // --- SUBMIT HANDLER ---
  async function handleSubmit(e) {
    e.preventDefault();
    e.stopPropagation();
    const form = e.target;
    let ok = true;
    for (const [name, cfg] of Object.entries(VALIDATION_RULES)) {
      if (cfg.required) {
        const el = form.querySelector('[name="' + name + '"]');
        if (
          !validateField({
            element: el,
            type: cfg.type,
            min: cfg.min,
            required: cfg.required,
            messages: cfg.messages,
          })
        )
          ok = false;
      }
    }
    form.querySelectorAll("select[required]").forEach((sel) => {
      if (!validateSelect(sel)) ok = false;
    });
    if (!ok) return console.log("Please fix errors and try again.");

    await populateAll(form);
    populateSubmissionFields(form);

    if (
      form.querySelector('[name="elqFormName"]').value ===
      "website_cta_videodemorequest"
    ) {
      setUInfoCookie(form);
    }

    const data = new URLSearchParams(new FormData(form));
    fetch(form.action, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: data.toString(),
    })
      .then((r) => {
        if (!r.ok) throw new Error(r.status);
        const ri = form.querySelector('[name="contentURL1"]');
        window.location.href = ri ? ri.value : window.location.origin;
      })
      .catch((err) => console.error("[Form] Submission error", err));
  }

  // --- INIT ---
  function initForm(form) {
    populateAll(form);
    populateUtmFields(form);
    attachValidation(form);
    initContactUsDynamic(form);
    form.addEventListener("submit", handleSubmit);
  }

  function init() {
    document.querySelectorAll('form[eloquaform="true"]').forEach(initForm);
  }
  if (document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);
})();
// --- END ---



/*
(function () {

  // --- HELPERS ---
  function getCookie(name) {
    const parts = `; ${document.cookie}`.split(`; ${name}=`);
    return parts.length === 2 ? parts.pop().split(";").shift() : "";
  }
  function setCookie(name, value, days) {
    let expires = "";
    if (days) {
      const d = new Date();
      d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
      expires = "; expires=" + d.toUTCString();
    }
    document.cookie = `${name}=${value || ""}${expires}; path=/`;
  }
  function getUrlParam(name) {
    return new URLSearchParams(window.location.search).get(name) || "";
  }
  async function hashSHA1(input) {
    const enc = new TextEncoder().encode(input);
    const buf = await crypto.subtle.digest("SHA-1", enc);
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  async function getUniqueFFID() {
    const p = getUrlParam("unique_ffid") || getUrlParam("uniqueFFID");
    if (p) return p;
    const domo = getUrlParam("domo_id") || getCookie("did") || "";
    return await hashSHA1(`${crypto.randomUUID()}|${domo}`);
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
    const c = document.cookie.split("; ").find((r) => r.startsWith("_ga="));
    return c ? c.split("=")[1] : "";
  }
  function getCanadaConsent(form) {
    const cb = form.querySelector('input[name="consent"]');
    if (cb) return cb.checked ? 1 : 0;
    const hid = form.querySelector('input[name="sFDCCanadaEmailOptIn1"]');
    if (hid) return ["1", "Yes", "true", 1, true].includes(hid.value) ? 1 : 0;
    return 1;
  }

  // --- UINFO COOKIE ---
  function setUInfoCookie(form) {
    const domo = getCookie("did") || "";
    const getV = (name) => {
      const el = form.querySelector(`[name="${name}"]`);
      return el ? el.value.trim() : "";
    };
    const params = new URLSearchParams({
      domoid: domo,
      firstname: getV("first_name"),
      lastname: getV("last_name"),
      email: getV("email"),
      phone: getV("phone"),
      selected: getV("department"),
    });
    const exp = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString();
    document.cookie = `uinfo=${params.toString()}; expires=${exp}; path=/`;
  }

  // --- POPULATORS ---
  function populateUtmFields(form) {
    const map = {
      utm_source: "utmSource1",
      utm_medium: "utmMedium1",
      utm_campaign: "utmCampaign1",
      campid: "utmCampid1",
      gadposition: "utmGadposition1",
      gcreative: "utmGcreative1",
      gdevice: "utmGdevice1",
      gnetwork: "utmGnetwork1",
      gkeyword: "utmGkeyword1",
      gplacement: "utmGplacement1",
      gmatchtype: "utmGmatchtype1",
      gtarget: "utmGtarget1",
      gclid: "gCLID1",
      utm_orgid: "utmOrgid1",
      orgid: "utmOrgid1",
      utm_campid: "utmCampid1",
      utm_gadposition: "utmGadposition1",
      utm_gcreative: "utmGcreative1",
      utm_gdevice: "utmGdevice1",
      utm_gnetwork: "utmGnetwork1",
      utm_gkeyword: "utmGkeyword1",
      utm_gplacement: "utmGplacement1",
      utm_gmatchtype: "utmGmatchtype1",
      utm_gtarget: "utmGtarget1",
    };
    const url = new URLSearchParams(window.location.search);
    const ck = new URLSearchParams(getCookie("_pubweb_utm"));
    Object.entries(map).forEach(([param, inputName]) => {
      const value = url.get(param) || ck.get(param) || "";
      const input = form.querySelector(`input[name="${inputName}"]`);
      if (input) input.value = value;
    });
  }

  function populateSubmissionFields(form) {
    const origin = window.location.origin;
    const cf = form.querySelector('input[name="contentURL1"]');
    if (cf) cf.value = origin + cf.value;
    const pf = form.querySelector('input[name="pathName1"]');
    if (pf) pf.value = window.location.href;
    const Q = window.location.search.substring(1);
    ["rFCDMJunkReason1", "originalUtmquerystring1"].forEach((name) => {
      const el = form.querySelector(`input[name="${name}"]`);
      if (el) el.value = Q;
    });
    const uq = form.querySelector('input[name="utmquerystring1"]');
    if (uq) {
      const m = Q.match(/campid.*$/);
      uq.value = m ? m[0] : "";
    }
    const tfi = form.querySelector('input[name="formSubmit1"]');
    if (tfi) {
      const ts = new Date();
      tfi.value = `${String(ts.getMonth() + 1).padStart(2, "0")}/${String(
        ts.getDate()
      ).padStart(2, "0")}/${ts.getFullYear()} ${String(ts.getHours()).padStart(
        2,
        "0"
      )}:${String(ts.getMinutes()).padStart(2, "0")}:${String(
        ts.getSeconds()
      ).padStart(2, "0")}`;
    }
    const li = form.querySelector('input[name="language"]');
    if (li) li.value = navigator.language || "";
    const emailEl = form.querySelector('input[name="email"]');
    const compEl = form.querySelector('input[name="company"]');
    if (compEl) compEl.value = emailEl ? emailEl.value.split("@").pop() : "";
    const codEl = form.querySelector(
      'input[name="sFDCCanadaEmailOptInOutDate1"]'
    );
    if (codEl) codEl.value = new Date().toISOString().split("T")[0];
    const ci1 = form.querySelector('input[name="sFDCCanadaEmailOptIn1"]');
    if (ci1) ci1.value = getCanadaConsent(form);
  }

  async function populateUniqueFFID(form) {
    const id = await getUniqueFFID();
    form
      .querySelectorAll('input[name="uniqueFFID"]')
      .forEach((i) => (i.value = id));
  }
  function populateDomoID(form) {
    const id = getOrCreateDomoID();
    form
      .querySelectorAll('input[name="domo_id"]')
      .forEach((i) => (i.value = id));
  }
  function populateGaClientId(form) {
    const id = getGaClientId();
    form.querySelectorAll('input[name="g_id"]').forEach((i) => (i.value = id));
  }
  async function populateAll(form) {
    
    populateUtmFields(form);
    populateDomoID(form);
    populateGaClientId(form);
    await populateUniqueFFID(form);

    fetch("https://api.ipify.org?format=json")
    .then((r) => r.json())
    .then((data) =>
      fetch(
        `https://max-mind-get-production.up.railway.app/getIp?ip=${data.ip}`
      )
    )
    .then((r) => r.json())
    .then((data) => {
      const iso = data.iso_code;
      document
        .querySelectorAll('input[name="geoip_country_code"]')
        .forEach((i) => (i.value = iso));
      if (iso === "CA") {
        document.querySelectorAll(".consent-wrapper").forEach((w) => {
          const chk = w.querySelector("input");
          if (chk) chk.removeAttribute("checked");
          w.style.display = "flex";
        });
      }
    })
    .catch((e) => console.error("Error fetching Geo IP:", e));
  }

  // --- VALIDATION ---
  const VALIDATION_RULES = {
    first_name: {
      type: "name",
      min: 2,
      required: true,
      messages: {
        required: "First name is a required field.",
        min: "Please enter two or more characters.",
        invalid: "Please enter a valid last name..",
      },
    },
    last_name: {
      type: "name",
      min: 2,
      required: true,
      messages: {
        required: "Last name is a required field.",
        min: "Please enter two or more characters.",
        invalid: "Please enter a valid last name.",
      },
    },
    email: {
      type: "email",
      required: true,
      messages: {
        required: "Email is a required field.",
        invalid: "Please make sure the email address is formatted as name@domain.com.",
        business: "Please enter a valid business email address. Personal emails such as Gmail are not accepted.",
      },
    },
    phone: {
      type: "phone",
      min: 10,
      required: true,
      messages: {
        required: "Phone number is a required field.",
        min: "Please enter a minimum of 10 digits.",
        invalid: "Please enter a valid phone number.",
      },
    },
    title: {
      type: "title",
      required: true,
      messages: {
        required: "Job title is required.",
        invalid: "Please enter a valid job title.",
      },
    },
  };

  function validateField(cfg) {
    const v = cfg.element.value.trim();
    let ok = false,
      err;
    switch (cfg.type) {
        case"name":
        if(!v) err="required";
        else if(v.length<cfg.min) err="min";
        else if(/(.)\1{3,}/.test(v)) err="invalid";
        else if(!/^[a-zA-Z\s]+$/.test(v)) err="invalid";
        else ok=true;
        break;
      case "email":
        if (!v) err = "required";
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) err = "invalid";
        else if (
          [
            "gmail.com",
            "yahoo.com",
            "outlook.com",
            "hotmail.com",
            "aol.com",
            "msn.com",
            "ymail.com",
            "comcast.net",
            "live.com",
            "protonmail.com",
          ].includes(v.split("@")[1])
        )
          err = "business";
        else ok = true;
        break;
      case "phone":
        const digs = v.replace(/\D/g, "");
        if (!v) err = "required";
        else if (digs.length < cfg.min) err = "min";
        else if (!/^(?!\+?(\d)\1+$)\+?\d{8,15}$/.test(v)) err = "invalid";
        else ok = true;
        break;
      case "title":
        if (!v) err = cfg.required ? "required" : null;
        else if (!/^[a-zA-Z\s]+$/.test(v) || /(.)\1{3,}/.test(v))
          err = "invalid";
        else ok = true;
        break;
    }
    const ct = cfg.element.parentElement,
      nx = ct.nextElementSibling;
    if (!ok) {
      if (!nx || !nx.classList.contains("error-message")) {
        const e = document.createElement("div");
        e.className = "error-message";
        e.textContent = cfg.messages[err];
        ct.insertAdjacentElement("afterend", e);
      } else nx.textContent = cfg.messages[err];
    } else if (nx && nx.classList.contains("error-message")) nx.remove();
    return ok;
  }

  function validateSelect(sel) {
    const v = sel.value,
      ct = sel.parentElement,
      nx = ct.nextElementSibling;
    const msg = `${
      sel.getAttribute("errorlabel") || sel.name
    } is a required field.`;
    if (!v) {
      if (!nx || !nx.classList.contains("error-message")) {
        const e = document.createElement("div");
        e.className = "error-message";
        e.textContent = msg;
        ct.insertAdjacentElement("afterend", e);
      } else nx.textContent = msg;
      return false;
    } else if (nx && nx.classList.contains("error-message")) nx.remove();
    return true;
  }

  function attachValidation(form) {
    Object.entries(VALIDATION_RULES).forEach(([n, r]) => {
      const el = form.querySelector(`[name="${n}"]`);
      if (el)
        el.addEventListener("blur", () =>
          validateField({
            element: el,
            type: r.type,
            min: r.min,
            required: r.required,
            messages: r.messages,
          })
        );
    });
    form.querySelectorAll("select[required]").forEach((sel) => {
      sel.addEventListener("change", () => validateSelect(sel));
      sel.addEventListener("blur", () => validateSelect(sel));
    });
  }

  // --- CONTACT US DYNAMIC FIELDS ---
  function initContactUsDynamic(form) {
    const elq = form.querySelector('input[name="elqFormName"]')?.value;
    if (elq != "website_cta_contactus") return;
    const sub = form.querySelector('select[name="subject"]');
    if (!sub) return;
    function add() {
      const wrap = sub.closest(".form-input-wrap");
      if (!form.querySelector("div[job-title-wrap]"))
        wrap.insertAdjacentHTML(
          "afterend",
          `<div job-title-wrap class="form-input-wrap"><div class="form-input-inner-wrap"><select name="title" required class="input-relative" errorlabel="job title"><option value="">Job title</option><option value="CXO/EVP">CXO/EVP</option><option value="SVP/VP">SVP/VP</option><option value="Director">Director</option><option value="Manager">Manager</option><option value="Individual Contributor">Individual Contributor</option><option value="Student">Student</option></select></div></div>`
        );
      if (!form.querySelector("div[department-wrap]"))
        form
          .querySelector("div[job-title-wrap]")
          .insertAdjacentHTML(
            "afterend",
            `<div department-wrap class="form-input-wrap"><div class="form-input-inner-wrap"><select name="department" required class="input-relative" errorlabel="department"><option value="">Department</option><option value="BI">BI</option><option value="Customer Service &amp; Support">Customer Service &amp; Support</option><option value="Engineering/Product Development">Engineering/Product Development</option><option value="Developer/Engineering">Developer/Engineering</option><option value="Human Resources">Human Resources</option><option value="IT">IT</option><option value="Marketing">Marketing</option><option value="Operations">Operations</option><option value="Sales">Sales</option><option value="Finance">Finance</option><option value="Other">Other</option></select></div></div>`
          );
    }
    function rem() {
      form.querySelector("div[job-title-wrap]")?.remove();
      form.querySelector("div[department-wrap]")?.remove();
    }
    function upd() {
      sub.value === "Sales" ? add() : rem();
    }
    sub.addEventListener("change", upd);
    form.addEventListener("submit", upd);
    upd();
  }

  // --- SUBMIT HANDLER ---
  async function handleSubmit(e) {
    e.preventDefault();
    e.stopPropagation();
    const form = e.target;
    let valid = true;
    Object.entries(VALIDATION_RULES).forEach(([n, r]) => {
      if (r.required) {
        const el = form.querySelector(`[name="${n}"]`);
        if (
          !validateField({
            element: el,
            type: r.type,
            min: r.min,
            required: r.required,
            messages: r.messages,
          })
        )
          valid = false;
      }
    });
    form.querySelectorAll("select[required]").forEach((sel) => {
      if (!validateSelect(sel)) valid = false;
    });
    if (!valid) return console.log("Please fix errors and try again.");

    await populateAll(form);
    populateSubmissionFields(form);
    const elqN = form.querySelector('input[name="elqFormName"]')?.value;
    if (elqN === "website_cta_videodemorequest") setUInfoCookie(form);

    const data = new URLSearchParams(new FormData(form));
    fetch(form.action, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: data,
    })
      .then((res) => {
        if (!res.ok) throw new Error(res.status);
        console.log("[Form] Eloqua submission successful");
        const ri = form.querySelector('input[name="contentURL1"]');
        window.location.href = ri ? ri.value : window.location.origin;
      })
      .catch((err) => console.error("[Form] Submission error", err));
  }

  // --- INIT ---
  function initForm(form) {
    populateAll(form);
    attachValidation(form);
    initContactUsDynamic(form);
    form.addEventListener("submit", handleSubmit);
  }
  function init() {
    document.querySelectorAll('form[eloquaform="true"]').forEach(initForm);
  }
  if (document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);
})();
*/
// --- END ---
