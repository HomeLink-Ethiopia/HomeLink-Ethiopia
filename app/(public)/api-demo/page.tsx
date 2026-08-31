'use client'

import { useState, useEffect } from 'react'
import {
  fetchProperties,
  submitPropertyListing,
  submitViewingRequest,
  submitApplication,
  submitMaintenanceRequest,
  submitFraudReport,
  submitDispute,
} from '@/services/api'
import type {
  Property,
  VerificationRecord,
  ViewingRequestRecord,
  ApplicationRecord,
  MaintenanceRequestRecord,
  FraudReportRecord,
  DisputeRecord,
} from '@/services/api'

export default function APIDemoPage() {
  const [activeTab, setActiveTab] = useState<'properties' | 'forms' | 'status'>('properties')
  const [mockMode, setMockMode] = useState(true)
  const [debugMode, setDebugMode] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<any>(null)
  const [properties, setProperties] = useState<Property[]>([])

  useEffect(() => {
    setMockMode(process.env.NEXT_PUBLIC_MOCK_MODE !== 'false')
    setDebugMode(process.env.NEXT_PUBLIC_DEBUG_MODE === 'true')
  }, [])

  const handleFetchProperties = async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const props = await fetchProperties({ verifiedOnly: true })
      setProperties(props)
      setResult({
        action: 'Fetched Properties',
        count: props.length,
        data: props.slice(0, 3),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch properties')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitProperty = async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const result = await submitPropertyListing({
        title: 'Demo Apartment - Modern & Spacious',
        neighborhood: 'Bole',
        address: '123 Demo Street, Addis Ababa',
        propertyType: 'apartment',
        beds: 2,
        baths: 1,
        sizeSqm: 85,
        priceEtb: 12000,
        depositEtb: 6000,
        amenities: ['WiFi', 'Parking', 'Water Tank'],
        description: 'Beautiful 2-bedroom apartment in prime location',
        photoUrls: ['https://via.placeholder.com/400x300?text=Bedroom'],
        ownershipDocUrl: 'https://via.placeholder.com/400x300?text=Ownership+Doc',
        landlordIdDocUrl: 'https://via.placeholder.com/400x300?text=ID+Doc',
      })
      setResult({
        action: 'Property Listing Submitted',
        id: result.id,
        status: result.status,
        timestamp: result.submittedAt,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit property')
    } finally {
      setLoading(false)
    }
  }

  const handleViewingRequest = async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const result = await submitViewingRequest({
        propertyId: 'prop-001',
        preferredDate: '2024-12-25',
        preferredTime: '14:00',
        note: 'Demo viewing request',
      })
      setResult({
        action: 'Viewing Request Submitted',
        id: result.id,
        status: result.status,
        propertyId: result.propertyId,
        date: result.preferredDate,
        time: result.preferredTime,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit viewing request')
    } finally {
      setLoading(false)
    }
  }

  const handleApplicationSubmit = async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const result = await submitApplication({
        propertyId: 'prop-001',
        fullName: 'Demo User',
        phone: '+251911234567',
        email: 'demo@example.com',
        employmentStatus: 'employed',
        monthlyIncomeEtb: 50000,
        moveInDate: '2024-12-25',
        note: 'Demo rental application',
      })
      setResult({
        action: 'Application Submitted',
        id: result.id,
        status: result.status,
        name: result.fullName,
        email: result.email,
        timestamp: result.submittedAt,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit application')
    } finally {
      setLoading(false)
    }
  }

  const handleMaintenanceRequest = async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const result = await submitMaintenanceRequest({
        propertyId: 'prop-001',
        category: 'plumbing',
        priority: 'high',
        description: 'Demo maintenance request - leaking tap',
        mediaUrls: ['https://via.placeholder.com/300x200?text=Issue+Photo'],
      })
      setResult({
        action: 'Maintenance Request Submitted',
        id: result.id,
        status: result.status,
        category: result.category,
        priority: result.priority,
        timestamp: result.submittedAt,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit maintenance request')
    } finally {
      setLoading(false)
    }
  }

  const handleFraudReport = async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const result = await submitFraudReport({
        propertyId: 'prop-999',
        reason: 'fake_photos',
        details: 'Demo fraud report - photos do not match actual property',
        reporterEmail: 'reporter@example.com',
      })
      setResult({
        action: 'Fraud Report Submitted',
        id: result.id,
        status: result.status,
        reason: result.reason,
        timestamp: result.submittedAt,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit fraud report')
    } finally {
      setLoading(false)
    }
  }

  const handleDispute = async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const result = await submitDispute({
        propertyId: 'prop-001',
        category: 'deposit',
        description: 'Demo dispute - landlord refusing to return deposit',
      })
      setResult({
        action: 'Dispute Filed',
        id: result.id,
        status: result.status,
        category: result.category,
        timestamp: result.submittedAt,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to file dispute')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">🚀 API Integration Demo</h1>
          <p className="text-lg text-gray-600">Live API integration showcase for HomeLink Ethiopia</p>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {/* Mock Mode Status */}
          <div className={`p-6 rounded-lg shadow-lg ${mockMode ? 'bg-yellow-50 border-2 border-yellow-300' : 'bg-green-50 border-2 border-green-300'}`}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-bold text-gray-900">Mode</h3>
              <span className={`px-3 py-1 rounded-full text-sm font-semibold ${mockMode ? 'bg-yellow-200 text-yellow-900' : 'bg-green-200 text-green-900'}`}>
                {mockMode ? '🧪 Mock' : '🔗 Real API'}
              </span>
            </div>
            <p className="text-sm text-gray-600">
              {mockMode ? 'Using local test data' : 'Connected to backend'}
            </p>
          </div>

          {/* API URL Status */}
          <div className="p-6 rounded-lg shadow-lg bg-blue-50 border-2 border-blue-300">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-bold text-gray-900">API URL</h3>
              <span className="px-3 py-1 rounded-full text-sm font-semibold bg-blue-200 text-blue-900">
                {process.env.NEXT_PUBLIC_API_URL || 'localhost:3001'}
              </span>
            </div>
            <p className="text-sm text-gray-600">Backend endpoint</p>
          </div>

          {/* Debug Mode Status */}
          <div className={`p-6 rounded-lg shadow-lg ${debugMode ? 'bg-purple-50 border-2 border-purple-300' : 'bg-gray-50 border-2 border-gray-300'}`}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-bold text-gray-900">Debug</h3>
              <span className={`px-3 py-1 rounded-full text-sm font-semibold ${debugMode ? 'bg-purple-200 text-purple-900' : 'bg-gray-200 text-gray-900'}`}>
                {debugMode ? '✓ Enabled' : '✗ Disabled'}
              </span>
            </div>
            <p className="text-sm text-gray-600">Console logging {debugMode ? 'ON' : 'OFF'}</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-4 mb-8">
          <button
            onClick={() => setActiveTab('properties')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all ${
              activeTab === 'properties'
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-indigo-300'
            }`}
          >
            📋 Properties
          </button>
          <button
            onClick={() => setActiveTab('forms')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all ${
              activeTab === 'forms'
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-indigo-300'
            }`}
          >
            📝 Submit Forms
          </button>
          <button
            onClick={() => setActiveTab('status')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all ${
              activeTab === 'status'
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-indigo-300'
            }`}
          >
            ✓ Integration Status
          </button>
        </div>

        {/* Content */}
        <div className="bg-white rounded-xl shadow-2xl p-8">
          {/* Properties Tab */}
          {activeTab === 'properties' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Properties Management</h2>

              <button
                onClick={handleFetchProperties}
                disabled={loading}
                className="mb-6 px-6 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-gray-400 transition-all"
              >
                {loading ? '⏳ Loading...' : '🔍 Fetch Properties'}
              </button>

              {properties.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">
                    Found {properties.length} Properties
                  </h3>
                  <div className="grid gap-4">
                    {properties.slice(0, 3).map((prop) => (
                      <div key={prop.id} className="p-4 border-2 border-gray-200 rounded-lg hover:border-indigo-400 transition-all">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="text-lg font-bold text-gray-900">{prop.title}</h4>
                          <span className="px-3 py-1 bg-green-100 text-green-900 rounded-full text-sm font-semibold">
                            ✓ Verified
                          </span>
                        </div>
                        <p className="text-gray-600 mb-2">{prop.neighborhood} • {prop.beds} beds • {prop.baths} baths</p>
                        <p className="text-indigo-600 font-bold text-lg">ETB {prop.priceEtb.toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Forms Tab */}
          {activeTab === 'forms' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Submit API Requests</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <button
                  onClick={handleSubmitProperty}
                  disabled={loading}
                  className="p-4 bg-blue-50 border-2 border-blue-300 rounded-lg hover:bg-blue-100 transition-all disabled:opacity-50"
                >
                  <div className="font-bold text-lg text-blue-900 mb-1">📍 Submit Property</div>
                  <div className="text-sm text-blue-700">List a new property for verification</div>
                </button>

                <button
                  onClick={handleViewingRequest}
                  disabled={loading}
                  className="p-4 bg-green-50 border-2 border-green-300 rounded-lg hover:bg-green-100 transition-all disabled:opacity-50"
                >
                  <div className="font-bold text-lg text-green-900 mb-1">👁️ Request Viewing</div>
                  <div className="text-sm text-green-700">Request property viewing appointment</div>
                </button>

                <button
                  onClick={handleApplicationSubmit}
                  disabled={loading}
                  className="p-4 bg-purple-50 border-2 border-purple-300 rounded-lg hover:bg-purple-100 transition-all disabled:opacity-50"
                >
                  <div className="font-bold text-lg text-purple-900 mb-1">📋 Submit Application</div>
                  <div className="text-sm text-purple-700">Apply for property rental</div>
                </button>

                <button
                  onClick={handleMaintenanceRequest}
                  disabled={loading}
                  className="p-4 bg-orange-50 border-2 border-orange-300 rounded-lg hover:bg-orange-100 transition-all disabled:opacity-50"
                >
                  <div className="font-bold text-lg text-orange-900 mb-1">🔧 Maintenance Request</div>
                  <div className="text-sm text-orange-700">Report maintenance issue</div>
                </button>

                <button
                  onClick={handleFraudReport}
                  disabled={loading}
                  className="p-4 bg-red-50 border-2 border-red-300 rounded-lg hover:bg-red-100 transition-all disabled:opacity-50"
                >
                  <div className="font-bold text-lg text-red-900 mb-1">⚠️ Report Fraud</div>
                  <div className="text-sm text-red-700">Report suspicious activity</div>
                </button>

                <button
                  onClick={handleDispute}
                  disabled={loading}
                  className="p-4 bg-yellow-50 border-2 border-yellow-300 rounded-lg hover:bg-yellow-100 transition-all disabled:opacity-50"
                >
                  <div className="font-bold text-lg text-yellow-900 mb-1">⚖️ File Dispute</div>
                  <div className="text-sm text-yellow-700">File tenant-landlord dispute</div>
                </button>
              </div>
            </div>
          )}

          {/* Status Tab */}
          {activeTab === 'status' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Integration Status</h2>

              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border-l-4 border-green-500">
                  <span className="text-2xl">✅</span>
                  <div>
                    <div className="font-bold text-green-900">HTTP Client</div>
                    <div className="text-sm text-green-700">Fully implemented with retry logic & error handling</div>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border-l-4 border-green-500">
                  <span className="text-2xl">✅</span>
                  <div>
                    <div className="font-bold text-green-900">API Configuration</div>
                    <div className="text-sm text-green-700">25+ endpoints defined and organized</div>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border-l-4 border-green-500">
                  <span className="text-2xl">✅</span>
                  <div>
                    <div className="font-bold text-green-900">API Service</div>
                    <div className="text-sm text-green-700">9 functions support real & mock API modes</div>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border-l-4 border-green-500">
                  <span className="text-2xl">✅</span>
                  <div>
                    <div className="font-bold text-green-900">Environment Setup</div>
                    <div className="text-sm text-green-700">Configuration ready (mock/real modes)</div>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border-l-4 border-green-500">
                  <span className="text-2xl">✅</span>
                  <div>
                    <div className="font-bold text-green-900">Type Safety</div>
                    <div className="text-sm text-green-700">Full TypeScript support with interfaces</div>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border-l-4 border-green-500">
                  <span className="text-2xl">✅</span>
                  <div>
                    <div className="font-bold text-green-900">Error Handling</div>
                    <div className="text-sm text-green-700">Automatic retry, timeout, fallback mechanisms</div>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border-l-4 border-green-500">
                  <span className="text-2xl">✅</span>
                  <div>
                    <div className="font-bold text-green-900">Documentation</div>
                    <div className="text-sm text-green-700">3000+ lines with guides & examples</div>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-indigo-50 border-2 border-indigo-300 rounded-lg">
                <h3 className="text-xl font-bold text-indigo-900 mb-3">🎯 Ready for Production</h3>
                <ul className="space-y-2 text-indigo-700">
                  <li>✓ Switch between mock & real API with one variable</li>
                  <li>✓ Automatic fallback to mock if API is offline</li>
                  <li>✓ Retry logic with exponential backoff</li>
                  <li>✓ Timeout management (30s default)</li>
                  <li>✓ Debug logging support</li>
                  <li>✓ Zero additional dependencies</li>
                </ul>
              </div>
            </div>
          )}

          {/* Results Section */}
          {result && (
            <div className="mt-8 p-6 bg-green-50 border-2 border-green-300 rounded-lg">
              <h3 className="text-lg font-bold text-green-900 mb-4">✓ Success Response</h3>
              <pre className="bg-white p-4 rounded border-l-4 border-green-500 overflow-auto text-sm">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}

          {/* Error Section */}
          {error && (
            <div className="mt-8 p-6 bg-red-50 border-2 border-red-300 rounded-lg">
              <h3 className="text-lg font-bold text-red-900 mb-4">✗ Error</h3>
              <p className="text-red-700 font-mono">{error}</p>
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="mt-8 p-6 bg-gray-900 text-white rounded-lg">
          <h3 className="text-lg font-bold mb-3">📚 How to Use This Demo</h3>
          <ul className="space-y-2 text-sm">
            <li>✓ Switch tabs to try different API operations</li>
            <li>✓ Click buttons to make API requests in real-time</li>
            <li>✓ See responses displayed below each request</li>
            <li>✓ Open DevTools (F12) → Console to see debug logs (when enabled)</li>
            <li>✓ Check Network tab to monitor HTTP requests</li>
          </ul>
        </div>

        {/* Quick Links */}
        <div className="mt-8 p-6 bg-indigo-50 border-2 border-indigo-300 rounded-lg">
          <h3 className="text-lg font-bold text-indigo-900 mb-3">📖 Documentation</h3>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <li>
              <a href="/docs/API_INTEGRATION.md" className="text-indigo-600 hover:text-indigo-900 font-semibold">
                → Complete API Guide
              </a>
            </li>
            <li>
              <a href="/docs/API_QUICK_REFERENCE.md" className="text-indigo-600 hover:text-indigo-900 font-semibold">
                → Quick Reference
              </a>
            </li>
            <li>
              <a href="/API_SETUP_COMPLETE.md" className="text-indigo-600 hover:text-indigo-900 font-semibold">
                → Setup Details
              </a>
            </li>
            <li>
              <a href="/docs/ARCHITECTURE.md" className="text-indigo-600 hover:text-indigo-900 font-semibold">
                → Architecture
              </a>
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
