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
      <div>
        <a href="visits/index.html#new" class="btn btn-primary btn-sm me-1"><i class="bi bi-plus"></i> Visit</a>
        <a href="incident/index.html#new" class="btn btn-danger btn-sm me-1"><i class="bi bi-plus"></i> Incident</a>
        <a href="medications/index.html#new" class="btn btn-success btn-sm me-1"><i class="bi bi-plus"></i> Meds</a>
        <button onclick="API.refreshPageData()" class="btn btn-outline-secondary btn-sm"><i class="bi bi-arrow-clockwise"></i> Refresh</button>
      </div>
    </div>
    
    <div class="row g-4 mb-4">
      <div class="col-md-4">
        <div class="premium-card text-center h-100 p-4" id="dash-visits">
          <div class="spinner-border text-primary spinner-border-sm" role="status"></div>
        </div>
      </div>
      <div class="col-md-4">
        <div class="premium-card text-center h-100 p-4" id="dash-meds">
          <div class="spinner-border text-primary spinner-border-sm" role="status"></div>
        </div>
      </div>
      <div class="col-md-4">
        <div class="premium-card text-center h-100 p-4" id="dash-reports">
          <div class="spinner-border text-primary spinner-border-sm" role="status"></div>
        </div>
      </div>
    </div>
    
    <div class="row mb-4">
      <div class="col-12">
        <div class="premium-card p-4" id="dash-latest-visit">
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
    const [visits, meds, reports] = await Promise.all([
      API.fetchData('Visits'),
      API.fetchData('Medications'),
      API.fetchData('Reports')
    ]);

    // Render Aggregates
    document.getElementById('dash-visits').innerHTML = `
      <h6 class="text-muted text-uppercase fw-bold mb-2">Total Visits</h6>
      <h2 class="display-5 fw-bold text-primary mb-3">${visits.length}</h2>
      <a href="visits/index.html" class="btn btn-sm btn-outline-primary w-100">View Visits</a>
    `;
    
    const activeMeds = meds.filter(m => !m['Date End'] || m['Date End'].trim() === "");
    document.getElementById('dash-meds').innerHTML = `
      <h6 class="text-muted text-uppercase fw-bold mb-2">Active Medications</h6>
      <h2 class="display-5 fw-bold text-success mb-3">${activeMeds.length}</h2>
      <a href="medications/index.html" class="btn btn-sm btn-outline-success w-100">View Medications</a>
    `;

    document.getElementById('dash-reports').innerHTML = `
      <h6 class="text-muted text-uppercase fw-bold mb-2">Reports</h6>
      <h2 class="display-5 fw-bold text-info mb-3">${reports.length}</h2>
      <a href="reports/index.html" class="btn btn-sm btn-outline-info w-100">View Reports</a>
    `;

    // Render Latest Visit
    visits.sort((a, b) => new Date(b.Date) - new Date(a.Date));
    const latestVisit = visits[0];
    if (latestVisit) {
      document.getElementById('dash-latest-visit').innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-3">
          <h5 class="fw-bold mb-0">Latest Visit</h5>
          <span class="badge text-bg-primary">${latestVisit['Visit Type'] || 'Consultation'}</span>
        </div>
        <p class="mb-1 text-muted"><i class="bi bi-calendar3"></i> ${new Date(latestVisit.Date).toLocaleDateString()}</p>
        <p class="mb-3"><strong>Remarks:</strong> ${latestVisit.Remarks || 'No remarks provided.'}</p>
        <a href="appointment/index.html#${latestVisit.id}" class="btn btn-sm btn-primary">Open Full Details</a>
      `;
    } else {
      document.getElementById('dash-latest-visit').innerHTML = `<p class="text-muted mb-0">No recent visits logged.</p>`;
    }

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
  API.clearCache('Reports');
  API.clearCache('Ailments');
  API.clearCache('Doctors');
  renderDashboard();
}