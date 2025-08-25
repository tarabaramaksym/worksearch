import { useMemo } from 'react'
import { useApp } from '@context/AppContext'
import JobCard from '@components/JobCard/JobCard'
import Pagination from '@components/Pagination/Pagination'
import './JobList.css'

function JobList() {
	const {
		jobs,
		filters,
		filterOptions,
		resetFilters,
		resultCount,
		pagination,
		setPage,
		setPageSize,
		getCurrentURL
	} = useApp()

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

	const handlePageChange = (page) => {
		setPage(page)
	}

	const handlePageSizeChange = (pageSize) => {
		setPageSize(pageSize)
	}

	const handleShare = async () => {
		try {
			const url = getCurrentURL()
			await navigator.clipboard.writeText(url)
			// You could add a toast notification here
			alert('URL copied to clipboard!')
		} catch (err) {
			// Fallback for older browsers
			const textArea = document.createElement('textarea')
			textArea.value = getCurrentURL()
			document.body.appendChild(textArea)
			textArea.select()
			document.execCommand('copy')
			document.body.removeChild(textArea)
			alert('URL copied to clipboard!')
		}
	}

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
			</div>
			<div className="job-list-content">
				{jobs.map((job) => (
					<JobCard job={job} />
				))}
			</div>

			{/* Pagination Component */}
			<Pagination
				currentPage={pagination.currentPage}
				totalPages={pagination.totalPages}
				total={pagination.total}
				pageSize={pagination.pageSize}
				onPageChange={handlePageChange}
				onPageSizeChange={handlePageSizeChange}
			/>
		</div >
	)
}

export default JobList 