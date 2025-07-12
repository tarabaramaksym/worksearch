import { createContext, useContext, useReducer, useMemo } from 'react'

const AppContext = createContext()

// Initial state
const initialState = {
  // UI State
  currentView: 'jobs', // 'jobs' or 'analytics'
  
  // Filters
  filters: {
    search: '',
    companies: [],
    locations: [],
    tags: [],
    websites: [],
    applied: 'all', // 'all', 'applied', 'not_applied'
    dateRange: 'all', // 'all', 'today', 'week', 'month', 'custom'
    customDateStart: '',
    customDateEnd: ''
  }
}

// Actions
const actions = {
  SET_VIEW: 'SET_VIEW',
  SET_FILTER: 'SET_FILTER',
  RESET_FILTERS: 'RESET_FILTERS',
  TOGGLE_FILTER_ITEM: 'TOGGLE_FILTER_ITEM'
}

// Reducer
function appReducer(state, action) {
  switch (action.type) {
    case actions.SET_VIEW:
      return {
        ...state,
        currentView: action.payload
      }
      
    case actions.SET_FILTER:
      return {
        ...state,
        filters: {
          ...state.filters,
          [action.payload.key]: action.payload.value
        }
      }
      
    case actions.TOGGLE_FILTER_ITEM:
      const { filterType, item } = action.payload
      const currentItems = state.filters[filterType]
      const isSelected = currentItems.includes(item)
      
      return {
        ...state,
        filters: {
          ...state.filters,
          [filterType]: isSelected
            ? currentItems.filter(i => i !== item)
            : [...currentItems, item]
        }
      }
      
    case actions.RESET_FILTERS:
      return {
        ...state,
        filters: initialState.filters
      }
      
    default:
      return state
  }
}

/**
 * App Context Provider
 */
export function AppProvider({ children, jobs = [] }) {
  const [state, dispatch] = useReducer(appReducer, initialState)
  
  // Calculate filter options from jobs data
  const filterOptions = useMemo(() => {
    if (!jobs || jobs.length === 0) {
      return {
        companies: [],
        locations: [],
        tags: [],
        websites: []
      }
    }

    const companies = new Set()
    const locations = new Set()
    const tags = new Set()
    const websites = new Set()

    jobs.forEach(job => {
      // Companies
      if (job.company_name) {
        companies.add(job.company_name)
      }

      // Locations
      if (job.locations && Array.isArray(job.locations)) {
        job.locations.forEach(location => {
          if (location) locations.add(location)
        })
      }

      // Tags
      if (job.tags && Array.isArray(job.tags)) {
        job.tags.forEach(tag => {
          if (tag.name) tags.add(tag.name)
        })
      }

      // Websites
      if (job.website_name) {
        websites.add(job.website_name)
      }
    })

    return {
      companies: Array.from(companies).sort(),
      locations: Array.from(locations).sort(),
      tags: Array.from(tags).sort(),
      websites: Array.from(websites).sort()
    }
  }, [jobs])
  
  // Action creators
  const setView = (view) => {
    dispatch({ type: actions.SET_VIEW, payload: view })
  }
  
  const setFilter = (key, value) => {
    dispatch({ type: actions.SET_FILTER, payload: { key, value } })
  }
  
  const toggleFilterItem = (filterType, item) => {
    dispatch({ type: actions.TOGGLE_FILTER_ITEM, payload: { filterType, item } })
  }
  
  const resetFilters = () => {
    dispatch({ type: actions.RESET_FILTERS })
  }
  
  // Note: filterOptions are now calculated automatically from jobs data
  
  // Filter jobs based on current filters
  const filterJobs = useMemo(() => {
    return (jobs) => {
      if (!jobs || jobs.length === 0) return []
      
      return jobs.filter(job => {
        const { filters } = state
        
        // Search filter
        if (filters.search) {
          const searchTerm = filters.search.toLowerCase()
          const searchableText = `${job.job_name} ${job.job_description} ${job.company_name}`.toLowerCase()
          if (!searchableText.includes(searchTerm)) return false
        }
        
        // Company filter
        if (filters.companies.length > 0) {
          if (!filters.companies.includes(job.company_name)) return false
        }
        
        // Location filter
        if (filters.locations.length > 0) {
          if (!job.locations || !job.locations.some(loc => filters.locations.includes(loc))) return false
        }
        
        // Tags filter
        if (filters.tags.length > 0) {
          if (!job.tags || !job.tags.some(tag => filters.tags.includes(tag.name))) return false
        }
        
        // Website filter
        if (filters.websites.length > 0) {
          if (!filters.websites.includes(job.website_name)) return false
        }
        
        // Applied filter
        if (filters.applied !== 'all') {
          const isApplied = job.applied
          if (filters.applied === 'applied' && !isApplied) return false
          if (filters.applied === 'not_applied' && isApplied) return false
        }
        
        // Date range filter
        if (filters.dateRange !== 'all') {
          const jobDate = new Date(job.created_at)
          const now = new Date()
          
          switch (filters.dateRange) {
            case 'today':
              const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
              if (jobDate < today) return false
              break
              
            case 'week':
              const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
              if (jobDate < weekAgo) return false
              break
              
            case 'month':
              const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
              if (jobDate < monthAgo) return false
              break
              
            case 'custom':
              if (filters.customDateStart && jobDate < new Date(filters.customDateStart)) return false
              if (filters.customDateEnd && jobDate > new Date(filters.customDateEnd)) return false
              break
          }
        }
        
        return true
      })
    }
  }, [state.filters])
  
  const value = {
    // State
    ...state,
    filterOptions, // Use computed filterOptions instead of state.filterOptions
    
    // Actions
    setView,
    setFilter,
    toggleFilterItem,
    resetFilters,
    
    // Computed
    filterJobs
  }
  
  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  )
}

/**
 * Hook to use app context
 */
export function useApp() {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useApp must be used within AppProvider')
  }
  return context
} 