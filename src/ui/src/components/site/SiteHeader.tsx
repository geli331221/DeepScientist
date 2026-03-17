import type { ReactNode } from 'react'
import { Languages, Settings2 } from 'lucide-react'
import { NavLink } from 'react-router-dom'

import { Button, buttonVariants } from '@/components/ui/button'
import { assetUrl } from '@/lib/assets'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'

const copy = {
  en: {
    home: 'Home',
    docs: 'Docs',
    settings: 'Settings',
    language: '中文 / EN',
  },
  zh: {
    home: '首页',
    docs: '文档',
    settings: '设置',
    language: '中文 / EN',
  },
} as const

export function SiteHeader({
  className,
  rightSlot,
}: {
  className?: string
  rightSlot?: ReactNode
}) {
  const { locale, toggleLocale } = useI18n()
  const t = copy[locale]
  const logoSrc = assetUrl('assets/branding/logo.svg')

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'rounded-full px-3 py-2 text-sm transition',
      isActive
        ? 'bg-black/[0.08] text-foreground dark:bg-white/[0.10]'
        : 'text-foreground/70 hover:bg-black/[0.04] hover:text-foreground dark:text-white/70 dark:hover:bg-white/[0.06] dark:hover:text-white'
    )

  return (
    <header
      className={cn(
        'sticky top-0 z-40 border-b border-black/8 bg-[rgba(248,245,239,0.72)] backdrop-blur-xl dark:border-white/[0.08] dark:bg-[rgba(12,14,18,0.72)]',
        className
      )}
    >
      <div className="mx-auto flex min-h-16 w-full max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <NavLink to="/" className="flex items-center gap-2 rounded-full px-1.5 py-1 transition hover:bg-black/[0.04] dark:hover:bg-white/[0.06]">
            <img
              src={logoSrc}
              alt="DeepScientist"
              className="h-7 w-auto object-contain"
              draggable={false}
            />
            <span className="hidden text-sm font-semibold tracking-tight sm:inline">DeepScientist</span>
          </NavLink>

          <nav className="hidden items-center gap-1 md:flex">
            <NavLink to="/" end className={linkClass}>
              {t.home}
            </NavLink>
            <NavLink to="/docs" className={linkClass}>
              {t.docs}
            </NavLink>
            <NavLink to="/settings" className={linkClass}>
              {t.settings}
            </NavLink>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {rightSlot}
          <Button variant="secondary" size="sm" onClick={toggleLocale} className="rounded-full">
            <Languages className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t.language}</span>
          </Button>
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              cn(
                buttonVariants({
                  variant: isActive ? 'default' : 'secondary',
                  size: 'sm',
                  className: 'rounded-full',
                })
              )
            }
          >
            <Settings2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t.settings}</span>
          </NavLink>
        </div>
      </div>
    </header>
  )
}
