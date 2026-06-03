window.addEventListener('load', loadAppointment);

async function loadAppointment() {
  const visitId = window.location.hash.substring(1);
  if (!visitId) {
    document.getElementById('appointment-title').innerText = "No Visit ID provided.";
    return;
  }

  try {
    const visits = await API.fetchData('Visits');
    const visit = visits.find(v => v.id === visitId);
    
    if (!visit) {
      document.getElementById('appointment-title').innerText = "Visit not found.";
      return;
    }

    // Header & Doctor Name
    document.getElementById('appointment-title').innerText = visit.Title || visit['Visit Type'] || "Consultation";
    
    let doctorName = '';
    if (visit['Doctor ID']) {
      doctorName = ` - Doctor: ${visit['Doctor ID'].Name || visit['Doctor ID'].data || visit['Doctor ID']}`;
    }
    document.getElementById('appointment-date').innerText = new Date(visit.Date).toLocaleDateString() + doctorName;

    // General Info
    document.getElementById('general-info').style.display = 'block';
    document.getElementById('info-list').innerHTML = `
      <li class="mb-2"><strong>Type:</strong> ${visit['Visit Type']}</li>
      <li><strong>Remarks:</strong> ${visit.Remarks || 'None'}</li>
    `;

    // Extract embedded references provided by the Apps Script API
    const relatedMeds = visit['Medication IDs']?.referenced || [];
    const medsList = document.getElementById('meds-list');
    if (relatedMeds.length === 0) {
      medsList.innerHTML = "<li class='list-group-item text-muted border-0'>No medications prescribed during this visit.</li>";
    } else {
      medsList.innerHTML = relatedMeds.map(m => `<li class='list-group-item border-0 px-0 d-flex justify-content-between align-items-center'><strong>${m.Name}</strong> <span class='text-muted'>${m['Consumption Pattern'] || ''}</span></li>`).join('');
    }

    const relatedLabs = visit['Lab IDs']?.referenced || [];
    const labsList = document.getElementById('labs-list');
    if (relatedLabs.length === 0) {
      labsList.innerHTML = "<li class='list-group-item text-muted border-0'>No lab reports associated.</li>";
    } else {
      labsList.innerHTML = relatedLabs.map(l => `<li class='list-group-item border-0 px-0'><strong>${l.Name || l.Title || 'Report'}</strong> ${l.URL ? `<a href="${l.URL}" target="_blank" class='ms-2 btn btn-sm btn-outline-primary'>View Document</a>` : ''}</li>`).join('');
    }

    const relatedAilments = visit['Ailment IDs']?.referenced || [];
    const ailmentsList = document.getElementById('ailments-list');
    if (relatedAilments.length === 0) {
      ailmentsList.innerHTML = "<li class='list-group-item text-muted border-0'>No ailments diagnosed.</li>";
    } else {
      ailmentsList.innerHTML = relatedAilments.map(a => `<li class='list-group-item border-0 px-0'><strong>${a.Name || a.Title || 'Ailment'}</strong> - <span class='text-muted'>${a.Status || 'Active'}</span></li>`).join('');
    }

  } catch (err) {
    console.error("Error loading appointment details:", err);
    document.getElementById('appointment-title').innerText = "Error loading appointment.";
  }
}
