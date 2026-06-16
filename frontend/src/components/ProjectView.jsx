import { useState } from 'react'
import Terminal from './Terminal.jsx'
import './ProjectView.css'

const QUICK_ACTIONS = [
  { key: 'dev', label: 'Dev Server', icon: '▶', description: 'npm run dev' },
  { key: 'start', label: 'Start', icon: '▶', description: 'npm start' },
  { key: 'build', label: 'Build', icon: '⚙', description: 'npm run build' },
  { key: 'preview', label: 'Preview', icon: '👁', description: 'npm run preview' },
  { key: 'install', label: 'Install', icon: '📦', description: 'npm install', alwaysAvailable: true },
]

export default function ProjectView({
  project,
  processes,
  onStartScript,
  onStopProcess,
  onRestartProcess,
  socket
}) {
  const [selectedProcessId, setSelectedProcessId] = useState(null)

  const scripts = project.scripts ? Object.entries(project.scripts) : []
  const scriptNames = project.scripts ? Object.keys(project.scripts) : []
  const depsCount = project.dependenciesCount || 0

  const getProcessForScript = (scriptName) => {
    return processes.find(p => p.script === scriptName)
  }

  const activeProcess = selectedProcessId
    ? processes.find(p => p.id === selectedProcessId)
    : processes[0] || null

  // Filter quick actions to show only relevant ones
  const availableQuickActions = QUICK_ACTIONS.filter(
    action => action.alwaysAvailable || scriptNames.includes(action.key)
  )

  // Other scripts not covered by quick actions
  const quickActionKeys = QUICK_ACTIONS.map(a => a.key)
  const otherScripts = scripts.filter(([name]) => !quickActionKeys.includes(name))

  return (
    <div className="project-view">
      {/* Header */}
      <div className="project-header">
        <h2 className="project-name">{project.name}</h2>
        <p className="project-path">{project.path}</p>
        <div className="project-meta">
          {depsCount > 0 && (
            <span className="badge badge-neutral">{depsCount} dependencies</span>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      {availableQuickActions.length > 0 && (
        <div className="project-section">
          <h3 className="section-title">Quick Actions</h3>
          <div className="quick-actions">
            {availableQuickActions.map(action => {
              const proc = getProcessForScript(action.key)
              const isRunning = !!proc

              return (
                <div key={action.key} className={`quick-action-card ${isRunning ? 'quick-action-running' : ''}`}>
                  <div className="quick-action-info">
                    <span className="quick-action-label">{action.label}</span>
                    <span className="quick-action-desc">{action.description}</span>
                  </div>
                  <div className="quick-action-controls">
                    {isRunning ? (
                      <>
                        <span className="badge badge-success">Running</span>
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
                      </>
                    ) : (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => onStartScript(project.id, action.key)}
                      >
                        {action.icon} Run
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Other Scripts */}
      {otherScripts.length > 0 && (
        <div className="project-section">
          <h3 className="section-title">Other Scripts</h3>
          <div className="scripts-grid">
            {otherScripts.map(([name, command]) => {
              const proc = getProcessForScript(name)
              const isRunning = !!proc

              return (
                <div
                  key={name}
                  className={`script-card ${isRunning ? 'script-card-running' : ''}`}
                >
                  <div className="script-info">
                    <span className="script-name">{name}</span>
                    <span className="script-command">{command}</span>
                  </div>
                  <div className="script-actions">
                    {isRunning ? (
                      <>
                        <span className="badge badge-success">Running</span>
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
                      </>
                    ) : (
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => onStartScript(project.id, name)}
                        title="Start"
                      >
                        ▶
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Terminal Output */}
      {processes.length > 0 && (
        <div className="project-section">
          <h3 className="section-title">Output</h3>

          {processes.length > 1 && (
            <div className="terminal-tabs">
              {processes.map(proc => (
                <button
                  key={proc.id}
                  className={`terminal-tab ${(activeProcess && activeProcess.id === proc.id) ? 'active' : ''}`}
                  onClick={() => setSelectedProcessId(proc.id)}
                >
                  {proc.script}
                </button>
              ))}
            </div>
          )}

          {activeProcess && (
            <Terminal
              processId={activeProcess.id}
              socket={socket}
            />
          )}
        </div>
      )}
    </div>
  )
}
