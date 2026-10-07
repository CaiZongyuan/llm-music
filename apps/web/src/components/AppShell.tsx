import { useState } from 'react';
import { Link, Outlet } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { projectsOptions } from '../features/projects/queries';
import { useMessages, usePreferences } from '../features/preferences/Preferences';
import { shellMessages } from './messages';
import { Player } from '../features/player/Player';

export function AppShell() {
  const t = useMessages(shellMessages);
  const { locale, theme, setLocale, setTheme } = usePreferences();
  const [navOpen, setNavOpen] = useState(false);
  const projects = useQuery(projectsOptions());
  return <><a className="skip" href="#workspace">{t.skip}</a><div className="app-shell">
    <aside className={`sidebar ${navOpen ? 'open' : ''}`} aria-label={t.projects}>
      <Link className="brand" to="/" onClick={() => setNavOpen(false)}><span className="brand-mark" aria-hidden="true">♫</span><span>{t.brand}<small>LOCAL MUSIC WORKBENCH</small></span></Link>
      <nav><Link to="/" onClick={() => setNavOpen(false)} className="nav-link" activeOptions={{ exact: true }} activeProps={{ className: 'active' }}><span aria-hidden="true">▦</span>{t.library}</Link></nav>
      <div className="side-heading">{t.projects}</div><div className="project-nav">{projects.data?.map(project => <Link key={project.id} to="/projects/$projectId" params={{ projectId: project.id }} onClick={() => setNavOpen(false)} activeProps={{ className: 'active' }}><span aria-hidden="true">♪</span>{project.name}</Link>)}</div>
      <div className="side-bottom">{t.local}<small>{t.tagline}</small></div>
    </aside><div className="main-shell"><header className="topbar">
      <button className="mobile-nav" type="button" onClick={() => setNavOpen(value => !value)} aria-label={t.openNav} aria-expanded={navOpen}>☰</button>
      <Link className="breadcrumb" to="/">{t.library}</Link>
      <div className="preferences"><label className="language-label">{t.language}<select aria-label={t.language} value={locale} onChange={event => setLocale(event.target.value === 'en' ? 'en' : 'zh-CN')}><option value="zh-CN">中文</option><option value="en">English</option></select></label>
        <button type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={theme === 'dark' ? t.light : t.dark}><span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span> {theme === 'dark' ? t.light : t.dark}</button>
      </div></header><main id="workspace" tabIndex={-1}><Outlet /></main></div>
  </div><Player /></>;
}
