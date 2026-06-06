// shared/table.js

async function renderGenericTable(tableName, containerId, filterOptions = null) {
  // Dynamically load Simple-DataTables if not present
  if (!document.getElementById('simple-datatables-css')) {
    const link = document.createElement('link');
    link.id = 'simple-datatables-css';
    link.rel = 'stylesheet';
    link.href = 'https://cdn.jsdelivr.net/npm/simple-datatables@9.0.3/dist/style.min.css';
    document.head.appendChild(link);
  }
  if (!document.getElementById('simple-datatables-js')) {
    const script = document.createElement('script');
    script.id = 'simple-datatables-js';
    script.src = 'https://cdn.jsdelivr.net/npm/simple-datatables@9.0.3/dist/umd/simple-datatables.min.js';
    document.head.appendChild(script);
  }

  const container = document.getElementById(containerId);
  container.innerHTML = `
    <div class="d-flex justify-content-center my-5">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading ${tableName}...</span>
      </div>
    </div>
  `;
  
  try {
    let [records, apiConfig] = await Promise.all([
      API.fetchData(tableName),
      API.fetchSchema()
    ]);

    // Apply Filter if passed
    if (filterOptions && records) {
      if (filterOptions.include) {
        records = records.filter(r => r[filterOptions.key] === filterOptions.include);
      }
      if (filterOptions.exclude) {
        records = records.filter(r => r[filterOptions.key] !== filterOptions.exclude);
      }
    }

    // Use schema to define headers if possible, falling back to data keys
    let headers = [];
    if (apiConfig && apiConfig.schema && apiConfig.schema[tableName]) {
      headers = apiConfig.schema[tableName].filter(key => key !== 'id');
    } else if (records && records.length > 0) {
      headers = Object.keys(records[0]).filter(key => key !== 'id');
    } else {
      headers = ['Name', 'Date', 'Remarks']; // basic fallback
    }

    if (filterOptions && filterOptions.hideColumns) {
      headers = headers.filter(h => !filterOptions.hideColumns.includes(h));
    }

    const refreshBtnHtml = `<button onclick="API.refreshPageData()" class="btn btn-outline-secondary btn-sm me-2"><i class="bi bi-arrow-clockwise"></i> Refresh</button>`;
    const addBtnHtml = `<button onclick="window.location.hash='new'" class="btn btn-primary btn-sm"><i class="bi bi-plus"></i> Add Record</button>`;
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
        
        // INTERCEPT REPORTS CUSTOM COLUMNS
        if (tableName === 'Reports' && header === 'File' && cellValue) {
            cellValue = `<a href="${cellValue}" target="_blank" class="btn btn-outline-primary btn-sm text-nowrap"><i class="bi bi-file-earmark-text"></i> Open</a>`;
        } else if (tableName === 'Reports' && header === 'Data Points' && cellValue > 0) {
            cellValue = `<a href="../reports/lab/index.html#${row.id}" class="btn btn-primary btn-sm text-nowrap"><i class="bi bi-graph-up"></i> View Data (${cellValue})</a>`;
        }
        else {
            // Handle Object references (foreign keys)
            if (typeof cellValue === 'object' && cellValue !== null) {
              if (cellValue.referenced && Array.isArray(cellValue.referenced)) {
                const count = cellValue.referenced.length;
                if (count > 0) {
                  const names = cellValue.referenced.map(ref => ref.Name || ref.Title || ref.id).join(', ');
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

    // Initialize DataTable
    const initDataTable = () => {
      if (window.simpleDatatables) {
        const table = container.querySelector('table');
        if (table) {
          const dataTable = new window.simpleDatatables.DataTable(table, {
             searchable: true,
             fixedHeight: false,
             perPage: 10
          });
          
          dataTable.on('datatable.init', () => {
             try {
               // Only attempt to sort if there is data
               if (dataTable.data && dataTable.data.data && dataTable.data.data.length > 0) {
                 const thElements = Array.from(table.querySelectorAll('th'));
                 let dateColIndex = thElements.findIndex(th => th.textContent.trim().toLowerCase() === 'date');
                 if (dateColIndex === -1) dateColIndex = 0;
                 dataTable.columns.sort(dateColIndex, "desc");
               }
             } catch (e) {
               console.warn("Could not auto-sort empty table");
             }
          });
        }
      } else {
        setTimeout(initDataTable, 50); // Retry if library hasn't loaded yet
      }
    };
    initDataTable();

  } catch (err) {
    console.error("Error rendering table:", err);
    container.innerHTML = `<div class="alert alert-danger">Failed to load table data.</div>`;
  }
}

function refreshTableData(tableName, containerId) {
  API.clearCache(tableName);
  window.location.reload(); // Safer way to ensure any custom filterOptions passed in the specific HTML file's initialization are reapplied.
}