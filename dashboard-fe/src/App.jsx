import { useState, useEffect } from 'react'
import { AppProvider, useApp } from './context/AppContext'
import JobList from './components/JobList'
import Analytics from './components/Analytics'
import Filters from './components/Filters'
import ViewSwitcher from './components/ViewSwitcher'
import './App.css'

/**
 * Main App Layout Component
 */
function AppLayout({ jobs }) {
  const { currentView } = useApp()

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <div className="header-left">
          <h1>Job Dashboard</h1>
          <span className="job-count">{jobs.length} opportunities</span>
        </div>
        
        <div className="header-right">
          <ViewSwitcher />
        </div>
      </header>

      {/* Main Content */}
      <main className="app-main">
        {/* Filters Sidebar */}
        <aside className="app-sidebar">
          <Filters jobs={jobs} />
        </aside>

        {/* Content Area with Sliding Views */}
        <div className="app-content">
          <div 
            className="content-slider"
            style={{
              transform: `translateX(${currentView === 'analytics' ? '-50%' : '0%'})`
            }}
          >
            {/* Jobs View */}
            <div className="content-panel jobs-panel">
              <JobList jobs={jobs} />
            </div>

            {/* Analytics View */}
            <div className="content-panel analytics-panel">
              <Analytics jobs={jobs} />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

/**
 * App Component with Context Provider
 */
function App() {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchJobs()
  }, [])

  const fetchJobs = async () => {
    try {
      setLoading(true)
      const response = await fetch('http://localhost:3000/api/jobs')
      if (!response.ok) {
        throw new Error('Failed to fetch jobs')
      }
      const data = await response.json()
      setJobs(data.jobs)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="app">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading job opportunities...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="app">
        <div className="error-container">
          <span className="error-icon">⚠️</span>
          <h3>Unable to load jobs</h3>
          <p>{error}</p>
          <button onClick={fetchJobs} className="retry-btn">
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <AppProvider jobs={jobs}>
      <AppLayout jobs={jobs} />
    </AppProvider>
  )
}

export default App
