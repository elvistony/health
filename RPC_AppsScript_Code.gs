/**
 * VITAL TRACK API 
 * Handles CRUD operations, File Uploads, and Auth for the Health Tracker App
 */

// ==========================================
// 1. CONFIGURATION 
// ==========================================
const SYSTEM_CONFIG = {
  // Create a spreadsheet with a sheet called "Auth".
  // Columns should be: Key | Patient | Role 
  // Example Row:     X7b9 | Mom     | consultant
  master_auth_sheet_id: "1MxwKwygdiTrmqHJVZJfZqLspPdmvQ-NqrxL0Rxswa9U" 
};

const Patient = {
  "Tony": {
    sheet_id: "1j9auks9IOyjKNHBWvRMSERXd9c21G7TCzembbZ9bQPc",
    folder_id: "YOUR_FOLDER_ID_HERE"
  },
  "Rency": {
    sheet_id: "1j9auks9IOyjKNHBWvRMSERXd9c21G7TCzembbZ9bQPc",
    folder_id: "YOUR_FOLDER_ID_HERE"
  },
  "Mom": {
    sheet_id: "1j9auks9IOyjKNHBWvRMSERXd9c21G7TCzembbZ9bQPc",  
    folder_id: "YOUR_FOLDER_ID_HERE" 
  }
};

// ==========================================
// 2. DATABASE SCHEMA & LOOKUPS
// ==========================================
// Note: Index 2 (the 3rd column) is universally standardized as the Label/Name for UI Dropdowns.
const DB_SCHEMA = {
  "Visits": ["id", "Date", "Title", "Visit Type", "Doctor ID", "Ailment IDs", "Lab IDs", "Medication IDs", "Remarks"],
  "Doctors": ["id", "Date", "Name", "Hospital", "Specialization", "Type", "Contact", "Remarks"],
  "Medications": ["id", "Date", "Name", "Brand Product", "Remarks", "Consumption Pattern", "Date Start", "Date End"],
  "Ailments": ["id", "Date", "Name", "Description", "is Chronic", "Remarks"],
  "Labs": ["id", "Date", "Name", "File", "Data Points", "Tags", "Remarks"],
  "LabsData": ["id", "Date", "Parameter", "Lab ID", "Category", "Sub Category", "Observed Value", "Unit", "Min", "Max"]
};

const LOOKUPS = {
  "Visits": {
    "Doctor ID": "Doctors",
    "Ailment IDs": "Ailments",
    "Medication IDs": "Medications",
    "Lab IDs": "Labs"
  }
};

// Cache for nested lookups
let CACHE = {};
let CACHE_Valid = false;

// ==========================================
// 3. POST REQUEST (LOGIN, CREATE, UPDATE, UPLOAD, DELETE, PUSH)
// ==========================================
function doPost(e) {
  try {
    const requestData = JSON.parse(e.postData.contents);
    const action = requestData.action;

    // --- AUTHENTICATION BYPASS ---
    // The UI sends { "action": "login", "key": "USER_INPUT_KEY" }
    if (action === "login") {
      const authResult = authenticateKey(requestData.key);
      return ContentService.createTextOutput(JSON.stringify({ status: "success", data: authResult }))
                           .setMimeType(ContentService.MimeType.JSON);
    }

    // --- AUTHORIZATION FOR ALL OTHER ENDPOINTS ---
    authenticateKey(requestData.key);

    // --- STANDARD CRUD OPERATIONS ---
    const patient = requestData.patient;
    if (!Patient[patient]) throw new Error(`Patient '${patient}' not found in configuration.`);
    const ssheet = SpreadsheetApp.openById(Patient[patient].sheet_id); 

    let response = {};

    switch(action){
      case "create":
        response = createRecord(ssheet, requestData.category, requestData.data);
        break;
      case "update":
        response = updateRecord(ssheet, requestData.category, requestData.data);
        break;
      case "upload":
        response = uploadRecord(ssheet, requestData.category, requestData.data, patient);
        break;
      case "delete":
        response = deleteRecord(ssheet, requestData.category, requestData.id);
        break;
      case "push":
        response = record_LabData(ssheet, requestData.data);
        break;
      default:
        throw new Error(`Invalid action: ${action}`);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: "success", data: response }))
                         .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", error: error.message }))
                         .setMimeType(ContentService.MimeType.JSON);
  }
}

// ==========================================
// 4. GET REQUEST (READ, READALL, METADATA, SCHEMA)
// ==========================================
function doGet(e){
  try{
    const action = e.parameter.action;

    // --- AUTHORIZATION FOR ALL GET ENDPOINTS ---
    authenticateKey(e.parameter.key);

    if(action === "schema"){
      return ContentService.createTextOutput(JSON.stringify({ status: "success", data: { schema: DB_SCHEMA, lookups: LOOKUPS } }))
                           .setMimeType(ContentService.MimeType.JSON);
    }

    const patient = e.parameter.patient;
    if (!Patient[patient]) throw new Error(`Patient '${patient}' not found in configuration.`);
    
    const ssheet = SpreadsheetApp.openById(Patient[patient].sheet_id); 
    const sheetName = e.parameter.category;
    const id = e.parameter.id;
    
    let data;

    switch(action){
      case "readallmeta":
        data = readAllMetaData(ssheet);
        break;
      case "profile":
        data = readProfileData(ssheet);
        break;
      case "read":
        if(!sheetName || !id) throw new Error("Missing category or id for read action.");
        data = readRecordById(ssheet, sheetName, id);
        break;
      case "readall":
        if(!sheetName) throw new Error("Missing category for readall action.");
        data = readAllRecordsNested(ssheet, sheetName);
        break;
      default:
        throw new Error(`Invalid action: ${action}`);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: "success", data: data }))
                         .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", error: error.message }))
                         .setMimeType(ContentService.MimeType.JSON);
  } 
}

// ==========================================
// 5. AUTHENTICATION FUNCTION
// ==========================================
function authenticateKey(key) {
  if (!key) throw new Error("Invalid token");
  
  const ss = SpreadsheetApp.openById(SYSTEM_CONFIG.master_auth_sheet_id);
  const authSheet = ss.getSheetByName("Auth");
  
  if (!authSheet) throw new Error("Auth sheet is missing from the Master Spreadsheet.");

  const data = authSheet.getDataRange().getValues();
  
  // Loop through rows, skipping the header (row 0)
  // Assuming Column A (0) is Key, Column B (1) is Patient, Column C (2) is Role
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === key) { 
      return {
        action: "login",
        patient: data[i][1], 
        role: data[i][2]     
      };
    }
  }
  
  throw new Error("Invalid token");
}

// ==========================================
// 6. CRUD & DATABASE FUNCTIONS
// ==========================================
function createRecord(spreadsheet, sheetName, data) {
  const sheet = spreadsheet.getSheetByName(sheetName);
  const newRow = sheet.getLastRow() + 1;
  const newID = Math.random().toString(36).slice(2);
  
  data[DB_SCHEMA[sheetName][0]] = newID;

  Object.keys(data).forEach((column) => {
    let colIndex = DB_SCHEMA[sheetName].indexOf(column);
    if (colIndex > -1) {
      sheet.getRange(newRow, colIndex + 1).setValue(data[column]);
    }
  });

  return { "id": newID, "action": "created" };
}

function updateRecord(spreadsheet, sheetName, data) {
  const sheet = spreadsheet.getSheetByName(sheetName);
  const lastRow = sheet.getLastRow();
  const idRows = sheet.getRange(1, 1, lastRow, 1).getValues();

  var recordID = data[DB_SCHEMA[sheetName][0]];
  var rowNumber = idRows.flat(2).indexOf(recordID);

  if (rowNumber === -1) {
    return { "id": recordID, "action": "unchanged", "error": `No Record matched in sheet: ${sheetName} with ID:${recordID}` };
  }

  Object.keys(data).forEach((column) => {
    let colIndex = DB_SCHEMA[sheetName].indexOf(column);
    if (colIndex > -1) {
      sheet.getRange(rowNumber + 1, colIndex + 1).setValue(data[column]);
    }
  });

  return { "id": recordID, "action": "updated" };
}

function deleteRecord(spreadsheet, sheetName, id) {
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) throw new Error(`Sheet ${sheetName} does not exist.`);
  
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) throw new Error(`No records found in ${sheetName}.`);
  
  const idRows = sheet.getRange(1, 1, lastRow, 1).getValues();
  const rowNumber = idRows.flat(2).indexOf(id);

  if (rowNumber === -1) {
    throw new Error(`Record with ID ${id} not found.`);
  }

  sheet.deleteRow(rowNumber + 1);
  return { "id": id, "action": "deleted" };
}

// ==========================================
// 7. FILE UPLOAD & LAB DATA FUNCTIONS
// ==========================================
function uploadRecord(spreadsheet, sheetName, data, patient) {
  const sheet = spreadsheet.getSheetByName(sheetName);
  const newRow = sheet.getLastRow() + 1;
  const newID = Math.random().toString(36).slice(2);
  
  data[DB_SCHEMA[sheetName][0]] = newID;

  Object.keys(data).forEach((column) => {
    let colIndex = DB_SCHEMA[sheetName].indexOf(column);
    if (colIndex > -1) {
      if (column === "File") {
        // Now accurately uses the newly standardized Name column (index 2) for the filename
        let fileName = data[DB_SCHEMA[sheetName][2]] || "Uploaded File";
        let fileMetadata = upload_Blob(Patient[patient].folder_id, data[column], fileName);
        sheet.getRange(newRow, colIndex + 1).setValue(fileMetadata.id);
      } else {
        sheet.getRange(newRow, colIndex + 1).setValue(data[column]);
      }
    }
  });

  return { "id": newID, "action": "created" };
}

function upload_Blob(folderID, fileData, name) {
  var folder = DriveApp.getFolderById(folderID);
  const decodedData = Utilities.base64Decode(fileData.replace(/^data:.*;base64,/, '')); 
  const blob = Utilities.newBlob(decodedData, getMimeTypeFromBase64(fileData), name);
  var file = folder.createFile(blob);
  file.setDescription("Uploaded by Vital Track API");

  return { url: file.getUrl(), id: file.getId(), name: file.getName() };
}

function getMimeTypeFromBase64(base64Data) {
  return base64Data.split(',')[0].split(':')[1].split(';')[0];
}

function record_LabData(spreadsheet, data) {
  const sheet = spreadsheet.getSheetByName("LabsData");
  let row = sheet.getLastRow() + 1; 
  const readings = data.readings;
  const pushedIds = [];

  readings.forEach(reading => {
    const newID = Math.random().toString(36).slice(2);
    pushedIds.push(newID);

    // Schema: ["id", "Date", "Parameter", "Lab ID", "Category", "Sub Category", "Observed Value", "Unit", "Min", "Max"]
    sheet.getRange(row, 1).setValue(newID);
    sheet.getRange(row, 2).setValue(data.date);
    sheet.getRange(row, 3).setValue(reading.parameter); // Parameter is now strictly Column 3
    sheet.getRange(row, 4).setValue(data.lab_id); 
    sheet.getRange(row, 5).setValue(reading.category || "");
    sheet.getRange(row, 6).setValue(reading.sub_category || "");
    sheet.getRange(row, 7).setValue(reading.value);
    sheet.getRange(row, 8).setValue(reading.unit || "");
    sheet.getRange(row, 9).setValue(reading.min_allowed || "");
    sheet.getRange(row, 10).setValue(reading.max_allowed || "");
    row++;
  });
  
  return { "action": "pushed_labs", "ids": pushedIds };
}

// ==========================================
// 8. READ & NESTED LOOKUP FUNCTIONS
// ==========================================
function readRecordById(spreadsheet, sheetName, id) {
  const sheet = spreadsheet.getSheetByName(sheetName);
  const lastRow = sheet.getLastRow();
  const idRows = sheet.getRange(1, 1, lastRow, 1).getValues();
  var rowNumber = idRows.flat(2).indexOf(id);

  if (rowNumber === -1) {
    return { "id": id, "category": sheetName, "action": "read", "error": `No Record matched in sheet: ${sheetName} with ID:${id}` };
  }

  var data = {};
  Object.keys(DB_SCHEMA[sheetName]).forEach((column, index) => {
    data[DB_SCHEMA[sheetName][index]] = sheet.getRange(rowNumber + 1, index + 1).getValues()[0][0];
  });

  return { "id": id, "category": sheetName, "action": "read", "data": data };
}

function readAllRecordsNested(spreadsheet, sheetName) {
  const sheet = spreadsheet.getSheetByName(sheetName);
  const range = sheet.getDataRange();
  const values = range.getValues();
  const Records = [];

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    let record = {};
    record['id'] = row[0];
    let Nests = (LOOKUPS[sheetName]) ? LOOKUPS[sheetName] : {};
    
    row.forEach((cell, index) => {
      let column = DB_SCHEMA[sheetName][index];
      if (Object.keys(Nests).includes(column)) {
        let Nest = Nests[column];
        if (column.slice(-1)[0] === 's') { // Array of IDs
          let nestedIds = cell.toString().split(',').map(item => item.trim()).filter(item => item);
          let result = nestedIds.map((id) => getNestedValues(spreadsheet, Nest, id));
          record[column] = { data: cell, referenced: result };
        } else { // Single ID
          record[column] = readRecordById(spreadsheet, Nest, cell).data;
        }
      } else {
        record[column] = cell;
      }
    });
    Records.push(record);
  }
  return { 'category': sheetName, 'data': Records };
}

function readAllMetaData(spreadsheet) {
  const sheets = ["Doctors", "Medications", "Ailments", "Labs"];
  let metaData = {};
  
  sheets.forEach((sheetName) => {
    const sheet = spreadsheet.getSheetByName(sheetName);
    metaData[sheetName] = [];
    const values = sheet.getDataRange().getValues();

    for (let i = 1; i < values.length; i++) {
      metaData[sheetName].push({
        'id': values[i][0],
        // Universally grabbing index 2 (the 3rd column) as the label/name based on the updated schema
        'label': values[i][2] 
      });
    }
  });

  return { 'category': 'meta-all', 'data': metaData };
}

function readProfileData(spreadsheet) {
  const sheet = spreadsheet.getSheetByName("Profile");
  if (!sheet) throw new Error("Profile sheet not found.");
  
  const values = sheet.getDataRange().getValues();
  const profile = {};
  
  for (let i = 0; i < values.length; i++) {
    const key = values[i][0];
    const value = values[i][1];
    if (key && typeof key === 'string' && key.trim() !== "") {
      profile[key.trim()] = value;
    }
  }
  
  return { 'category': 'Profile', 'data': profile };
}

function getNestedValues(spreadsheet, sheetName, id) {
  try {
    if (checkDuration() && sheetName in CACHE) {
      if(CACHE[sheetName][id]) return CACHE[sheetName][id];
    } else {
      populateDictionaryFromSheet(spreadsheet, sheetName);
    }
    
    if (sheetName in CACHE && CACHE[sheetName][id]) {
      return CACHE[sheetName][id];
    } else {
      return readRecordById(spreadsheet, sheetName, id)['data'];
    }
  } catch (e) {
    return { "id": id, "error": `Failed to nest ${sheetName} ID:${id}` };
  }
}

function populateDictionaryFromSheet(spreadsheet, sheetName) {
  const sheet = spreadsheet.getSheetByName(sheetName);
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();

  if (lastRow < 2) return {}; 

  const data = sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues();
  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  const dictionary = {};

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const id = row[0]; 
    const innerDict = {};

    for (let j = 0; j < row.length; j++) { 
      innerDict[headers[j]] = row[j]; 
    }
    dictionary[id] = innerDict; 
  }
  
  CACHE[sheetName] = dictionary;
  setTimestamp();
  return dictionary;
}

function setTimestamp() { CACHE_Valid = Date.now(); }

function checkDuration() {
  if (!CACHE_Valid) return false; 
  return (Date.now() - CACHE_Valid) <= 15000; 
}