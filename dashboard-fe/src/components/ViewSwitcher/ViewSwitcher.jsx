import { useApp } from '@context/AppContext'
import './ViewSwitcher.css'

/**
 * View Switcher Component for sliding between views
 */
function ViewSwitcher() {
  const { currentView, setView } = useApp()

  const views = [
    { id: 'jobs', label: 'Job List', icon: '📋' },
    { id: 'analytics', label: 'Analytics', icon: '📊' }
  ]

  const handleViewChange = (viewId) => {
    setView(viewId)
  }

  const handleDragStart = (e) => {
    e.preventDefault()
  }

  return (
    <div className="view-switcher">
      <div className="view-switcher-track">
        {views.map((view) => (
          <button
            key={view.id}
            className={`view-tab ${currentView === view.id ? 'active' : ''}`}
            onClick={() => handleViewChange(view.id)}
            onDragStart={handleDragStart}
          >
            <span className="view-icon">{view.icon}</span>
            <span className="view-label">{view.label}</span>
          </button>
        ))}
        
        {/* Sliding indicator */}
        <div 
          className="view-indicator"
          style={{
            transform: `translateX(${currentView === 'analytics' ? '100%' : '0%'})`
          }}
        />
      </div>
      
      {/* Drag Handle */}
      <div className="drag-handle">
        <div className="drag-dots">
          <div className="drag-dot"></div>
          <div className="drag-dot"></div>
          <div className="drag-dot"></div>
        </div>
      </div>
    </div>
  )
}

export default ViewSwitcher 