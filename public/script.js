// Minimal view router and demo logic (no external dependencies)
// Note: This frontend calls the minimal in-memory API in server.js. Replace with real API calls for production.
(function () {
  const show = (id) => {
    document.querySelectorAll('[data-view]').forEach(s => s.classList.add('hidden'));
    const el = document.querySelector(`[data-view="${id}"]`);
    if (el) el.classList.remove('hidden');
    window.scrollTo(0,0);
  };

  // Simple client-side application state
  let currentApplication = null;

  // Landing calculators
  document.getElementById('calc-btn').addEventListener('click', () => {
    const amount = Number(document.getElementById('calc-amount').value) || 0;
    const term = Number(document.getElementById('calc-term').value) || 1;
    const rate = 0.02; // demo monthly rate
    const repayment = ((amount * rate) / (1 - Math.pow(1 + rate, -term))).toFixed(2);
    document.getElementById('calc-result').textContent = `Approx monthly repayment: GHS ${repayment}`;
  });

  document.getElementById('start-application').addEventListener('click', async () => {
    // create a draft application on server
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

  // Steps navigation
  document.getElementById('to-step2').addEventListener('click', async () => {
    // save step1 to server
    const body = {
      name: document.getElementById('name').value,
      phone: document.getElementById('phone').value,
      email: document.getElementById('email').value
    };
    if (currentApplication && currentApplication.id) {
      await fetch('/applications/' + currentApplication.id, {
        method: 'PATCH',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify(body)
      });
    }
    show('step2');
  });

  document.getElementById('to-step3').addEventListener('click', async () => {
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
      // refresh local copy
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

  // Submit application -> processing -> waiting for admin -> success (simulated)
  document.getElementById('submit-app').addEventListener('click', async () => {
    const consent = document.getElementById('consent').checked;
    if (!consent) return alert('Please consent to terms before submitting.');
    if (!currentApplication || !currentApplication.id) return alert('No application found.');

    show('processing');
    await fetch('/applications/' + currentApplication.id + '/submit', { method: 'POST' });
    // Polling demo: check status and simulate admin action after delay
    setTimeout(async () => {
      show('waiting-admin');
      // simulate admin approval after delay
      setTimeout(() => {
        show('success');
        document.getElementById('approval-details').textContent = 'Approved: Disbursed GHS 5,000.00. Repayment: 6 months.';
      }, 3500);
    }, 1200);
  });

  // MTN MoMo flow (simulated)
  let smsTimerId = null;
  document.getElementById('momo-send-sms').addEventListener('click', () => {
    show('sms-verify');
    startSmsTimer(60);
    document.getElementById('sms-text').value = 'MTN MoMo code: 1234. Use to verify your login.';
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
        document.getElementById('approval-details').textContent = 'Logged in via MoMo and loan pre-check passed.';
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
