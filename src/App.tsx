import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  Activity, ArrowLeft, ArrowUp, Bot, Check, ChevronDown, CircleHelp, Code2,
  Command, Cpu, FolderGit2, Gauge, Github, Layers3, Menu, MessageSquare,
  CheckCircle2, ExternalLink, FileCode2, FileText, GitPullRequest, Globe, Lock, MoreHorizontal, Paperclip, Plus, Radio, RefreshCw, Search, Settings2, ShieldCheck, Sparkles,
  X, Zap,
} from 'lucide-react';
import { approveProposal, checkHealth, getRepositoryFile, getRepositoryTree, listRepositories, sendChat } from './lib/api';
import type { ChangeProposal, ChatMessage, Repository, RepositoryEntry } from './types';

const starterPrompts = [
  { icon: Code2, title: 'Build a feature', detail: 'Plan and implement a new capability' },
  { icon: Search, title: 'Understand this codebase', detail: 'Explore architecture and key files' },
  { icon: ShieldCheck, title: 'Review for issues', detail: 'Find bugs and security risks' },
];

function makeMessage(role: ChatMessage['role'], content: string): ChatMessage {
  return { id: crypto.randomUUID(), role, content };
}

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [proposals, setProposals] = useState<ChangeProposal[]>([]);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [githubConfigured, setGithubConfigured] = useState(false);
  const [projects, setProjects] = useState<Repository[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsLoaded, setProjectsLoaded] = useState(false);
  const [projectError, setProjectError] = useState('');
  const [selectedProject, setSelectedProject] = useState<Repository | null>(null);
  const [projectFiles, setProjectFiles] = useState<RepositoryEntry[]>([]);
  const [projectLoading, setProjectLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState('');
  const [fileContent, setFileContent] = useState('');
  const [fileLoading, setFileLoading] = useState(false);
  const [apiOnline, setApiOnline] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('Chat');
  const [showSettings, setShowSettings] = useState(false);
  const [notice, setNotice] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    checkHealth().then((health) => {
      setApiOnline(health.ok);
      setConfigured(health.configured);
      setGithubConfigured(health.githubConfigured);
    }).catch(() => setApiOnline(false));
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, busy]);

  useEffect(() => {
    if (activeTab !== 'Projects' || !githubConfigured || projectsLoaded || projectsLoading) return;
    setProjectsLoading(true);
    listRepositories().then(setProjects).catch((error) => setProjectError(error instanceof Error ? error.message : 'Could not load repositories.')).finally(() => { setProjectsLoading(false); setProjectsLoaded(true); });
  }, [activeTab, githubConfigured, projectsLoaded, projectsLoading]);

  async function openProject(project: Repository) {
    setSelectedProject(project);
    setProjectFiles([]);
    setSelectedFile('');
    setFileContent('');
    setProjectError('');
    setProjectLoading(true);
    try {
      const [owner, repo] = project.fullName.split('/');
      const tree = await getRepositoryTree(owner, repo, project.defaultBranch);
      setProjectFiles(tree.entries);
    } catch (error) {
      setProjectError(error instanceof Error ? error.message : 'Could not read this repository.');
    } finally {
      setProjectLoading(false);
    }
  }

  async function openFile(path: string) {
    if (!selectedProject) return;
    setSelectedFile(path);
    setFileLoading(true);
    setFileContent('');
    setProjectError('');
    try {
      const [owner, repo] = selectedProject.fullName.split('/');
      const file = await getRepositoryFile(owner, repo, path);
      setFileContent(file.content);
    } catch (error) {
      setProjectError(error instanceof Error ? error.message : 'Could not open this file.');
    } finally {
      setFileLoading(false);
    }
  }

  async function submit(text = input) {
    const prompt = text.trim();
    if (!prompt || busy) return;
    const next = [...messages, makeMessage('user', prompt)];
    setMessages(next);
    setInput('');
    setBusy(true);
    setNotice('');
    try {
      const result = await sendChat(next);
      setMessages((current) => [...current, makeMessage('assistant', result.message)]);
      if (result.proposals?.length) setProposals((current) => [...current, ...result.proposals!]);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  async function approveChange(proposalId: string) {
    setApprovingId(proposalId);
    setProposals((current) => current.map((proposal) => proposal.id === proposalId ? { ...proposal, approvalError: undefined } : proposal));
    try {
      const result = await approveProposal(proposalId);
      setProposals((current) => current.map((proposal) => proposal.id === proposalId ? { ...proposal, status: 'approved', pullRequestUrl: result.pullRequestUrl, pullRequestCreated: result.pullRequestCreated } : proposal));
    } catch (error) {
      setProposals((current) => current.map((proposal) => proposal.id === proposalId ? { ...proposal, approvalError: error instanceof Error ? error.message : 'Could not approve this change.' } : proposal));
    } finally {
      setApprovingId(null);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void submit();
  }

  return (
    <div className="app-shell">
      <div className="ambient ambient-one" /><div className="ambient ambient-two" /><div className="ambient ambient-three" />
      <aside className={`sidebar glass-panel ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="brand-row">
          <div className="brand-mark"><Sparkles size={19} strokeWidth={2.2} /></div>
          <span className="brand-name">zuno<span>.</span></span>
          <button className="icon-button mobile-close" onClick={() => setSidebarOpen(false)} aria-label="Close menu"><X size={18} /></button>
        </div>
        <button className="new-chat" onClick={() => { setMessages([]); setProposals([]); setActiveTab('Chat'); setSidebarOpen(false); }}>
          <Plus size={17} /><span>New session</span><kbd>⌘ K</kbd>
        </button>
        <div className="side-label">WORKSPACE</div>
        <nav className="nav-list">
          {[
            { name: 'Chat', icon: MessageSquare },
            { name: 'Projects', icon: FolderGit2 },
            { name: 'Code review', icon: ShieldCheck },
            { name: 'Activity', icon: Activity },
          ].map(({ name, icon: Icon }) => (
            <button key={name} className={`nav-item ${activeTab === name ? 'active' : ''}`} onClick={() => { setActiveTab(name); setSidebarOpen(false); if (name === 'Chat') setNotice(''); else if (name !== 'Projects') setNotice(`${name} tools are being built. The repository browser is available now.`); else setNotice(''); }}>
              <Icon size={17} /><span>{name}</span>{name === 'Activity' && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="side-label recent-label">RECENT</div>
        {messages.length > 0 ? <button className="recent-item" onClick={() => setActiveTab('Chat')}><MessageSquare size={15} /><span>{messages.find(m => m.role === 'user')?.content || 'Current session'}</span></button> : <div className="empty-recent">Your sessions will appear here.</div>}
        <div className="sidebar-spacer" />
        <div className="usage-card">
          <div className="usage-top"><span className="usage-icon"><Zap size={14} /></span><span>Agent status</span><span className={`status-dot ${apiOnline ? 'online' : ''}`} /></div>
          <p>{apiOnline ? (configured ? 'Ready for your next task' : 'API ready · Add an AI key') : 'Waiting for local API'}</p>
          <div className="usage-track"><span style={{ width: apiOnline ? '100%' : '18%' }} /></div>
        </div>
        <button className="profile-row" onClick={() => setShowSettings(true)}>
          <div className="avatar">Z</div><div className="profile-copy"><strong>ZUNO workspace</strong><span>Personal edition</span></div><MoreHorizontal size={18} className="profile-more" />
        </button>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button menu-button" onClick={() => setSidebarOpen(true)} aria-label="Open menu"><Menu size={19} /></button>
            <div className="breadcrumb"><span>Workspace</span><span className="crumb-slash">/</span><strong>{activeTab}</strong><ChevronDown size={14} /></div>
          </div>
          <div className="topbar-right">
            <div className="connection-pill"><span className={`status-dot ${apiOnline ? 'online' : ''}`} />{apiOnline ? 'Local API connected' : 'API offline'}</div>
            <button className="icon-button" aria-label="Help" onClick={() => setNotice('ZUNO Agent is an early foundation release. Configure your AI provider in the server .env file to start chatting.')}><CircleHelp size={18} /></button>
            <button className="settings-button" onClick={() => setShowSettings(true)}><Settings2 size={16} /><span>Settings</span></button>
          </div>
        </header>

        <section className="workspace-content">
          {activeTab === 'Projects' ? (
            <div className="projects-view">
              <div className="projects-heading">
                <div><span className="eyebrow-mini">GITHUB WORKSPACE</span><h2>{selectedProject ? selectedProject.name : 'Your repositories'}</h2><p>{selectedProject ? selectedProject.fullName + ' · ' + selectedProject.defaultBranch : 'Browse codebases connected to your GitHub account.'}</p></div>
                <div className="project-heading-actions">
                  {selectedProject && <button className="settings-button" onClick={() => { setSelectedProject(null); setProjectFiles([]); setSelectedFile(''); setProjectError(''); }}><ArrowLeft size={15} /> Repositories</button>}
                  <button className="icon-button" aria-label="Refresh repositories" onClick={() => { setProjects([]); setProjectsLoaded(false); setProjectError(''); }}><RefreshCw size={16} /></button>
                </div>
              </div>
              {!githubConfigured ? (
                <div className="connect-card glass-panel"><div className="connect-icon"><Github size={23} /></div><h3>Connect your GitHub</h3><p>Add a fine-grained GitHub token to the server environment to let ZUNO inspect your repositories and source files. Use read-only access for Metadata and Contents.</p><code>GITHUB_TOKEN=github_pat_...</code><span className="connect-note">The token stays on your server. It is never sent to the browser.</span></div>
              ) : projectError ? <div className="inline-notice"><CircleHelp size={15} />{projectError}<button onClick={() => setProjectError('')} aria-label="Dismiss"><X size={14} /></button></div> : selectedProject ? (
                <div className="repository-detail">
                  <div className="file-list glass-panel"><div className="file-list-heading"><span>FILES</span><small>{projectFiles.length} files</small></div>{projectLoading ? <div className="project-loading"><span className="send-loader" /> Reading repository tree…</div> : projectFiles.map((file) => <button key={file.path} className={`file-row ${selectedFile === file.path ? 'selected' : ''}`} onClick={() => void openFile(file.path)}><FileCode2 size={14} /><span>{file.path}</span></button>)}</div>
                  <div className="file-preview glass-panel">{selectedFile ? <><div className="file-preview-heading"><FileText size={14} /><span>{selectedFile}</span></div>{fileLoading ? <div className="project-loading"><span className="send-loader" /> Loading file…</div> : <pre>{fileContent}</pre>}</> : <div className="file-empty"><Code2 size={24} /><strong>Select a file to preview</strong><span>Text files up to 100 KB can be opened here.</span></div>}</div>
                </div>
              ) : projectsLoading ? <div className="project-loading"><span className="send-loader" /> Loading your GitHub repositories…</div> : projects.length === 0 ? <div className="file-empty"><FolderGit2 size={25} /><strong>No repositories found</strong><span>Check that your token can read repository metadata and contents.</span></div> : <div className="repository-grid">{projects.map((project) => <button className="repository-card glass-panel" key={project.id} onClick={() => void openProject(project)}><div className="repository-card-top"><span className="repo-icon"><FolderGit2 size={17} /></span><span className="repo-visibility">{project.private ? <Lock size={11} /> : <Globe size={11} />}{project.private ? 'Private' : 'Public'}</span></div><strong>{project.name}</strong><span className="repo-fullname">{project.fullName}</span><p>{project.description || 'No description provided.'}</p><div className="repo-card-footer"><span>{project.language || 'Source code'}</span><span>Open project <ExternalLink size={11} /></span></div></button>)}</div>
              }
            </div>
          ) : activeTab === 'Chat' && messages.length === 0 ? (
            <div className="welcome-wrap">
              <div className="welcome-orbit"><div className="orbit-ring ring-a" /><div className="orbit-ring ring-b" /><div className="orbit-core"><Bot size={31} /></div><span className="orbit-spark spark-a"><Sparkles size={15} /></span><span className="orbit-spark spark-b"><Code2 size={14} /></span><span className="orbit-spark spark-c"><Zap size={13} /></span></div>
              <div className="eyebrow"><span className="eyebrow-line" /> YOUR AI ENGINEERING PARTNER <span className="eyebrow-line" /></div>
              <h1>Build something<br /><span>remarkable.</span></h1>
              <p className="welcome-subtitle">Your ideas, your codebase, one thoughtful agent.<br className="desktop-break" /> What are we working on today?</p>
              <div className="starter-grid">
                {starterPrompts.map(({ icon: Icon, title, detail }) => <button className="starter-card glass-panel" key={title} onClick={() => { setInput(title === 'Build a feature' ? 'Help me plan and build a new feature.' : title === 'Understand this codebase' ? 'Help me understand the architecture of my codebase.' : 'Review my code for bugs and security issues.'); inputRef.current?.focus(); }}><span className="starter-icon"><Icon size={18} /></span><span className="starter-text"><strong>{title}</strong><small>{detail}</small></span><ArrowUp size={15} className="starter-arrow" /></button>)}
              </div>
              <div className="capability-row"><span><Check size={13} /> Thoughtful planning</span><i /><span><Check size={13} /> Code-first answers</span><i /><span><Check size={13} /> Human in control</span></div>
            </div>
          ) : activeTab === 'Chat' ? (
            <div className="conversation">
              <div className="conversation-heading"><div><span className="eyebrow-mini">ZUNO SESSION</span><h2>Let's make it happen.</h2></div><span className="session-tag"><Radio size={12} /> Live session</span></div>
              {messages.map((message) => <article className={`message-row ${message.role}`} key={message.id}><div className={`message-avatar ${message.role}`}>{message.role === 'assistant' ? <Sparkles size={16} /> : 'Y'}</div><div className="message-body"><div className="message-meta"><strong>{message.role === 'assistant' ? 'ZUNO Agent' : 'You'}</strong><span>{message.role === 'assistant' ? 'AI assistant' : 'Just now'}</span></div><p>{message.content}</p></div></article>)}
              {proposals.map((proposal) => <article className="proposal-card glass-panel" key={proposal.id}><div className="proposal-heading"><span className="proposal-icon"><GitPullRequest size={16} /></span><div><strong>Proposed code change</strong><small>{proposal.fullName} · {proposal.path}</small></div><span className={`proposal-status ${proposal.status}`}>{proposal.status === 'approved' ? (proposal.pullRequestCreated ? 'PR created' : 'Branch ready') : 'Needs review'}</span></div><p>{proposal.summary}</p><details><summary>Review the complete file change</summary><div className="proposal-code-grid"><section><small>BEFORE</small><pre>{proposal.originalContent || 'New file'}</pre></section><section><small>PROPOSED</small><pre>{proposal.proposedContent}</pre></section></div></details>{proposal.approvalError && <div className="proposal-error">{proposal.approvalError}</div>}{proposal.status === 'approved' ? <a className="proposal-link" href={proposal.pullRequestUrl} target="_blank" rel="noreferrer"><CheckCircle2 size={14} /> {proposal.pullRequestCreated ? 'Open pull request' : 'Open branch'} <ExternalLink size={12} /></a> : <button className="approve-button" disabled={approvingId === proposal.id} onClick={() => void approveChange(proposal.id)}>{approvingId === proposal.id ? <span className="send-loader" /> : <CheckCircle2 size={15} />} Approve &amp; create pull request</button>}</article>)}
              {busy && <div className="message-row assistant"><div className="message-avatar assistant"><Sparkles size={16} /></div><div className="message-body"><div className="message-meta"><strong>ZUNO Agent</strong><span>Thinking</span></div><div className="typing"><i /><i /><i /></div></div></div>}
              {notice && <div className="inline-notice"><CircleHelp size={15} />{notice}<button onClick={() => setNotice('')} aria-label="Dismiss"><X size={14} /></button></div>}
              <div ref={bottomRef} />
            </div>
          ) : null}
          {activeTab !== 'Projects' && activeTab !== 'Chat' && <div className="feature-placeholder glass-panel"><Sparkles size={22} /><h2>{activeTab}</h2><p>This workspace is being developed. GitHub repository browsing and AI chat are available now.</p><button className="settings-button" onClick={() => setActiveTab('Chat')}>Back to chat</button></div>}
          {messages.length === 0 && activeTab === 'Chat' && notice && <div className="inline-notice welcome-notice"><CircleHelp size={15} />{notice}<button onClick={() => setNotice('')} aria-label="Dismiss"><X size={14} /></button></div>}
        </section>

        <div className="composer-area">
          <form className="composer glass-panel" onSubmit={onSubmit}>
            <textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void submit(); } }} placeholder="Ask ZUNO to build, debug, or explore..." rows={1} disabled={busy} />
            <div className="composer-bottom"><div className="composer-tools"><button type="button" className="tool-button" onClick={() => setNotice('Project attachment support is coming soon.')} aria-label="Attach project"><Paperclip size={16} /></button><span className="composer-hint"><Command size={11} /> Enter to send · Shift + Enter for newline</span></div><button className="send-button" type="submit" disabled={!input.trim() || busy} aria-label="Send message">{busy ? <span className="send-loader" /> : <ArrowUp size={18} />}</button></div>
          </form>
          <div className="composer-disclaimer"><ShieldCheck size={12} /> ZUNO can make mistakes. Review important changes before applying them.</div>
        </div>
      </main>

      {showSettings && <div className="modal-backdrop" onClick={() => setShowSettings(false)}><section className="settings-modal glass-panel" onClick={(e) => e.stopPropagation()}><div className="modal-heading"><div><span className="eyebrow-mini">PREFERENCES</span><h2>Workspace settings</h2></div><button className="icon-button" onClick={() => setShowSettings(false)}><X size={18} /></button></div><div className="settings-row"><span className="settings-symbol"><Cpu size={17} /></span><div><strong>AI provider</strong><p>Configured securely on your server</p></div><span className={`settings-state ${configured ? 'good' : ''}`}>{configured ? 'Connected' : 'Not configured'}</span></div><div className="settings-row"><span className="settings-symbol"><Github size={17} /></span><div><strong>GitHub integration</strong><p>Read-only repository browsing and agent tools</p></div><span className={`settings-state ${githubConfigured ? 'good' : ''}`}>{githubConfigured ? 'Connected' : 'Not configured'}</span></div><div className="settings-row"><span className="settings-symbol"><Gauge size={17} /></span><div><strong>API status</strong><p>Local development server</p></div><span className={`settings-state ${apiOnline ? 'good' : ''}`}>{apiOnline ? 'Online' : 'Offline'}</span></div><div className="modal-footnote"><ShieldCheck size={14} /> AI and GitHub credentials stay on the server and are never sent to the browser.</div></section></div>}
      <div className="build-stamp"><Layers3 size={12} /> ZUNO AGENT <span>·</span> EARLY ACCESS</div>
    </div>
  );
}