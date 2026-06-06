// shared/form.js

async function generateForm(tableName, recordId, formElementId, options = {}) {
  const defaultValues = options.defaultValues || {};
  const hiddenFields = options.hiddenFields || [];
  const collapsibleFields = options.collapsibleFields || [];
  const enumDropdowns = options.enumDropdowns || {};
  
  const form = document.getElementById(formElementId);
  form.innerHTML = `
    <div class="d-flex justify-content-center my-3">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading form...</span>
      </div>
    </div>
  `;

  try {
    const [records, apiConfig, metaData] = await Promise.all([
      API.fetchData(tableName),
      API.fetchSchema(),
      API.fetchMetaData()
    ]);
    
    let headers = [];
    let existingRecord = null;

    if (apiConfig && apiConfig.schema && apiConfig.schema[tableName]) {
      headers = apiConfig.schema[tableName].filter(key => key !== 'id');
    } else if (records && records.length > 0) {
      headers = Object.keys(records[0]).filter(k => k !== 'id');
    } else {
      form.innerHTML = '<div class="alert alert-danger">Unable to load table schema.</div>';
      return;
    }

    if (recordId && recordId !== 'new' && records) {
      existingRecord = records.find(r => r.id === recordId);
    }

    let mainHtml = '';
    let collapseHtml = '';
    
    headers.forEach(header => {
      let val = '';
      if (existingRecord) {
        val = existingRecord[header] !== undefined ? existingRecord[header] : '';
        if (typeof val === 'object' && val !== null) {
          val = val.data || val.id || ''; // Extract from lookup object
        }
      } else if (defaultValues[header] !== undefined) {
        val = defaultValues[header]; // prefill on new
      }

      if (hiddenFields.includes(header)) {
        mainHtml += `<input type="hidden" id="field-${header}" name="${header}" value="${val}" />`;
        return;
      }

      let inputType = 'text';
      if (header.toLowerCase().includes('date')) inputType = 'date';
      else if (header.toLowerCase().includes('time')) inputType = 'time';

      let fieldHtml = '';

      if (enumDropdowns[header]) {
        fieldHtml += `
          <div class="mb-3">
            <label for="field-${header}" class="form-label fw-bold">${header}</label>
            <select class="form-select" id="field-${header}" name="${header}" required>
              <option value="">-- Select --</option>
              ${enumDropdowns[header].map(opt => `<option value="${opt}" ${val === opt ? 'selected' : ''}>${opt}</option>`).join('')}
            </select>
          </div>
        `;
      }
      // Check if it's a foreign key relation
      else if (apiConfig.lookups && apiConfig.lookups[tableName] && apiConfig.lookups[tableName][header] && metaData) {
        const targetTable = apiConfig.lookups[tableName][header];
        const isMultiple = header.endsWith('s'); // e.g., 'Ailment IDs' vs 'Doctor ID'
        const options = metaData[targetTable] || [];

        let selectedVals = [];
        if (val) {
          selectedVals = val.toString().split(',').map(s => s.trim());
        }

        fieldHtml += `
          <div class="mb-3">
            <label for="field-${header}" class="form-label fw-bold">${header}</label>
            <select class="form-select" id="field-${header}" name="${header}" ${isMultiple ? 'multiple size="4"' : ''}>
              ${!isMultiple ? '<option value="">-- Select --</option>' : ''}
              ${options.map(opt => `<option value="${opt.id}" ${selectedVals.includes(opt.id) ? 'selected' : ''}>${opt.label || opt.id}</option>`).join('')}
            </select>
            ${isMultiple ? '<small class="text-muted">Hold Ctrl (Windows) or Cmd (Mac) to select multiple.</small>' : ''}
          </div>
        `;
      } 
      else if (header === 'Remarks' || header.toLowerCase().includes('description') || header.toLowerCase().includes('notes')) {
        fieldHtml += `
          <div class="mb-3">
            <label for="field-${header}" class="form-label fw-bold">${header}</label>
            <textarea class="form-control" id="field-${header}" name="${header}" rows="3">${val}</textarea>
          </div>
        `;
      } else {
        fieldHtml += `
          <div class="mb-3">
            <label for="field-${header}" class="form-label fw-bold">${header}</label>
            <input type="${inputType}" class="form-control" id="field-${header}" name="${header}" value="${val}" ${header === 'id' ? 'readonly' : ''} required />
          </div>
        `;
      }

      if (collapsibleFields.includes(header)) {
        collapseHtml += fieldHtml;
      } else {
        mainHtml += fieldHtml;
      }
    });

    let html = mainHtml;
    
    if (collapseHtml) {
      html += `
        <div class="accordion mb-3" id="accordionAdvanced">
          <div class="accordion-item border-0 shadow-sm rounded">
            <h2 class="accordion-header" id="headingAdvanced">
              <button class="accordion-button collapsed fw-bold text-muted bg-body-tertiary" type="button" data-bs-toggle="collapse" data-bs-target="#collapseAdvanced" aria-expanded="false" aria-controls="collapseAdvanced">
                <i class="bi bi-gear me-2"></i> Additional Settings (Optional)
              </button>
            </h2>
            <div id="collapseAdvanced" class="accordion-collapse collapse" aria-labelledby="headingAdvanced" data-bs-parent="#accordionAdvanced">
              <div class="accordion-body bg-body-tertiary border-top">
                ${collapseHtml}
              </div>
            </div>
          </div>
        </div>
      `;
    }

    html += `
      <div class="d-flex justify-content-end mt-4 gap-2">
        <button type="button" class="btn btn-outline-secondary" onclick="window.location.hash=''">Cancel</button>
        <button type="submit" id="save-btn" class="btn btn-primary">Save Changes</button>
      </div>
    `;

    form.innerHTML = html;

    form.onsubmit = async (e) => {
      e.preventDefault();
      const saveBtn = document.getElementById('save-btn');
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving...';

      const formData = new FormData(form);
      const dataObj = {};
      
      // Iterate through unique keys to correctly handle multiple selections
      const keys = Array.from(new Set(formData.keys()));
      for (const key of keys) {
        const values = formData.getAll(key);
        if (values.length > 1) {
          dataObj[key] = values.join(','); // Apps script expects comma separated string
        } else {
          dataObj[key] = values[0];
        }
      }

      console.log(`Submitting form for ${tableName}... Payload:`, dataObj);

      const success = await saveRecord(tableName, recordId, dataObj);
      
      saveBtn.disabled = false;
      saveBtn.innerText = 'Save Changes';
      
      if (success) {
        window.location.hash = '';
        API.clearCache(tableName);
        
        if (typeof renderGenericTable === 'function') {
           document.getElementById('table-view').style.display = 'block';
           document.getElementById('modal-view').style.display = 'none';
           renderGenericTable(tableName, 'table-view');
        } else {
           window.location.reload();
        }
      }
    };

  } catch (err) {
    console.error(err);
    form.innerHTML = `<div class="alert alert-danger">Failed to load form for ${tableName}.</div>`;
  }
}

async function saveRecord(tableName, recordId, dataObj) {
  const isUpdate = (recordId && recordId !== 'new');
  
  const payload = {
    key: sessionStorage.getItem('vt_key') || "",
    patient: CURRENT_PATIENT,
    action: isUpdate ? 'update' : 'create',
    category: tableName,
    id: isUpdate ? recordId : undefined,
    data: dataObj
  };

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "text/plain"
      },
      body: JSON.stringify(payload)
    });

    console.log(`Successfully dispatched ${payload.action} command to Apps Script for ${tableName}.`);
    return true;

  } catch (error) {
    console.error("Failed to save:", error);
    alert("Failed to save record. Check the console for details.");
    return false;
  }
}
