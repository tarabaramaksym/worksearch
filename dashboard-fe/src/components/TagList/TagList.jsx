import './TagList.css'

function TagList({ tags }) {
  if (!tags || tags.length === 0) {
    return null
  }

  return (
    <div className="tag-list">
      {tags.map((tag, index) => (
        <span 
          key={index} 
          className={`tag tag-${tag.category}`}
        >
          {tag.name}
        </span>
      ))}
    </div>
  )
}

export default TagList 