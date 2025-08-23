import { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react'

const API_BASE_URL = 'http://localhost:3000'

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
	resultCount: 0,

	// Pagination state
	pagination: {
		currentPage: 1,
		pageSize: 20,
		totalPages: 0,
		total: 0
	}
}

const actions = {
	SET_VIEW: 'SET_VIEW',
	SET_FILTER: 'SET_FILTER',
	RESET_FILTERS: 'RESET_FILTERS',
	TOGGLE_FILTER_ITEM: 'TOGGLE_FILTER_ITEM',
	SET_LOADING: 'SET_LOADING',
	SET_ERROR: 'SET_ERROR',
	SET_JOBS_DATA: 'SET_JOBS_DATA',
	SET_PAGINATION: 'SET_PAGINATION',
	SET_PAGE: 'SET_PAGE',
	SET_PAGE_SIZE: 'SET_PAGE_SIZE'
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
				resultCount: action.payload.pagination?.total || action.payload.count || 0,
				loading: false,
				error: null
			}
		case actions.SET_PAGINATION:
			return {
				...state,
				pagination: action.payload
			}
		case actions.SET_PAGE:
			return {
				...state,
				pagination: {
					...state.pagination,
					currentPage: action.payload
				}
			}
		case actions.SET_PAGE_SIZE:
			return {
				...state,
				pagination: {
					...state.pagination,
					pageSize: action.payload
				}
			}
		default:
			return state
	}
}

export function AppProvider({ children }) {
	const [state, dispatch] = useReducer(appReducer, initialState)
	const debounceTimer = useRef(null)
	const isInitialized = useRef(false)
	const isFetching = useRef(false)
	const isInitialSetup = useRef(true)
	const previousFilters = useRef(initialState.filters)

	// URL parameter utilities
	const updateURLParams = useCallback((filters, pagination) => {
		const url = new URL(window.location)

		// Clear existing params
		url.searchParams.delete('q')
		url.searchParams.delete('company')
		url.searchParams.delete('location')
		url.searchParams.delete('website')
		url.searchParams.delete('applied')
		url.searchParams.delete('dateRange')
		url.searchParams.delete('customDateStart')
		url.searchParams.delete('customDateEnd')
		url.searchParams.delete('page')
		url.searchParams.delete('limit')

		// Add filter params
		if (filters.search) url.searchParams.set('q', filters.search)
		if (filters.companies.length > 0) url.searchParams.set('company', filters.companies.join(','))
		if (filters.locations.length > 0) url.searchParams.set('location', filters.locations.join(','))
		if (filters.websites.length > 0) url.searchParams.set('website', filters.websites.join(','))
		if (filters.applied !== 'all') url.searchParams.set('applied', filters.applied)
		if (filters.dateRange !== 'all') url.searchParams.set('dateRange', filters.dateRange)
		if (filters.customDateStart) url.searchParams.set('customDateStart', filters.customDateStart)
		if (filters.customDateEnd) url.searchParams.set('customDateEnd', filters.customDateEnd)

		// Add dynamic tag category filters
		Object.entries(filters).forEach(([key, value]) => {
			if (Array.isArray(value) && value.length > 0 &&
				!['search', 'companies', 'locations', 'websites', 'applied', 'dateRange', 'customDateStart', 'customDateEnd'].includes(key)) {
				url.searchParams.set(key, value.join(','))
			} else if (Array.isArray(value) && value.length === 0) {
				url.searchParams.delete(key)
			}
		})

		// Add pagination params
		if (pagination.currentPage > 1) url.searchParams.set('page', pagination.currentPage.toString())
		if (pagination.pageSize !== 20) url.searchParams.set('limit', pagination.pageSize.toString())

		// Update URL without reloading the page
		window.history.replaceState({}, '', url.toString())
	}, [])

	const parseURLParams = useCallback(() => {
		const url = new URL(window.location)
		const params = url.searchParams

		const filters = {
			search: params.get('q') || '',
			companies: params.get('company') ? params.get('company').split(',').filter(Boolean) : [],
			locations: params.get('location') ? params.get('location').split(',').filter(Boolean) : [],
			websites: params.get('website') ? params.get('website').split(',').filter(Boolean) : [],
			applied: params.get('applied') || 'all',
			dateRange: params.get('dateRange') || 'all',
			customDateStart: params.get('customDateStart') || '',
			customDateEnd: params.get('customDateEnd') || ''
		}

		// Parse dynamic tag category filters
		for (const [key, value] of params.entries()) {
			if (!['q', 'company', 'location', 'website', 'applied', 'dateRange', 'customDateStart', 'customDateEnd', 'page', 'limit'].includes(key)) {
				if (value) {
					const filterValues = value.split(',').filter(Boolean)
					filters[key] = filterValues
				}
			}
		}

		// Validate and sanitize pagination parameters
		let page = parseInt(params.get('page')) || 1
		let limit = parseInt(params.get('limit')) || 20

		// Ensure valid ranges
		if (page < 1) page = 1
		if (limit < 1 || limit > 100) limit = 20

		const pagination = {
			currentPage: page,
			pageSize: limit
		}

		return { filters, pagination }
	}, [])

	// Handle browser back/forward navigation
	useEffect(() => {
		const handlePopState = () => {
			const { filters: urlFilters, pagination: urlPagination } = parseURLParams()

			// Update filters from URL
			Object.entries(urlFilters).forEach(([key, value]) => {
				if (JSON.stringify(value) !== JSON.stringify(state.filters[key])) {
					dispatch({ type: actions.SET_FILTER, payload: { key, value } })
				}
			})

			// Update pagination from URL
			if (urlPagination.currentPage !== state.pagination.currentPage ||
				urlPagination.pageSize !== state.pagination.pageSize) {
				dispatch({ type: actions.SET_PAGINATION, payload: urlPagination })
			}
		}

		window.addEventListener('popstate', handlePopState)
		return () => window.removeEventListener('popstate', handlePopState)
	}, [state.filters, state.pagination, parseURLParams])

	const buildFilterParams = useCallback((filters) => {
		const params = new URLSearchParams()

		if (filters.search) params.append('search', filters.search)
		if (filters.companies.length > 0) params.append('companies', filters.companies.join(','))
		if (filters.locations.length > 0) params.append('locations', filters.locations.join(','))
		if (filters.websites.length > 0) params.append('websites', filters.websites.join(','))
		if (filters.applied !== 'all') params.append('applied', filters.applied)
		if (filters.dateRange !== 'all') params.append('dateRange', filters.dateRange)
		if (filters.customDateStart) params.append('customDateStart', filters.customDateStart)
		if (filters.customDateEnd) params.append('customDateEnd', filters.customDateEnd)

		// Add dynamic tag category filters
		Object.entries(filters).forEach(([key, value]) => {
			if (Array.isArray(value) && value.length > 0 &&
				!['search', 'companies', 'locations', 'websites', 'applied', 'dateRange', 'customDateStart', 'customDateEnd'].includes(key)) {
				params.append(key, value.join(','))
			}
		})

		return params
	}, [])

	const fetchJobsWithFilters = useCallback(async (filters = state.filters, pagination = state.pagination) => {
		try {
			isFetching.current = true
			dispatch({ type: actions.SET_LOADING, payload: true })

			const params = buildFilterParams(filters)
			params.append('page', pagination.currentPage.toString())
			params.append('limit', pagination.pageSize.toString())

			const response = await fetch(`${API_BASE_URL}/api/jobs/filtered?${params.toString()}`)
			if (!response.ok) throw new Error('Failed to fetch jobs')

			const data = await response.json()

			// Set jobs data first
			dispatch({
				type: actions.SET_JOBS_DATA,
				payload: {
					jobs: data.jobs,
					count: data.count,
					filters: data.filters || {},
					pagination: data.pagination || {}
				}
			})

			// Only update pagination if it's different from current state
			if (data.pagination && (
				data.pagination.currentPage !== state.pagination.currentPage ||
				data.pagination.pageSize !== state.pagination.pageSize ||
				data.pagination.total !== state.pagination.total ||
				data.pagination.totalPages !== state.pagination.totalPages
			)) {
				dispatch({ type: actions.SET_PAGINATION, payload: data.pagination })
			}

		} catch (error) {
			dispatch({ type: actions.SET_ERROR, payload: error.message })
		} finally {
			isFetching.current = false
		}
	}, [state.filters, state.pagination, buildFilterParams])

	const debouncedFetchJobs = useCallback((filters) => {
		if (debounceTimer.current) {
			clearTimeout(debounceTimer.current)
		}
		debounceTimer.current = setTimeout(() => {
			if (isInitialized.current && !isInitialSetup.current) {
				fetchJobsWithFilters(filters, { currentPage: 1, pageSize: state.pagination.pageSize })
			}
		}, 300)
	}, [fetchJobsWithFilters, state.pagination.pageSize])

	// Initialize state from URL params on mount
	useEffect(() => {
		const { filters: urlFilters, pagination: urlPagination } = parseURLParams()

		// Update state with URL params
		Object.entries(urlFilters).forEach(([key, value]) => {
			if (value !== initialState.filters[key]) {
				dispatch({ type: actions.SET_FILTER, payload: { key, value } })
			}
		})

		if (urlPagination.currentPage !== 1 || urlPagination.pageSize !== 20) {
			dispatch({ type: actions.SET_PAGINATION, payload: urlPagination })
		}

		// Mark as initialized after setting initial state
		isInitialized.current = true

		// Fetch initial data if URL has parameters OR if no parameters (default data)
		const hasFilters = Object.values(urlFilters).some(value =>
			value && (Array.isArray(value) ? value.length > 0 : value !== 'all')
		)
		const hasPagination = urlPagination.currentPage > 1 || urlPagination.pageSize !== 20

		if (hasFilters || hasPagination) {
			// Fetch data with URL parameters
			fetchJobsWithFilters(urlFilters, urlPagination)
		} else {
			// Fetch default data (first page)
			fetchJobsWithFilters(initialState.filters, { currentPage: 1, pageSize: 20 })
		}

		// Mark initial setup as complete after a short delay
		setTimeout(() => {
			isInitialSetup.current = false
			// Set previous filters to current state after initialization
			previousFilters.current = JSON.parse(JSON.stringify(state.filters))
		}, 100)
	}, []) // Only run once on mount

	// Update URL when filters or pagination change (but prevent infinite loops)
	useEffect(() => {
		// Skip URL update if not yet initialized
		if (!isInitialized.current) {
			return
		}

		// Skip if still in initial setup
		if (isInitialSetup.current) {
			return
		}

		updateURLParams(state.filters, state.pagination)
	}, [state.filters, state.pagination, updateURLParams])

	// Remove the complex filters and pagination effects that cause loops
	// Instead, we'll handle data fetching explicitly when needed

	const setView = (view) => {
		dispatch({ type: actions.SET_VIEW, payload: view })
	}
	const resetFilters = () => {
		dispatch({ type: actions.RESET_FILTERS })
		// Reset pagination to page 1 when filters are cleared
		if (state.pagination.currentPage !== 1) {
			dispatch({ type: actions.SET_PAGE, payload: 1 })
		}

		// After resetting filters, fetch default data
		if (isInitialized.current && !isInitialSetup.current) {
			fetchJobsWithFilters(initialState.filters, { currentPage: 1, pageSize: state.pagination.pageSize })
		}
	}
	const setPagination = (pagination) => {
		dispatch({ type: actions.SET_PAGINATION, payload: pagination })
	}
	const toggleFilterItem = (filterType, item) => {
		dispatch({ type: actions.TOGGLE_FILTER_ITEM, payload: { filterType, item } })

		// After changing filters, fetch new data and reset to page 1
		if (isInitialized.current && !isInitialSetup.current) {
			const newFilters = { ...state.filters }
			const currentItems = newFilters[filterType] || []
			const isSelected = currentItems.includes(item)

			if (isSelected) {
				newFilters[filterType] = currentItems.filter(i => i !== item)
			} else {
				newFilters[filterType] = [...currentItems, item]
			}

			// Reset to page 1 when filters change
			if (state.pagination.currentPage !== 1) {
				dispatch({ type: actions.SET_PAGE, payload: 1 })
			}

			// Fetch new data with updated filters
			fetchJobsWithFilters(newFilters, { currentPage: 1, pageSize: state.pagination.pageSize })
		}
	}

	const setPage = (page) => {
		dispatch({ type: actions.SET_PAGE, payload: page })

		// After changing page, fetch new data
		if (isInitialized.current && !isInitialSetup.current) {
			fetchJobsWithFilters(state.filters, { ...state.pagination, currentPage: page })
		}
	}

	const setPageSize = (pageSize) => {
		dispatch({ type: actions.SET_PAGE_SIZE, payload: pageSize })

		// After changing page size, fetch new data and reset to page 1
		if (isInitialized.current && !isInitialSetup.current) {
			dispatch({ type: actions.SET_PAGE, payload: 1 })
			fetchJobsWithFilters(state.filters, { currentPage: 1, pageSize })
		}
	}

	const setFilter = (key, value) => {
		dispatch({ type: actions.SET_FILTER, payload: { key, value } })

		// After changing filters, fetch new data and reset to page 1
		if (isInitialized.current && !isInitialSetup.current) {
			const newFilters = { ...state.filters, [key]: value }

			// Reset to page 1 when filters change
			if (state.pagination.currentPage !== 1) {
				dispatch({ type: actions.SET_PAGE, payload: 1 })
			}

			// For search, use debounced fetch
			if (key === 'search') {
				debouncedFetchJobs(newFilters)
			} else {
				// For other filters, fetch immediately
				fetchJobsWithFilters(newFilters, { currentPage: 1, pageSize: state.pagination.pageSize })
			}
		}
	}

	const getCurrentURL = () => {
		return window.location.href
	}

	const value = {
		...state,
		setView,
		setFilter,
		toggleFilterItem,
		resetFilters,
		setPagination,
		setPage,
		setPageSize,
		getCurrentURL,
		refetchJobs: () => {
			// Reset to page 1 when refetching
			dispatch({ type: actions.SET_PAGE, payload: 1 })
			fetchJobsWithFilters(state.filters, { ...state.pagination, currentPage: 1 })
		}
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