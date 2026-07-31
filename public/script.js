// Minimal view router and demo logic (no external dependencies)
// Updated for Zambia MoMo: currency K, phone validation for +260 (Zambia) only
// Added calculator slider syncing and live calculation when sliders change
// Enforced step validation: users cannot proceed until current step is valid
// Added horizontal clickable stepper with independent step navigation and auto-save
(function () {
  const show = (id) => {
    document.querySelectorAll('[data-view]').forEach(s => s.classList.add('hidden'));
    const el = document.querySelector(`[data-view="${id}"]`);
    if (el) el.classList.remove('hidden');
    currentStep = id;
    setActiveStep(id);
    window.scrollTo(0,0);
  };

  let currentStep = 'landing';

  // Simple client-side application state
  let currentApplication = null;

  // Zambia phone regex: E.164 starting with +260 and 9 digits after (e.g. +260971234567)
  const zambiaPhoneRegex = /^\+260\d{9}$/;

  // Elements
  const calcAmountInput = document.getElementById('calc-amount');
  const calcAmountSlider = document.getElementById('calc-amount-slider');
  const calcTermInput = document.getElementById('calc-term');
  const calcTermSlider = document.getElementById('calc-term-slider');
  const calcBtn = document.getElementById('calc-btn');
  const calcResult = document.getElementById('calc-result');

  // Step UI
  const stepElements = Array.from(document.querySelectorAll('.step'));
  function setActiveStep(stepId) {
    stepElements.forEach(el => {
      const id = el.dataset.step;
      el.classList.toggle('active', id === stepId);
    });
  }
  function markStepComplete(stepId, complete = true) {
    const el = document.querySelector(`.step[data-step="${stepId}"]`);
    if (!el) return;
    if (complete) el.classList.add('complete'); else el.classList.remove('complete');
  }

  // Validate Step 1 fields
  function validateStep1() {
    const name = document.getElementById('name').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const ok = name.length >= 2 && zambiaPhoneRegex.test(phone);
    document.querySelector('#to-step2').disabled = !ok;
    markStepComplete('step1', ok);
    updateSubmitEnabled();
    return ok;
  }

  // Validate Step 2 fields
  function validateStep2() {
    const employer = document.getElementById('employer').value.trim();
    const income = Number(document.getElementById('income').value || 0);
    const ok = employer.length >= 2 && income > 0;
    document.querySelector('#to-step3').disabled = !ok;
    markStepComplete('step2', ok);
    updateSubmitEnabled();
    return ok;
  }

  // Validate Step 3 (consent)
  function validateStep3() {
    const consent = document.getElementById('consent').checked;
    document.querySelector('#submit-app').disabled = !consent;
    markStepComplete('step3', consent);
    updateSubmitEnabled();
    return consent;
  }

  function allStepsValid() {
    return validateStep1() && validateStep2() && validateStep3();
  }

  function updateSubmitEnabled() {
    const submit = document.querySelector('#submit-app');
    if (!submit) return;
    submit.disabled = !(validateStep1() && validateStep2() && validateStep3());
  }

  // Calculate repayment (simple amortizing loan formula)
  function calculateRepayment(amount, term, monthlyRate = 0.02) {
    if (!amount || !term) return 0;
    const r = monthlyRate;
    const n = term;
    const payment = (amount * r) / (1 - Math.pow(1 + r, -n));
    return Number(payment.toFixed(2));
  }

  function updateCalcResult() {
    const amount = Number(calcAmountInput.value) || 0;
    const term = Number(calcTermInput.value) || 1;
    const repayment = calculateRepayment(amount, term);
    calcResult.textContent = `Approx monthly repayment: K ${repayment.toLocaleString()}`;
  }

  // Sync sliders and inputs
  function syncAmountFromSlider() {
    calcAmountInput.value = calcAmountSlider.value;
    updateCalcResult();
  }
  function syncAmountFromInput() {
    let v = Number(calcAmountInput.value) || 0;
    if (v < Number(calcAmountSlider.min)) v = Number(calcAmountSlider.min);
    if (v > Number(calcAmountSlider.max)) v = Number(calcAmountSlider.max);
    // round to step
    const step = Number(calcAmountSlider.step) || 100;
    v = Math.round(v / step) * step;
    calcAmountInput.value = v;
    calcAmountSlider.value = v;
    updateCalcResult();
  }
  function syncTermFromSlider() {
    calcTermInput.value = calcTermSlider.value;
    updateCalcResult();
  }
  function syncTermFromInput() {
    let v = Number(calcTermInput.value) || 1;
    const min = Number(calcTermSlider.min) || 1;
    const max = Number(calcTermSlider.max) || 24;
    if (v < min) v = min;
    if (v > max) v = max;
    calcTermInput.value = v;
    calcTermSlider.value = v;
    updateCalcResult();
  }

  // Auto-save current visible step to server
  async function saveCurrentStep() {
    if (!currentApplication || !currentApplication.id) return;
    const id = currentApplication.id;
    try {
      if (currentStep === 'step1') {
        const body = {
          name: document.getElementById('name').value,
          phone: document.getElementById('phone').value,
          email: document.getElementById('email').value,
          desired_amount: Number(document.getElementById('calc-amount').value) || 0,
          desired_term: Number(document.getElementById('calc-term').value) || 1
        };
        await fetch('/applications/' + id, { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
      } else if (currentStep === 'step2') {
        const body = {
          employer: document.getElementById('employer').value,
          jobTitle: document.getElementById('jobTitle').value,
          income: document.getElementById('income').value
        };
        await fetch('/applications/' + id, { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
      } else if (currentStep === 'step3') {
        const body = { consent: document.getElementById('consent').checked };
        await fetch('/applications/' + id, { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
      }
      // refresh local copy
      const res = await fetch('/applications/' + id);
      currentApplication = await res.json();
    } catch (err) {
      console.warn('Auto-save failed', err);
    }
  }

  // Click handlers for horizontal steps (allow navigation; save current step before switching)
  stepElements.forEach((el) => {
    el.addEventListener('click', async (e) => {
      const target = el.dataset.step;
      // save current step to server before switching
      await saveCurrentStep();
      show(target);
      // run validations for the target step and update buttons
      validateStep1(); validateStep2(); validateStep3();
    });
  });

  // Initial wiring
  if (calcAmountSlider) calcAmountSlider.addEventListener('input', syncAmountFromSlider);
  if (calcAmountInput) calcAmountInput.addEventListener('change', syncAmountFromInput);
  if (calcTermSlider) calcTermSlider.addEventListener('input', syncTermFromSlider);
  if (calcTermInput) calcTermInput.addEventListener('change', syncTermFromInput);

  if (calcBtn) calcBtn.addEventListener('click', updateCalcResult);

  // Initialize display
  updateCalcResult();

  // Real-time validation for step inputs
  document.getElementById('name').addEventListener('input', validateStep1);
  document.getElementById('phone').addEventListener('input', validateStep1);
  document.getElementById('employer').addEventListener('input', validateStep2);
  document.getElementById('income').addEventListener('input', validateStep2);
  document.getElementById('consent').addEventListener('change', validateStep3);

  // Start application: create draft and go to Step 1
  document.getElementById('start-application').addEventListener('click', async () => {
    const payload = { status: 'draft', created_at: new Date().toISOString() };
    const res = await fetch('/applications', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify(payload)
    });
    currentApplication = await res.json();
    show('step1');
  });

  document.getElementById('momo-login-btn').addEventListener('click', () => show('momo'));

  // to-step2: validate and save step1
  document.getElementById('to-step2').addEventListener('click', async () => {
    if (!validateStep1()) return alert('Please complete your personal details with a valid Zambian MoMo number.');
    // save step1 to server
    const body = {
      name: document.getElementById('name').value,
      phone: document.getElementById('phone').value,
      email: document.getElementById('email').value,
      desired_amount: Number(document.getElementById('calc-amount').value) || 0,
      desired_term: Number(document.getElementById('calc-term').value) || 1
    };
    if (currentApplication && currentApplication.id) {
      await fetch('/applications/' + currentApplication.id, {
        method: 'PATCH',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify(body)
      });
      const res = await fetch('/applications/' + currentApplication.id);
      currentApplication = await res.json();
    }
    show('step2');
  });

  // to-step3: validate and save step2
  document.getElementById('to-step3').addEventListener('click', async () => {
    if (!validateStep2()) return alert('Please provide your employer and monthly income.');
    const body = {
      employer: document.getElementById('employer').value,
      jobTitle: document.getElementById('jobTitle').value,
      income: document.getElementById('income').value
    };
    if (currentApplication && currentApplication.id) {
      await fetch('/applications/' + currentApplication.id, {
        method: 'PATCH',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify(body)
      });
      const res = await fetch('/applications/' + currentApplication.id);
      currentApplication = await res.json();
    }
    document.getElementById('summary').textContent = JSON.stringify(currentApplication, null, 2);
    show('step3');
  });

  document.querySelectorAll('button.back').forEach(b => {
    b.addEventListener('click', (e) => {
      const back = e.currentTarget.dataset.back;
      if (back) show(back);
    });
  });

  // Submit application -> server validation -> processing -> waiting for admin -> success (simulated)
  document.getElementById('submit-app').addEventListener('click', async () => {
    if (!validateStep3()) return alert('You must consent to terms before submitting.');
    if (!currentApplication || !currentApplication.id) return alert('No application found.');

    show('processing');
    const resp = await fetch('/applications/' + currentApplication.id + '/submit', { method: 'POST' });
    if (resp.status === 400) {
      const body = await resp.json();
      alert('Server validation failed: ' + (body.message || JSON.stringify(body)));
      // Back to first incomplete step
      if (body.missing && body.missing.includes('name')) show('step1');
      else if (body.missing && body.missing.includes('employer')) show('step2');
      else show('step1');
      return;
    }

    // Polling demo: check status and simulate admin action after delay
    setTimeout(async () => {
      show('waiting-admin');
      // simulate admin approval after delay
      setTimeout(async () => {
        // If using Telegram webhook, real approval will update server state. For demo, mark approved
        const resCheck = await fetch('/applications/' + currentApplication.id);
        const appData = await resCheck.json();
        if (appData.status === 'approved') {
          show('success');
          document.getElementById('approval-details').textContent = `Approved: Disbursed K ${appData.desired_amount || '5,000'}. Repayment: ${appData.desired_term || 6} months.`;
        } else if (appData.status === 'rejected') {
          show('processing');
          setTimeout(() => { alert('Your application was rejected by admin.'); show('landing'); }, 800);
        } else {
          // fallback demo approve
          show('success');
          document.getElementById('approval-details').textContent = 'Approved: Disbursed K 5,000.00. Repayment: 6 months.';
        }
      }, 3500);
    }, 1200);
  });

  // MoMo flow (simulated)
  let smsTimerId = null;
  document.getElementById('momo-send-sms').addEventListener('click', () => {
    const phone = document.getElementById('momo-phone').value.trim();
    if (!zambiaPhoneRegex.test(phone)) {
      return alert('Please enter a valid Zambian MoMo phone number in E.164 format (example: +260971234567).');
    }
    show('sms-verify');
    startSmsTimer(60);
    document.getElementById('sms-text').value = 'MoMo Zambia code: 1234. Use to verify your login.';
  });

  function startSmsTimer(seconds) {
    const el = document.getElementById('sms-timer');
    clearInterval(smsTimerId);
    let t = seconds;
    el.textContent = t;
    smsTimerId = setInterval(() => {
      t -= 1;
      el.textContent = Math.max(0,t);
      if (t <= 0) clearInterval(smsTimerId);
    }, 1000);
  }

  document.getElementById('sms-accept').addEventListener('click', () => {
    // Could parse SMS for OTP; here we go to OTP entry
    show('otp');
    focusOtp(0);
  });

  // OTP inputs behavior
  const otpInputs = Array.from(document.querySelectorAll('.otp-digit'));
  otpInputs.forEach((inp, idx) => {
    inp.addEventListener('input', (e) => {
      const v = e.target.value.replace(/[^0-9]/g, '').slice(0,1);
      e.target.value = v;
      if (v && idx < otpInputs.length - 1) otpInputs[idx + 1].focus();
    });
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !e.target.value && idx > 0) {
        otpInputs[idx - 1].focus();
      }
    });
  });

  function focusOtp(i) {
    otpInputs[i].focus();
    otpInputs[i].select();
  }

  document.getElementById('verify-otp').addEventListener('click', () => {
    const code = otpInputs.map(i => i.value || '_').join('');
    if (/^\d{4}$/.test(code)) {
      show('processing');
      setTimeout(() => {
        show('success');
        document.getElementById('approval-details').textContent = 'Logged in via MoMo Zambia and loan pre-check passed.';
      }, 1200);
    } else {
      alert('Please enter all 4 digits of the OTP.');
    }
  });

  // Done button goes home
  document.getElementById('done').addEventListener('click', () => show('landing'));

  // Start on landing
  show('landing');
})();
