# 🗃️ Decentralized File Metadata Manager

<p align="center">
  <b>A decentralized file management system integrating IPFS for file storage and MongoDB for metadata and version control.</b><br>
  Built using <b>Node.js</b>, <b>Express.js</b>, <b>IPFS</b>, and <b>MongoDB</b>.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-18+-green?logo=node.js" />
  <img src="https://img.shields.io/badge/Express.js-Backend-blue?logo=express" />
  <img src="https://img.shields.io/badge/IPFS-Decentralized%20Storage-brightgreen?logo=ipfs" />
  <img src="https://img.shields.io/badge/MongoDB-Database-darkgreen?logo=mongodb" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?logo=open-source-initiative" />
</p>

---

## 🧭 Overview

This project is a **Decentralized File Metadata Management System** that securely stores files on **IPFS** while maintaining structured metadata and version history in **MongoDB**.

It provides a RESTful backend to:
- Upload files to IPFS  
- Manage metadata, versions, and ownership  
- Verify data integrity with SHA-256  
- Search, download, and soft-delete files  

Designed for real-world decentralized applications where **data immutability, traceability, and verifiability** matter.

---

## 🧩 Folder Structure

```
src/
├── config/
│   └── db.js
├── controllers/
│   └── fileController.js
├── models/
│   └── fileMetadata.js
├── routes/
│   └── fileRoutes.js
├── services/
│   └── ipfsService.js
├── utils/
│   └── hashUtils.js
├── app.js
.env
package.json
```

---

## 📸 Project Snapshots

### 🧠 IPFS Desktop (Local Node)
Uploaded file pinned successfully:
<img width="1402" height="193" alt="Screenshot 2025-11-09 175326" src="https://github.com/user-attachments/assets/40dd9bbb-b76b-4a73-a218-90ed04bf0789" />


---

### 🗄️ MongoDB Atlas (File Metadata Record)
File metadata stored with owner, versions, and timestamps:
<img width="730" height="303" alt="Screenshot 2025-11-09 183437" src="https://github.com/user-attachments/assets/c04f574b-4274-4739-8672-b468dac8721c" />


---


## 🚀 Features

- ⚡ **Decentralized Storage via IPFS** – Files stored on your local or remote IPFS node.
- 🧾 **MongoDB Metadata Layer** – Tracks file name, owner, version history, description, and tags.
- 🔁 **Version Control System** – Automatically increments version numbers on new uploads.
- 🧩 **Integrity Verification** – Uses SHA-256 hashing to detect duplicates and verify file content.
- 🔍 **Metadata Search** – Query files by owner, tags, or content description.
- 🗑️ **Soft Delete System** – Marks files inactive instead of deleting permanently.
- 💚 **Health Monitoring** – IPFS node and MongoDB connection status endpoint.
- 🧰 **Rate Limiting** – Protects against excessive upload/download requests.

---

## 🧬 Tech Stack

| Layer | Technology |
|--------|-------------|
| **Backend Framework** | Node.js + Express.js |
| **Database** | MongoDB (Atlas) |
| **Decentralized Storage** | IPFS (`ipfs-http-client`) |
| **Security / Integrity** | SHA-256 Hashing |
| **Request Control** | express-rate-limit |
| **Environment Config** | dotenv |
| **File Uploads** | multer |

---

## ⚙️ Installation & Setup

### 1️⃣ Clone the Repository
```bash
git clone https://github.com/adwityac/decentralized-file-metadata-manager.git
cd decentralized-file-metadata-manager
```

### 2️⃣ Install Dependencies
```bash
npm install
```

### 3️⃣ Create `.env` File
Example configuration:

```env
# Server
PORT=3000
NODE_ENV=development

# MongoDB
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/filedatamanager?retryWrites=true&w=majority

# IPFS (Local Node)
IPFS_HOST=127.0.0.1
IPFS_PORT=5001
IPFS_PROTOCOL=http
IPFS_API_URL=http://127.0.0.1:5001

# (Optional)
JWT_SECRET=your_secret_key_here
```

### 4️⃣ Start IPFS Node
If using **IPFS Desktop (Windows)**:
- Open IPFS Desktop → Settings → Enable “API Server”.
- It should be accessible at:
  ```
  http://127.0.0.1:5001/webui
  ```

### 5️⃣ Run the Server
```bash
npm run dev
```

You should see:
```
🚀 Server running on port 3000
🗄️ MongoDB Connected
📡 IPFS: http://127.0.0.1:5001
✅ IPFS client initialized successfully
```

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|-----------|-------------|
| **POST** | `/api/files/upload` | Upload a new file to IPFS + MongoDB |
| **GET** | `/api/files/:fileId` | Get metadata for a specific file |
| **GET** | `/api/files/download/:fileId/:versionIndex?` | Download file by ID or version |
| **POST** | `/api/files/update/:fileId` | Upload a new version of an existing file |
| **GET** | `/api/files/verify/:fileId/:versionIndex` | Verify file integrity on IPFS |
| **GET** | `/api/files/owner/:owner` | Retrieve files uploaded by a specific owner |
| **DELETE** | `/api/files/:fileId` | Soft delete a file |
| **GET** | `/api/files/system/status` | IPFS & MongoDB health status |
| **GET** | `/api/files/system/search` | Search files by query, owner, or tags |

---

## 📘 Example Usage

### 🗂️ Upload a File
**Request:**
```bash
POST /api/files/upload
Form Data:
  file: <sample.txt>
  owner: adwit
```

**Response:**
```json
{
  "success": true,
  "message": "File uploaded successfully",
  "data": {
    "fileId": "85fdebed78756e62de5fa468beccf598",
    "originalFileName": "sample.txt",
    "sha256Hash": "5e8ec69c8858f6a1ee31cdea70837b9154d70a6873fbe91e61cc2135a614fd48",
    "ipfsHash": "QmQ8k3siDa7kuCUm34C6Mgoav4gsYXGNjamkNLzp98zymc"
  }
}
```

---

### 🧾 Check System Health
**Request:**
```bash
GET /api/files/system/status
```

**Response:**
```json
{
  "success": true,
  "message": "IPFS service is running",
  "data": {
    "connected": true,
    "version": "0.37.0",
    "repoUsagePercent": "0.03%"
  }
}
```

---

### 🗑️ Soft Delete File
**Request:**
```bash
DELETE /api/files/85fdebed78756e62de5fa468beccf598
Body (JSON):
{
  "owner": "adwit"
}
```

**Response:**
```json
{
  "success": true,
  "message": "File deleted successfully"
}
```

---

## 🧠 Architecture Diagram

```
        ┌────────────┐
        │   Client   │
        └─────┬──────┘
              │
              ▼
      ┌───────────────┐
      │  Express API  │
      ├───────────────┤
      │ Upload / GET  │
      │ Delete / Verify│
      └──────┬────────┘
             │
     ┌───────┴────────┐
     │                │
     ▼                ▼
┌───────────┐   ┌──────────────┐
│   IPFS    │   │   MongoDB    │
│ (Decentralized) │ (Metadata DB) │
└───────────┘   └──────────────┘
```

---


## 🪐 License

This project is licensed under the **MIT License** — feel free to fork, modify, and build upon it.  
```
MIT License © 2025 Adwitya Chakraborty
```

---

## ⭐ Support

If you like this project, please ⭐ **star** the repository — it helps support continued open-source development!
