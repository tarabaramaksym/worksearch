import { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react'

const AppContext = createContext()

const initialState = {
  currentView: 'jobs',
  
  filters: {
    search: '',
    companies: [],
    locations: [],
    websites: [],
    applied: 'all',	
    dateRange: 'all',
    customDateStart: '',
    customDateEnd: '',
    // Dynamic tag category filters will be added here
  },
  
  jobs: [],
  filterOptions: {
    companies: [],
    locations: [],
    tagCategories: {},
    websites: []
  },
  loading: true,
  error: null,
  resultCount: 0
}

const actions = {
  SET_VIEW: 'SET_VIEW',
  SET_FILTER: 'SET_FILTER',
  RESET_FILTERS: 'RESET_FILTERS',
  TOGGLE_FILTER_ITEM: 'TOGGLE_FILTER_ITEM',
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR',
  SET_JOBS_DATA: 'SET_JOBS_DATA'
}

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
      const currentItems = state.filters[filterType] || []
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
      const resetFilters = { ...initialState.filters }
      Object.keys(state.filters).forEach(key => {
        if (Array.isArray(state.filters[key]) && !Object.prototype.hasOwnProperty.call(initialState.filters, key)) {
          resetFilters[key] = []
        }
      })
      return {
        ...state,
        filters: resetFilters
      }
    case actions.SET_LOADING:
      return {
        ...state,
        loading: action.payload
      }
    case actions.SET_ERROR:
      return {
        ...state,
        error: action.payload,
        loading: false
      }
    case actions.SET_JOBS_DATA:
      return {
        ...state,
        jobs: action.payload.jobs,
        filterOptions: action.payload.filters,
        resultCount: action.payload.count,
        loading: false,
        error: null
      }
    default:
      return state
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState)
  const debounceTimer = useRef(null)

  const buildFilterParams = useCallback((filters) => {
    const params = new URLSearchParams()
    if (filters.search) {
      params.append('q', filters.search)
    }
    if (filters.companies.length > 0) {
      params.append('company', filters.companies.join(','))
    }
    if (filters.locations.length > 0) {
      params.append('location', filters.locations.join(','))
    }
    if (filters.websites.length > 0) {
      params.append('website', filters.websites.join(','))
    }
    if (filters.applied !== 'all') {
      params.append('applied', filters.applied === 'applied' ? 'true' : 'false')
    }
    Object.entries(filters).forEach(([key, value]) => {
      if (Array.isArray(value) && value.length > 0 && 
          !['search', 'companies', 'locations', 'websites', 'applied', 'dateRange', 'customDateStart', 'customDateEnd'].includes(key)) {
        params.append(key, value.join(','))
      }
    })
    return params.toString()
  }, [])

  const fetchJobsWithFilters = useCallback(async (filters) => {
    try {
      dispatch({ type: actions.SET_LOADING, payload: true })
      const filterParams = buildFilterParams(filters)
      const url = `http://localhost:3000/api/jobs/filtered${filterParams ? `?${filterParams}` : ''}`
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error('Failed to fetch jobs')
      }
      const data = await response.json()
      dispatch({ 
        type: actions.SET_JOBS_DATA, 
        payload: {
          jobs: data.jobs,
          filters: data.filters,
          count: data.count
        }
      })
    } catch (error) {
      dispatch({ type: actions.SET_ERROR, payload: error.message })
    }
  }, [buildFilterParams])

  const debouncedFetchJobs = useCallback((filters) => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }
    debounceTimer.current = setTimeout(() => {
      fetchJobsWithFilters(filters)
    }, 300)
  }, [fetchJobsWithFilters])

  useEffect(() => {
    const isSearchFilter = state.filters.search !== ''
    if (isSearchFilter) {
      debouncedFetchJobs(state.filters)
    } else {
      fetchJobsWithFilters(state.filters)
    }
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }
    }
  }, [state.filters, fetchJobsWithFilters, debouncedFetchJobs])

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
  const value = {
    ...state,
    setView,
    setFilter,
    toggleFilterItem,
    resetFilters,
    refetchJobs: () => fetchJobsWithFilters(state.filters)
  }
  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useApp must be used within an AppProvider')
  }
  return context
} 