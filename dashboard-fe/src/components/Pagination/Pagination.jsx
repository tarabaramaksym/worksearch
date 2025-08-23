import React from 'react'
import './Pagination.css'

function Pagination({ 
  currentPage, 
  totalPages, 
  total, 
  pageSize, 
  onPageChange, 
  onPageSizeChange,
  showPageSizeSelector = true 
}) {
  const startItem = (currentPage - 1) * pageSize + 1
  const endItem = Math.min(currentPage * pageSize, total)
  
  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      onPageChange(page)
    }
  }
  
  const handlePageSizeChange = (event) => {
    const newPageSize = parseInt(event.target.value)
    onPageSizeChange(newPageSize)
  }
  
  const renderPageNumbers = () => {
    const pages = []
    const maxVisiblePages = 5
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2))
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1)
    
    // Adjust start page if we're near the end
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1)
    }
    
    // Add first page and ellipsis if needed
    if (startPage > 1) {
      pages.push(
        <button
          key={1}
          onClick={() => handlePageChange(1)}
          className="pagination-page"
        >
          1
        </button>
      )
      if (startPage > 2) {
        pages.push(
          <span key="ellipsis1" className="pagination-ellipsis">
            ...
          </span>
        )
      }
    }
    
    // Add visible page numbers
    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <button
          key={i}
          onClick={() => handlePageChange(i)}
          className={`pagination-page ${i === currentPage ? 'active' : ''}`}
        >
          {i}
        </button>
      )
    }
    
    // Add last page and ellipsis if needed
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        pages.push(
          <span key="ellipsis2" className="pagination-ellipsis">
            ...
          </span>
        )
      }
      pages.push(
        <button
          key={totalPages}
          onClick={() => handlePageChange(totalPages)}
          className="pagination-page"
        >
          {totalPages}
        </button>
      )
    }
    
    return pages
  }
  
  if (totalPages <= 1) {
    return null
  }
  
  return (
    <div className="pagination">
      <div className="pagination-info">
        <span>
          Showing {startItem}-{endItem} of {total} jobs
        </span>
      </div>
      
      <div className="pagination-controls">
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="pagination-nav"
        >
          ← Previous
        </button>
        
        <div className="pagination-pages">
          {renderPageNumbers()}
        </div>
        
        <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="pagination-nav"
        >
          Next →
        </button>
      </div>
      
      {showPageSizeSelector && (
        <div className="pagination-size">
          <label htmlFor="page-size">Show:</label>
          <select
            id="page-size"
            value={pageSize}
            onChange={handlePageSizeChange}
            className="pagination-size-select"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <span>per page</span>
        </div>
      )}
    </div>
  )
}

export default Pagination
