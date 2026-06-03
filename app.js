// root app.js - Dashboard logic

window.addEventListener('load', renderDashboard);

async function renderDashboard() {
  const root = document.getElementById('app-root');
  
  root.innerHTML = `
    <div class="mb-4 d-flex justify-content-between align-items-center">
      <div>
        <h2 class="mb-0">Patient Dashboard</h2>
        <p class="text-muted">Overview for ${CURRENT_PATIENT}</p>
      </div>
      <button onclick="refreshDashboard()" class="btn btn-outline-primary btn-sm">Refresh All Data</button>
    </div>
    
    <div class="row g-4 mb-4">
      <div class="col-md-4">
        <div class="premium-card text-center h-100" id="dash-visits">
          <div class="spinner-border text-primary spinner-border-sm" role="status"></div>
        </div>
      </div>
      <div class="col-md-4">
        <div class="premium-card text-center h-100" id="dash-meds">
          <div class="spinner-border text-primary spinner-border-sm" role="status"></div>
        </div>
      </div>
      <div class="col-md-4">
        <div class="premium-card text-center h-100" id="dash-labs">
          <div class="spinner-border text-primary spinner-border-sm" role="status"></div>
        </div>
      </div>
    </div>

    <div class="premium-card p-4">
      <h5 class="fw-bold mb-4">Appointments Calendar</h5>
      <div id="calendar-view"></div>
    </div>
  `;

  try {
    const [visits, meds, labs] = await Promise.all([
      API.fetchData('Visits'),
      API.fetchData('Medications'),
      API.fetchData('Labs')
    ]);

    // Render Aggregates
    document.getElementById('dash-visits').innerHTML = `
      <h6 class="text-muted text-uppercase fw-bold mb-2">Total Visits</h6>
      <h2 class="display-5 fw-bold text-primary mb-0">${visits.length}</h2>
    `;
    
    const activeMeds = meds.filter(m => !m['Date End'] || m['Date End'].trim() === "");
    document.getElementById('dash-meds').innerHTML = `
      <h6 class="text-muted text-uppercase fw-bold mb-2">Active Medications</h6>
      <h2 class="display-5 fw-bold text-primary mb-0">${activeMeds.length}</h2>
    `;

    document.getElementById('dash-labs').innerHTML = `
      <h6 class="text-muted text-uppercase fw-bold mb-2">Lab Reports</h6>
      <h2 class="display-5 fw-bold text-primary mb-0">${labs.length}</h2>
    `;

    // Render FullCalendar
    const calEl = document.getElementById('calendar-view');
    const events = visits.map(v => ({
      id: v.id,
      title: v.Title || v['Visit Type'],
      start: v.Date,
      url: `appointment/index.html#${v.id}`
    }));

    const calendar = new FullCalendar.Calendar(calEl, {
      initialView: 'dayGridMonth',
      height: 'auto',
      events: events,
      eventClick: function(info) {
        // Automatically navigates to the url specified in the event
      }
    });
    
    calendar.render();

  } catch (err) {
    console.error("Error loading dashboard", err);
    root.innerHTML += `<div class="alert alert-danger mt-3">Failed to load dashboard data.</div>`;
  }
}

function refreshDashboard() {
  API.clearCache('Visits');
  API.clearCache('Medications');
  API.clearCache('Labs');
  API.clearCache('Ailments');
  API.clearCache('Doctors');
  renderDashboard();
}