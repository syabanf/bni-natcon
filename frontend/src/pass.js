/*
 * What an attendee's QR carries.
 *
 * The ticket number is the identity the ticketing team issued and the one
 * printed on the physical ticket, so that is what every scanner at the event
 * reads: booth scanners, the learning-class door, the goodiebag and pin desk.
 *
 * The member code stays as the human-readable ID on the pass, and it still
 * resolves at every scanner — an attendee the committee typed in by hand has
 * no ticket number at all, and their QR falls back to it.
 */
export const scanCode = (user) => user?.ticket_number || user?.member_code || ''
