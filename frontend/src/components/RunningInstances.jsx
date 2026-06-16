import { useState, useEffect } from 'react'
import Terminal from './Terminal.jsx'
import './RunningInstances.css'

function Uptime({ startedAt }) {
  const [elapsed, setElapsed] = useState('')

  useEffect(() => {
    const calculate = () => {
      const start = new Date(startedAt).getTime()
      const now = Date.now()
      const diff = Math.floor((now - start) / 1000)

      const hours = Math.floor(diff / 3600)
      const minutes = Math.floor((diff % 3600) / 60)
      const seconds = diff % 60

      if (hours > 0) {
        setElapsed(`${hours}h ${minutes}m ${seconds}s`)
      } else if (minutes > 0) {
        setElapsed(`${minutes}m ${seconds}s`)
      } else {
        setElapsed(`${seconds}s`)
      }
    }

    calculate()
    const interval = setInterval(calculate, 1000)
    return () => clearInterval(interval)
  }, [startedAt])

  return <span className="instance-uptime">{elapsed}</span>
}

export default function RunningInstances({
  processes,
  projects,
  onStopProcess,
  onRestartProcess,
  onSelectProject,
  socket
}) {
  const [expandedId, setExpandedId] = useState(null)

  const getProjectName = (projectId) => {
    const project = projects.find(p => p.id === projectId)
    return project ? project.name : 'Unknown'
  }

  const toggleExpanded = (id) => {
    setExpandedId(prev => prev === id ? null : id)
  }

  return (
    <div className="running-instances">
      <div className="instances-header">
        <h2 className="instances-title">Running Instances</h2>
        <span className="badge badge-success">{processes.length}</span>
      </div>

      {processes.length === 0 ? (
        <div className="instances-empty">
          <div className="instances-empty-icon">⚡</div>
          <p>No servers running</p>
          <p className="instances-empty-hint">Start a script from a project to see it here</p>
        </div>
      ) : (
        <div className="instances-list">
          {processes.map(proc => (
            <div key={proc.id} className="instance-card">
              <div className="instance-main">
                <div className="instance-info">
                  <button
                    className="instance-project-link"
                    onClick={() => onSelectProject(proc.projectId)}
                  >
                    {getProjectName(proc.projectId)}
                  </button>
                  <span className="instance-script">{proc.script}</span>
                  <div className="instance-details">
                    <span className="instance-detail">PID: {proc.pid}</span>
                    <span className="instance-detail-sep">·</span>
                    <Uptime startedAt={proc.startedAt} />
                  </div>
                </div>

                <div className="instance-actions">
                  <span className="badge badge-success">Running</span>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => toggleExpanded(proc.id)}
                    title="Toggle output"
                  >
                    {expandedId === proc.id ? '▲' : '▼'}
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => onRestartProcess(proc.id)}
                    title="Restart"
                  >
                    ↻
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => onStopProcess(proc.id)}
                    title="Stop"
                  >
                    ■
                  </button>
                </div>
              </div>

              {expandedId === proc.id && (
                <div className="instance-terminal">
                  <Terminal key={proc.id} processId={proc.id} socket={socket} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
