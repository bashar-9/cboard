# Local Mode

- One laptop runs CBoard and opens it as the Host.
- One Receiver opens the Host's local address on the same router.
- Internet is not required.
- Public opens from the main local address.
- Private opens from the short secret link shown to the Host.
- Both rooms remain connected while the user changes tabs.
- Text and files move browser-to-browser and expire after 15 minutes.

The local server only coordinates the connection. It checks the page origin, limits signaling message size, allows one Host and one Receiver per room, and never stores shared content.

If the Host laptop sleeps, the server stops, or the Host browser closes, sharing ends until it is reopened.
