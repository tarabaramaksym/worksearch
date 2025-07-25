import { useState, useMemo, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import './Filters.css'

function Filters() {
  const { 
    filters, 
    filterOptions,
    setFilter, 
    toggleFilterItem, 
    resetFilters,
    resultCount
  } = useApp()
  
  const [collapsedSections, setCollapsedSections] = useState({
    companies: true,
    locations: true,
    websites: true
  })
  const [showAllSections, setShowAllSections] = useState({})
  const [sectionSearches, setSectionSearches] = useState({})

  useEffect(() => {
    if (filterOptions.tagCategories) {
      const newCollapsedSections = {}
      Object.keys(filterOptions.tagCategories).forEach(category => {
        if (collapsedSections[category] === undefined) {
          newCollapsedSections[category] = true
        }
      })
      if (Object.keys(newCollapsedSections).length > 0) {
        setCollapsedSections(prev => ({
          ...prev,
          ...newCollapsedSections
        }))
      }
    }
  }, [filterOptions.tagCategories])

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

  const toggleSection = (section) => {
    setCollapsedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  const handleSearchChange = (e) => {
    setFilter('search', e.target.value)
  }

  const handleAppliedChange = (e) => {
    setFilter('applied', e.target.value)
  }

  const handleDateRangeChange = (e) => {
    setFilter('dateRange', e.target.value)
  }

  const handleCustomDateChange = (type, value) => {
    setFilter(type, value)
  }

  const toggleShowAll = (filterType) => {
    setShowAllSections(prev => ({
      ...prev,
      [filterType]: !prev[filterType]
    }))
  }

  const handleSectionSearch = (filterType, searchTerm) => {
    setSectionSearches(prev => ({
      ...prev,
      [filterType]: searchTerm
    }))
  }

  const renderFilterSection = (title, filterType, items, limit = 10) => {
    const isCollapsed = collapsedSections[filterType]
    const selectedItems = filters[filterType] || []
    const showAll = showAllSections[filterType] || false
    const sectionSearch = sectionSearches[filterType] || ''
    const filteredItems = sectionSearch 
      ? items.filter(item => item.toLowerCase().includes(sectionSearch.toLowerCase()))
      : items
    const displayItems = showAll ? filteredItems : filteredItems.slice(0, limit)
    const hasMore = filteredItems.length > limit

    if (items.length === 0) return null

    return (
      <div className="filter-section">
        <div 
          className="filter-section-header"
          onClick={() => toggleSection(filterType)}
        >
          <h3>{title}</h3>
          <span className={`toggle-icon ${isCollapsed ? 'collapsed' : ''}`}>▼</span>
        </div>
        {!isCollapsed && (
          <div className="filter-section-content">
            <div className="section-search">
              <input
                type="text"
                placeholder={`Search ${title.toLowerCase()}...`}
                value={sectionSearch}
                onChange={(e) => handleSectionSearch(filterType, e.target.value)}
                className="section-search-input"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            <div className="filter-items">
              {displayItems.map(item => {
                const isSelected = selectedItems.includes(item)
                return (
                  <div 
                    key={item}
                    className={`filter-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => toggleFilterItem(filterType, item)}
                  >
                    <label className="filter-label">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="filter-checkbox"
                      />
                      <span className="filter-text">{item}</span>
                    </label>
                  </div>
                )
              })}
            </div>
            {hasMore && (
              <button 
                className="show-more-btn"
                onClick={() => toggleShowAll(filterType)}
              >
                {showAll ? 'Show Less' : `Show ${filteredItems.length - limit} More`}
              </button>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="filters">
      <div className="filters-header">
        <div className="filters-title">
          <h2>Filters</h2>
          <span className="result-count">
            {resultCount} {resultCount === 1 ? 'job' : 'jobs'}
          </span>
        </div>
        {hasActiveFilters && (
          <button 
            className="clear-filters-btn"
            onClick={resetFilters}
          >
            Clear All
          </button>
        )}
      </div>
      <div className="filters-content">
        <div className="filter-section">
          <div className="search-container">
            <input
              type="text"
              placeholder="Search jobs..."
              value={filters.search}
              onChange={handleSearchChange}
              className="search-input"
            />
            <span className="search-icon">🔍</span>
          </div>
        </div>
        <div className="filter-section">
          <h3>Quick Filters</h3>
          <div className="quick-filters">
            <select 
              value={filters.applied} 
              onChange={handleAppliedChange}
              className="filter-select"
            >
              <option value="all">All Applications</option>
              <option value="not_applied">Not Applied</option>
              <option value="applied">Applied</option>
            </select>
            <select 
              value={filters.dateRange} 
              onChange={handleDateRangeChange}
              className="filter-select"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">Last Week</option>
              <option value="month">Last Month</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>
          {filters.dateRange === 'custom' && (
            <div className="custom-date-range">
              <input
                type="date"
                value={filters.customDateStart}
                onChange={(e) => handleCustomDateChange('customDateStart', e.target.value)}
                className="date-input"
              />
              <span>to</span>
              <input
                type="date"
                value={filters.customDateEnd}
                onChange={(e) => handleCustomDateChange('customDateEnd', e.target.value)}
                className="date-input"
              />
            </div>
          )}
        </div>
        {filterOptions.tagCategories && Object.entries(filterOptions.tagCategories).map(([category, tags]) => {
			const categoryTitle = category.charAt(0).toUpperCase() + category.slice(1).replace(/_/g, ' ')
			return (
				<div key={category}>
              {renderFilterSection(categoryTitle, category, tags, 10)}
            </div>
          )
        })}
		{renderFilterSection('Companies', 'companies', filterOptions.companies)}
		{renderFilterSection('Locations', 'locations', filterOptions.locations)}
        {renderFilterSection('Websites', 'websites', filterOptions.websites)}
      </div>
    </div>
  )
}

export default Filters 