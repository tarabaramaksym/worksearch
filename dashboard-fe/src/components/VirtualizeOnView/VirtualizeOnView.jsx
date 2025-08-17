import { useRef, useState, useEffect } from 'react'

function VirtualizeOnView({ children, placeholder = null, offset = 200 }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const observer = new window.IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
        } else {
          setVisible(false)
        }
      },
      {
        root: null,
        rootMargin: `${offset}px 0px ${offset}px 0px`,
        threshold: 0.01
      }
    )
    if (ref.current) {
      observer.observe(ref.current)
    }
    return () => {
      if (ref.current) {
        observer.unobserve(ref.current)
      }
      observer.disconnect()
    }
  }, [offset])

  return (
    <div ref={ref}>
      {visible ? children : placeholder}
    </div>
  )
}

export default VirtualizeOnView 