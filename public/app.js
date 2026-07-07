var S=document.querySelector("#app");if(!S)throw new Error("Missing app root.");var M=S,H=new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}),k="Appeal Compass is designed only for individual residential homeowners appealing their own home; entity-owned, commercial, and association properties are not supported and generally require an attorney.",P="https://www.cookcountyassessoril.gov/exemptions",q="https://www.cookcountypropertyinfo.com/",w=0;function i(e){return String(e??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function v(e,t){return`<a href="${i(e)}" target="_blank" rel="noreferrer">${i(t)}<span class="sr-only"> (opens in new tab)</span></a>`}function u(e,t){w+=1;let n=`tooltip-${w}`;return`<span class="tooltip">
    <button class="tooltip-toggle" type="button" aria-label="${i(e)}" aria-expanded="false" aria-describedby="${n}">?</button>
    <span class="tooltip-bubble" id="${n}" role="tooltip" hidden>${i(t)}</span>
  </span>`}function b(e){let t=String(e??""),n=/https?:\/\/[^\s<>"']+/g,s="",a=0;for(let r of t.matchAll(n)){let o=r[0],c=r.index??0,A=o.match(/[.,;:)]+$/)?.[0]??"",$=o.slice(0,o.length-A.length);s+=i(t.slice(a,c)),s+=`<a href="${i($)}" target="_blank" rel="noreferrer">${i($)}<span class="sr-only"> (opens in new tab)</span></a>${i(A)}`,a=c+o.length}return s+i(t.slice(a))}function l(e){return e===null?"Not available":H.format(e)}function d(e,t=0){return e===null?"Not available":e.toLocaleString("en-US",{maximumFractionDigits:t})}async function C(e){let t=await fetch(e,{headers:{accept:"application/json"}}),n=await t.json();if(!t.ok||typeof n=="object"&&n&&"ok"in n&&n.ok===!1){let s=n.error?.message??"The request failed.";throw new Error(s)}return n}function f(e,t){let n=new FormData(e).get(t);return typeof n=="string"?n.trim():""}function x(e,t){let n=["jurisdiction","venue","ownershipType","assessorAppealFiled","assessorDecisionReceived","borAppealFiled","borDecisionReceived","borDecisionDate","purchasePrice","purchaseDate","appraisalValue","appraisalDate","actualSqft","actualAv","actualImprovementAv"];for(let s of n){let a=f(t,s);a&&e.set(s,a)}}function T(e){return`<section class="progress" aria-live="polite"><p>${i(e)}</p></section>`}function D(){return`<svg aria-hidden="true" class="github-mark" viewBox="0 0 16 16" width="20" height="20">
    <path fill="currentColor" d="M8 0C3.58 0 0 3.67 0 8.2c0 3.62 2.29 6.69 5.47 7.78.4.08.55-.18.55-.39 0-.19-.01-.84-.01-1.53-2.01.38-2.53-.5-2.69-.96-.09-.24-.48-.96-.82-1.16-.28-.16-.68-.55-.01-.56.63-.01 1.08.59 1.23.84.72 1.24 1.87.89 2.33.68.07-.53.28-.89.51-1.09-1.78-.21-3.64-.91-3.64-4.04 0-.89.31-1.62.82-2.19-.08-.21-.36-1.04.08-2.16 0 0 .67-.22 2.2.84A7.43 7.43 0 0 1 8 3.98c.68 0 1.36.09 2 .28 1.53-1.06 2.2-.84 2.2-.84.44 1.12.16 1.95.08 2.16.51.57.82 1.3.82 2.19 0 3.14-1.87 3.83-3.65 4.04.29.26.54.76.54 1.54 0 1.11-.01 2-.01 2.27 0 .21.15.47.55.39A8.08 8.08 0 0 0 16 8.2C16 3.67 12.42 0 8 0Z"/>
  </svg>`}function F(){return`<footer class="site-footer">
    <p>Appeal Compass is an open-source project developed by <a href="https://github.com/tommasodesantis" target="_blank" rel="noreferrer">Tommaso De Santis<span class="sr-only"> (opens in new tab)</span></a> under GPLv3.</p>
    <a class="footer-icon-link" href="https://github.com/tommasodesantis/appealcompass" target="_blank" rel="noreferrer">${D()}<span>View on GitHub</span><span class="sr-only"> (opens in new tab)</span></a>
    <a href="https://ko-fi.com/tomdesantis" target="_blank" rel="noreferrer">Donations help the project grow and cover hosting and maintenance costs.<span class="sr-only"> (opens in new tab)</span></a>
  </footer>`}function R(){let e=["Looking up your property...","Fetching assessment history...","Finding similar homes...","Building the evidence summary..."],t=0,n=e[0]??"",s=document.querySelector("#progress");s&&(s.innerHTML=T(e[t]??n));let a=window.setInterval(()=>{t=(t+1)%e.length;let r=document.querySelector("#progress");r&&(r.innerHTML=T(e[t]??n))},650);return()=>window.clearInterval(a)}function I(){M.innerHTML=`
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
        <p class="hint pin-help">Don't know your PIN? You can recover it from the ${v(q,"Cook County Property Tax Portal")}.</p>

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
    ${F()}
  `}function p(e){let t=document.querySelector("#form-error");t&&(t.innerHTML=e?`<section class="error inline-error" role="alert">${i(e)}</section>`:"")}function m(e,t){let n=new FormData(e).get(t);return typeof n=="string"?n:""}function g(e,t,n){let s=e.querySelector(`[data-conditional="${t}"]`);if(s){s.hidden=!n;for(let a of Array.from(s.querySelectorAll("input, select, textarea"))){if(!(a instanceof HTMLInputElement||a instanceof HTMLSelectElement||a instanceof HTMLTextAreaElement))continue;let r=a;r.disabled=!n,r.required=n,n||(r instanceof HTMLInputElement&&r.type==="radio"?r.checked=!1:r.value="")}}}function h(e){let t=m(e,"assessorAppealFiled")==="yes",n=m(e,"borAppealFiled")==="yes",s=m(e,"borDecisionReceived")==="yes";g(e,"assessorDecision",t),g(e,"borDecision",n),g(e,"borDecisionDate",n&&s)}function N(e){return p(""),h(e),e.reportValidity()?f(e,"ownershipType")!=="individual"?(p(k),!1):!0:!1}function j(e){return e.length===0?"":`<section class="warnings" aria-label="Warnings"><h2>Warnings</h2><ul>${e.map(t=>`<li>${b(t)}</li>`).join("")}</ul></section>`}function B(){return`<section class="panel" aria-labelledby="exemptions">
    <h2 id="exemptions">Exemptions and past-year corrections</h2>
    <p>Exemptions are fixed reductions in taxable value for owner-occupants, seniors, veterans, people with disabilities, and some other homeowners. They can be worth more than an appeal.</p>
    <p>Check your exemptions on the ${v(P,"Cook County Assessor exemptions page")} and the ${v(q,"Cook County Property Tax Portal")}. Bring documentation for any missing or incorrect exemption.</p>
    <p>A Certificate of Error is a Cook County process to fix past-year mistakes - like a missed exemption or wrong property facts - which can lead to a refund. Ask the Assessor's office about it.</p>
  </section>`}function V(e){let t=e.routing,n=t.officialUrl?`<a href="${i(t.officialUrl)}" target="_blank" rel="noreferrer">Verify at the official source before filing</a>`:"";if(!t.deadline)return`<p>No computed deadline. ${n}</p>`;let s=t.daysRemaining===null?"":` ${t.daysRemaining>=0?`${t.daysRemaining} days remaining.`:`${Math.abs(t.daysRemaining)} days past the computed deadline.`}`;return`<p><strong>Deadline:</strong> ${i(t.deadline)}.${i(s)} ${n}</p>`}function U(e){let t=e.evidence.comparableAnalysis,n=u("What comparable profile means",'A "profile" is the set of matching rules this tool uses to pick similar homes for the specific venue: size, age, neighborhood, and which assessment number is compared, because each venue weighs comparables differently.'),s=t.status==="ok"?`<p>Comparable analysis completed with the ${i(t.profileLabel)} profile ${n} using ${i(t.metricLabel)} per square foot.</p>`:`<p>${i(t.note)}</p>`,a=t.exhibit.map(o=>{let c=t.profileLabel.includes("Assessor")||e.routing.venue==="closed"?o.comparable.av:o.comparable.improvementAv;return`<tr>
        <td>${i(o.comparable.pinFormatted)}</td>
        <td>${d(o.comparable.buildingSqft)}</td>
        <td>${i(o.comparable.yearBuilt??"Not available")}</td>
        <td>${i(o.comparable.assessmentYear??"Not available")}</td>
        <td>${l(c)}</td>
        <td>${l(o.avPerSqft)}</td>
      </tr>`}).join(""),r=a.length===0?"<p>No lower-assessed comparable exhibit is available from the current public data.</p>":`<div class="table-wrap"><table>
          <thead><tr><th>PIN</th><th>Sqft</th><th>Built Year</th><th>Assessment Year</th><th>Metric</th><th>Metric/sqft</th></tr></thead>
          <tbody>${a}</tbody>
        </table></div>`;return`<section class="panel" aria-labelledby="step-four">
    <div class="step-label">Step 4</div>
    <h2 id="step-four">Evidence summary</h2>
    <p class="metric-line"><strong>Tier:</strong> ${i(e.evidence.tier)} ${u("What tier means","The tier is a rough screen of how much public data supports spending time on an appeal.")}. ${i(e.evidence.tierMessage)}</p>
    ${s}
    <p><strong>Pool:</strong> ${d(t.poolSize)} similar homes, ${i(t.scope??"no scope")}; subject ${i(t.metricLabel)}/sqft ${l(t.subjectAvPerSqft)}; median ${l(t.medianAvPerSqft)}; gap ${d(t.gapPct,1)}%.</p>
    ${r}
    <h3 class="heading-with-tooltip">Arguments ${u("What arguments mean","An argument is a distinct reason the assessment may be too high: uniformity, overvaluation, description error, or assessment shock. Strength labels are rough screens, not legal conclusions.")}</h3>
    ${e.evidence.arguments.length?`<ul>${e.evidence.arguments.map(o=>`<li><strong>${i(o.argumentType)}:</strong> ${i(o.text)}</li>`).join("")}</ul>`:"<p>No strong public-data argument was found. Add sale, appraisal, condition, or factual-error evidence if available.</p>"}
    <h3 class="heading-with-tooltip">Rough savings estimate ${u("How rough savings are estimated","Estimated savings = \u0394AV \xD7 E \xD7 r, where \u0394AV is the assessed-value reduction, E is the state equalizer, and r is the assumed tax rate. The range is shown as \xB120% and is not a promise.")}</h3>
    <p>${l(e.evidence.savingsAssumptions.low)} to ${l(e.evidence.savingsAssumptions.high)}, with point estimate ${l(e.evidence.savingsAssumptions.point)}.</p>
    <p class="hint">Assumes equalizer ${e.evidence.savingsAssumptions.stateEqualizer} and tax rate ${(e.evidence.savingsAssumptions.taxRate*100).toFixed(2)}%; this is a rough range, not a promise.</p>
  </section>`}function _(e,t){let n=e.case.parcel,s=[n.address,n.city,n.zipCode].filter(Boolean).join(", "),a=[e.case.userEvidence.actualSqft?`Actual sqft ${d(e.case.userEvidence.actualSqft)}`:"",e.case.userEvidence.actualAv?`Actual AV ${l(e.case.userEvidence.actualAv)}`:"",e.case.userEvidence.actualImprovementAv?`Actual improvement AV ${l(e.case.userEvidence.actualImprovementAv)}`:""].filter(Boolean),r=new URLSearchParams(t);r.set("pin",n.pin),e.demo&&r.set("demo","1");let o=document.querySelector("#results");o&&(o.innerHTML=`
    <section class="notice"><strong>${i(e.evidence.disclaimers[0])}</strong></section>
    <section class="panel" aria-labelledby="step-three">
      <div class="step-label">Step 3</div>
      <h2 id="step-three">Routing decision</h2>
      <p class="headline">${i(e.routing.headline)}</p>
      ${V(e)}
      <ul>${e.routing.reasoning.map(c=>`<li>${b(c)}</li>`).join("")}</ul>
    </section>

    <section class="subject panel">
      <h2>Subject property</h2>
      <dl>
        <div><dt>PIN</dt><dd>${i(n.pinFormatted)}</dd></div>
        ${s?`<div><dt>Address</dt><dd>${i(s)}</dd></div>`:""}
        <div><dt>Class / township</dt><dd>${i(n.propertyClass)} / ${i(n.townshipName)}</dd></div>
        <div><dt>Building sqft</dt><dd>${d(n.buildingSqft)}</dd></div>
        <div><dt>Total AV</dt><dd>${l(n.currentAv)}</dd></div>
        <div><dt>Improvement AV</dt><dd>${l(n.currentImprovementAv)}</dd></div>
      </dl>
      ${a.length?`<p class="tagline">${i(a.join("; "))} - user-supplied; documentation required.</p>`:""}
    </section>

    ${U(e)}

    <section class="panel" aria-labelledby="step-five">
      <div class="step-label">Step 5</div>
      <h2 id="step-five">${i(e.venue.name)} checklist</h2>
      <p class="hint">Use this checklist to assemble documents before filing at the official venue.</p>
      <ul>${e.venue.checklist.map(c=>`<li>${b(c)}</li>`).join("")}</ul>
      <a class="button-link" href="/print?${r.toString()}">Print / Save as PDF</a>
    </section>

    ${B()}

    ${j(e.warnings)}
  `)}function E(){p("");for(let e of["#results","#address-results"]){let t=document.querySelector(e);t&&(t.innerHTML="")}}async function O(e){E();let t=R();try{let n=await C(`/api/case?${e.toString()}`);E(),_(n,e)}catch(n){let s=document.querySelector("#results");s&&(s.innerHTML=`<section class="error" role="alert">${i(n instanceof Error?n.message:"The case could not be loaded.")}</section>`)}finally{t();let n=document.querySelector("#progress");n&&(n.innerHTML="")}}async function Y(e){if(!N(e))return;let t=new URLSearchParams,n=f(e,"pin");if(x(t,e),n){t.set("pin",n),await O(t);return}let s=document.querySelector("#results");s&&(s.innerHTML='<section class="error" role="alert">Enter a PIN.</section>')}function z(){let e=document.querySelector("details.evidence");if(e)for(let t of Array.from(e.querySelectorAll("[data-evidence-input]")))(t instanceof HTMLInputElement||t instanceof HTMLTextAreaElement)&&(t.value="")}function y(e=null){for(let t of Array.from(document.querySelectorAll(".tooltip-toggle"))){if(t===e)continue;let n=t.getAttribute("aria-describedby"),s=n?document.getElementById(n):null;t.setAttribute("aria-expanded","false"),s&&(s.hidden=!0)}}function W(e){let t=e.getAttribute("aria-describedby"),n=t?document.getElementById(t):null;if(!n)return;let s=e.getAttribute("aria-expanded")!=="true";y(s?e:null),e.setAttribute("aria-expanded",String(s)),n.hidden=!s}I();var L=document.querySelector("#case-form");L&&h(L);document.addEventListener("submit",e=>{let t=e.target;t instanceof HTMLFormElement&&t.id==="case-form"&&(e.preventDefault(),Y(t))});document.addEventListener("change",e=>{let t=e.target;if(t instanceof HTMLInputElement||t instanceof HTMLSelectElement||t instanceof HTMLTextAreaElement){let n=t.form;n?.id==="case-form"&&(p(""),h(n))}});document.addEventListener("click",e=>{let t=e.target;if(t instanceof HTMLElement){let n=t.closest(".tooltip-toggle");if(n){W(n);return}y()}t instanceof HTMLElement&&t.id==="clear-evidence"&&z()});document.addEventListener("keydown",e=>{e.key==="Escape"&&y()});document.documentElement.dataset.enhanced="true";
