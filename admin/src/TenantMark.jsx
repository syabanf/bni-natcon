import { assetUrl } from './api'

/*
 * How a booth shows up in a list: its own logo when it sent one, its two
 * letters when it did not.
 *
 * Both live in a slot of the same width, because a list where the name
 * starts at a different place on every row reads as broken. The logos are
 * exported onto one canvas (scripts/booth_logos.py), so a square mark and a
 * wide wordmark come out the same visual size inside it.
 */
export default function TenantMark({ tenant, className = '' }) {
  return (
    <span className={`tn-mark ${className}`.trim()}>
      {tenant?.logo_url ? (
        <img className="tn-mark-img" src={assetUrl(tenant.logo_url)} alt={tenant.name} />
      ) : (
        <span className="tn-mark-ini">{tenant?.initials}</span>
      )}
    </span>
  )
}
