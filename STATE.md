What We Are Building: The Architecture
We are building a Serverless Progressive Web App (PWA) designed to act as a unified, portable electronic health record (EHR) system.

It uses a highly efficient, decoupled architecture:

The Backend (Google Workspace): A heavily customized Google Sheet acts as your relational database. Google Drive acts as your secure file storage bucket for X-rays and prescriptions. A custom Google Apps Script serves as the "brain," routing traffic and handling data processing.

The Frontend (GitHub Pages): A lightweight, static Multi-Page Application (MPA) built with standard HTML, vanilla JavaScript, and Pico.css. It lives entirely in the browser, meaning it is instantly accessible via a web link without anyone needing to download an app from an App Store.

What We Have Achieved So Far
We have successfully built the entire engine and the structural blueprint of the application.

The Database Schema: We engineered a robust, relational table structure (Visits, Medications, Ailments, Labs, LabsData, Doctors). Crucially, we standardized the third column across all tables to act as the "Label," which makes building dynamic dropdowns in the UI incredibly easy.

The RPC API: We wrote a custom Remote Procedure Call API (Code.gs) that securely handles creating, reading, updating, deleting, and nesting data. It also natively intercepts Base64 image strings and converts them into physical Google Drive files.

The Routing & Caching Engine: We built a frontend engine (api.js) that uses URL Hashes for state management (e.g., /#v8x9a) and sessionStorage to cache data locally. This means the app feels lightning-fast and doesn't overload Google's servers as you click around.

The UI Blueprint: We mapped out the folder structure and wrote the baseline code for the data grids, the 60-second "Consultant Snapshot," and the chronological "Timeline" feed, ensuring it all looks like a polished native app on a mobile phone using Pico.css.

Who Is Using It
The system is designed with a strict two-tier access model to serve two very different types of users:

The Admins / Patients (You & Your Family): You have full read/write access. You are the ones actively managing the database—uploading lab photos, logging new appointments, and keeping the active medication lists accurate for yourself, your mom, and Rency.

The Consultants (The Doctors): Doctors at various hospitals are given a specific, read-only authentication key. They do not want to navigate a complex database; they are using the app to get up to speed in under a minute.

The Ultimate Goal
The goal of Vital Track is to eliminate the friction of medical fragmentation. When your parents see a new specialist, you no longer have to carry physical folders of lab reports or try to remember the exact dosage of a medication prescribed by a different doctor three years ago. You simply hand the specialist a phone or text them a link. They immediately see a clean, chronological timeline of events, a gallery of lab files, and a snapshot of current active medications and vital alerts.

The Expectation & Next Steps
The expectation is that this system will be 100% free to host, highly secure (as data never leaves your personal Google account), and completely responsive on any device.

