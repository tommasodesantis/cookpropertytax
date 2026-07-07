var h=document.querySelector("#app");if(!h)throw new Error("Missing app root.");var y=h,A=new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}),$="Appeal Compass is designed only for individual residential homeowners appealing their own home; entity-owned, commercial, and association properties are not supported and generally require an attorney.";function s(e){return String(e??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function o(e){return e===null?"Not available":A.format(e)}function l(e,n=0){return e===null?"Not available":e.toLocaleString("en-US",{maximumFractionDigits:n})}async function w(e){let n=await fetch(e,{headers:{accept:"application/json"}}),t=await n.json();if(!n.ok||typeof t=="object"&&t&&"ok"in t&&t.ok===!1){let a=t.error?.message??"The request failed.";throw new Error(a)}return t}function c(e,n){let t=new FormData(e).get(n);return typeof t=="string"?t.trim():""}function S(e,n){let t=["jurisdiction","venue","ownershipType","assessorAppealFiled","assessorDecisionReceived","borAppealFiled","borDecisionReceived","borDecisionDate","purchasePrice","purchaseDate","appraisalValue","appraisalDate","actualSqft","actualAv","actualImprovementAv"];for(let i of t){let r=c(n,i);r&&e.set(i,r)}for(let i of["ownerOccupied","age65Plus","seniorFreezeIncome","veteranDisabled","personDisabled","vacancyClaim","demolitionClaim"])n.elements.namedItem(i)?.checked&&e.set(i,"1");let a=c(n,"conditionIssue").split(`
`).map(i=>i.trim()).filter(Boolean);for(let i of a)e.append("conditionIssue",i)}function b(e){return`<section class="progress" aria-live="polite"><p>${s(e)}</p></section>`}function T(){return`<svg aria-hidden="true" class="github-mark" viewBox="0 0 16 16" width="20" height="20">
    <path fill="currentColor" d="M8 0C3.58 0 0 3.67 0 8.2c0 3.62 2.29 6.69 5.47 7.78.4.08.55-.18.55-.39 0-.19-.01-.84-.01-1.53-2.01.38-2.53-.5-2.69-.96-.09-.24-.48-.96-.82-1.16-.28-.16-.68-.55-.01-.56.63-.01 1.08.59 1.23.84.72 1.24 1.87.89 2.33.68.07-.53.28-.89.51-1.09-1.78-.21-3.64-.91-3.64-4.04 0-.89.31-1.62.82-2.19-.08-.21-.36-1.04.08-2.16 0 0 .67-.22 2.2.84A7.43 7.43 0 0 1 8 3.98c.68 0 1.36.09 2 .28 1.53-1.06 2.2-.84 2.2-.84.44 1.12.16 1.95.08 2.16.51.57.82 1.3.82 2.19 0 3.14-1.87 3.83-3.65 4.04.29.26.54.76.54 1.54 0 1.11-.01 2-.01 2.27 0 .21.15.47.55.39A8.08 8.08 0 0 0 16 8.2C16 3.67 12.42 0 8 0Z"/>
  </svg>`}function L(){return`<footer class="site-footer">
    <p>Appeal Compass is an open-source project developed by <a href="https://github.com/tommasodesantis" target="_blank" rel="noreferrer">Tommaso De Santis<span class="sr-only"> (opens in new tab)</span></a> under GPLv3.</p>
    <a class="footer-icon-link" href="https://github.com/tommasodesantis/appealcompass" target="_blank" rel="noreferrer">${T()}<span>View on GitHub</span><span class="sr-only"> (opens in new tab)</span></a>
    <a href="https://ko-fi.com/tomdesantis" target="_blank" rel="noreferrer">Donations help the project grow and cover hosting and maintenance costs.<span class="sr-only"> (opens in new tab)</span></a>
  </footer>`}function E(){let e=["Looking up your property...","Fetching assessment history...","Finding similar homes...","Building the evidence summary..."],n=0,t=e[0]??"",a=document.querySelector("#progress");a&&(a.innerHTML=b(e[n]??t));let i=window.setInterval(()=>{n=(n+1)%e.length;let r=document.querySelector("#progress");r&&(r.innerHTML=b(e[n]??t))},650);return()=>window.clearInterval(i)}function q(){y.innerHTML=`
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
        <p class="hint pin-help">Don't know your PIN? You can recover it from the <a href="https://www.cookcountypropertyinfo.com/" target="_blank" rel="noreferrer">Cook County Property Tax Portal<span class="sr-only"> (opens in new tab)</span></a>.</p>

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
              <input name="purchasePrice" inputmode="decimal">
            </label>
            <label>
              <span>Purchase date</span>
              <input name="purchaseDate" type="date">
            </label>
            <label>
              <span>Appraisal value</span>
              <input name="appraisalValue" inputmode="decimal">
            </label>
            <label>
              <span>Appraisal date</span>
              <input name="appraisalDate" type="date">
            </label>
            <label>
              <span>Actual sqft</span>
              <input name="actualSqft" inputmode="decimal" aria-describedby="actual-help">
            </label>
            <label>
              <span>Actual total AV</span>
              <input name="actualAv" inputmode="decimal">
            </label>
            <label>
              <span>Actual improvement AV</span>
              <input name="actualImprovementAv" inputmode="decimal">
            </label>
          </div>
          <p id="actual-help" class="hint">User-supplied values are labeled documentation-required and are used only when official public data is missing.</p>
          <label>
            <span>Condition issues</span>
            <textarea name="conditionIssue" rows="3" placeholder="One issue per line"></textarea>
          </label>
          <div class="checks">
            ${[["ownerOccupied","Owner occupied"],["age65Plus","Age 65+"],["seniorFreezeIncome","Senior Freeze income screen"],["veteranDisabled","Disabled veteran"],["personDisabled","Person with disability"],["vacancyClaim","Vacancy claim"],["demolitionClaim","Demolition claim"]].map(([e,n])=>`<label><input type="checkbox" name="${e}"><span>${n}</span></label>`).join("")}
          </div>
        </details>

        <div class="actions">
          <button type="submit">Review my case</button>
        </div>
      </form>
    </section>

    <div id="progress"></div>
    <div id="results"></div>
    ${L()}
  `}function m(e){let n=document.querySelector("#form-error");n&&(n.innerHTML=e?`<section class="error inline-error" role="alert">${s(e)}</section>`:"")}function d(e,n){let t=new FormData(e).get(n);return typeof t=="string"?t:""}function u(e,n,t){let a=e.querySelector(`[data-conditional="${n}"]`);if(a){a.hidden=!t;for(let i of Array.from(a.querySelectorAll("input, select, textarea"))){if(!(i instanceof HTMLInputElement||i instanceof HTMLSelectElement||i instanceof HTMLTextAreaElement))continue;let r=i;r.disabled=!t,r.required=t,t||(r instanceof HTMLInputElement&&r.type==="radio"?r.checked=!1:r.value="")}}}function v(e){let n=d(e,"assessorAppealFiled")==="yes",t=d(e,"borAppealFiled")==="yes",a=d(e,"borDecisionReceived")==="yes";u(e,"assessorDecision",n),u(e,"borDecision",t),u(e,"borDecisionDate",t&&a)}function P(e){return m(""),v(e),e.reportValidity()?c(e,"ownershipType")!=="individual"?(m($),!1):!0:!1}function D(e){return e.length===0?"":`<section class="warnings" aria-label="Warnings"><h2>Warnings</h2><ul>${e.map(n=>`<li>${s(n)}</li>`).join("")}</ul></section>`}function M(e){let n=e.routing,t=n.officialUrl?`<a href="${s(n.officialUrl)}" target="_blank" rel="noreferrer">Verify at the official source before filing</a>`:"";if(!n.deadline)return`<p>No computed deadline. ${t}</p>`;let a=n.daysRemaining===null?"":` ${n.daysRemaining>=0?`${n.daysRemaining} days remaining.`:`${Math.abs(n.daysRemaining)} days past the computed deadline.`}`;return`<p><strong>Deadline:</strong> ${s(n.deadline)}.${s(a)} ${t}</p>`}function F(e){let n=e.evidence.comparableAnalysis,t=n.exhibit.map(i=>{let r=n.profileLabel.includes("Assessor")||e.routing.venue==="closed"?i.comparable.av:i.comparable.improvementAv;return`<tr>
        <td>${s(i.comparable.pinFormatted)}</td>
        <td>${l(i.comparable.buildingSqft)}</td>
        <td>${s(i.comparable.yearBuilt??"Not available")}</td>
        <td>${o(r)}</td>
        <td>${o(i.avPerSqft)}</td>
      </tr>`}).join(""),a=t.length===0?"<p>No lower-assessed comparable exhibit is available from the current public data.</p>":`<div class="table-wrap"><table>
          <thead><tr><th>PIN</th><th>Sqft</th><th>Year</th><th>Metric</th><th>Metric/sqft</th></tr></thead>
          <tbody>${t}</tbody>
        </table></div>`;return`<section class="panel" aria-labelledby="step-four">
    <div class="step-label">Step 4</div>
    <h2 id="step-four">Evidence summary</h2>
    <p><strong>Tier:</strong> ${s(e.evidence.tier)}. ${s(e.evidence.tierMessage)}</p>
    <p class="hint">The tier is a rough screen of how much public data supports spending time on an appeal.</p>
    <p><strong>Comparable profile:</strong> ${s(n.profileLabel)} using ${s(n.metricLabel)}.</p>
    <p class="hint">Comparable analysis matters because uniformity appeals compare your assessment to similar homes.</p>
    <p>${s(n.note)}</p>
    <p><strong>Pool:</strong> ${l(n.poolSize)} similar homes, ${s(n.scope??"no scope")}; subject ${s(n.metricLabel)}/sqft ${o(n.subjectAvPerSqft)}; median ${o(n.medianAvPerSqft)}; gap ${l(n.gapPct,1)}%.</p>
    ${a}
    <h3>Arguments</h3>
    ${e.evidence.arguments.length?`<ul>${e.evidence.arguments.map(i=>`<li><strong>${s(i.argumentType)}:</strong> ${s(i.text)}</li>`).join("")}</ul>`:"<p>No strong public-data argument was found. Add sale, appraisal, condition, or factual-error evidence if available.</p>"}
    <h3>Rough savings estimate</h3>
    <p>${o(e.evidence.savingsAssumptions.low)} to ${o(e.evidence.savingsAssumptions.high)}, with point estimate ${o(e.evidence.savingsAssumptions.point)}.</p>
    <p class="hint">Assumes equalizer ${e.evidence.savingsAssumptions.stateEqualizer} and tax rate ${(e.evidence.savingsAssumptions.taxRate*100).toFixed(2)}%; this is a rough range, not a promise.</p>
  </section>`}function H(e,n){let t=e.case.parcel,a=[t.address,t.city,t.zipCode].filter(Boolean).join(", "),i=[e.case.userEvidence.actualSqft?`Actual sqft ${l(e.case.userEvidence.actualSqft)}`:"",e.case.userEvidence.actualAv?`Actual AV ${o(e.case.userEvidence.actualAv)}`:"",e.case.userEvidence.actualImprovementAv?`Actual improvement AV ${o(e.case.userEvidence.actualImprovementAv)}`:""].filter(Boolean),r=new URLSearchParams(n);r.set("pin",t.pin),e.demo&&r.set("demo","1");let g=document.querySelector("#results");g&&(g.innerHTML=`
    <section class="notice"><strong>${s(e.evidence.disclaimers[0])}</strong></section>
    <section class="panel" aria-labelledby="step-three">
      <div class="step-label">Step 3</div>
      <h2 id="step-three">Routing decision</h2>
      <p class="headline">${s(e.routing.headline)}</p>
      ${M(e)}
      <ul>${e.routing.reasoning.map(p=>`<li>${s(p)}</li>`).join("")}</ul>
    </section>

    <section class="subject panel">
      <h2>Subject property</h2>
      <dl>
        <div><dt>PIN</dt><dd>${s(t.pinFormatted)}</dd></div>
        ${a?`<div><dt>Address</dt><dd>${s(a)}</dd></div>`:""}
        <div><dt>Class / township</dt><dd>${s(t.propertyClass)} / ${s(t.townshipName)}</dd></div>
        <div><dt>Building sqft</dt><dd>${l(t.buildingSqft)}</dd></div>
        <div><dt>Total AV</dt><dd>${o(t.currentAv)}</dd></div>
        <div><dt>Improvement AV</dt><dd>${o(t.currentImprovementAv)}</dd></div>
      </dl>
      ${i.length?`<p class="tagline">${s(i.join("; "))} - user-supplied; documentation required.</p>`:""}
    </section>

    ${F(e)}

    <section class="panel" aria-labelledby="step-five">
      <div class="step-label">Step 5</div>
      <h2 id="step-five">${s(e.venue.name)} checklist</h2>
      <p class="hint">Use this checklist to assemble documents before filing at the official venue.</p>
      <ul>${e.venue.checklist.map(p=>`<li>${s(p)}</li>`).join("")}</ul>
      <a class="button-link" href="/print?${r.toString()}">Print / Save as PDF</a>
    </section>

    ${D(e.warnings)}
  `)}async function k(e){let n=E();try{let t=await w(`/api/case?${e.toString()}`);H(t,e)}catch(t){let a=document.querySelector("#results");a&&(a.innerHTML=`<section class="error" role="alert">${s(t instanceof Error?t.message:"The case could not be loaded.")}</section>`)}finally{n();let t=document.querySelector("#progress");t&&(t.innerHTML="")}}async function C(e){if(!P(e))return;let n=new URLSearchParams,t=c(e,"pin");if(S(n,e),t){n.set("pin",t),await k(n);return}let a=document.querySelector("#results");a&&(a.innerHTML='<section class="error" role="alert">Enter a PIN.</section>')}q();var f=document.querySelector("#case-form");f&&v(f);document.addEventListener("submit",e=>{let n=e.target;n instanceof HTMLFormElement&&n.id==="case-form"&&(e.preventDefault(),C(n))});document.addEventListener("change",e=>{let n=e.target;if(n instanceof HTMLInputElement||n instanceof HTMLSelectElement||n instanceof HTMLTextAreaElement){let t=n.form;t?.id==="case-form"&&(m(""),v(t))}});document.documentElement.dataset.enhanced="true";
