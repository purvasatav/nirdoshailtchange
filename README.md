# 🛡️ Nirdosh Vault

# AI-Powered Digital Identity Intelligence Platform

> **Verify Before You Apply**

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript)
![Node.js](https://img.shields.io/badge/Node.js-339933?logo=node.js)
![Express](https://img.shields.io/badge/Express.js-black?logo=express)
![Python](https://img.shields.io/badge/Python-3776AB?logo=python&logoColor=white)
![Gemini](https://img.shields.io/badge/Google-Gemini_2.5_Flash-4285F4)
![License](https://img.shields.io/badge/License-MIT-green)

## 🚀 Quick Links

  Resource       Link
  -------------- ---------------
  Demo Video     ADD_LINK_HERE
  Live Demo      ADD_LINK_HERE
  GitHub         ADD_LINK_HERE

## Core Capabilities

-   Consensus Identity Engine
-   Identity Resolution Confidence
-   Visual Identity Evidence Graph
-   Cross-Document Conflict Detection
-   Evidence-Based Correction Guidance
-   Government Scheme Discovery
-   Nearby Assistance Centres
-   Downloadable PDF Report

## Overview

Nirdosh Vault is an AI-powered GovTech platform that helps citizens
identify inconsistencies across identity documents before submitting
applications.

The platform extracts document fields, builds a Consensus Identity
Profile, calculates an explainable Identity Resolution Confidence Score,
visualizes relationships between uploaded documents, provides correction
guidance, discovers potentially relevant government schemes, finds
nearby assistance centres, and generates downloadable PDF reports.

## Problem Statement

Millions of citizens submit multiple identity documents while applying for scholarships, welfare schemes, admissions, and public services.

Small inconsistencies such as differences in name, date of birth, address, or parent name often result in application delays, verification failures, and repeated correction cycles.

Existing platforms securely store and exchange documents but generally validate them only after submission.

Nirdosh Vault introduces a pre-submission verification layer that helps citizens detect and resolve inconsistencies before they apply.

## Features

-   AI-assisted document extraction (Gemini + PaddleOCR)
-   Consensus Identity Engine
-   Identity Resolution Confidence
-   Visual Identity Evidence Graph
-   Conflict Detection
-   Evidence-Based Correction Guidance
-   Government Scheme Discovery
-   Nearby Assistance Centres
-   PDF Verification Report
-   Privacy-first processing

## Workflow

```text
Upload Identity Documents
          │
          ▼
AI Extraction (Gemini + PaddleOCR)
          │
          ▼
Field Normalization
          │
          ▼
Consensus Identity Engine
          │
          ▼
Identity Resolution Confidence
          │
          ▼
Visual Identity Evidence Graph
          │
          ▼
Correction Guidance
      ┌───┴──────────┐
      ▼              ▼
Nearby Centres   Scheme Discovery
      │              │
      └──────┬───────┘
             ▼
Download PDF Report
```

## 🏗️ Architecture Overview

| Component | Implementation |
|-----------|----------------|
| **Document Upload** | Multi-document upload with PDF and image support |
| **Extraction Pipeline** | Google Gemini 2.5 Flash with PaddleOCR fallback |
| **Normalization Layer** | Deterministic field normalization |
| **Consensus Engine** | Cross-document identity comparison |
| **Identity Resolution Confidence** | Explainable peer-evidence scoring |
| **Identity Evidence Graph** | Interactive visualization of document relationships |
| **Correction Guidance** | Evidence-backed advisory guidance |
| **Scheme Discovery** | Preliminary government scheme matching |
| **Nearby Centres** | Assistance centre locator |
| **Report Generation** | Downloadable PDF verification report |


# 🛠️ Technology Stack

| Layer | Technologies | Purpose |
|-------|--------------|---------|
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS, React Router | Responsive user interface and client-side routing |
| **Backend** | Node.js, Express.js, TypeScript | REST APIs, business logic, authentication, document analysis pipeline |
| **AI & LLM** | Google Gemini 2.5 Flash | Intelligent document field extraction and natural language explanations |
| **OCR Engine** | PaddleOCR (Python) | Optical Character Recognition with fallback extraction |
| **Document Processing** | PDF Processing, Image Processing, Field Normalization | Pre-processing, parsing, and structured document analysis |
| **Identity Intelligence Engine** | Consensus Identity Engine, Deterministic Validation Logic | Cross-document comparison, consensus generation, conflict detection |
| **Confidence Engine** | Identity Resolution Confidence Algorithm | Explainable peer-evidence based identity consistency scoring |
| **Visualization** | Visual Identity Evidence Graph | Interactive visualization of document relationships and evidence |
| **Government Services** | Rule-Based Scheme Discovery, Nearby Assistance Centre Finder | Preliminary scheme discovery and citizen assistance |
| **Authentication** | JSON Web Tokens (JWT), bcrypt | Secure user authentication and password hashing |
| **Security** | Helmet, CORS, Environment Variables | API security and secure configuration management |
| **Maps & Location** | Google Maps Platform | Nearby Aadhaar, CSC, and Maha e-Seva centre discovery |
| **Logging & Monitoring** | Winston, Morgan | Structured logging and request monitoring |
| **Database** | MongoDB *(Prototype Support)* | User and application data storage |
| **Deployment** | Vercel (Frontend), Render (Backend), Docker | Application deployment and containerization |
| **Version Control** | Git, GitHub | Source code management and collaboration |
| **Languages** | TypeScript, JavaScript, Python, HTML5, CSS3 | Full-stack application development |

## Responsible AI

- AI assists document extraction and natural language explanations.
- Cross-document comparison follows deterministic rules.
- No uploaded document is treated as absolute truth.
- Ambiguous cases are flagged for manual review.
- Reports provide advisory guidance only.
- Final verification remains the responsibility of the relevant government authority.

  ## Why Nirdosh Vault?

Unlike traditional verification systems,

• no single document is treated as the master record

• identity consistency is established through peer evidence

• every confidence score is explainable

• document relationships are visualized

• correction guidance is evidence-backed

• scheme discovery remains transparent and advisory

## Local Setup

Backend

``` bash
cd api
npm install
pip install -r requirements.txt
npm run dev
```

Frontend

``` bash
cd ui
npm install
npm run dev
```

## Environment Variables

``` env
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
JWT_SECRET=
GOOGLE_MAPS_API_KEY=
```

## Roadmap

- DigiLocker Integration
- Multilingual Support
- Organization Dashboard
- Mobile Application
- Additional Government Schemes
- More Identity Document Types
- Offline Verification Support
- Citizen Verification History

## Team

Team Nexovate

-   Siddhi Jadhav
-   Purva Satav
-   Saumya Raut

## Disclaimer

Nirdosh Vault is a hackathon prototype. It is not affiliated with UIDAI,
DigiLocker, CSC, Maha e-Seva, myScheme, NSP, or any Government
authority. It provides advisory cross-document consistency analysis and
preliminary scheme discovery only.
