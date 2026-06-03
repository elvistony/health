// shared/form.js

async function generateForm(tableName, recordId, formElementId) {
  const form = document.getElementById(formElementId);
  form.innerHTML = `
    <div class="d-flex justify-content-center my-3">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading form...</span>
      </div>
    </div>
  `;

  try {
    const [records, apiConfig] = await Promise.all([
      API.fetchData(tableName),
      API.fetchSchema()
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

    let html = '';
    
    headers.forEach(header => {
      let val = '';
      if (existingRecord) {
        val = existingRecord[header] !== undefined ? existingRecord[header] : '';
        if (typeof val === 'object' && val !== null) {
          val = val.data || val.id || ''; // Extract from lookup object
        }
      }

      let inputType = 'text';
      if (header.toLowerCase().includes('date')) inputType = 'date';
      else if (header.toLowerCase().includes('time')) inputType = 'time';

      if (header === 'Remarks' || header.toLowerCase().includes('description') || header.toLowerCase().includes('notes')) {
        html += `
          <div class="mb-3">
            <label for="field-${header}" class="form-label fw-bold">${header}</label>
            <textarea class="form-control" id="field-${header}" name="${header}" rows="3">${val}</textarea>
          </div>
        `;
      } else {
        html += `
          <div class="mb-3">
            <label for="field-${header}" class="form-label fw-bold">${header}</label>
            <input type="${inputType}" class="form-control" id="field-${header}" name="${header}" value="${val}" ${header === 'id' ? 'readonly' : ''} required />
          </div>
        `;
      }
    });

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
      formData.forEach((value, key) => {
        dataObj[key] = value;
      });

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
