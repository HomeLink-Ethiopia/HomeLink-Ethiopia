# Implementation Plan: HomeLink Feature Completion

## Overview

This implementation plan completes all partially implemented features in the HomeLink Ethiopia application. The work includes connecting all pages to the translation system, implementing search and filtering functionality, creating missing dashboard pages, establishing the landlord verification workflow, and ensuring zero broken navigation links. All features follow the existing Next.js/React patterns with TypeScript.

## Tasks

- [~] 1. Set up translation integration infrastructure
  - Connect the homepage (/) to the Translation_System using the `useLanguage` hook
  - Extend locales/en.json and locales/am.json with new translation keys for all sections
  - Verify language switching updates all visible text without page reload
  - Test that language preference persists in LocalStorage
  - _Requirements: 1.1, 1.2, 1.8, 1.9, 1.11_

- [ ] 2. Implement search functionality
  - [~] 2.1 Update TopNav component with search form submission
    - Add form submit handler that redirects to /explore with query parameter
    - Implement URL encoding for search queries
    - _Requirements: 2.1_
  
  - [~] 2.2 Create search filter utility in lib/search.ts
    - Write `filterProperties()` function with case-insensitive matching
    - Implement matching against property location, title, and description
    - Support multiple simultaneous filters with AND logic
    - Add empty state handling when no properties match
    - _Requirements: 2.2, 2.3, 2.4, 2.6, 2.7_
  
  - [ ]* 2.3 Write unit tests for filter logic
    - Test search query filtering in title and location
    - Test neighborhood filtering
    - Test price range filtering
    - Test bedroom count filtering
    - Test multiple filters with AND logic
    - Test empty result handling
    - _Requirements: 2.2, 2.3, 2.6, 2.7, 9.6, 9.9_
  
  - [~] 2.4 Update explore page to accept and apply search filters
    - Parse URL query parameters on page load
    - Display query text in search input when present
    - Apply filters to DiscoverySplit component
    - Ensure results appear within 500ms on client side
    - _Requirements: 2.2, 2.5, 2.6, 2.7_
  
  - [~] 2.5 Connect explore page to Translation_System
    - Add `useLanguage` hook to explore page
    - Update all labels, buttons, and content to use translation keys
    - _Requirements: 1.3, 1.8, 1.11_

- [~] 3. Checkpoint - Test search functionality
  - Verify search from homepage redirects correctly with query params
  - Verify filtered results display correctly on explore page
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Enable property detail page navigation
  - [~] 4.1 Update Property_Card component with navigation
    - Wrap card content with Link component pointing to /property/[id]
    - Ensure all Property_Card instances on explore page link correctly
    - _Requirements: 3.1, 3.5_
  
  - [~] 4.2 Enhance property detail page (/property/[id]/page.tsx)
    - Display all property images in gallery
    - Show title, location, price, bedrooms, bathrooms, description
    - Handle invalid property IDs with "Property not found" error page
    - Ensure TopNav is visible (public layout)
    - _Requirements: 3.2, 3.3, 3.4, 3.6, 3.7_
  
  - [~] 4.3 Connect property detail page to Translation_System
    - Add `useLanguage` hook
    - Update all labels and content to use translation keys
    - _Requirements: 1.4, 1.8, 1.11_

- [ ] 5. Create missing tenant dashboard pages
  - [~] 5.1 Create /tenant/applications page
    - Create page.tsx file following existing dashboard pattern
    - Display all rental applications submitted by logged-in tenant
    - Include TopBar component with title and subtitle
    - Add `useLanguage` hook and connect to Translation_System
    - _Requirements: 4.1, 4.5, 4.6, 4.7, 4.8_
  
  - [~] 5.2 Create /tenant/payments page
    - Create page.tsx file following existing dashboard pattern
    - Display payment history and upcoming rent payments
    - Include TopBar component
    - Add `useLanguage` hook and connect to Translation_System
    - _Requirements: 4.2, 4.5, 4.6, 4.7, 4.8_
  
  - [~] 5.3 Create /tenant/messages page
    - Create page.tsx file following existing dashboard pattern
    - Display conversations between tenant and landlords/admin
    - Include TopBar component
    - Add `useLanguage` hook and connect to Translation_System
    - _Requirements: 4.3, 4.5, 4.6, 4.7, 4.8_
  
  - [~] 5.4 Create /tenant/maintenance page
    - Create page.tsx file following existing dashboard pattern
    - Display maintenance requests submitted by tenant
    - Include TopBar component
    - Add `useLanguage` hook and connect to Translation_System
    - _Requirements: 4.4, 4.5, 4.6, 4.7, 4.8_
  
  - [~] 5.5 Connect existing tenant dashboard to Translation_System
    - Update /tenant/dashboard/page.tsx with `useLanguage` hook
    - Extend translation files with tenant dashboard keys
    - _Requirements: 1.5, 1.8, 1.11_

- [ ] 6. Create missing landlord dashboard pages
  - [~] 6.1 Create /landlord/properties page
    - Create page.tsx file following existing dashboard pattern
    - Display all properties owned by logged-in landlord
    - Show edit and status management options for each property
    - Include TopBar component
    - Add `useLanguage` hook and connect to Translation_System
    - _Requirements: 5.1, 5.5, 5.6, 5.7, 5.8, 5.9_
  
  - [~] 6.2 Create /landlord/properties/new page with form
    - Create page.tsx file with property creation form
    - Require title, location, price, bedrooms, bathrooms, description fields
    - Add photo upload interface for property images
    - Implement verification status guard (redirect if not verified)
    - Add `useLanguage` hook and connect to Translation_System
    - _Requirements: 5.2, 5.3, 5.6, 5.7, 5.9_
  
  - [~] 6.3 Create /landlord/tenants page
    - Create page.tsx file following existing dashboard pattern
    - Display all current and past tenants of landlord's properties
    - Include TopBar component
    - Add `useLanguage` hook and connect to Translation_System
    - _Requirements: 5.3, 5.6, 5.7, 5.8, 5.9_
  
  - [~] 6.4 Create /landlord/rent-payments page
    - Create page.tsx file following existing dashboard pattern
    - Display rent payment status for all landlord's properties
    - Include TopBar component
    - Add `useLanguage` hook and connect to Translation_System
    - _Requirements: 5.4, 5.6, 5.7, 5.8, 5.9_
  
  - [~] 6.5 Create /landlord/maintenance page
    - Create page.tsx file following existing dashboard pattern
    - Display maintenance requests for landlord's properties
    - Include TopBar component
    - Add `useLanguage` hook and connect to Translation_System
    - _Requirements: 5.5, 5.6, 5.7, 5.8, 5.9_
  
  - [~] 6.6 Connect existing landlord dashboard to Translation_System
    - Update /landlord/dashboard/page.tsx with `useLanguage` hook
    - Extend translation files with landlord dashboard keys
    - _Requirements: 1.6, 1.8, 1.11_

- [~] 7. Checkpoint - Test dashboard pages
  - Verify all tenant sidebar links navigate without 404 errors
  - Verify all landlord sidebar links navigate without 404 errors
  - Test language switching on all dashboard pages
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Implement landlord verification workflow
  - [-] 8.1 Extend user model with verification fields
    - Update lib/auth-db.ts User interface with verificationStatus, verificationDocuments, rejectionReason
    - Update lib/auth-context.tsx to export VerificationStatus type
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_
  
  - [~] 8.2 Create /landlord/verification-status page
    - Create page.tsx file with verification status display
    - Show different UI based on status (unverified, pending, verified, rejected)
    - Provide document upload interface for identification and property documents
    - Add resubmit button when status is rejected
    - Include rejection reason display when rejected
    - Add `useLanguage` hook and connect to Translation_System
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.9_
  
  - [~] 8.3 Add verification guard to /landlord/properties/new
    - Check if landlord verificationStatus is "verified"
    - Redirect to /landlord/verification-status if not verified
    - Display informational message about verification requirement
    - _Requirements: 6.7, 6.8_

- [ ] 9. Implement admin verification queue
  - [~] 9.1 Create verification management functions in lib/admin.ts
    - Write `getAllPendingVerifications()` function
    - Write `approveVerification(userId)` function
    - Write `rejectVerification(userId, reason)` function
    - Update user verificationStatus in auth-db
    - _Requirements: 7.1, 7.6, 7.7, 7.8_
  
  - [~] 9.2 Create /admin/verification-queue page
    - Create page.tsx file following existing dashboard pattern
    - Display all pending landlord verifications
    - Show landlord name, email, submission date, and documents
    - Add document viewer interface
    - Provide Approve button for each request
    - Provide Reject button with reason text input
    - Remove request from display after approval/rejection
    - Include TopBar component
    - Add `useLanguage` hook and connect to Translation_System
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9_
  
  - [~] 9.3 Connect existing admin dashboard pages to Translation_System
    - Update /admin/dashboard/page.tsx with `useLanguage` hook
    - Extend translation files with admin dashboard keys
    - _Requirements: 1.7, 1.8, 1.11_

- [ ] 10. Implement property CRUD operations
  - [ ] 10.1 Create property validation utility
    - Write `validatePropertyForm()` function in lib/propertyValidation.ts
    - Validate required fields (title, location, price, bedrooms, bathrooms, description)
    - Return array of validation errors
    - _Requirements: 8.2, 8.10_
  
  - [ ]* 10.2 Write unit tests for property validation
    - Test validation of required fields
    - Test price must be positive
    - Test valid form returns empty errors array
    - _Requirements: 8.2, 8.10_
  
  - [~] 10.3 Implement property creation in /landlord/properties/new
    - Handle form submission with validation
    - Store new property in lib/property-db.ts (in-memory)
    - Handle property photo uploads and storage
    - Display validation errors to user
    - _Requirements: 8.1, 8.2, 8.3, 8.4_
  
  - [~] 10.4 Implement property editing
    - Add edit route /landlord/properties/[id]/edit/page.tsx
    - Pre-fill form with current property data
    - Update property in lib/property-db.ts on submit
    - _Requirements: 8.5, 8.6, 8.7_
  
  - [~] 10.5 Implement property status management
    - Add status toggle in /landlord/properties page
    - Update property status (active/inactive) in lib/property-db.ts
    - Exclude inactive properties from tenant search results
    - _Requirements: 8.8, 8.9_

- [ ] 11. Implement advanced search filters on explore page
  - [~] 11.1 Create filter UI components
    - Add filter controls for neighborhood, property type, price range, bedrooms
    - Place filters on explore page following existing design patterns
    - Connect filter labels to Translation_System
    - _Requirements: 9.1, 9.8_
  
  - [~] 11.2 Implement filter application logic
    - Apply neighborhood filter (exact match)
    - Apply property type filter (exact match)
    - Apply price range filter (min/max)
    - Apply bedroom count filter (exact match)
    - Support multiple simultaneous filters with AND logic
    - Add clear all filters functionality
    - Ensure filter updates complete within 300ms
    - _Requirements: 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.9_

- [ ] 12. Fix all navigation links
  - [~] 12.1 Verify tenant sidebar links
    - Audit all tenant Sidebar component links
    - Ensure all links point to existing pages
    - Test navigation to applications, payments, messages, maintenance pages
    - _Requirements: 10.1, 10.5_
  
  - [~] 12.2 Verify landlord sidebar links
    - Audit all landlord Sidebar component links
    - Ensure all links point to existing pages
    - Test navigation to properties, tenants, rent-payments, maintenance pages
    - _Requirements: 10.2, 10.5_
  
  - [~] 12.3 Verify admin sidebar links
    - Audit all admin Sidebar component links
    - Ensure all links point to existing pages
    - Test navigation to verification-queue and all admin pages
    - _Requirements: 10.3, 10.5_
  
  - [~] 12.4 Verify TopNav links
    - Audit all TopNav component links
    - Ensure all links navigate to existing pages
    - Test Home and Logout button functionality
    - _Requirements: 10.4, 10.5, 10.6, 10.7_
  
  - [~] 12.5 Validate route definitions
    - Audit all route definitions in app directory
    - Ensure each route has corresponding page file
    - Test all navigation elements for successful page load
    - _Requirements: 10.8, 10.9_

- [ ] 13. Final integration and testing
  - [ ]* 13.1 Write integration tests for key user flows
    - Test complete search and filter workflow
    - Test property detail navigation flow
    - Test landlord verification workflow
    - Test property creation and management
    - _Requirements: All_
  
  - [~] 13.2 Verify all translation keys are present
    - Check all new pages have complete translation entries
    - Test language switching on every page
    - Verify Amharic translations are preserved
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11_
  
  - [~] 13.3 Perform end-to-end navigation testing
    - Click through every navigation link in all user roles
    - Verify no 404 errors occur
    - Verify authentication redirects work correctly
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9_
  
  - [~] 13.4 Test performance requirements
    - Verify search results appear within 500ms
    - Verify filter updates complete within 300ms
    - _Requirements: 2.7, 9.9_

- [~] 14. Final checkpoint - Comprehensive testing
  - Run all unit tests and integration tests
  - Test all features with both English and Amharic languages
  - Verify all dashboard pages are accessible and functional
  - Confirm landlord verification workflow works end-to-end
  - Ensure all navigation links work for all user roles
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional test tasks and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation throughout implementation
- All pages follow existing Next.js/React/TypeScript patterns with Tailwind CSS
- Translation system uses `useLanguage` hook from lib/language-context.tsx
- Authentication system remains unchanged (lib/auth-context.tsx)
- Property data stored in-memory in lib files (not persistent)
- All styling uses Tailwind CSS consistent with existing design system

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "8.1", "10.1"] },
    { "id": 1, "tasks": ["2.1", "2.2", "4.1", "8.2"] },
    { "id": 2, "tasks": ["2.3", "2.4", "2.5", "4.2", "4.3", "5.1", "5.2", "5.3", "5.4", "6.1", "8.3", "9.1", "10.2"] },
    { "id": 3, "tasks": ["5.5", "6.2", "6.3", "6.4", "6.5", "9.2", "10.3"] },
    { "id": 4, "tasks": ["6.6", "9.3", "10.4", "10.5", "11.1"] },
    { "id": 5, "tasks": ["11.2", "12.1", "12.2", "12.3", "12.4", "12.5"] },
    { "id": 6, "tasks": ["13.1", "13.2", "13.3", "13.4"] }
  ]
}
```
