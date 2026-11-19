import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  Activity, ArrowUp, Bot, Check, ChevronDown, CircleHelp, Code2,
  Command, Cpu, FolderGit2, Gauge, Github, Layers3, Menu, MessageSquare,
  MoreHorizontal, Paperclip, Plus, Radio, Search, Settings2, ShieldCheck, Sparkles,
  X, Zap,
} from 'lucide-react';
import { checkHealth, sendChat } from './lib/api';
import type { ChatMessage } from './types';

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
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [configured, setConfigured] = useState(false);
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
    }).catch(() => setApiOnline(false));
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, busy]);

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
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setBusy(false);
      inputRef.current?.focus();
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
        <button className="new-chat" onClick={() => { setMessages([]); setActiveTab('Chat'); setSidebarOpen(false); }}>
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
            <button key={name} className={`nav-item ${activeTab === name ? 'active' : ''}`} onClick={() => { setActiveTab(name); setSidebarOpen(false); if (name !== 'Chat') setNotice(`${name} workspace is coming in a future release.`); else setNotice(''); }}>
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
          {messages.length === 0 ? (
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
          ) : (
            <div className="conversation">
              <div className="conversation-heading"><div><span className="eyebrow-mini">ZUNO SESSION</span><h2>Let's make it happen.</h2></div><span className="session-tag"><Radio size={12} /> Live session</span></div>
              {messages.map((message) => <article className={`message-row ${message.role}`} key={message.id}><div className={`message-avatar ${message.role}`}>{message.role === 'assistant' ? <Sparkles size={16} /> : 'Y'}</div><div className="message-body"><div className="message-meta"><strong>{message.role === 'assistant' ? 'ZUNO Agent' : 'You'}</strong><span>{message.role === 'assistant' ? 'AI assistant' : 'Just now'}</span></div><p>{message.content}</p></div></article>)}
              {busy && <div className="message-row assistant"><div className="message-avatar assistant"><Sparkles size={16} /></div><div className="message-body"><div className="message-meta"><strong>ZUNO Agent</strong><span>Thinking</span></div><div className="typing"><i /><i /><i /></div></div></div>}
              {notice && <div className="inline-notice"><CircleHelp size={15} />{notice}<button onClick={() => setNotice('')} aria-label="Dismiss"><X size={14} /></button></div>}
              <div ref={bottomRef} />
            </div>
          )}
          {messages.length === 0 && notice && <div className="inline-notice welcome-notice"><CircleHelp size={15} />{notice}<button onClick={() => setNotice('')} aria-label="Dismiss"><X size={14} /></button></div>}
        </section>

        <div className="composer-area">
          <form className="composer glass-panel" onSubmit={onSubmit}>
            <textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void submit(); } }} placeholder="Ask ZUNO to build, debug, or explore..." rows={1} disabled={busy} />
            <div className="composer-bottom"><div className="composer-tools"><button type="button" className="tool-button" onClick={() => setNotice('Project attachment support is coming soon.')} aria-label="Attach project"><Paperclip size={16} /></button><span className="composer-hint"><Command size={11} /> Enter to send · Shift + Enter for newline</span></div><button className="send-button" type="submit" disabled={!input.trim() || busy} aria-label="Send message">{busy ? <span className="send-loader" /> : <ArrowUp size={18} />}</button></div>
          </form>
          <div className="composer-disclaimer"><ShieldCheck size={12} /> ZUNO can make mistakes. Review important changes before applying them.</div>
        </div>
      </main>

      {showSettings && <div className="modal-backdrop" onClick={() => setShowSettings(false)}><section className="settings-modal glass-panel" onClick={(e) => e.stopPropagation()}><div className="modal-heading"><div><span className="eyebrow-mini">PREFERENCES</span><h2>Workspace settings</h2></div><button className="icon-button" onClick={() => setShowSettings(false)}><X size={18} /></button></div><div className="settings-row"><span className="settings-symbol"><Cpu size={17} /></span><div><strong>AI provider</strong><p>Configured securely on your server</p></div><span className={`settings-state ${configured ? 'good' : ''}`}>{configured ? 'Connected' : 'Not configured'}</span></div><div className="settings-row"><span className="settings-symbol"><Github size={17} /></span><div><strong>GitHub integration</strong><p>Repository tools are not enabled yet</p></div><span className="settings-state">Coming soon</span></div><div className="settings-row"><span className="settings-symbol"><Gauge size={17} /></span><div><strong>API status</strong><p>Local development server</p></div><span className={`settings-state ${apiOnline ? 'good' : ''}`}>{apiOnline ? 'Online' : 'Offline'}</span></div><div className="modal-footnote"><ShieldCheck size={14} /> Your provider key stays on the server and is never sent to the browser.</div></section></div>}
      <div className="build-stamp"><Layers3 size={12} /> ZUNO AGENT <span>·</span> EARLY ACCESS</div>
    </div>
  );
}