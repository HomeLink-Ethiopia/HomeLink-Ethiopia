<div align="center">

# 🏠 HomeLink Ethiopia: https://home-link-ethiopia-vrzr.vercel.app/

**A Trusted Digital Housing Ecosystem**

*"From finding a house to managing a trusted tenancy."*

[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-18-blue?style=for-the-badge&logo=react)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-Express-green?style=for-the-badge&logo=node.js)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=for-the-badge&logo=mongodb)](https://www.mongodb.com/)
[![FastAPI](https://img.shields.io/badge/FastAPI-Python-009688?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)

</div>

---

## 📖 Executive Summary

HomeLink Ethiopia is a comprehensive, full-stack digital housing platform designed to solve the trust, transparency, and efficiency issues plaguing the Ethiopian rental market. It connects tenants, landlords, and property managers through a verified ecosystem, replacing fragmented, paper-based processes with a modern, secure, and data-driven solution.

By integrating **AI-driven property matching**, **strict administrative verification workflows**, and **real-time digital payments via Chapa**, HomeLink ensures that finding and managing a home in Ethiopia is safe, seamless, and entirely digital.

## 🚨 The Problem

Ethiopia faces significant housing pressure associated with rapid urbanization. Beyond the physical shortage, the rental process itself is deeply flawed:
*   **Lack of Trust:** Tenants frequently fall victim to fake listings, duplicate properties, or unverified landlords.
*   **Fragmented Discovery:** Property discovery relies on brokers and social media, making it hard to compare prices.
*   **Manual Processes:** Rental agreements, rent tracking, and maintenance requests are largely paper-based.

## 💡 The Solution

HomeLink provides a **three-sided marketplace** with a robust trust layer:

### For Tenants
*   **Verified Discovery:** Search for properties with geospatial filters and clear verification badges.
*   **AI Recommendations:** Explainable AI that ranks properties based on your budget and preferences.
*   **Digital Lifecycle:** Apply, sign lease agreements, and upload payment receipts all in one place.
*   **Secure Payments:** Integrated with Chapa for Telebirr, CBE, and card payments.

### For Landlords
*   **Verification Workflow:** Upload identity and ownership documents to get a "Verified" badge.
*   **Property Management:** Manage listings, images, applications, and tenant communication.
*   **Rent Tracking:** Generate invoices and track who has paid.

### For Administrators
*   **Verification Dashboard:** Review documents and approve/reject properties.
*   **Trust & Safety:** Monitor flagged listings, handle disputes, and suspend malicious accounts.

## 🛠️ Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | Next.js 14 (App Router), React, TypeScript, Tailwind CSS |
| **Backend** | Node.js, Express.js, JWT, Nodemailer (Email OTP) |
| **Database** | MongoDB Atlas, Mongoose ODM |
| **AI Microservice** | Python, FastAPI, Scikit-learn |
| **Payments** | Chapa API (v1/v2 Integration) |
| **Deployment** | Vercel (Frontend), Render (Backend) |

## 🏗️ System Architecture

```mermaid
flowchart TD
    %% Clients
    subgraph Client Layer [Client Layer]
        T[Tenant App]
        L[Landlord App]
        A[Admin Console]
    end

    %% Frontend
    FE[Next.js Frontend<br/>Vercel]
    T --> FE
    L --> FE
    A --> FE

    %% Backend
    BE[Express.js REST API<br/>Render]
    FE -- "HTTPS / JSON<br/>JWT Auth" --> BE

    %% Database
    DB[(MongoDB Atlas<br/>Cloud Database)]
    BE -- "Mongoose ODM" --> DB

    %% External Services
    subgraph External [External & In-Progress Integrations]
        CHAPA[Chapa Payment Gateway<br/>Telebirr, CBE, Cards]
        AI[FastAPI AI Microservice<br/>Recommendations & Fraud]
    end
    
    BE -- "HTTPS (Initialize/Verify)" --> CHAPA
    BE -- "REST API (In-Progress)" --> AI
Getting Started (Local Setup)
Prerequisites
Node.js (v18+)

Python (v3.9+)

MongoDB Atlas Account

Chapa Account (Test Keys)

1. Clone the Repository
bash
git clone https://github.com/HomeLink-Ethiopia/HomeLink-Ethiopia.git
cd HomeLink-Ethiopia
2. Backend Setup
bash
cd backend
npm install
Create a .env file in the backend folder and add your secrets:

env
PORT=5000
MONGO_URI=your_mongodb_atlas_connection_string
JWT_SECRET=your_jwt_secret
CHAPA_SECRET_KEY=secret_test_key
FRONTEND_URL=http://localhost:3000
Start the backend server:

bash
npm run dev
3. Frontend Setup
Open a new terminal:

bash
cd frontend
npm install
Create a .env.local file in the frontend folder:

env
NEXT_PUBLIC_MOCK_MODE=false
NEXT_PUBLIC_API_URL=http://localhost:5000
Start the frontend server:

bash
npm run dev
4. Access the Application
Open your browser and navigate to http://localhost:3000.

website:https://home-link-ethiopia-vrzr.vercel.app

👥 The Team

Kidist Kinfe — Backend Lead (Node.js, Express, Auth, Payments, System Architecture),Database,Deployment,Payment,Testing

Tsedenia Worku — Frontend Lead (Next.js, React, UI/UX, Client-side Logic)

Yirgalem — Database & Verification Lead

Addisu — Testing, DevOps & AI Lead (API Testing, CI/CD, FastAPI Microservice, Deployment)

<div align="center"> <i>Built with ❤️ for the HomeLink Ethiopia Team.</i> </div> ```
