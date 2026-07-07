var T=document.querySelector("#app");if(!T)throw new Error("Missing app root.");var L=T,S=new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}),q="Appeal Compass is designed only for individual residential homeowners appealing their own home; entity-owned, commercial, and association properties are not supported and generally require an attorney.",M="https://www.cookcountyassessoril.gov/exemptions",E="https://www.cookcountypropertyinfo.com/";function s(e){return String(e??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function v(e,n){return`<a href="${s(e)}" target="_blank" rel="noreferrer">${s(n)}<span class="sr-only"> (opens in new tab)</span></a>`}function g(e){let n=String(e??""),t=/https?:\/\/[^\s<>"']+/g,i="",a=0;for(let r of n.matchAll(t)){let l=r[0],c=r.index??0,h=l.match(/[.,;:)]+$/)?.[0]??"",y=l.slice(0,l.length-h.length);i+=s(n.slice(a,c)),i+=`<a href="${s(y)}" target="_blank" rel="noreferrer">${s(y)}<span class="sr-only"> (opens in new tab)</span></a>${s(h)}`,a=c+l.length}return i+s(n.slice(a))}function o(e){return e===null?"Not available":S.format(e)}function p(e,n=0){return e===null?"Not available":e.toLocaleString("en-US",{maximumFractionDigits:n})}async function P(e){let n=await fetch(e,{headers:{accept:"application/json"}}),t=await n.json();if(!n.ok||typeof t=="object"&&t&&"ok"in t&&t.ok===!1){let i=t.error?.message??"The request failed.";throw new Error(i)}return t}function f(e,n){let t=new FormData(e).get(n);return typeof t=="string"?t.trim():""}function H(e,n){let t=["jurisdiction","venue","ownershipType","assessorAppealFiled","assessorDecisionReceived","borAppealFiled","borDecisionReceived","borDecisionDate","purchasePrice","purchaseDate","appraisalValue","appraisalDate","actualSqft","actualAv","actualImprovementAv"];for(let i of t){let a=f(n,i);a&&e.set(i,a)}}function A(e){return`<section class="progress" aria-live="polite"><p>${s(e)}</p></section>`}function k(){return`<svg aria-hidden="true" class="github-mark" viewBox="0 0 16 16" width="20" height="20">
    <path fill="currentColor" d="M8 0C3.58 0 0 3.67 0 8.2c0 3.62 2.29 6.69 5.47 7.78.4.08.55-.18.55-.39 0-.19-.01-.84-.01-1.53-2.01.38-2.53-.5-2.69-.96-.09-.24-.48-.96-.82-1.16-.28-.16-.68-.55-.01-.56.63-.01 1.08.59 1.23.84.72 1.24 1.87.89 2.33.68.07-.53.28-.89.51-1.09-1.78-.21-3.64-.91-3.64-4.04 0-.89.31-1.62.82-2.19-.08-.21-.36-1.04.08-2.16 0 0 .67-.22 2.2.84A7.43 7.43 0 0 1 8 3.98c.68 0 1.36.09 2 .28 1.53-1.06 2.2-.84 2.2-.84.44 1.12.16 1.95.08 2.16.51.57.82 1.3.82 2.19 0 3.14-1.87 3.83-3.65 4.04.29.26.54.76.54 1.54 0 1.11-.01 2-.01 2.27 0 .21.15.47.55.39A8.08 8.08 0 0 0 16 8.2C16 3.67 12.42 0 8 0Z"/>
  </svg>`}function C(){return`<footer class="site-footer">
    <p>Appeal Compass is an open-source project developed by <a href="https://github.com/tommasodesantis" target="_blank" rel="noreferrer">Tommaso De Santis<span class="sr-only"> (opens in new tab)</span></a> under GPLv3.</p>
    <a class="footer-icon-link" href="https://github.com/tommasodesantis/appealcompass" target="_blank" rel="noreferrer">${k()}<span>View on GitHub</span><span class="sr-only"> (opens in new tab)</span></a>
    <a href="https://ko-fi.com/tomdesantis" target="_blank" rel="noreferrer">Donations help the project grow and cover hosting and maintenance costs.<span class="sr-only"> (opens in new tab)</span></a>
  </footer>`}function D(){let e=["Looking up your property...","Fetching assessment history...","Finding similar homes...","Building the evidence summary..."],n=0,t=e[0]??"",i=document.querySelector("#progress");i&&(i.innerHTML=A(e[n]??t));let a=window.setInterval(()=>{n=(n+1)%e.length;let r=document.querySelector("#progress");r&&(r.innerHTML=A(e[n]??t))},650);return()=>window.clearInterval(a)}function F(){L.innerHTML=`
    <header class="topline">
      <h1>Appeal Compass</h1>
      <p class="lede">Enter a PIN. A PIN is the 14-digit parcel number on your assessment notice, tax bill, or property record card.</p>
    </header>

    <section class="panel" aria-labelledby="step-one">
      <div class="step-label">Step 1</div>
      <h2 id="step-one">Find the property</h2>
      <form id="case-form" class="stack">
        <div id="form-error" aria-live="polite"></div>
        <label>
          <span>Jurisdiction</span>
          <select name="jurisdiction" required>
            <option value="cook_county_il" selected>Cook County, Illinois</option>
          </select>
        </label>
        <p class="hint">More jurisdictions may be added - this is an open-source project.</p>
        <div class="lookup-grid">
          <label>
            <span>PIN</span>
            <input name="pin" autocomplete="off" inputmode="numeric" placeholder="03-00-000-000-0001" required>
          </label>
        </div>
        <p class="hint pin-help">Don't know your PIN? You can recover it from the ${v(E,"Cook County Property Tax Portal")}.</p>

        <fieldset class="question-group">
          <legend>Ownership type</legend>
          <label>
            <span>Who owns the property?</span>
            <select name="ownershipType" required>
              <option value="">Choose ownership type</option>
              <option value="individual">Individual</option>
              <option value="llc">LLC</option>
              <option value="corporation">Corporation</option>
              <option value="other">Other entity</option>
            </select>
          </label>
        </fieldset>

        <fieldset class="question-group">
          <legend>Assessor appeal status</legend>
          <p>Have you already filed an Assessor appeal for this year?</p>
          <div class="choice-row">
            <label><input type="radio" name="assessorAppealFiled" value="yes" required><span>Yes</span></label>
            <label><input type="radio" name="assessorAppealFiled" value="no" required><span>No</span></label>
          </div>
          <div class="conditional" data-conditional="assessorDecision" hidden>
            <p>Have you already received the Assessor decision?</p>
            <div class="choice-row">
              <label><input type="radio" name="assessorDecisionReceived" value="yes"><span>Yes</span></label>
              <label><input type="radio" name="assessorDecisionReceived" value="no"><span>No</span></label>
            </div>
          </div>
        </fieldset>

        <fieldset class="question-group">
          <legend>Board of Review appeal status</legend>
          <p>Have you already filed a Board of Review appeal for this year?</p>
          <div class="choice-row">
            <label><input type="radio" name="borAppealFiled" value="yes" required><span>Yes</span></label>
            <label><input type="radio" name="borAppealFiled" value="no" required><span>No</span></label>
          </div>
          <div class="conditional" data-conditional="borDecision" hidden>
            <p>Have you already received the BOR decision?</p>
            <div class="choice-row">
              <label><input type="radio" name="borDecisionReceived" value="yes"><span>Yes</span></label>
              <label><input type="radio" name="borDecisionReceived" value="no"><span>No</span></label>
            </div>
          </div>
          <div class="conditional" data-conditional="borDecisionDate" hidden>
            <label>
              <span>BOR decision date</span>
              <input name="borDecisionDate" type="date">
            </label>
          </div>
        </fieldset>

        <details class="evidence">
          <summary>Add your own evidence</summary>
          <div class="evidence-grid">
            <label>
              <span>Venue</span>
              <select name="venue">
                <option value="auto">Auto-route</option>
                <option value="assessor">Assessor</option>
                <option value="bor">Board of Review</option>
                <option value="ptab">PTAB</option>
              </select>
            </label>
            <label>
              <span>Purchase price</span>
              <input name="purchasePrice" inputmode="decimal" data-evidence-input>
            </label>
            <label>
              <span>Purchase date</span>
              <input name="purchaseDate" type="date" data-evidence-input>
            </label>
            <label>
              <span>Appraisal value</span>
              <input name="appraisalValue" inputmode="decimal" data-evidence-input>
            </label>
            <label>
              <span>Appraisal date</span>
              <input name="appraisalDate" type="date" data-evidence-input>
            </label>
            <label>
              <span>Actual sqft</span>
              <input name="actualSqft" inputmode="decimal" aria-describedby="actual-help" data-evidence-input>
            </label>
            <label>
              <span>Actual total AV</span>
              <input name="actualAv" inputmode="decimal" data-evidence-input>
            </label>
            <label>
              <span>Actual improvement AV</span>
              <input name="actualImprovementAv" inputmode="decimal" data-evidence-input>
            </label>
          </div>
          <p id="actual-help" class="hint">User-supplied values are labeled documentation-required and are used only when official public data is missing.</p>
          <button type="button" id="clear-evidence" class="secondary">Clear evidence</button>
        </details>

        <div class="actions">
          <button type="submit">Review my case</button>
        </div>
      </form>
    </section>

    <div id="progress"></div>
    <div id="results"></div>
    ${C()}
  `}function d(e){let n=document.querySelector("#form-error");n&&(n.innerHTML=e?`<section class="error inline-error" role="alert">${s(e)}</section>`:"")}function u(e,n){let t=new FormData(e).get(n);return typeof t=="string"?t:""}function m(e,n,t){let i=e.querySelector(`[data-conditional="${n}"]`);if(i){i.hidden=!t;for(let a of Array.from(i.querySelectorAll("input, select, textarea"))){if(!(a instanceof HTMLInputElement||a instanceof HTMLSelectElement||a instanceof HTMLTextAreaElement))continue;let r=a;r.disabled=!t,r.required=t,t||(r instanceof HTMLInputElement&&r.type==="radio"?r.checked=!1:r.value="")}}}function b(e){let n=u(e,"assessorAppealFiled")==="yes",t=u(e,"borAppealFiled")==="yes",i=u(e,"borDecisionReceived")==="yes";m(e,"assessorDecision",n),m(e,"borDecision",t),m(e,"borDecisionDate",t&&i)}function R(e){return d(""),b(e),e.reportValidity()?f(e,"ownershipType")!=="individual"?(d(q),!1):!0:!1}function x(e){return e.length===0?"":`<section class="warnings" aria-label="Warnings"><h2>Warnings</h2><ul>${e.map(n=>`<li>${g(n)}</li>`).join("")}</ul></section>`}function I(){return`<section class="panel" aria-labelledby="exemptions">
    <h2 id="exemptions">Exemptions and past-year corrections</h2>
    <p>Exemptions are fixed reductions in taxable value for owner-occupants, seniors, veterans, people with disabilities, and some other homeowners. They can be worth more than an appeal.</p>
    <p>Check your exemptions on the ${v(M,"Cook County Assessor exemptions page")} and the ${v(E,"Cook County Property Tax Portal")}. Bring documentation for any missing or incorrect exemption.</p>
    <p>A Certificate of Error is a Cook County process to fix past-year mistakes - like a missed exemption or wrong property facts - which can lead to a refund. Ask the Assessor's office about it.</p>
  </section>`}function j(e){let n=e.routing,t=n.officialUrl?`<a href="${s(n.officialUrl)}" target="_blank" rel="noreferrer">Verify at the official source before filing</a>`:"";if(!n.deadline)return`<p>No computed deadline. ${t}</p>`;let i=n.daysRemaining===null?"":` ${n.daysRemaining>=0?`${n.daysRemaining} days remaining.`:`${Math.abs(n.daysRemaining)} days past the computed deadline.`}`;return`<p><strong>Deadline:</strong> ${s(n.deadline)}.${s(i)} ${t}</p>`}function N(e){let n=e.evidence.comparableAnalysis,t=n.exhibit.map(a=>{let r=n.profileLabel.includes("Assessor")||e.routing.venue==="closed"?a.comparable.av:a.comparable.improvementAv;return`<tr>
        <td>${s(a.comparable.pinFormatted)}</td>
        <td>${p(a.comparable.buildingSqft)}</td>
        <td>${s(a.comparable.yearBuilt??"Not available")}</td>
        <td>${s(a.comparable.assessmentYear??"Not available")}</td>
        <td>${o(r)}</td>
        <td>${o(a.avPerSqft)}</td>
      </tr>`}).join(""),i=t.length===0?"<p>No lower-assessed comparable exhibit is available from the current public data.</p>":`<div class="table-wrap"><table>
          <thead><tr><th>PIN</th><th>Sqft</th><th>Built Year</th><th>Assessment Year</th><th>Metric</th><th>Metric/sqft</th></tr></thead>
          <tbody>${t}</tbody>
        </table></div>`;return`<section class="panel" aria-labelledby="step-four">
    <div class="step-label">Step 4</div>
    <h2 id="step-four">Evidence summary</h2>
    <p><strong>Tier:</strong> ${s(e.evidence.tier)}. ${s(e.evidence.tierMessage)}</p>
    <p class="hint">The tier is a rough screen of how much public data supports spending time on an appeal.</p>
    <p><strong>Comparable profile:</strong> ${s(n.profileLabel)} using ${s(n.metricLabel)}.</p>
    <p class="hint">Comparable analysis matters because uniformity appeals compare your assessment to similar homes.</p>
    <p>${s(n.note)}</p>
    <p><strong>Pool:</strong> ${p(n.poolSize)} similar homes, ${s(n.scope??"no scope")}; subject ${s(n.metricLabel)}/sqft ${o(n.subjectAvPerSqft)}; median ${o(n.medianAvPerSqft)}; gap ${p(n.gapPct,1)}%.</p>
    ${i}
    <h3>Arguments</h3>
    ${e.evidence.arguments.length?`<ul>${e.evidence.arguments.map(a=>`<li><strong>${s(a.argumentType)}:</strong> ${s(a.text)}</li>`).join("")}</ul>`:"<p>No strong public-data argument was found. Add sale, appraisal, condition, or factual-error evidence if available.</p>"}
    <h3>Rough savings estimate</h3>
    <p>${o(e.evidence.savingsAssumptions.low)} to ${o(e.evidence.savingsAssumptions.high)}, with point estimate ${o(e.evidence.savingsAssumptions.point)}.</p>
    <p class="hint">Assumes equalizer ${e.evidence.savingsAssumptions.stateEqualizer} and tax rate ${(e.evidence.savingsAssumptions.taxRate*100).toFixed(2)}%; this is a rough range, not a promise.</p>
  </section>`}function U(e,n){let t=e.case.parcel,i=[t.address,t.city,t.zipCode].filter(Boolean).join(", "),a=[e.case.userEvidence.actualSqft?`Actual sqft ${p(e.case.userEvidence.actualSqft)}`:"",e.case.userEvidence.actualAv?`Actual AV ${o(e.case.userEvidence.actualAv)}`:"",e.case.userEvidence.actualImprovementAv?`Actual improvement AV ${o(e.case.userEvidence.actualImprovementAv)}`:""].filter(Boolean),r=new URLSearchParams(n);r.set("pin",t.pin),e.demo&&r.set("demo","1");let l=document.querySelector("#results");l&&(l.innerHTML=`
    <section class="notice"><strong>${s(e.evidence.disclaimers[0])}</strong></section>
    <section class="panel" aria-labelledby="step-three">
      <div class="step-label">Step 3</div>
      <h2 id="step-three">Routing decision</h2>
      <p class="headline">${s(e.routing.headline)}</p>
      ${j(e)}
      <ul>${e.routing.reasoning.map(c=>`<li>${g(c)}</li>`).join("")}</ul>
    </section>

    <section class="subject panel">
      <h2>Subject property</h2>
      <dl>
        <div><dt>PIN</dt><dd>${s(t.pinFormatted)}</dd></div>
        ${i?`<div><dt>Address</dt><dd>${s(i)}</dd></div>`:""}
        <div><dt>Class / township</dt><dd>${s(t.propertyClass)} / ${s(t.townshipName)}</dd></div>
        <div><dt>Building sqft</dt><dd>${p(t.buildingSqft)}</dd></div>
        <div><dt>Total AV</dt><dd>${o(t.currentAv)}</dd></div>
        <div><dt>Improvement AV</dt><dd>${o(t.currentImprovementAv)}</dd></div>
      </dl>
      ${a.length?`<p class="tagline">${s(a.join("; "))} - user-supplied; documentation required.</p>`:""}
    </section>

    ${N(e)}

    <section class="panel" aria-labelledby="step-five">
      <div class="step-label">Step 5</div>
      <h2 id="step-five">${s(e.venue.name)} checklist</h2>
      <p class="hint">Use this checklist to assemble documents before filing at the official venue.</p>
      <ul>${e.venue.checklist.map(c=>`<li>${g(c)}</li>`).join("")}</ul>
      <a class="button-link" href="/print?${r.toString()}">Print / Save as PDF</a>
    </section>

    ${I()}

    ${x(e.warnings)}
  `)}function $(){d("");for(let e of["#results","#address-results"]){let n=document.querySelector(e);n&&(n.innerHTML="")}}async function V(e){$();let n=D();try{let t=await P(`/api/case?${e.toString()}`);$(),U(t,e)}catch(t){let i=document.querySelector("#results");i&&(i.innerHTML=`<section class="error" role="alert">${s(t instanceof Error?t.message:"The case could not be loaded.")}</section>`)}finally{n();let t=document.querySelector("#progress");t&&(t.innerHTML="")}}async function _(e){if(!R(e))return;let n=new URLSearchParams,t=f(e,"pin");if(H(n,e),t){n.set("pin",t),await V(n);return}let i=document.querySelector("#results");i&&(i.innerHTML='<section class="error" role="alert">Enter a PIN.</section>')}function B(){let e=document.querySelector("details.evidence");if(e)for(let n of Array.from(e.querySelectorAll("[data-evidence-input]")))(n instanceof HTMLInputElement||n instanceof HTMLTextAreaElement)&&(n.value="")}F();var w=document.querySelector("#case-form");w&&b(w);document.addEventListener("submit",e=>{let n=e.target;n instanceof HTMLFormElement&&n.id==="case-form"&&(e.preventDefault(),_(n))});document.addEventListener("change",e=>{let n=e.target;if(n instanceof HTMLInputElement||n instanceof HTMLSelectElement||n instanceof HTMLTextAreaElement){let t=n.form;t?.id==="case-form"&&(d(""),b(t))}});document.addEventListener("click",e=>{let n=e.target;n instanceof HTMLElement&&n.id==="clear-evidence"&&B()});document.documentElement.dataset.enhanced="true";
