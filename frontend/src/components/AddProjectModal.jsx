import { useState } from 'react'
import './AddProjectModal.css'

export default function AddProjectModal({ isOpen, onClose, onProjectAdded }) {
  const [path, setPath] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!path.trim()) {
      setError('Please enter a project path')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: path.trim() })
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || data.message || 'Failed to add project')
        return
      }

      setPath('')
      setError('')
      onProjectAdded(data)
    } catch (err) {
      setError('Failed to connect to server')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setPath('')
    setError('')
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <h2 className="modal-title">Add Project</h2>

        <form onSubmit={handleSubmit}>
          <div className="modal-field">
            <input
              type="text"
              className="modal-input"
              placeholder="/path/to/your/project"
              value={path}
              onChange={e => setPath(e.target.value)}
              autoFocus
            />
            <p className="modal-helper">Enter the absolute path to your project directory</p>
          </div>

          {error && <p className="modal-error">{error}</p>}

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={handleClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Adding...' : 'Add Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
