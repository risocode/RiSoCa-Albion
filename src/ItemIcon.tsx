import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { localItemIconUrl, type LocalIconFolder } from './itemIconUrl'

type ItemIconProps = {
  uniqueName: string
  enchantmentLevel?: number
  /** Folder inside `public/item-icons` to load from first. */
  localFolder?: LocalIconFolder
  /** Display size in CSS pixels. */
  size?: number
  className?: string
  alt?: string
  hoverLabel?: string
  /** `eager` + high fetch priority speeds up the selected weapon / hero icon. */
  loading?: 'eager' | 'lazy'
  fetchPriority?: 'high' | 'low' | 'auto'
  showPreview?: boolean
}

export function ItemIcon({
  uniqueName,
  enchantmentLevel,
  localFolder = 'resources',
  size = 48,
  className = '',
  alt = '',
  hoverLabel,
  loading = 'lazy',
  fetchPriority,
  showPreview = true,
}: ItemIconProps) {
  const [sourceMode, setSourceMode] = useState<'local' | 'broken'>('local')
  const [hovered, setHovered] = useState(false)
  const [previewPos, setPreviewPos] = useState({ top: 0, left: 0 })
  const hostRef = useRef<HTMLSpanElement | null>(null)
  const previewWidth = Math.max(144, size * 2 + 24)
  const previewHeight = Math.max(132, size * 2 + 34)
  const src = localItemIconUrl(localFolder, uniqueName, enchantmentLevel)

  useEffect(() => {
    // Re-evaluate source from local cache whenever icon identity changes.
    setSourceMode('local')
  }, [localFolder, uniqueName, enchantmentLevel])

  useLayoutEffect(() => {
    if (!hovered) return
    const el = hostRef.current
    if (!el) return

    const place = () => {
      const rect = el.getBoundingClientRect()
      const vw = window.innerWidth
      const vh = window.innerHeight
      const pad = 8

      let left = rect.right + 10
      if (left + previewWidth > vw - pad) {
        left = rect.left - previewWidth - 10
      }
      left = Math.max(pad, Math.min(left, vw - previewWidth - pad))

      let top = rect.top + rect.height / 2 - previewHeight / 2
      top = Math.max(pad, Math.min(top, vh - previewHeight - pad))
      setPreviewPos({ top, left })
    }

    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [hovered, previewHeight, previewWidth])

  if (sourceMode === 'broken') {
    return (
      <span
        className={`item-icon item-icon--fallback ${className}`.trim()}
        style={{ width: size, height: size }}
        aria-hidden
      />
    )
  }

  return (
    <span
      ref={hostRef}
      className="item-icon-wrap"
      onMouseEnter={() => {
        if (showPreview) setHovered(true)
      }}
      onMouseLeave={() => {
        if (showPreview) setHovered(false)
      }}
    >
      <img
        className={`item-icon ${className}`.trim()}
        src={src}
        alt={alt}
        width={size}
        height={size}
        loading={loading}
        decoding="async"
        {...(fetchPriority ? { fetchPriority } : {})}
        onError={() => setSourceMode('broken')}
      />
      {showPreview && hovered
        ? createPortal(
            <span
              className="item-icon-preview"
              role="tooltip"
              aria-hidden
              style={{
                position: 'fixed',
                top: previewPos.top,
                left: previewPos.left,
                width: previewWidth,
                minHeight: previewHeight,
              }}
            >
              <img
                className="item-icon-preview__img"
                src={src}
                alt=""
                width={Math.max(84, size * 2)}
                height={Math.max(84, size * 2)}
              />
              <span className="item-icon-preview__label">{hoverLabel ?? uniqueName}</span>
            </span>,
            document.body
          )
        : null}
    </span>
  )
}
