import { illustrationManifest, type IllustrationId } from '../lib/illustrations'

export function Illustration({ id, label, className = '' }: { id: IllustrationId; label?: string; className?: string }) {
  const asset = illustrationManifest[id]
  const style = {
    WebkitMaskImage: `url("${asset.path}")`,
    maskImage: `url("${asset.path}")`,
  }
  return <span className={`illustration ${className}`.trim()} style={style} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} />
}
