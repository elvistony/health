### 1. The Current Situation: The Architecture

You have built a **Decoupled Serverless Multi-Page Application (MPA).** It consists of two completely separate halves that only talk to each other over the internet:

* **The Backend (The Database & Logic):** This lives entirely inside Google's ecosystem. Your Google Sheet acts as the relational database, Google Drive acts as the file storage bucket (for lab reports), and Google Apps Script (`Code.gs`) acts as the server logic.
* **The Frontend (The UI):** This is a collection of static HTML, CSS (Pico.css), and JavaScript files (`app.js`, `api.js`). Because they are static, they can be hosted anywhere for free (like GitHub Pages). They hold no actual data; they only draw the screens and ask the backend for information.
* **The Bridge (The Cache):** To prevent hitting Google's rate limits and to make the app feel blazingly fast, your front-end uses `sessionStorage`. It downloads a table once, saves it in the browser's memory, and instantly loads it as you click around the different folders (`/visits/`, `/medications/`, etc.).

---

### 2. The RPC API: How it Works

Most modern web APIs are **RESTful**, meaning they use different URL paths to mean different things (e.g., `GET /patients/mom` or `DELETE /visits/123`).

Google Apps Script does not allow that. It only gives you **one single endpoint URL** (ending in `/exec`). Because of this, you built an **RPC (Remote Procedure Call)** API.

In an RPC API, you send all your traffic to that one single URL, but you attach an `"action"` command to the payload. The API reads the action (like a switchboard operator) and routes the request to the right function internally.

Here is the exact breakdown of how your frontend will communicate with it.

#### A. Authentication (The Gatekeeper)

Before the app can do anything, it needs to know who is logging in and which patient they are looking at.

* **The Request:** You send a POST request with `{ "action": "login", "key": "X7b9" }`.
* **The Response:** The API checks the Master Auth Sheet and returns `{ "patient": "Mom", "role": "consultant" }`.
* **The Result:** Your front-end saves this in `sessionStorage` and attaches `patient: "Mom"` to every future request.

#### B. Reading Data (GET Requests)

To get data, your front-end appends query parameters directly to the URL.

* **Read a whole table:** `?patient=Mom&action=readall&category=Visits`
* **Read one specific record:** `?patient=Mom&action=read&category=Visits&id=v8x9a`
* **Get Schema (Dropdown metadata):** `?action=schema` (No patient required).

#### C. Writing Data (POST Requests)

To modify the database, you send a JSON body via `POST`.

* **`create`**: Injects a new row and auto-generates a unique ID.
* **`update`**: Finds the row by ID and overwrites the specified columns.
* **`delete`**: Finds the row by ID and deletes it.
* **`upload`**: Takes a Base64 image string, converts it to a file in Google Drive, and saves the Drive URL into the database row.
* **`push`**: A specialized action specifically for `LabsData` that loops through an array of nested readings (like blood sugar and cholesterol) and generates a new row for each one.

---

### 3. How to Use It (The Code)

When you are writing the Javascript for your Add/Edit forms on the front-end, you will use the browser's native `fetch()` API.

Because Google Apps Script has strict CORS (Cross-Origin Resource Sharing) rules, **you must use `mode: 'no-cors'` and `text/plain**` when sending POST requests, otherwise the browser will block the request.

Here is exactly how a "Save Visit" button will submit data to your RPC API:

```javascript
async function submitNewVisit() {
  const API_URL = "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec";
  
  // 1. Build the RPC Payload
  const payload = {
    patient: "Mom",      // Pulled from your Auth state
    action: "create",    // The RPC Command
    category: "Visits",  // The target table
    data: {
      "Date": document.getElementById('visit-date').value,
      "Title": document.getElementById('visit-title').value,
      "Visit Type": "Outpatient",
      "Doctor ID": "DOC-123",
      "Remarks": document.getElementById('visit-notes').value
    }
  };

  // 2. Send it to Google
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      mode: "no-cors", // CRITICAL for Apps Script
      headers: {
        "Content-Type": "text/plain" // CRITICAL for Apps Script
      },
      body: JSON.stringify(payload)
    });

    // 3. Clear the local cache so the table refreshes next time you look at it
    sessionStorage.removeItem('vt_Mom_Visits');
    
    alert("Visit saved successfully!");
    window.location.hash = ""; // Close the modal and return to table view

  } catch (error) {
    console.error("Failed to save:", error);
  }
}

