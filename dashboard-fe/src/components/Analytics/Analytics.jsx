import { useState, useEffect, useMemo } from 'react'
import { useApp } from '@context/AppContext'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
} from 'chart.js'
import { Bar, Doughnut, Line } from 'react-chartjs-2'
import './Analytics.css'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement
)

/**
 * Analytics component for job dashboard insights
 */
function Analytics() {
  const { jobs, filters } = useApp()
  const [selectedMetric, setSelectedMetric] = useState('tags')
  const [topN, setTopN] = useState(10)
  const [tagFilter, setTagFilter] = useState('all')
  
  // Use filtered jobs from global context (already filtered on server)
  const filteredJobsFromContext = jobs

  /**
   * Process job data to extract analytics insights
   */
  const analytics = useMemo(() => {
    if (!filteredJobsFromContext || filteredJobsFromContext.length === 0) return null

    // Tag/Skill Analysis
    const tagCounts = {}
    const companyCounts = {}
    const locationCounts = {}
    const salaryRanges = {
      'Under $50k': 0,
      '$50k - $75k': 0,
      '$75k - $100k': 0,
      '$100k - $150k': 0,
      'Over $150k': 0,
      'Not specified': 0
    }
    const jobsByDate = {}

    // Define tag categories for filtering
    const tagCategories = {
      'programming': ['javascript', 'python', 'java', 'c++', 'c#', 'php', 'ruby', 'go', 'rust', 'swift', 'kotlin', 'typescript', 'scala', 'r', 'matlab', 'perl', 'dart', 'elixir', 'clojure', 'haskell', 'f#', 'lua', 'groovy', 'assembly'],
      'frontend': ['react', 'vue', 'angular', 'html', 'css', 'sass', 'less', 'bootstrap', 'tailwind', 'material-ui', 'jquery', 'webpack', 'vite', 'parcel', 'gulp', 'grunt', 'babel', 'eslint', 'prettier', 'storybook', 'cypress', 'jest', 'testing-library'],
      'backend': ['node.js', 'express', 'django', 'flask', 'spring', 'laravel', 'rails', 'asp.net', 'fastapi', 'gin', 'echo', 'fiber', 'nestjs', 'koa', 'hapi', 'restify', 'graphql', 'apollo', 'prisma', 'typeorm', 'sequelize', 'mongoose', 'hibernate'],
      'database': ['mysql', 'postgresql', 'mongodb', 'redis', 'elasticsearch', 'sqlite', 'oracle', 'sql server', 'cassandra', 'dynamodb', 'firestore', 'couchdb', 'neo4j', 'influxdb', 'clickhouse', 'mariadb', 'cockroachdb', 'fauna', 'supabase', 'planetscale'],
      'cloud': ['aws', 'azure', 'gcp', 'google cloud', 'heroku', 'vercel', 'netlify', 'digitalocean', 'linode', 'vultr', 'cloudflare', 'firebase', 'amplify', 'railway', 'render', 'fly.io', 'kubernetes', 'docker', 'terraform', 'ansible', 'jenkins', 'github actions'],
      'mobile': ['react native', 'flutter', 'ionic', 'xamarin', 'cordova', 'phonegap', 'native script', 'expo', 'android', 'ios', 'swift', 'kotlin', 'objective-c', 'java android', 'flutter web', 'pwa', 'capacitor'],
      'devops': ['docker', 'kubernetes', 'jenkins', 'gitlab ci', 'github actions', 'travis ci', 'circleci', 'terraform', 'ansible', 'chef', 'puppet', 'vagrant', 'nginx', 'apache', 'linux', 'bash', 'powershell', 'monitoring', 'logging', 'prometheus', 'grafana', 'elk stack'],
      'data': ['python', 'r', 'sql', 'pandas', 'numpy', 'scikit-learn', 'tensorflow', 'pytorch', 'keras', 'jupyter', 'tableau', 'power bi', 'excel', 'spark', 'hadoop', 'airflow', 'kafka', 'snowflake', 'databricks', 'dbt', 'looker', 'qlik'],
      'design': ['figma', 'sketch', 'adobe xd', 'photoshop', 'illustrator', 'after effects', 'indesign', 'canva', 'invision', 'principle', 'framer', 'zeplin', 'abstract', 'marvel', 'axure', 'balsamiq', 'wireframing', 'prototyping', 'ui/ux', 'user experience'],
      'other': [] // Will be populated with tags that don't fit other categories
    }

    // Get all tags and categorize them
    const allTags = new Set()
    filteredJobsFromContext.forEach(job => {
      if (job.tags && job.tags.length > 0) {
        job.tags.forEach(tag => {
          allTags.add(tag.name.toLowerCase())
        })
      }
    })

    // Find uncategorized tags
    const categorizedTags = new Set()
    Object.values(tagCategories).forEach(categoryTags => {
      categoryTags.forEach(tag => categorizedTags.add(tag))
    })
    
    allTags.forEach(tag => {
      if (!categorizedTags.has(tag)) {
        tagCategories.other.push(tag)
      }
    })

    // Filter jobs based on tag filter
    const filteredJobs = tagFilter === 'all' ? filteredJobsFromContext : filteredJobsFromContext.filter(job => {
      if (!job.tags || job.tags.length === 0) return false
      const jobTagNames = job.tags.map(tag => tag.name.toLowerCase())
      const categoryTags = tagCategories[tagFilter] || []
      return jobTagNames.some(tagName => categoryTags.includes(tagName))
    })

    filteredJobs.forEach(job => {
      // Count tags (only from filtered jobs)
      if (job.tags && job.tags.length > 0) {
        job.tags.forEach(tag => {
          // If filtering by category, only count tags in that category
          if (tagFilter === 'all' || (tagCategories[tagFilter] && tagCategories[tagFilter].includes(tag.name.toLowerCase()))) {
            tagCounts[tag.name] = (tagCounts[tag.name] || 0) + 1
          }
        })
      }

      // Count companies
      if (job.company_name) {
        companyCounts[job.company_name] = (companyCounts[job.company_name] || 0) + 1
      }

      // Count locations
      if (job.locations && job.locations.length > 0) {
        job.locations.forEach(location => {
          locationCounts[location] = (locationCounts[location] || 0) + 1
        })
      }

      // Analyze salary ranges (assuming salary is in the description or title)
      const jobText = `${job.title} ${job.description}`.toLowerCase()
      if (jobText.includes('$') || jobText.includes('salary') || jobText.includes('usd')) {
        // Simple salary extraction logic
        const salaryMatch = jobText.match(/\$(\d+)k?/)
        if (salaryMatch) {
          const salary = parseInt(salaryMatch[1]) * (salaryMatch[0].includes('k') ? 1000 : 1)
          if (salary < 50000) salaryRanges['Under $50k']++
          else if (salary < 75000) salaryRanges['$50k - $75k']++
          else if (salary < 100000) salaryRanges['$75k - $100k']++
          else if (salary < 150000) salaryRanges['$100k - $150k']++
          else salaryRanges['Over $150k']++
        } else {
          salaryRanges['Not specified']++
        }
      } else {
        salaryRanges['Not specified']++
      }

      // Jobs by date
      if (job.created_at) {
        const date = new Date(job.created_at).toDateString()
        jobsByDate[date] = (jobsByDate[date] || 0) + 1
      }
    })

    // Sort and get top items
    const sortedTags = Object.entries(tagCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, topN)
    
    const sortedCompanies = Object.entries(companyCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, topN)
    
    const sortedLocations = Object.entries(locationCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, topN)

    return {
      tagCounts: sortedTags,
      companyCounts: sortedCompanies,
      locationCounts: sortedLocations,
      salaryRanges,
      jobsByDate,
      totalJobs: filteredJobsFromContext.length,
      filteredJobs: filteredJobs.length,
      totalTags: Object.keys(tagCounts).length,
      totalCompanies: Object.keys(companyCounts).length,
      totalLocations: Object.keys(locationCounts).length,
      tagCategories
    }
  }, [filteredJobsFromContext, topN, tagFilter])

  /**
   * Generate chart data based on selected metric
   */
  const getChartData = () => {
    if (!analytics) return null

    const colors = [
      '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
      '#FF9F40', '#FF6384', '#C9CBCF', '#4BC0C0', '#FF6384'
    ]

    switch (selectedMetric) {
      case 'tags':
        return {
          labels: analytics.tagCounts.map(([name]) => name),
          datasets: [{
            label: 'Jobs per Skill/Tag',
            data: analytics.tagCounts.map(([, count]) => count),
            backgroundColor: colors,
            borderColor: colors.map(color => color.replace('0.2', '1')),
            borderWidth: 1
          }]
        }
      case 'companies':
        return {
          labels: analytics.companyCounts.map(([name]) => name),
          datasets: [{
            label: 'Jobs per Company',
            data: analytics.companyCounts.map(([, count]) => count),
            backgroundColor: colors,
            borderColor: colors.map(color => color.replace('0.2', '1')),
            borderWidth: 1
          }]
        }
      case 'locations':
        return {
          labels: analytics.locationCounts.map(([name]) => name),
          datasets: [{
            label: 'Jobs per Location',
            data: analytics.locationCounts.map(([, count]) => count),
            backgroundColor: colors,
            borderColor: colors.map(color => color.replace('0.2', '1')),
            borderWidth: 1
          }]
        }
      case 'salary':
        return {
          labels: Object.keys(analytics.salaryRanges),
          datasets: [{
            label: 'Jobs by Salary Range',
            data: Object.values(analytics.salaryRanges),
            backgroundColor: colors,
            borderColor: colors.map(color => color.replace('0.2', '1')),
            borderWidth: 1
          }]
        }
      default:
        return null
    }
  }

  /**
   * Get chart options based on selected metric
   */
  const getChartOptions = () => {
    return {
      responsive: true,
      plugins: {
        legend: {
          position: 'top',
        },
        title: {
          display: true,
          text: `${selectedMetric.charAt(0).toUpperCase() + selectedMetric.slice(1)} Analysis`
        }
      },
      scales: selectedMetric === 'salary' ? {} : {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1
          }
        }
      }
    }
  }

  if (!analytics) {
    return (
      <div className="analytics">
        <div className="analytics-loading">
          No job data available for analytics
        </div>
      </div>
    )
  }

  return (
    <div className="analytics">
      <div className="analytics-header">
        <h2>Job Market Analytics</h2>
        <div className="analytics-controls">
          <select 
            value={selectedMetric} 
            onChange={(e) => setSelectedMetric(e.target.value)}
            className="metric-select"
          >
            <option value="tags">Skills & Tags</option>
            <option value="companies">Companies</option>
            <option value="locations">Locations</option>
            <option value="salary">Salary Ranges</option>
          </select>
          {selectedMetric === 'tags' && (
            <select 
              value={tagFilter} 
              onChange={(e) => setTagFilter(e.target.value)}
              className="tag-filter-select"
            >
              <option value="all">All Categories</option>
              <option value="programming">Programming Languages</option>
              <option value="frontend">Frontend</option>
              <option value="backend">Backend</option>
              <option value="database">Database</option>
              <option value="cloud">Cloud & Infrastructure</option>
              <option value="mobile">Mobile Development</option>
              <option value="devops">DevOps & Tools</option>
              <option value="data">Data & Analytics</option>
              <option value="design">Design & UX</option>
              <option value="other">Other Skills</option>
            </select>
          )}
          {selectedMetric !== 'salary' && (
            <select 
              value={topN} 
              onChange={(e) => setTopN(parseInt(e.target.value))}
              className="top-n-select"
            >
              <option value={5}>Top 5</option>
              <option value={10}>Top 10</option>
              <option value={15}>Top 15</option>
              <option value={20}>Top 20</option>
            </select>
          )}
        </div>
      </div>

      <div className="analytics-summary">
        <div className="summary-card">
          <h3>{analytics.totalJobs}</h3>
          <p>Total Jobs</p>
        </div>
        {selectedMetric === 'tags' && tagFilter !== 'all' && (
          <div className="summary-card filtered">
            <h3>{analytics.filteredJobs}</h3>
            <p>Filtered Jobs</p>
          </div>
        )}
        <div className="summary-card">
          <h3>{analytics.totalTags}</h3>
          <p>Unique Skills</p>
        </div>
        <div className="summary-card">
          <h3>{analytics.totalCompanies}</h3>
          <p>Companies</p>
        </div>
        <div className="summary-card">
          <h3>{analytics.totalLocations}</h3>
          <p>Locations</p>
        </div>
      </div>

      <div className="analytics-charts">
        <div className="chart-container">
          <div className="chart-wrapper">
            {selectedMetric === 'salary' ? (
              <Doughnut data={getChartData()} options={getChartOptions()} />
            ) : (
              <Bar data={getChartData()} options={getChartOptions()} />
            )}
          </div>
        </div>

        <div className="insights-panel">
          <h3>Key Insights</h3>
          <div className="insights-list">
            {selectedMetric === 'tags' && analytics.tagCounts.length > 0 && (
              <div className="insight">
                <strong>Most in-demand skill{tagFilter !== 'all' ? ` in ${tagFilter}` : ''}:</strong> {analytics.tagCounts[0][0]} 
                ({analytics.tagCounts[0][1]} jobs)
              </div>
            )}
            {selectedMetric === 'companies' && analytics.companyCounts.length > 0 && (
              <div className="insight">
                <strong>Top hiring company:</strong> {analytics.companyCounts[0][0]} 
                ({analytics.companyCounts[0][1]} jobs)
              </div>
            )}
            {selectedMetric === 'locations' && analytics.locationCounts.length > 0 && (
              <div className="insight">
                <strong>Hottest job location:</strong> {analytics.locationCounts[0][0]} 
                ({analytics.locationCounts[0][1]} jobs)
              </div>
            )}
            {selectedMetric === 'salary' && (
              <div className="insight">
                <strong>Salary transparency:</strong> {
                  ((analytics.totalJobs - analytics.salaryRanges['Not specified']) / analytics.totalJobs * 100).toFixed(1)
                }% of jobs specify salary information
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="analytics-recommendations">
        <h3>Market Recommendations</h3>
        <div className="recommendations-grid">
          {analytics.tagCounts.slice(0, 3).map(([skill, count], index) => (
            <div key={skill} className="recommendation-card">
              <div className="recommendation-rank">#{index + 1}</div>
              <div className="recommendation-content">
                <h4>{skill}</h4>
                <p>{count} job opportunities</p>
                <div className="recommendation-advice">
                  {index === 0 && "🔥 Hottest skill in the market"}
                  {index === 1 && "📈 Strong demand, great opportunities"}
                  {index === 2 && "💡 Solid choice for career growth"}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default Analytics 