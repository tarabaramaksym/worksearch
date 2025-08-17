import TagList from '@components/TagList/TagList'
import './JobCard.css'

function JobCard({ job }) {
  return (
    <div className="job-card">
      <div className="job-card-header">
        <h3 className="job-title">{job.job_name}</h3>
        <p className="job-company">{job.company_name}</p>
      </div>
      
      <div className="job-card-body">
        <TagList tags={job.tags} />
      </div>
      
      <div className="job-card-footer">
        <span className="job-date">
          {new Date(job.created_at).toLocaleDateString()}
        </span>
        {job.applied && (
          <span className="job-applied">Applied</span>
        )}
		<a href={job.website_url + job.job_url} target="_blank" rel="noopener noreferrer">
			<button className="job-card-button">View Job</button>
		</a>
      </div>
    </div>
  )
}

export default JobCard 