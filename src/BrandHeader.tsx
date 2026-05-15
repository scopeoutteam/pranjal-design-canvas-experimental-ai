import logoUrl from './assets/scopeout-logo-full.svg'

export default function BrandHeader() {
  return (
    <div
      style={{
        position: 'fixed',
        top: 18,
        left: 18,
        display: 'flex',
        alignItems: 'center',
        zIndex: 20,
        pointerEvents: 'none',
      }}
    >
      <img src={logoUrl} alt="Scopeout" height={28} style={{ display: 'block', width: 'auto' }} />
    </div>
  )
}
