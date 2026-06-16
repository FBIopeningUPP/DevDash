import './Sidebar.css'

export default function Sidebar({
  projects,
  selectedProjectId,
  onSelectProject,
  onAddProject,
  onShowInstances,
  activeTab,
  runningProcesses,
  theme,
  onThemeChange
}) {
  const runningCount = runningProcesses.length

  const projectHasRunning = (projectId) => {
    return runningProcesses.some(p => p.projectId === projectId)
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1 className="sidebar-logo">DevDash</h1>
        <span className="sidebar-tagline">Project Manager</span>
      </div>

      <div className="sidebar-divider" />

      <div className="sidebar-section">
        <button
          className={`sidebar-item sidebar-running ${activeTab === 'instances' ? 'active' : ''}`}
          onClick={onShowInstances}
        >
          <span className="sidebar-item-left">
            {runningCount > 0 && <span className="running-dot" />}
            <span>Running</span>
          </span>
          <span className="badge badge-neutral">{runningCount}</span>
        </button>
      </div>

      <div className="sidebar-divider" />

      <div className="sidebar-section">
        <div className="sidebar-section-header">
          <span className="sidebar-section-title">Projects</span>
          <button className="btn btn-ghost btn-sm" onClick={onAddProject}>+</button>
        </div>

        <div className="sidebar-project-list">
          {projects.map(project => (
            <button
              key={project.id}
              className={`sidebar-item sidebar-project ${selectedProjectId === project.id && activeTab === 'project' ? 'active' : ''}`}
              onClick={() => onSelectProject(project.id)}
            >
              <span className="sidebar-item-left">
                {projectHasRunning(project.id) && <span className="running-dot" />}
                <span className="sidebar-project-name">{project.name}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="sidebar-footer">
        <div className="sidebar-divider" />
        <div className="sidebar-section">
          <div className="sidebar-section-header">
            <span className="sidebar-section-title">Theme</span>
          </div>
          <div className="theme-switcher">
            <select
              id="theme-switcher"
              value={theme}
              onChange={(e) => onThemeChange(e.target.value)}
              className="theme-select"
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="dracula">Dracula</option>
              <option value="nord">Nord</option>
              <option value="monokai">Monokai</option>
            </select>
          </div>
        </div>
      </div>
    </aside>
  )
}
