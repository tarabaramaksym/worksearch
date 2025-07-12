import { useMemo } from 'react'
import { useApp } from '../context/AppContext'
import JobCard from './JobCard'
import './JobList.css'

function JobList({ jobs }) {
  const { filterJobs, filters } = useApp()
  
  // Filter jobs based on current filters
  const filteredJobs = useMemo(() => {
    return filterJobs(jobs)
  }, [jobs, filterJobs])

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return (
      filters.search ||
      filters.companies.length > 0 ||
      filters.locations.length > 0 ||
      filters.tags.length > 0 ||
      filters.websites.length > 0 ||
      filters.applied !== 'all' ||
      filters.dateRange !== 'all'
    )
  }, [filters])

  if (!jobs || jobs.length === 0) {
    return (
      <div className="job-list-empty">
        <div className="empty-state">
          <span className="empty-icon">📋</span>
          <h3>No jobs available</h3>
          <p>Check back later for new opportunities!</p>
        </div>
      </div>
    )
  }

  if (filteredJobs.length === 0) {
    return (
      <div className="job-list-empty">
        <div className="empty-state">
          <span className="empty-icon">🔍</span>
          <h3>No jobs match your filters</h3>
          <p>Try adjusting your search criteria to see more results.</p>
          {hasActiveFilters && (
            <button 
              className="clear-filters-suggestion"
              onClick={() => window.location.reload()} // This will trigger filter reset
            >
              Clear all filters
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="job-list">
      <div className="job-list-header">
        <h2>
          {filteredJobs.length} {filteredJobs.length === 1 ? 'Job' : 'Jobs'}
          {hasActiveFilters && <span className="filtered-indicator">filtered</span>}
        </h2>
      </div>
      
      <div className="job-list-content">
        {filteredJobs.map((job) => (
          <JobCard key={job.entity_id} job={job} />
        ))}
      </div>
    </div>
  )
}

export default JobList 