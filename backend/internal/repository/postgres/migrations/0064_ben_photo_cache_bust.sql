-- Ben Wirawan's new portrait replaced the old file under the SAME name, so
-- phones kept serving the cached original. The file moves to a fresh name —
-- a URL no cache has ever seen — and every stored reference follows.

UPDATE seminar_speakers
SET photo_url = '/speakers/ben-wirawan-torch.jpg'
WHERE photo_url = '/speakers/ben-wirawan.jpg';
