import { assetUrl } from './api'

/*
 * How a booth shows up in a list: its own logo when it sent one, its two
 * letters when it did not.
 *
 * The attendee passport has worked this way since the logos arrived; the
 * committee's own screens were still reading initials, which made the booth
 * list the one place where you could not tell at a glance whose logo is
 * already in and whose is still missing.
 */
export default function TenantMark({ tenant, className = '' }) {
  const cls = `tn-mark ${className}`.trim()
  if (tenant?.logo_url) {
    return <img className={`${cls} img`} src={assetUrl(tenant.logo_url)} alt={tenant.name} />
  }
  return <span className={cls}>{tenant?.initials}</span>
}
