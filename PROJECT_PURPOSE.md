# Thirumala Group Business Management System

## Purpose and Overview
The **Thirumala Group Business Management System** is a comprehensive, full-stack web application designed to act as an internal ERP (Enterprise Resource Planning) and Admin Dashboard for the Thirumala Group. 

Its primary purpose is to centralize and manage the company's financial transactions, company records, physical assets (like vehicles), personnel (drivers), and user operations in one unified interface. A critical unique feature of this system is its **dual-mode operation (Regular and ITR modes)**, which allows the business to handle standard daily operations alongside specific tax reporting and compliance requirements seamlessly.

## Key Capabilities and Use Cases

1. **Financial Management & Accounting:**
   - Functions as a digital cash book for recording credit/debit transactions.
   - Generates detailed ledgers, balance sheets, and daily financial reports.
   - Manages finances across multiple companies under the Thirumala Group umbrella.

2. **Asset & Resource Tracking:**
   - Tracks physical assets, specifically vehicles and their registration/expiry dates.
   - Manages driver profiles and license validity.
   - Tracks bank guarantees and sends automated expiry notifications.

3. **Data Integrity & Workflow:**
   - Includes an approval workflow system where records can be locked for review.
   - Maintains a strict audit trail (tracking all edit histories and utilizing soft-deletes so no data is permanently lost).
   - Supports bulk importing/exporting of financial data via CSV/Excel.

4. **Access Control:**
   - Secure role-based access control to ensure sensitive financial data is only accessible to authorized personnel.

## Technology Stack
- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, TanStack Query.
- **Backend & Database:** Supabase (PostgreSQL), Express.js (for production serving).
- **Deployment:** Containerized via Docker or hosted on Vercel.

## Summary
In short, this project was created to replace manual or fragmented financial and asset tracking methods with a secure, modern, and centralized web application tailored specifically to the operational and tax-compliance needs of the Thirumala Group.
