// shared/table.js

async function renderGenericTable(tableName, containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = `
    <div class="d-flex justify-content-center my-5">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading ${tableName}...</span>
      </div>
    </div>
  `;
  
  try {
    const [records, apiConfig] = await Promise.all([
      API.fetchData(tableName),
      API.fetchSchema()
    ]);

    // Use schema to define headers if possible, falling back to data keys
    let headers = [];
    if (apiConfig && apiConfig.schema && apiConfig.schema[tableName]) {
      headers = apiConfig.schema[tableName].filter(key => key !== 'id');
    } else if (records && records.length > 0) {
      headers = Object.keys(records[0]).filter(key => key !== 'id');
    } else {
      headers = ['Name', 'Date', 'Remarks']; // basic fallback
    }

    const refreshBtnHtml = `<button onclick="refreshTableData('${tableName}', '${containerId}')" class="btn btn-outline-secondary btn-sm me-2">Refresh Data</button>`;
    const addBtnHtml = `<button onclick="window.location.hash='new'" class="btn btn-primary btn-sm">+ Add Record</button>`;
    const headerHtml = `
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h2 class="mb-0">${tableName}</h2>
        <div>
          ${refreshBtnHtml}
          ${addBtnHtml}
        </div>
      </div>
    `;

    if (!records || records.length === 0) {
      container.innerHTML = `
        ${headerHtml}
        <div class="premium-card p-0">
          <div class="table-responsive">
            <table class="table table-striped table-hover mb-0">
              <thead>
                <tr>
                  ${headers.map(h => `<th>${h}</th>`).join('')}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr><td colspan="${headers.length + 1}" class="text-center py-4">No records found in this database.</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      `;
      return;
    }

    let html = `
      ${headerHtml}
      <div class="premium-card p-0">
        <div class="table-responsive">
          <table class="table table-striped table-hover mb-0">
            <thead>
              <tr>
                ${headers.map(h => `<th>${h}</th>`).join('')}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
    `;

    records.forEach(row => {
      html += `<tr>`;
      headers.forEach(header => {
        let cellValue = row[header];
        
        // Handle Object references (foreign keys)
        if (typeof cellValue === 'object' && cellValue !== null) {
          if (cellValue.referenced && Array.isArray(cellValue.referenced)) {
            const count = cellValue.referenced.length;
            if (count > 0) {
              const names = cellValue.referenced.map(ref => ref.Name || ref.Title || ref.id).join(', ');
              // Determine label (e.g. "Ailment IDs" -> "Ailments", "Medication IDs" -> "Medications")
              let typeName = header.replace(' IDs', 's').replace(' ID', '');
              cellValue = `<button type="button" class="btn btn-sm btn-outline-primary text-nowrap" data-bs-toggle="popover" data-bs-trigger="focus hover" title="${typeName}" data-bs-content="${names}">[${count} ${typeName}]</button>`;
            } else {
              cellValue = '-';
            }
          } else {
            cellValue = cellValue.Name || cellValue.data || cellValue.Title || "Link";
          }
        }

        // Handle Timestamps (shrink to DD-MM-YYYY)
        if (typeof cellValue === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(cellValue)) {
          const d = new Date(cellValue);
          if (!isNaN(d)) {
            cellValue = ('0' + d.getDate()).slice(-2) + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + d.getFullYear();
          }
        }

        html += `<td class="align-middle">${cellValue || '-'}</td>`;
      });
      
      html += `
        <td class="align-middle text-nowrap">
          ${tableName === 'Visits' ? `<a href="../appointment/index.html#${row.id}" class="btn btn-outline-primary btn-sm me-1">Details</a>` : ''}
          <a href="#${row.id}" class="btn btn-outline-secondary btn-sm">Edit</a>
        </td>
      </tr>`;
    });

    html += `</tbody></table></div></div>`;
    container.innerHTML = html;

    // Initialize Bootstrap Popovers
    const popoverTriggerList = container.querySelectorAll('[data-bs-toggle="popover"]');
    [...popoverTriggerList].forEach(popoverTriggerEl => {
      new bootstrap.Popover(popoverTriggerEl);
    });

  } catch (err) {
    console.error("Error rendering table:", err);
    container.innerHTML = `<div class="alert alert-danger">Failed to load table data.</div>`;
  }
}

function refreshTableData(tableName, containerId) {
  API.clearCache(tableName);
  renderGenericTable(tableName, containerId);
}