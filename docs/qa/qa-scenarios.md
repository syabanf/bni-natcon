# BNI Natcon 2026 — QA Scenario Test Pack

> Generated from [`natcon2026-qa-scenarios.xlsx`](natcon2026-qa-scenarios.xlsx) —
> edit the workbook, then run `python3 scripts/qa_md_from_xlsx.py`.


## How to use
Work sheet by sheet. Fill the Result column (Pass / Fail / Blocked / N/A) and put anything odd in Notes.
A case fails if ANY expected result in its row does not happen — note which part.
P1 = must pass before the event. P2 = should pass. P3 = polish.

## Environment
Attendee & booth app: http://localhost:5173   ·   Admin panel: http://localhost:5174
Both apps share one browser profile, so you can only be signed into one role at a time.
Use a second browser (or a private window) to hold two roles at once.

## Before you start
Ask for a database reset if the data looks used — several cases assume nothing has been scanned yet.
Camera cases need a real phone; a desktop browser without a camera falls back to manual input, which is a separate case.

## Accounts (seeded, password: natcon2026)
Admin — admin@natcon.id
Attendee — reddie@natcon.id (NATCON-2026-08154) · sinta@natcon.id (…-08201) · agus@natcon.id (…-08322)
Booth scanner — booth-a1@natcon.id (SSCX International) · booth-sp01@natcon.id (BNI Xpora, sponsor)
Imported attendees sign in with chapter + first name, lowercase, no spaces — e.g. Heritage + Fahmi = heritagefahmi

## Sheets
01 Auth · 02 Attendee · 03 Booth scanner · 04 Admin master data · 05 Admin operations · 06 Reports & export · 07 Cross-cutting · 08 Test data

## Auth

*Sign-in, first-password setup, recovery, and who may see what.*

| ID | Pri | Precondition | Steps | Expected result |
|---|---|---|---|---|
| AUTH-01 | P1 | Admin account exists | Open the admin panel. Enter admin@natcon.id / natcon2026. Press Sign in. | Lands on the Dashboard with the sidebar visible. Stat tiles show numbers, not dashes. |
| AUTH-02 | P1 | Seeded attendee | On the attendee app sign in as reddie@natcon.id / natcon2026. | Lands on Home: 'Hello, Reddie', member pass card with a QR and the member ID NATCON-2026-08154. |
| AUTH-03 | P1 | Booth account | Sign in as booth-a1@natcon.id / natcon2026. | Lands on Booth Scanner titled 'SSCX International · Booth A1'. Bottom nav shows Scanner and Dashboard only. |
| AUTH-04 | P1 | Any account | Sign in with the right email and a wrong password. | Stays on sign-in and shows an error. The wording must not reveal whether the email exists. |
| AUTH-05 | P1 | An attendee imported from the ticketing sheet, who has never signed in | Sign in with their email and the generated password (chapter + first name). | 'Choose your password' appears immediately. No other page is reachable until a password is saved. |
| AUTH-06 | P1 | On the 'Choose your password' screen | Type a 5-character password in both fields and save. | Refused with a message about needing at least 8 characters. |
| AUTH-07 | P1 | Same screen | Type two different passwords and save. | Refused: the two passwords do not match. |
| AUTH-08 | P1 | Same screen | Type the same 8+ character password twice and save. | Goes straight to Home as that attendee. No second sign-in needed. |
| AUTH-09 | P1 | After AUTH-08 | Sign out. Sign in with the OLD generated password. | Refused. Sign in with the new password: accepted. |
| AUTH-10 | P1 | An attendee whose chapter and phone you know | On sign-in choose 'Forgot your password?'. Enter the chapter and the phone from their ticket. | Shows 'Found your account' with their member code and email. |
| AUTH-11 | P1 | Continuing AUTH-10 | Enter a new 8+ character password twice and save. Then sign in with it. | Password changed; the new password signs in. |
| AUTH-12 | P1 | Recovery screen | Enter the right phone but a chapter that belongs to someone else. | Refused. Repeat with the right chapter and an unknown phone: also refused. |
| AUTH-13 | P2 | Recovery screen | Enter the phone in three shapes: +628…, 628…, and 08… (with spaces). | All three find the same account — the format must not matter. |
| AUTH-14 | P2 | Two tickets bought on one email (ask admin to import two rows sharing an address) | Sign in with that email and the generated password. | 'Which one are you?' lists both passes with their names, member codes and chapters. |
| AUTH-15 | P2 | Continuing AUTH-14 | Pick the second pass. | Signs in as that person; the member ID on the pass matches the one picked, not the first. |
| AUTH-16 | P2 | Signed in as an attendee | Open the booth scanner URL directly (/tenant/scanner). | Redirected back to the attendee app. An attendee must never reach the scanner. |
| AUTH-17 | P2 | Signed in as a booth | Open an attendee URL directly (/attendee/passport). | Redirected to the scanner. |
| AUTH-18 | P3 | Sign-in screen | Try to sign in 11 times in a minute with a wrong password. | Around the 11th attempt it starts refusing with a 'too many attempts' message, then works again after a minute. |
| AUTH-19 | P3 | Signed in anywhere | Press Log out. | Returns to sign-in. Pressing the browser Back button does not restore the session. |

## Attendee

*The attendee app: pass, passport, breakout class, speed networking.*

| ID | Pri | Precondition | Steps | Expected result |
|---|---|---|---|---|
| ATT-01 | P1 | Signed in as an attendee | Look at Home. | Greeting with their first name, venue line 'BNI Natcon 2026 · Pullman Central Park Jakarta', member pass with QR, three stat tiles: Booths visited, Pins collected, Goodiebag. |
| ATT-02 | P2 | Home | Scroll to Today's agenda. | Six entries from 07:30 registration to 17:00 Lucky Draw & Closing, each with a place. |
| ATT-03 | P1 | Home | Open My QR. | A large QR plus the member ID in text, so a booth can type it if the camera fails. |
| ATT-04 | P1 | Passport tab | Look at the top of the passport. | An 'Official Sponsors' band appears ABOVE the booths, with the count of sponsor stands visited. Sponsor cards are red-framed and carry a SPONSOR ribbon. |
| ATT-05 | P1 | Passport | Read a booth card imported from the booth sheet. | Shows the company name, its category, the booth code, and underneath the booth contact and their chapter. |
| ATT-06 | P1 | A booth has just scanned this attendee | Reopen the Passport. | That booth's card is marked Scanned and has moved to the bottom of its group. Pins collected went up by one. |
| ATT-07 | P1 | Breakout Room tab | Look at the class list. | Four classes, each with a poster image, the room, seats left, and the speakers and moderator with their photos. |
| ATT-08 | P1 | Class list | Register for one class. | The banner says the class ticket is ready. The other three classes become unavailable with 'You already picked another class'. |
| ATT-09 | P1 | Registered | Open the class and show the entry QR. | A QR appears captioned 'Class entry pass — <room>' and explains it is for the class door, separate from the booth QR. |
| ATT-10 | P2 | Registered | Open the class detail and scroll to 'In this room'. | Lists the people registered for that room with their chapter. Your own name is there. |
| ATT-11 | P2 | Registered | Cancel the registration, then register for a different class. | Cancelling frees the choice; the other classes become available again and the new one registers. |
| ATT-12 | P1 | The door crew has just checked this attendee in | Reopen Breakout Room. | Banner reads 'Attendance recorded ✓' and the class button reads 'Registered · attended ✓'. |
| ATT-13 | P1 | Network tab, not yet at a table | Type a table number and join. | Placement card shows 'Table N · Seat n' and the people already at that table. |
| ATT-14 | P1 | Network tab | Scan the printed table QR with the camera (real phone). | Same result as typing the number — checked in at that table. |
| ATT-15 | P1 | Network tab | Type your own member code (NATCON-2026-…) into the table number box. | Refused with 'Enter your table number, e.g. 5'. It must NOT seat you at table 1. |
| ATT-16 | P1 | At a table with other people | Read another person's row. | Shows their company, BNI chapter, business classification and a WhatsApp link with their number. |
| ATT-17 | P1 | At a table | Press '+ Note' on someone you have NOT saved yet, write a note and save. | The note is stored and shown on their row; the contact is saved automatically (the row now offers 'Edit note'). |
| ATT-18 | P2 | At a table | Press '+ Save' on someone. | They are added to your saved contacts. |
| ATT-19 | P2 | Saved at least one contact | Open 'Table History & Saved Contacts'. | Lists the tables you joined and the contacts you saved, each with its note. |
| ATT-20 | P2 | Saved contacts list | Open one contact. | Shows their profile with email and phone. Tapping the phone opens the dialer; tapping the email opens the mail app. |
| ATT-21 | P3 | Any attendee screen | Scroll to the bottom. | 'System by WIT' is shown and links to wit.id. |
| ATT-22 | P2 | Attendee app | Look at the top bar. | Logo only — no venue line. The bottom nav reads Home, My QR, Passport, Breakout Room, Network, all on one level. |

## Booth scanner

*The booth/sponsor app used at the stand.*

| ID | Pri | Precondition | Steps | Expected result |
|---|---|---|---|---|
| BTH-01 | P1 | Signed in as a booth on a phone | Open Scanner and allow the camera. | Live camera preview appears. |
| BTH-02 | P1 | Camera on | Scan an attendee's QR from their My QR screen. | 'Scan successful' with their name, chapter, and 'pin +1 (total N)'. |
| BTH-03 | P1 | Camera blocked or unavailable | Open Scanner. | A clear message says the camera is unavailable and points to the manual input below — the page still works. |
| BTH-04 | P1 | Scanner | Type an attendee's member code into manual input and submit. | Same successful result as a camera scan. |
| BTH-05 | P1 | Scanner | Type the attendee's PHONE number instead of the member code. | Resolves to the same person. |
| BTH-06 | P1 | The same attendee was already scanned at this booth | Scan or type them again. | 'Already scanned' — says the pin count is unchanged. It must not add a second pin. |
| BTH-07 | P1 | Scanner | Type a code that belongs to nobody, e.g. NATCON-2026-99999. | A clear not-found message. Nothing is recorded. |
| BTH-08 | P2 | Scanner | Type a booth QR payload (BOOTH:A1) into manual input. | Refused — it is not an attendee code. |
| BTH-09 | P1 | At least one scan today | Open Dashboard. | Total scans and Scans today match what you scanned; the visitor appears in Recent visitors. |
| BTH-10 | P1 | Dashboard | Tap a visitor row. | Visitor detail: name, company, chapter, member code, visit time, a Call button, and a Lead note box. |
| BTH-11 | P1 | Visitor detail | Write a lead note, save, then go back to the dashboard. | The note is shown on that visitor's row in the list straight away — without reloading the page. |
| BTH-12 | P2 | Signed in as a sponsor booth (booth-sp01@natcon.id) | Repeat BTH-04. | Works the same; sponsors scan exactly like booths. |
| BTH-13 | P2 | Phone with the app open | Turn off mobile data and Wi-Fi, then scan an attendee. | Shows 'Offline — scan queued'. Turn the connection back on: the queued scan syncs and the attendee's pin appears. |
| BTH-14 | P3 | Booth app | Look at the bottom nav. | Only Scanner and Dashboard — no attendee tabs. |

## Admin master data

*Attendees, tenants, breakout classes, chapters — CRUD and Excel import.*

| ID | Pri | Precondition | Steps | Expected result |
|---|---|---|---|---|
| MD-01 | P1 | Admin, Attendees page | Look at the list. | Paginated table with the total count. Each row shows name, email, member code, chapter, company, phone and pin count. |
| MD-02 | P1 | Attendees page | Type part of a name, an email, or a phone into search. | The list narrows to matching rows and the total updates. |
| MD-03 | P1 | Attendees page | Press + Add Attendee, fill name, email, chapter, phone. Save. | The attendee appears with a generated member code NATCON-2026-…. |
| MD-04 | P1 | Continuing MD-03 | Open that attendee's Detail. | Profile with chapter, company, phone, classification, plus their visits and class registrations. |
| MD-05 | P1 | Attendees page | Edit an attendee, change the chapter, save. Reopen the row. | The change stuck; nothing else on the row was blanked. |
| MD-06 | P1 | Attendees page | Press Download format, then import that same file back. | Imports without errors — the template must be importable by its own importer. |
| MD-07 | P1 | The official ticketing export (Data Peserta .xlsx) | Press Import Excel and choose it. | Reports created / updated / failed. Attendees appear with chapter, company, classification and normalized phones (+62…). |
| MD-08 | P1 | After MD-07 | Import the SAME file a second time. | Everything is reported as updated, not created — no duplicates. |
| MD-09 | P2 | A sheet where one email holds two ticket numbers | Import it. | Both rows import as two separate attendees on the same email. |
| MD-10 | P1 | Tenants page | Look at the list. | Filter tabs All / Sponsors / Booths with live counts, a Kind column, and sponsor rows tinted. |
| MD-11 | P1 | Tenants page | Press Download format, then Import Excel with the official Data Booth sheet. | Booths import: Company Name becomes the booth, Business Classification the category, and Name + BNI Chapter become the booth contact. |
| MD-12 | P1 | After MD-11 | Open a booth's Detail. | Shows kind, booth code, category, booth contact, BNI chapter and the scanner login (booth-<code>@natcon.id). |
| MD-13 | P1 | Tenants page | Edit a booth, change only the category, save, then reopen Edit. | The description and contact are still there — editing must not blank the fields it did not touch. |
| MD-14 | P2 | Tenants page | Add a tenant with Kind = Sponsor. | It appears under Sponsors, the count goes up, and it shows above booths on the attendee passport. |
| MD-15 | P1 | Breakout Classes page | Press Edit on a class. | Slot, room, title, speakers, moderator, capacity, description, the speaker list with photos, and the cover are all filled in — nothing blank. |
| MD-16 | P1 | Class edit modal | Add a person, set the role to Moderator, upload a photo, save. Reopen. | The person and photo persisted and appear on the attendee class card. |
| MD-17 | P2 | Class edit modal | Upload a cover image and save. | The cover shows on the attendee class card and detail. |
| MD-18 | P1 | Class detail page | Register an attendee by member code, then by email, then by phone. | Each is added to the attendee list of that class. |
| MD-19 | P1 | Class detail | Register the same attendee twice. | Reported as already registered — not added twice. |
| MD-20 | P1 | Class detail | Register an attendee who is already in a DIFFERENT class in the same slot. | Refused, saying they already hold another class in that slot. |
| MD-21 | P1 | Class detail | Press Remove on a registered attendee. | They disappear from the list and the seat is freed. |
| MD-22 | P1 | Breakout Classes page | Press Download format, fill a couple of rows (attendee + room), then Import Registrations. | Reports created / updated / failed; the attendees show on the class detail. |
| MD-23 | P2 | Chapters page | Look at the list; add a chapter, rename one used by attendees. | Chapters list with member counts. A rename cascades to the attendees in that chapter. |
| MD-24 | P2 | Any master-data page | Import a file with a bad row (no email, or a malformed email). | The good rows still import; the bad row is reported with its row number and reason. |

## Admin operations

*Door check-in, tables, QR prints, lucky draw, dashboard.*

| ID | Pri | Precondition | Steps | Expected result |
|---|---|---|---|---|
| OPS-01 | P1 | Admin, Dashboard | Look at the tiles. | Registered attendees, Sponsors and Booths counted separately, total visit scans, scans today, class registrations. |
| OPS-02 | P2 | Dashboard | Leave it open while a booth records a scan. | Within a few seconds the scan count and the activity feed update on their own. |
| OPS-03 | P1 | Door Check-in | Pick a breakout room from the dropdown. | Shows attended / registered / percentage for that room. |
| OPS-04 | P1 | Door Check-in, an attendee registered for that room | Type their member code and check in. | 'Attendance recorded' with their name; attended count goes up by one. |
| OPS-05 | P1 | Continuing OPS-04 | Check the same person in again. | 'Already checked in' — the count does not move. |
| OPS-06 | P1 | Door Check-in on the WRONG room | Check in someone registered elsewhere. | Rejected: not registered for this class. Nothing recorded. |
| OPS-07 | P2 | Door Check-in on a phone | Scan a printed room QR (SEMINAR:<id>). | The page switches to that room instead of treating it as an attendee. |
| OPS-08 | P2 | Door Check-in with a camera | Scan an attendee's QR. | Same result as typing the code. |
| OPS-09 | P1 | Tables page | Generate tables: choose how many and seats per table. | The tables are created and listed; the attendee app can join them by number. |
| OPS-10 | P2 | Tables page | Delete a table nobody is sitting at. | It disappears from the list and from the attendee app. |
| OPS-11 | P1 | QR Prints | Open the page and pick a size. | Print-ready QR cards for tables, class rooms and booth signage, each labelled. |
| OPS-12 | P1 | QR Prints | Print (or print-preview) a page of table QRs, then scan one with the attendee app. | The scanned QR joins exactly that table — the printed number matches. |
| OPS-13 | P1 | Lucky Draw, several attendees hold pins | Open the page. | Shows the eligible count. It must equal the number of attendees with at least one pin — check against the Attendee Pins report. |
| OPS-14 | P1 | Lucky Draw | Press Shuffle & draw a winner. | Cards shuffle and one winner is shown with their name and chapter. |
| OPS-15 | P2 | After OPS-14 | Draw again. | The previous winner is not drawn a second time. |
| OPS-16 | P2 | Admin | Delete an attendee who has scans and a class registration. | Deleted after the confirmation, and their scans and registration go with them; counts on the dashboard drop accordingly. |

## Reports & export

*The three report pages and every spreadsheet the app hands out.*

| ID | Pri | Precondition | Steps | Expected result |
|---|---|---|---|---|
| RPT-01 | P1 | Admin, Tenant Leads | Open the page. | Scans per booth and scans per hour charts, plus the newest visit rows. |
| RPT-02 | P1 | Tenant Leads | Press Export Excel and open the file. | natcon2026-tenant-leads.xlsx opens in Excel. Columns: Attendee, Member Code, Chapter, Company, Tenant, Booth, Time. Row count matches the scans. |
| RPT-03 | P1 | Class Registrations | Press Export Excel and open the file. | natcon2026-class-registrations.xlsx. Attended reads Yes / Not yet. Slot is a number you can sort on. |
| RPT-04 | P1 | Attendee Pins | Press Export Excel and open the file. | natcon2026-attendee-pins.xlsx. Pins is a number; attendees with no pins show 0, not blank. |
| RPT-05 | P1 | Attendee Pins report | Compare the number of rows with the attendee total on the Attendees page. | Every attendee is in the file — none missing off the end of the list. |
| RPT-06 | P1 | A database with no scans yet | Open Tenant Leads. | The Export button is disabled and the page says there is no data — no empty file is produced. |
| RPT-07 | P2 | Any export opened in Excel | Look for a booth or company with an & or an accent, e.g. 'Hukum & Rekan'. | The name is intact — no mangled characters. |
| RPT-08 | P2 | Any export | Sort by the time column. | Rows sort in true chronological order. |
| RPT-09 | P1 | Attendees page | Press Download format and open the file. | natcon2026-template-import-attendees.xlsx with the documented headers and example rows. |
| RPT-10 | P1 | Tenants page | Press Download format and open the file. | natcon2026-template-import-booths.xlsx, headers matching the official Data Booth sheet. |
| RPT-11 | P1 | Breakout Classes page | Press Download format and open the file. | natcon2026-template-import-class-registrations.xlsx with Email / Member Code / Room. |
| RPT-12 | P2 | A full event's worth of data | Press Export on Tenant Leads and time it. | The file arrives without the page freezing. Note the time and file size in Notes. |

## Cross-cutting

*Devices, offline, demo mode, and how the apps behave when things go wrong.*

| ID | Pri | Precondition | Steps | Expected result |
|---|---|---|---|---|
| CRS-01 | P1 | A phone (or a 375px window) | Walk the attendee app: Home, My QR, Passport, Breakout Room, Network. | Nothing is cut off and the page never slides sideways. The bottom nav stays level. |
| CRS-02 | P1 | A phone or 375px window | Walk every admin page. | No page scrolls sideways. Wide tables scroll inside their own card, not the whole page. |
| CRS-03 | P2 | A tablet (768px) | Open the admin panel. | The sidebar becomes a top strip that scrolls; the last item is reachable. |
| CRS-04 | P2 | A laptop (1280px+) | Open the admin panel. | Sidebar on the left, dashboard in two columns. |
| CRS-05 | P2 | Attendee app on a phone | Add it to the home screen, then open it with the phone in flight mode. | It opens (cached shell) instead of showing a browser error page. |
| CRS-06 | P2 | Sign-in screen | Turn on Demo (Mock) mode and sign in with any password. | The app runs on local demo data with a red DEMO chip. No backend needed. |
| CRS-07 | P2 | Demo mode | Sign in as duo@natcon.id. | The 'Which one are you?' chooser appears — two tickets on one email. |
| CRS-08 | P1 | Any app | Stop the API (ask the developer) and try an action. | A human message says the server cannot be reached — not a blank page or a raw error. |
| CRS-09 | P2 | Signed in, session left overnight | Return the next day and use the app. | Either it still works, or it says the session expired and returns you to sign-in — never a silent failure. |
| CRS-10 | P3 | Any page | Check the browser tab. | Title and favicon are the Natcon branding, not the Vite default. |
| CRS-11 | P3 | Attendee and admin apps | Read the interface language. | Everything is in English, consistently — no leftover Indonesian labels. |

## Test data

| What | Value | Notes |
|---|---|---|
| Admin | admin@natcon.id / natcon2026 | Created by the seeder if no admin exists |
| Attendee 1 | reddie@natcon.id / natcon2026 | NATCON-2026-08154 · BNI Chapter Jakarta Elite · +62811000154 |
| Attendee 2 | sinta@natcon.id / natcon2026 | NATCON-2026-08201 · BNI Chapter Jakarta Elite · +62811000201 |
| Attendee 3 | agus@natcon.id / natcon2026 | NATCON-2026-08322 · BNI Chapter Bandung Raya · +62811000322 |
| Booth scanner | booth-a1@natcon.id / natcon2026 | SSCX International · booth A1 (from the official Data Booth sheet) |
| Sponsor scanner | booth-sp01@natcon.id / natcon2026 | BNI Xpora · booth SP-01 |
| Booth login pattern | booth-<code without dashes>@natcon.id | A1 → booth-a1, SP-01 → booth-sp01 |
| Imported attendee password | chapter + first name, lowercase, no spaces | Heritage + Fahmi → heritagefahmi |
| Unknown member code | NATCON-2026-99999 | For the not-found cases |
| Table QR payload | TABLE:5 | What the QR Prints page prints |
| Class QR payload | SEMINAR:<id> | Scanned on Door Check-in to switch room |
| Booth QR payload | BOOTH:A1 | Booth signage |
| Breakout classes | Rooms 1–4, all slot 1, 60 seats each | All parallel — an attendee picks exactly one |
| Attendee app | http://localhost:5173 |  |
| Admin panel | http://localhost:5174 |  |

## Coverage

| Section | Cases | P1 |
|---|---|---|
| Auth | 19 | 12 |
| Attendee | 22 | 14 |
| Booth scanner | 14 | 10 |
| Admin master data | 24 | 19 |
| Admin operations | 16 | 10 |
| Reports & export | 12 | 9 |
| Cross-cutting | 11 | 3 |
| **Total** | **118** | **77** |
