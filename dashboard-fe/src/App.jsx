import { AppProvider, useApp } from '@context/AppContext'
import JobList from '@components/JobList/JobList'
import Analytics from '@components/Analytics/Analytics'
import Filters from '@components/Filters/Filters'
import ViewSwitcher from '@components/ViewSwitcher/ViewSwitcher'
import './App.css'

function AppLayout() {
	const { currentView, jobs, resultCount, loading, error, refetchJobs } = useApp()

	if (error) {
		return (
			<div className="app">
				<div className="error-container">
					<span className="error-icon">⚠️</span>
					<h3>Unable to load jobs</h3>
					<p>{error}</p>
					<button onClick={refetchJobs} className="retry-btn">
						Try Again
					</button>
				</div>
			</div>
		)
	}

	return (
		<div className="app">
			<header className="app-header">
				<div className="header-left">
					<h1>
						<img src="/icon.png" alt="Worksearch Icon" className="header-icon" />
						Worksearch
					</h1>
				</div>

				<div className="header-right">
					<ViewSwitcher />
				</div>
			</header>

			<main className="app-main">
				<aside className="app-sidebar">
					<Filters />
				</aside>

				<div className="app-content">
					<div
						className="content-slider"
						style={{
							transform: `translateX(${currentView === 'analytics' ? '-50%' : '0%'})`
						}}
					>
						<div className="content-panel jobs-panel">
							{loading && jobs.length === 0 ? (
								<div className="loading-container">
									<div className="loading-spinner"></div>
									<p>Loading job opportunities...</p>
								</div>
							) : (
								<JobList />
							)}
						</div>

						<div className="content-panel analytics-panel">
							{loading && jobs.length === 0 ? (
								<div className="loading-container">
									<div className="loading-spinner"></div>
									<p>Loading analytics...</p>
								</div>
							) : (
								<Analytics />
							)}
						</div>
					</div>

					{loading && jobs.length > 0 && (
						<div className="loading-overlay">
							<div className="loading-indicator">
								<div className="loading-spinner-small"></div>
								<span>Updating results...</span>
							</div>
						</div>
					)}
				</div>
			</main>

			<div style={{ display: 'flex' }}>
				<div style={{ width: '320px' }}></div>
				<footer>
					<div className="footer-links">
						<span className="author-link">
							<span className="link-icon email-icon">📧</span>
							<span className="link-handle">tarabara.maksym@protonmail.com</span>
						</span>
						<a href="https://t.me/trbmaksym" className="author-link" target="_blank" rel="noopener noreferrer">
							<img src="telegram.png" alt="Telegram" className="link-icon" />
						</a>
						<a href="https://github.com/tarabaramaksym" className="author-link" target="_blank" rel="noopener noreferrer">
							<img src="github.svg" alt="GitHub" className="link-icon" />
						</a>
					</div>

					<p>
						© {new Date().getFullYear()} Worksearch. All rights reserved.
					</p>
				</footer>
			</div>
		</div>
	)
}

function App() {
	return (
		<AppProvider>
			<AppLayout />
		</AppProvider>
	)
}

export default App
