import { useMemo } from 'react'
import { useApp } from '@context/AppContext'
import JobCard from '@components/JobCard/JobCard'
import VirtualizeOnView from '@components/VirtualizeOnView/VirtualizeOnView'
import './JobList.css'

function JobList() {
  const { jobs, filters, filterOptions, resetFilters, resultCount } = useApp()
  
  const hasActiveFilters = useMemo(() => {
    const basicFilters = (
      filters.search ||
      filters.companies.length > 0 ||
      filters.locations.length > 0 ||
      filters.websites.length > 0 ||
      filters.applied !== 'all' ||
      filters.dateRange !== 'all'
    )
    const tagCategoryFilters = filterOptions.tagCategories ? 
      Object.keys(filterOptions.tagCategories).some(category => 
        filters[category] && filters[category].length > 0
      ) : false
    return basicFilters || tagCategoryFilters
  }, [filters, filterOptions.tagCategories])

  if (!jobs || jobs.length === 0) {
    if (hasActiveFilters) {
      return (
        <div className="job-list-empty">
          <div className="empty-state">
            <span className="empty-icon">🔍</span>
            <h3>No jobs match your filters</h3>
            <p>Try adjusting your search criteria to see more results.</p>
            <button 
              className="clear-filters-suggestion"
              onClick={resetFilters}
            >
              Clear all filters
            </button>
          </div>
        </div>
      )
    }
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

  return (
    <div className="job-list">
      <div className="job-list-header">
        <h2>
          {resultCount} {resultCount === 1 ? 'Job' : 'Jobs'}
          {hasActiveFilters && <span className="filtered-indicator">filtered</span>}
        </h2>
      </div>
      <div className="job-list-content">
        {jobs.map((job) => (
          <VirtualizeOnView key={job.entity_id} placeholder={<div style={{height: 305}} />} offset={300}>
            <JobCard job={job} />
          </VirtualizeOnView>
        ))}
      </div>
    </div>
  )
}

export default JobList 