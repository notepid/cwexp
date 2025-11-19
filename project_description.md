Simple web app where the user is managing a CW pileup. The software works by letting the operator enter callsigns into a list (backlog) and then the program (web client) goes through the backlog and generates CW tones for each callsign in the backlog.

The software must be configurable in the webclient to allow:
* words per minute (CW WPM)
* delay between backlog items
* dit tone audio frequency
* dah tone audio frequency

No authentication but multiple users. However, only one webclient can be the audio output (selectable with confirmation).

Sound is played using the standard browser api for sound.