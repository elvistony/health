// shared/api.js

(function authCheck() {
  const path = window.location.pathname;
  if (!path.includes('login/index.html') && !sessionStorage.getItem('vt_auth')) {
    if (path.endsWith('/health/') || path.endsWith('/health/index.html') || path.endsWith('/health')) {
      window.location.replace('login/index.html');
    } else {
      window.location.replace('../login/index.html');
    }
  }
})();


const API_URL = "https://script.google.com/macros/s/AKfycbz3mrSx2ugkwToqbWKdiJkyaaY582Rc-lAHBCJQX6yfRVxj69C4WbfFkaeh449pkrn-/exec"; 
const CURRENT_PATIENT = sessionStorage.getItem('vt_patient') || "Tony"; // Fallback to Tony if not set
const VT_KEY = sessionStorage.getItem('vt_key') || "";

const API = {
  async login(key) {
    console.log("Authenticating...");
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain" }, // Prevents CORS preflight
        body: JSON.stringify({ action: "login", key: key })
      });
      const result = await response.json();
      if (result.status === "success") {
        return result.data;
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      console.error("Login failed:", err);
      return null;
    }
  },

  async fetchSchema() {
    const cacheKey = `vt_schema`;
    
    const cachedData = sessionStorage.getItem(cacheKey);
    if (cachedData) {
      const parsed = JSON.parse(cachedData);
      // Force refresh if the old schema format (without lookups) was cached
      if (parsed && parsed.lookups) {
        console.log("Loaded Schema from Cache");
        return parsed;
      }
    }

    console.log("Fetching Schema from API...");
    try {
      const response = await fetch(`${API_URL}?action=schema&key=${VT_KEY}`);
      const result = await response.json();
      
      if (result.status === "success") {
        console.log("Schema fetch successful.");
        sessionStorage.setItem(cacheKey, JSON.stringify(result.data));
        return result.data;
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      console.error(`Failed to fetch schema:`, err);
      return { schema: {}, lookups: {} }; 
    }
  },

  async fetchProfile() {
    console.log(`Fetching Profile from API...`);
    try {
      const response = await fetch(`${API_URL}?patient=${CURRENT_PATIENT}&action=profile&key=${VT_KEY}`);
      const result = await response.json();
      if (result.status === "success") {
        return result.data.data;
      } else {
        throw new Error(result.error);
      }
    } catch(err) {
      console.error("Failed to fetch profile:", err);
      return null;
    }
  },

  async fetchMetaData() {
    const cacheKey = `vt_meta`;
    const cachedData = sessionStorage.getItem(cacheKey);
    if (cachedData) return JSON.parse(cachedData);

    console.log("Fetching MetaData from API...");
    try {
      const response = await fetch(`${API_URL}?patient=${CURRENT_PATIENT}&action=readallmeta&key=${VT_KEY}`);
      const result = await response.json();
      if (result.status === "success") {
        sessionStorage.setItem(cacheKey, JSON.stringify(result.data.data));
        return result.data.data;
      } else {
        throw new Error(result.error);
      }
    } catch(err) {
      console.error("Failed to fetch metadata:", err);
      return null;
    }
  },

  async fetchData(tableName, forceRefresh = false) {
    const cacheKey = `vt_${CURRENT_PATIENT}_${tableName}`;
    
    // 1. Check Session Storage first
    if (!forceRefresh) {
      const cachedData = sessionStorage.getItem(cacheKey);
      if (cachedData) {
        console.log(`Loaded ${tableName} from Cache`);
        return JSON.parse(cachedData);
      }
    }

    // 2. Fetch from Google Apps Script
    console.log(`Fetching ${tableName} from API (URL: ${API_URL})...`);
    try {
      const response = await fetch(`${API_URL}?patient=${CURRENT_PATIENT}&action=readall&category=${tableName}&key=${VT_KEY}`);
      const result = await response.json();
      
      if (result.status === "success") {
        console.log(`Successfully fetched ${result.data.data.length} records for ${tableName}.`);
        // 3. Save to cache
        sessionStorage.setItem(cacheKey, JSON.stringify(result.data.data));
        return result.data.data;
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      console.error(`Failed to fetch ${tableName}:`, err);
      return []; // Return empty array on failure to prevent UI crashing
    }
  },

  // Call this after you POST an update/create/delete so the UI grabs fresh data
  clearCache(tableName) {
    console.log(`Clearing cache for ${tableName}...`);
    sessionStorage.removeItem(`vt_${CURRENT_PATIENT}_${tableName}`);
  }
};

// AdminLTE native scripts handle sidebar toggling via data-lte-toggle