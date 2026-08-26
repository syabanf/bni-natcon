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

## Accounts — a fresh database has ONE login

Admin — admin@natcon.id / SEED_PASSWORD (default natcon2026). The 32 booths, the 4 sponsors and the 4 learning classes are already in a fresh database; the 769 attendees are seeded too (Data Peserta) and generate the networking tables on the Tables page.
Attendee — any email from the imported sheet; first password = chapter + first name, lowercase without spaces. Booth — booth-<code>@natcon.id / SEED_PASSWORD.
Imported attendees sign in with chapter + first name, lowercase, no spaces — e.g. Heritage + Fahmi = heritagefahmi

## Sheets
01 Auth · 02 Attendee · 03 Booth scanner · 04 Admin master data · 05 Admin operations · 06 Reports & export · 07 Cross-cutting · 08 Test data

## Auth

*Sign-in, first-password setup, recovery, and who may see what.*

| ID | Pri | Precondition | Steps | Expected result |
|---|---|---|---|---|
| AUTH-01 | P1 | Admin account exists | Open the admin panel. Enter admin@natcon.id / natcon2026. Press Sign in. | Lands on the Dashboard with the sidebar visible. Stat tiles show numbers, not dashes. |
| AUTH-02 | P1 | Attendee from the imported sheet | On the attendee app sign in with an attendee's email and their generated password (chapter + first name, lowercase, no spaces). | Asked to choose a password on this first sign-in, then lands on Home: 'Hello, <first name>', member pass card with a QR and their member ID. |
| AUTH-03 | P1 | Booth account | Open the booth door at /tenant/login. Sign in as booth-<code>@natcon.id with SEED_PASSWORD. | The page is headed 'Booth Scanner' and shows no 'Forgot your password?'. After sign-in: Booth Scanner titled 'SSCX International · Booth A1', bottom nav Scanner and Dashboard only. |
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
| AUTH-20 | P1 | Signed out | Open /login and read the page. | Headed 'Welcome to' with attendee wording, a 'Forgot your password?' link, and a link across to the booth sign-in. |
| AUTH-21 | P2 | Signed out | Open /tenant/login and sign in with an ATTENDEE account. | Still works — you land on the attendee home. The wrong door must never lock someone out. |
| AUTH-22 | P2 | Signed in as a booth | Press Log out. | Returns to the BOOTH sign-in (/tenant/login), not the attendee one. |

## Attendee

*The attendee app: pass, passport, learning class, speed networking.*

| ID | Pri | Precondition | Steps | Expected result |
|---|---|---|---|---|
| ATT-01 | P1 | Signed in as an attendee | Look at Home. | Greeting with their first name, venue line 'BNI Natcon 2026 · Pullman Central Park Jakarta', member pass with QR, three stat tiles: Booths visited, Pins collected, Goodiebag. |
| ATT-02 | P2 | Home | Scroll to Today's agenda. | Six entries from 07:30 registration to 17:00 Lucky Draw & Closing, each with a place. |
| ATT-03 | P1 | Home | Open My QR. | A large QR plus the member ID in text, so a booth can type it if the camera fails. |
| ATT-04 | P1 | Passport tab | Look at the top of the passport. | An 'Official Sponsors' band appears ABOVE the booths, with the count of sponsor stands visited. Sponsor cards are red-framed and carry a SPONSOR ribbon. |
| ATT-05 | P1 | Passport | Read a booth card imported from the booth sheet. | Shows the company name, its category, the booth code, and underneath the booth contact and their chapter. |
| ATT-06 | P1 | A booth has just scanned this attendee | Reopen the Passport. | That booth's card is marked Scanned and has moved to the bottom of its group. Pins collected went up by one. |
| ATT-07 | P1 | Learning Class tab | Look at the class list. | Four classes, each with a poster image, the room, seats left, and the speakers and moderator with their photos. |
| ATT-08 | P1 | Class list | Register for one class. | The banner says the class ticket is ready. The other three classes become unavailable with 'You already picked another class'. |
| ATT-09 | P1 | Registered | Open the class and show the entry QR. | A QR appears captioned 'Class entry pass — <room>' and explains it is for the class door, separate from the booth QR. |
| ATT-10 | P2 | Registered | Open the class detail and scroll to 'In this room'. | Lists the people registered for that room with their chapter. Your own name is there. |
| ATT-11 | P2 | Registered | Cancel the registration, then register for a different class. | Cancelling frees the choice; the other classes become available again and the new one registers. |
| ATT-12 | P1 | The door crew has just checked this attendee in | Reopen Learning Class. | Banner reads 'Attendance recorded ✓' and the class button reads 'Registered · attended ✓'. |
| ATT-13 | P1 | Learning class tab, networking | Look for a way to type a table number. | There is none — scanning the table QR is the only way in. The note says so, and the camera-failure message points at the committee. |
| ATT-14 | P1 | Network tab | Scan the printed table QR with the camera (real phone). | Same result as typing the number — checked in at that table. |
| ATT-15 | P1 | Network tab | Scan your own member QR at the table screen. | Refused as 'not a networking table code'. It must NOT seat you at table 1. |
| ATT-16 | P1 | At a table with other people | Read another person's row. | Shows their company, BNI chapter, business classification and a WhatsApp link with their number. |
| ATT-17 | P1 | At a table | Press '+ Note' on someone you have NOT saved yet, write a note and save. | The note is stored and shown on their row; the contact is saved automatically (the row now offers 'Edit note'). |
| ATT-18 | P2 | At a table | Press '+ Save' on someone. | They are added to your saved contacts. |
| ATT-19 | P2 | Saved at least one contact | Open 'Table History & Saved Contacts'. | Lists the tables you joined and the contacts you saved, each with its note. |
| ATT-20 | P2 | Saved contacts list | Open one contact. | Shows their profile with email and phone. Tapping the phone opens the dialer; tapping the email opens the mail app. |
| ATT-21 | P3 | Any attendee screen | Scroll to the bottom. | 'System by WIT' is shown and links to wit.id. |
| ATT-22 | P2 | Attendee app | Look at the top bar. | Logo only — no venue line. The bottom nav reads Home, My QR, Passport, Learning Class, Network, all on one level. |
| ATT-23 | P1 | Attendee holding one learning class | Register for a second class at the SAME hour. | Refused: 'that class runs at the same time as one you already picked'. |
| ATT-24 | P1 | Attendee holding one learning class | Register for a class at a DIFFERENT hour. | Accepted — two classes is the allowance. |
| ATT-25 | P1 | Attendee holding two learning classes | Register for a third. | Refused: two is the limit. Cancelling one frees the place immediately. |
| ATT-26 | P1 | Two attendees seated at the same table | Have the second one scan in while the first watches. | The newcomer appears on the first one's screen within about five seconds, with Save and Note ready — no refresh. |
| ATT-27 | P2 | Attendee whose email holds two tickets | Sign in. | The picker numbers the passes #1 and #2 above their member codes, so two identical names can be told apart. |
| ATT-28 | P1 | Attendee home screen, rundown covering both days | Read the agenda card top to bottom. | It is headed 'Agenda', 3 September first, then a 'Friday 4 September' heading before the Gold Club Breakfast — which says on it that it is for Gold Club tickets. |
| ATT-29 | P1 | Attendee passport | Scroll the booth list. | The exhibitors who sent a logo show it; the rest show their two-letter initials. No empty grey squares. |
| ATT-30 | P1 | Attendee scanned at both stands of a double-width booth | Open the passport and count the stamps. | That company gives one stamp and appears once. Two stands are one exhibitor, so it counts once towards the lucky draw's booth minimum too. |
| ATT-31 | P2 | Attendee · Learning Class tab | Look at the four class cards. | Each carries the committee's banner with its own speakers on it — not a plain gradient, and not the same picture on two classes. |
| ATT-32 | P1 | An attendee signing in for the very first time | Sign in and watch the Home screen, then press 'Quick tour' in the top bar. | Nothing opens by itself. Pressing the button starts a six-step tour that explains the pass, the QR, the passport, the classes and networking — each step on top of the screen it is describing. |
| ATT-33 | P1 | An attendee who has already run the tour | Press 'Quick tour' again, this time from the Passport screen. | It starts again at step 1 on Home, from wherever it was pressed. Back, Next and Skip all work, and it stays closed until asked for again. |
| ATT-34 | P2 | The tour open on a phone with the volume up | Listen, then press the speaker button. | Each step is read out loud; the speaker button silences it, stops what is being said mid-sentence, and it stays silent the next time the tour is opened. |
| ATT-35 | P2 | Attendee passport | Look at the order of the cards. | WIT.id is first, then the sponsors, then the booths by number. Placement only — the dashboard's Booth Ranking still counts scans honestly. |

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
| BTH-12 | P2 | Signed in as a sponsor booth (booth-b1@natcon.id) | Repeat BTH-04. | Works the same; sponsors scan exactly like booths. |
| BTH-13 | P2 | Phone with the app open | Turn off mobile data and Wi-Fi, then scan an attendee. | Shows 'Offline — scan queued'. Turn the connection back on: the queued scan syncs and the attendee's pin appears. |
| BTH-14 | P3 | Booth app | Look at the bottom nav. | Only Scanner and Dashboard — no attendee tabs. |
| BTH-15 | P1 | Scanner, an attendee holding a ticket from the sheet | Scan their pass QR from the My QR screen. | Recorded, with their name — the QR carries the ticket number, not the member code. |
| BTH-16 | P2 | Scanner, the same attendee | Type the member code printed under their QR instead. | Reported as a repeat visit of the same person — both keys reach one attendee, never two. |
| BTH-17 | P2 | Scanner | Type a ticket number nobody holds (16C6C-NOSUCHTICKET). | A clear not-found message. Nothing is recorded. |
| BTH-18 | P1 | A booth account that has never signed in | Sign in at /tenant/login with the committee-issued password. | The 'Choose your password' screen opens before anything else — the scanner stays closed until the crew sets a password of their own (8+ characters). The issued password then stops working. |
| BTH-19 | P1 | A booth that already set its own password | Sign in again with the new password. | Straight to the scanner — no password screen. The old committee-issued password is refused. |

## Admin master data

*Attendees, tenants, learning classes, chapters — CRUD and Excel import.*

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
| MD-15 | P1 | Learning Classes page | Press Edit on a class. | Slot, room, title, speakers, moderator, capacity, description, the speaker list with photos, and the cover are all filled in — nothing blank. |
| MD-16 | P1 | Class edit modal | Add a person, set the role to Moderator, upload a photo, save. Reopen. | The person and photo persisted and appear on the attendee class card. |
| MD-17 | P2 | Class edit modal | Upload a cover image and save. | The cover shows on the attendee class card and detail. |
| MD-18 | P1 | Class detail page | Register an attendee by member code, then by email, then by phone. | Each is added to the attendee list of that class. |
| MD-19 | P1 | Class detail | Register the same attendee twice. | Reported as already registered — not added twice. |
| MD-20 | P1 | Class detail | Register an attendee who is already in a DIFFERENT class in the same slot. | Refused, saying they already hold another class in that slot. |
| MD-21 | P1 | Class detail | Press Remove on a registered attendee. | They disappear from the list and the seat is freed. |
| MD-22 | P1 | Learning Classes page | Press Download format, fill a couple of rows (attendee + room), then Import Registrations. | Reports created / updated / failed; the attendees show on the class detail. |
| MD-23 | P2 | Chapters page | Look at the list; add a chapter, rename one used by attendees. | Chapters list with member counts. A rename cascades to the attendees in that chapter. |
| MD-24 | P2 | Any master-data page | Import a file with a bad row (no email, or a malformed email). | The good rows still import; the bad row is reported with its row number and reason. |
| MD-25 | P1 | Admin · Learning Classes | Read the Quota column for a class nobody has registered for. | Shows taken/quota (e.g. 0/60), an empty fill bar and 'N seats left'. |
| MD-26 | P1 | Admin · Learning Classes | Click the quota number, type 45, press Enter. | Saves without opening the edit form; the row shows 0/45 and '45 seats left'. Re-open the class in Edit: description, cover and speaker photos are untouched. |
| MD-27 | P1 | Admin · Learning Classes | Click the quota number, change it, press Esc. | The editor closes and the old quota stays — nothing was saved. |
| MD-28 | P1 | A class with 3 attendees registered | Set its quota to 2. | Refused, with '3 already registered — cancel registrations first'. The old quota is still in place after a page reload. |
| MD-29 | P1 | Same class, 3 registered | Set its quota to exactly 3. | Accepted. The row reads 3/3 with a full bar and FULL in red. |
| MD-30 | P1 | A class showing FULL | Register one more attendee into it (Detail → register by code/email/phone). | Refused: 'this seminar is fully booked'. An attendee picking it in the app is turned away too. |
| MD-31 | P2 | Admin · Learning Classes | Open Edit on a class with registrations and set Quota below that count. | The full edit form refuses it exactly like the quota cell does. |
| MD-32 | P2 | Admin · Learning Classes | Set a quota of 0 or a negative number. | Refused — the quota must be at least 1. |
| MD-33 | P1 | Admin · Learning Classes, rundown has learning blocks | Edit a class and pick a Time block. | The list shows the class's hour instead of 'not scheduled'; the attendee's class card shows the same hour. |
| MD-34 | P1 | Admin · Learning Classes | Upload a landscape Banner image and a portrait Poster on the same class. | The class list shows the banner; the attendee's class detail shows the poster whole, not cropped. |
| MD-35 | P1 | A class with both pictures | Edit only its description and save. | Both pictures survive. Losing one on an unrelated save is the bug this case exists for. |
| MD-36 | P1 | Admin · Tenants | Upload a Company logo on a booth. | The attendee passport shows the logo in place of the two-letter initials; booths without a logo still show initials. |
| MD-37 | P1 | Attendees imported from a sheet where several share a name, email and phone | Search for that email in Master Data → Attendees. | Each row carries #1 of 3, #2 of 3 … so identical-looking rows can be told apart. |
| MD-38 | P1 | Admin · Attendees | Add an attendee by hand and give them a Ticket number. | Saved and shown under their member code in the list; their pass QR then carries that number. |
| MD-39 | P1 | Admin · Attendees | Give a second attendee a ticket number another one already holds. | Refused — 'that ticket number belongs to another attendee'. Two people on one QR is the thing this prevents. |
| MD-40 | P1 | An attendee imported with a ticket number | Edit only their phone number and save. | The ticket number is still there. Losing it would make their QR stop scanning. |
| MD-41 | P1 | Admin · Tenants, a booth with no logo | Edit it, change only the description, save. Then open the attendee passport. | Its initials are still on the tile. A save that leaves the initials field alone must not empty it. |
| MD-42 | P2 | Admin · Tenants, a booth whose logo shipped with the app | Upload a different logo, then ask for a restart/redeploy. | The uploaded one stays. The shipped logo only fills a booth that has none. |
| MD-43 | P1 | Admin · Tenants | Find Alpha leaders in the list, then check GrasiaCare and Paper.id. | Alpha leaders is one row reading 'A47 & A48' — one company on two stands is one exhibitor, with one login and one QR for both signs. GrasiaCare sits on A18 alone and Paper.id on A20: the floor plan follows the committee's latest numbering, not the older sheet. |
| MD-44 | P2 | Admin · Tenants, some booths have a logo | Look down the Name column, then open the Dashboard's Booth Ranking and one booth's detail page. | Every exhibitor except Bio Medika and ProSnap shows their own logo in all three; those two show their initials. That is how you spot who still owes the committee a logo. |
| MD-45 | P1 | Admin · QR Prints, after a floor-plan update | Print the booth QRs and compare a few against the signs on the floor. | Every code matches the stand it is standing on. Old prints from before the renumbering are wrong and must be thrown away — the codes moved. |

## Admin operations

*Door check-in, tables, QR prints, lucky draw, dashboard.*

| ID | Pri | Precondition | Steps | Expected result |
|---|---|---|---|---|
| OPS-01 | P1 | Admin, Dashboard | Look at the tiles. | Registered attendees, Sponsors and Booths counted separately, total visit scans, scans today, class registrations. |
| OPS-02 | P2 | Dashboard | Leave it open while a booth records a scan. | Within a few seconds the scan count and the activity feed update on their own. |
| OPS-03 | P1 | Door Check-in | Pick a learning class from the dropdown. | Shows attended / registered / percentage for that room. |
| OPS-04 | P1 | Door Check-in, an attendee registered for that room | Type their member code and check in. | 'Attendance recorded' with their name; attended count goes up by one. |
| OPS-05 | P1 | Continuing OPS-04 | Check the same person in again. | 'Already checked in' — the count does not move. |
| OPS-06 | P1 | Door Check-in on the WRONG room | Check in someone registered elsewhere. | Rejected: not registered for this class. Nothing recorded. |
| OPS-07 | P2 | Door Check-in on a phone | Scan a printed room QR (SEMINAR:<id>). | The page switches to that room instead of treating it as an attendee. |
| OPS-08 | P2 | Door Check-in with a camera | Scan an attendee's QR. | Same result as typing the code. |
| OPS-09 | P1 | Tables page | Generate tables: choose how many and seats per table. | The tables are created and listed; the attendee app can join them by number. |
| OPS-10 | P2 | Tables page | Delete a table nobody is sitting at. | It disappears from the list and from the attendee app. |
| OPS-11 | P1 | QR Prints | Open the page and pick a size. | Print-ready QR cards for tables, class rooms and booth signage, each labelled. |
| OPS-12 | P1 | QR Prints | Print (or print-preview) a page of table QRs, then scan one with the attendee app. | The scanned QR joins exactly that table — the printed number matches. |
| OPS-13 | P1 | Lucky Draw, attendee list imported | Open the page. | Shows the eligible count. It must equal the TOTAL number of registered attendees — pins do not decide eligibility. Check against Master Data → Attendees. |
| OPS-14 | P1 | Lucky Draw | Press Shuffle & draw a winner. | Cards shuffle and one winner is shown with their name and chapter. |
| OPS-15 | P2 | After OPS-14 | Draw again. | The previous winner is not drawn a second time. |
| OPS-16 | P2 | Admin | Delete an attendee who has scans and a class registration. | Deleted after the confirmation, and their scans and registration go with them; counts on the dashboard drop accordingly. |
| OPS-24 | P2 | Lucky Draw | Press Stage mode, then Space, then Esc. | Space draws one winner (never two, however fast you press). Esc returns to the panel and the page is where you left it. |
| OPS-25 | P1 | Admin · Rundown, fresh database | Open the page before touching anything, then add a block: 09:00, 1 hour, Plenary, 'Opening Ceremony', Grand Ballroom. | The day already carries ten draft blocks — nine on 3 September, registration first and the draw last, two of them Learning Class, plus the Gold Club Breakfast under its own 'Friday 4 September' heading. The new block appears as 09:00 – 10:00 · 1 hour · Plenary, and the attendee agenda shows it without a redeploy. |
| OPS-26 | P1 | Admin · Rundown | Try to add a block starting at 13:30, and one that is 90 minutes long. | Both refused: blocks start on the hour and run in whole hours. |
| OPS-27 | P2 | Admin · Rundown with two blocks at the same time | Look at the table. | Both overlapping rows are tinted and marked 'overlaps another block'. |
| OPS-28 | P1 | Admin · Rundown | Delete a block that has a learning class in it. | The block goes, the class stays — it simply has no time until you give it a new block. |
| OPS-29 | P1 | Admin · Tables, nobody seated | Press Start round with 15 minutes. | The panel reads 'Round 1 is running · ends at HH:MM'. Every attendee's Network screen counts down to that same time. |
| OPS-30 | P1 | A round is running, attendee on the Network screen | Reload the attendee's page. | The countdown continues from where it was. It must NOT restart at 15:00 — that was the old bug. |
| OPS-31 | P1 | A round is running | Press Start next round. | The old round closes and a new one starts. Attendees follow within about 20 seconds; there are never two clocks. |
| OPS-32 | P2 | No round has ever started | Look at an attendee's Network screen. | The clock reads --:-- and 'waiting to start', not an invented number. |
| OPS-33 | P1 | Admin · Tables, some attendees seated | Press 'Who is seated'. | Each table lists who is sitting at it with chapter, company and the time they sat down. The header count agrees with the list. |
| OPS-34 | P2 | Admin · Tables, seating on screen | Press Export Excel. | natcon2026-networking-seating.xlsx downloads with table, seat, member code, name, chapter, company, phone and joined-at. |
| OPS-35 | P1 | Admin · Tables | Edit table 1 and give it the name 'Startup Corner'. | The list shows the name; an attendee seated there sees 'Startup Corner' on their placement card. |
| OPS-36 | P1 | Admin · Lucky Draw | Look at the top of the page. | Two tabs: Lucky Draw and Doorprize, each showing how many have been drawn. |
| OPS-37 | P1 | Admin · Lucky Draw | Set 'Booths to visit before entering' to 5. | The eligible count drops to only those who have visited five or more booths. Setting it back to 0 restores everyone. |
| OPS-38 | P1 | Admin · Lucky Draw | Draw a winner, then RELOAD the page. | The winner is still listed and still out of the pool. Losing them on reload was the old behaviour and must not come back. |
| OPS-39 | P1 | A lucky draw winner exists | Switch to the Doorprize tab. | It has its own (empty) winners list, and the lucky draw's winner is not in its pool — nobody takes two prizes. |
| OPS-40 | P2 | Admin · a draw whose pool is empty | Press draw. | Refused with 'nobody left to draw — everyone eligible has already won', not a silent failure. |
| OPS-41 | P2 | Admin · Lucky Draw with winners | Press Clear winners and confirm. | The list empties and everyone returns to the pool — for a rehearsal, or a ceremony that restarts. |
| OPS-42 | P1 | Admin · Rundown, draft blocks untouched | Delete a draft block, then restart the API (or ask for a redeploy). | It stays deleted. The draft is only ever written into an empty schedule. |
| OPS-43 | P1 | Admin · Rundown with two learning blocks | Put two classes in the 13:00 block and two in the 14:00 block, from the Learning Classes page. | Each class shows its hour. An attendee can then hold one from each block, but never two from the same one. |
| OPS-44 | P1 | Admin · Rundown | Add a block and pick 'Friday 4 September' in the Day field. | It lands under the 4 September heading, below every 3 September block — not mixed into the conference day. |
| OPS-45 | P2 | Admin · Rundown, two days on screen | Compare a 3 September block with a 4 September block at the same hour. | Neither is flagged as overlapping. Same hour on different days is not a clash. |

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
| RPT-11 | P1 | Learning Classes page | Press Download format and open the file. | natcon2026-template-import-class-registrations.xlsx with Email / Member Code / Room. |
| RPT-12 | P2 | A full event's worth of data | Press Export on Tenant Leads and time it. | The file arrives without the page freezing. Note the time and file size in Notes. |

## Cross-cutting

*Devices, offline, demo mode, and how the apps behave when things go wrong.*

| ID | Pri | Precondition | Steps | Expected result |
|---|---|---|---|---|
| CRS-01 | P1 | A phone (or a 375px window) | Walk the attendee app: Home, My QR, Passport, Learning Class, Network. | Nothing is cut off and the page never slides sideways. The bottom nav stays level. |
| CRS-02 | P1 | A phone or 375px window | Walk every admin page. | No page scrolls sideways. Wide tables scroll inside their own card, not the whole page. |
| CRS-03 | P2 | A tablet (768px) | Open the admin panel. | The sidebar becomes a top strip that scrolls; the last item is reachable. |
| CRS-04 | P2 | A laptop (1280px+) | Open the admin panel. | Sidebar on the left, dashboard in two columns. |
| CRS-05 | P2 | Attendee app on a phone | Add it to the home screen, then open it with the phone in flight mode. | It opens (cached shell) instead of showing a browser error page. |
| CRS-06 | P2 | Any sign-in screen, any app | Look for a Demo / Mock mode switch, and for any attendee or booth you do not recognise. | There is no switch and no invented data anywhere: demo mode and its made-up attendees and booths were removed, so every name on every screen comes from the committee's own sheets. |
| CRS-07 | P2 | An attendee whose email holds two tickets | Sign in with that email. | The 'Which one are you?' chooser appears, numbering the passes #1 and #2. |
| CRS-08 | P1 | Any app | Stop the API (ask the developer) and try an action. | A human message says the server cannot be reached — not a blank page or a raw error. |
| CRS-09 | P2 | Signed in, session left overnight | Return the next day and use the app. | Either it still works, or it says the session expired and returns you to sign-in — never a silent failure. |
| CRS-10 | P3 | Any page | Check the browser tab. | Title and favicon are the Natcon branding, not the Vite default. |
| CRS-11 | P3 | Attendee and admin apps | Read the interface language. | Everything is in English, consistently — no leftover Indonesian labels. |
| CRS-12 | P1 | The door or admin password, typed into the ATTENDEE sign-in | Sign in as door@natcon.id at /login. | A card says it is a door crew account, links to the door app, and offers Sign out. It must NOT be a blank page — that was the bug: the app bounced the account between /attendee and itself forever. |
| CRS-13 | P2 | Any attendee screen | Ask the developer to force a render error. | A card says the screen stopped working, with Reload and Sign out. Never a white page. |
| CRS-14 | P1 | Attendee app open on a phone, then a new version is deployed | Close and reopen the app (or reload twice). | It comes up on the new version. The cache is per build, so a deploy cannot leave a phone on the old one — or worse, on a shell whose files the deploy deleted. |
| CRS-15 | P1 | A phone (or a 375px window) | Open all four sign-ins: /login, /tenant/login, the admin panel, the door app. | Each one is a single column — brand on top, form below it at full width, fields and the Sign in button big enough to tap. Nothing scrolls sideways and the brand appears once, not twice. |
| CRS-16 | P2 | The door app on a phone | Look at the sign-in fields and the Show button. | They are styled like the other apps — rounded fields with an icon, a Show/Hide toggle on the password. Plain browser boxes mean the stylesheet is not matching the markup. |

## Door crew app

*The door crew's own app (port 5175 / 8087): class attendance, goodiebags and pins.*

| ID | Pri | Precondition | Steps | Expected result |
|---|---|---|---|---|
| DOOR-01 | P1 | Signed out | Open /door/login and sign in as door@natcon.id / SEED_PASSWORD. | You land on Door Check-in with three modes: Class attendance, Goodiebag, Pin — and the address becomes /door. |
| DOOR-02 | P1 | Signed out | Try an ATTENDEE email and password. | Refused with 'That is not a door account. Ask the committee for the door login.' — not a wall of errors on the next screen. |
| DOOR-03 | P1 | Signed out | Sign in with the wrong password. | It says the password is wrong. It must NOT say the session expired. |
| DOOR-04 | P1 | Door app, Class attendance mode | Pick a class and scan an attendee registered for it. | Attendance recorded, with their name and chapter. Scanning again says they are already checked in. |
| DOOR-05 | P1 | Door app, Class attendance mode | Scan an attendee NOT registered for that class. | Rejected clearly, naming the reason. |
| DOOR-06 | P1 | Door app, Goodiebag mode | Scan an attendee. | 'Goodiebag handed over' with their name; the counter moves. The class picker is hidden in this mode. |
| DOOR-07 | P1 | Door app, Goodiebag mode | Scan the same attendee again. | 'Already collected — <name> took it at HH:MM'. The time is what settles an argument at the desk. |
| DOOR-08 | P1 | Door app, Pin mode | Scan an attendee who already has their goodiebag. | The pin is handed over: the two are counted separately. |
| DOOR-09 | P2 | Door app | Type a member code, an email, and a phone number into the manual box. | All three find the attendee — a phone that will not scan must not stop the queue. |
| DOOR-10 | P1 | Signed in to the door app | Look for the attendee list, master data, reports or the draws. | None of it exists here, and the API refuses a door account those pages. That separation is why this app exists. |

## Test data

| What | Value | Notes |
|---|---|---|
| Admin | admin@natcon.id / natcon2026 | Created by the seeder if no admin exists |
| Admin | admin@natcon.id / SEED_PASSWORD | The only account a fresh database has |
| Attendees | already there — 769 from the ticketing export | Seeded by migration 0028. Password = chapter + first name, lowercase, no spaces; they must change it on first sign-in. |
| Booths | already there — 32 booths + 4 sponsors from the booth sheet | login booth-<code>@natcon.id on SEED_PASSWORD, following the stand — Paper.id is on A20, so booth-a20@natcon.id. The seed password only opens the door once: each crew sets their own on first sign-in. Alpha leaders holds two stands as one booth, 'A47 & A48', logging in as booth-a47@natcon.id. |
| Networking tables | Tables page → Generate | none exist until the committee makes them |
| Sponsor scanner | booth-b1@natcon.id / SEED_PASSWORD | Bio Medika · booth B1 — the sheet's own Sponsor divider made it a sponsor |
| Booth login pattern | booth-<code without dashes>@natcon.id | Booth login pattern: A1 → booth-a1@natcon.id, SP-01 → booth-sp01@natcon.id |
| Imported attendee password | chapter + first name, lowercase, no spaces | Heritage + Fahmi → heritagefahmi |
| Unknown member code | NATCON-2026-99999 | For the not-found cases |
| Table QR payload | TABLE:5 | What the QR Prints page prints |
| Class QR payload | SEMINAR:<id> | Scanned on Door Check-in to switch room |
| Booth QR payload | BOOTH:A1 | Booth signage |
| Learning classes | Rooms 1–4, 60 seats each | Give each one a rundown block before testing the two-class rule |
| Attendee app | http://localhost:5173 |  |
| Admin panel | http://localhost:5174 |  |
| Attendee sign-in | http://localhost:5173/login | The door printed on the attendee ticket |
| Booth sign-in | http://localhost:5173/tenant/login | The door given to booth and sponsor crews |
| Attendee QR payload | their ticket number, e.g. 16C6C-23BBA1745 | What the pass QR carries. The member code under it still scans. |
| Unknown ticket number | 16C6C-NOSUCHTICKET | For the not-found cases at any scanner |
| Rundown | 10 draft blocks: 9 on 3 Sep (07:00 → 18:00) + Gold Club Breakfast 4 Sep 08:00–11:00 | Seeded only when the schedule is empty; two of them are Learning Class blocks |
| Door crew app | /door/login | Its own path, like /login and /tenant/login. The bare address redirects there. |

## Coverage

| Section | Cases | P1 |
|---|---|---|
| Auth | 22 | 13 |
| Attendee | 35 | 23 |
| Booth scanner | 19 | 13 |
| Admin master data | 45 | 36 |
| Admin operations | 38 | 25 |
| Reports & export | 12 | 9 |
| Cross-cutting | 16 | 6 |
| Door crew app | 10 | 9 |
| **Total** | **197** | **134** |
