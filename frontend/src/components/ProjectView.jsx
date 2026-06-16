import { useState, useEffect } from 'react'
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
  const [gitData, setGitData] = useState({ branch: null, uncommitted: 0 })
  const [viewTab, setViewTab] = useState('runner')

  const [envContent, setEnvContent] = useState('')
  const [envSaving, setEnvSaving] = useState(false)

  const [outdatedDeps, setOutdatedDeps] = useState(null)
  const [loadingDeps, setLoadingDeps] = useState(false)

  useEffect(() => {
    if (project) {
      fetch(`/api/projects/${project.id}/git`)
        .then(res => res.json())
        .then(data => setGitData(data))
        .catch(err => console.error('Failed to fetch git data:', err))
    }
  }, [project])

  useEffect(() => {
    if (project && viewTab === 'env') {
      fetch(`/api/projects/${project.id}/env`)
        .then(res => res.json())
        .then(data => setEnvContent(data.content || ''))
        .catch(err => console.error('Failed to fetch env:', err))
    }
  }, [project, viewTab])

  useEffect(() => {
    if (project && viewTab === 'deps' && !outdatedDeps && !loadingDeps) {
      setLoadingDeps(true)
      fetch(`/api/projects/${project.id}/dependencies/outdated`)
        .then(res => res.json())
        .then(data => {
          setOutdatedDeps(data)
          setLoadingDeps(false)
        })
        .catch(err => {
          console.error('Failed to fetch outdated deps:', err)
          setLoadingDeps(false)
        })
    }
  }, [project, viewTab, outdatedDeps, loadingDeps])

  const handleOpenVSCode = async () => {
    try {
      await fetch(`/api/projects/${project.id}/open`, { method: 'POST' })
    } catch (err) {
      console.error('Failed to open VS Code:', err)
    }
  }

  const saveEnv = async () => {
    setEnvSaving(true)
    try {
      await fetch(`/api/projects/${project.id}/env`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: envContent })
      })
    } catch (err) {
      console.error('Failed to save env:', err)
    }
    setEnvSaving(false)
  }

  const scripts = project.scripts ? Object.entries(project.scripts) : []
  const scriptNames = project.scripts ? Object.keys(project.scripts) : []
  const depsCount = project.dependenciesCount || 0

  const getProcessForScript = (scriptName) => {
    return processes.find(p => p.script === scriptName)
  }

  const activeProcess = selectedProcessId
    ? processes.find(p => p.id === selectedProcessId)
    : processes[0] || null

  const availableQuickActions = QUICK_ACTIONS.filter(
    action => action.alwaysAvailable || scriptNames.includes(action.key)
  )

  const quickActionKeys = QUICK_ACTIONS.map(a => a.key)
  const otherScripts = scripts.filter(([name]) => !quickActionKeys.includes(name))

  return (
    <div className="project-view">
      {/* Header */}
      <div className="project-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 className="project-name">{project.name}</h2>
            <p className="project-path">{project.path}</p>
            <div className="project-meta">
              {depsCount > 0 && (
                <span className="badge badge-neutral">{depsCount} dependencies</span>
              )}
              {gitData.branch && (
                <span className="badge badge-neutral" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                    <path fillRule="evenodd" d="M11.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.25.75a2.25 2.25 0 113 2.122V6A2.5 2.5 0 0110 8.5H6a1 1 0 00-1 1v1.128a2.251 2.251 0 11-1.5 0V5.372a2.25 2.25 0 111.5 0v1.836A2.492 2.492 0 016 7h4a1 1 0 001-1v-.628A2.25 2.25 0 019.5 3.25zM4.25 12a.75.75 0 100 1.5.75.75 0 000-1.5zM3.5 3.25a.75.75 0 111.5 0 .75.75 0 01-1.5 0z"></path>
                  </svg>
                  {gitData.branch}
                  {gitData.uncommitted > 0 && ` (±${gitData.uncommitted})`}
                </span>
              )}
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={handleOpenVSCode} title="Open in VS Code" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M1.385 5.5l5.228-3.414 7.026-1.63v15.088l-7.026-1.63-5.228-3.414.935-.918 3.966 2.62 5.087 1.18V2.62L6.286 3.8 2.32 6.418l-.935-.918z"></path>
            </svg>
            Open in VS Code
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="project-tabs" style={{ display: 'flex', gap: '12px', borderBottom: '1px solid var(--border-color)', marginBottom: '24px' }}>
        <button 
          className={`tab-btn ${viewTab === 'runner' ? 'active' : ''}`} 
          onClick={() => setViewTab('runner')}
          style={{ padding: '8px 4px', border: 'none', background: 'none', cursor: 'pointer', borderBottom: viewTab === 'runner' ? '2px solid var(--accent)' : '2px solid transparent', color: viewTab === 'runner' ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: 500 }}
        >
          Runner
        </button>
        <button 
          className={`tab-btn ${viewTab === 'env' ? 'active' : ''}`} 
          onClick={() => setViewTab('env')}
          style={{ padding: '8px 4px', border: 'none', background: 'none', cursor: 'pointer', borderBottom: viewTab === 'env' ? '2px solid var(--accent)' : '2px solid transparent', color: viewTab === 'env' ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: 500 }}
        >
          Environment
        </button>
        <button 
          className={`tab-btn ${viewTab === 'deps' ? 'active' : ''}`} 
          onClick={() => setViewTab('deps')}
          style={{ padding: '8px 4px', border: 'none', background: 'none', cursor: 'pointer', borderBottom: viewTab === 'deps' ? '2px solid var(--accent)' : '2px solid transparent', color: viewTab === 'deps' ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: 500 }}
        >
          Dependencies
        </button>
      </div>

      <div className="tab-content">
        {viewTab === 'runner' && (
          <>
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
                    key={activeProcess.id}
                    processId={activeProcess.id}
                    socket={socket}
                  />
                )}
              </div>
            )}
          </>
        )}

        {viewTab === 'env' && (
          <div className="env-editor">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <h3 className="section-title" style={{ margin: 0 }}>.env File</h3>
              <button className="btn btn-primary btn-sm" onClick={saveEnv} disabled={envSaving}>
                {envSaving ? 'Saving...' : 'Save .env'}
              </button>
            </div>
            <textarea 
              value={envContent} 
              onChange={e => setEnvContent(e.target.value)} 
              spellCheck="false"
              placeholder="# Add environment variables here (e.g. PORT=3000)"
              style={{ 
                width: '100%', 
                height: '400px', 
                fontFamily: 'var(--font-mono)', 
                fontSize: '13px',
                padding: '16px', 
                borderRadius: 'var(--radius-md)', 
                backgroundColor: 'var(--terminal-bg)', 
                color: 'var(--terminal-text)',
                border: '1px solid var(--border-color)',
                resize: 'vertical'
              }}
            />
          </div>
        )}

        {viewTab === 'deps' && (
          <div className="deps-manager">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', alignItems: 'center' }}>
              <h3 className="section-title" style={{ margin: 0 }}>Outdated Dependencies</h3>
              <button 
                className="btn btn-ghost btn-sm" 
                onClick={() => { setOutdatedDeps(null); setLoadingDeps(false); }}
                disabled={loadingDeps}
              >
                ↻ Refresh
              </button>
            </div>
            
            {loadingDeps ? (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <p>Checking npm registry for updates...</p>
                <p style={{ fontSize: '12px' }}>This may take a few seconds.</p>
              </div>
            ) : (
              outdatedDeps && Object.keys(outdatedDeps).length > 0 ? (
                <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                  <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead style={{ backgroundColor: 'var(--bg-surface-hover)' }}>
                      <tr>
                        <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Package</th>
                        <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Current</th>
                        <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Wanted</th>
                        <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Latest</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(outdatedDeps).map(([pkg, info]) => (
                        <tr key={pkg} style={{ borderTop: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{pkg}</td>
                          <td style={{ padding: '12px 16px' }}>{info.current || 'N/A'}</td>
                          <td style={{ padding: '12px 16px', color: 'var(--success)' }}>{info.wanted}</td>
                          <td style={{ padding: '12px 16px', color: 'var(--accent)' }}>{info.latest}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--success)', backgroundColor: 'var(--success-light)', borderRadius: 'var(--radius-md)' }}>
                  <p style={{ fontWeight: 600 }}>All dependencies are up to date!</p>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  )
}
