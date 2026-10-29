# Test videos from a Mac local or external disk

The project includes a **development-only macOS video test mode** that works without Docker, PostgreSQL, cloud hosting, or copying files.

## 1. Connect a disk and find a small folder

In macOS Terminal:

```bash
ls /Volumes
```

Pick a **small NPTEL course folder** that includes a few MP4 files, for example `/Volumes/CollegeDrive/NPTEL/Computer Science/Algorithms`. Mac internal folders such as `$HOME/Movies/NPTEL` work too. Do not select the root of a 90 TB disk for the first test.

## 2. Download the application and launch

Requirements: macOS, Node.js 22 or newer, Git, and read access to your chosen folder.

```bash
git clone https://github.com/thinkbulb9-cmd/mremdigital.git
cd mremdigital
bash scripts/mac-video-test.sh "/Volumes/CollegeDrive/NPTEL/Computer Science/Algorithms"
```

Replace the example folder path with your exact mounted volume and folder path (keep the quotes around paths with spaces). The script checks the folder; creates a unique local login password and session secret in `.env.local` if needed; installs dependencies; and runs Next.js on **127.0.0.1**. The first setup displays the password once. For subsequent runs, your password is in your local `.env.local`.

Open **http://127.0.0.1:3000**, sign in, select **All departments** or **Videos**, and click **Play** on an indexed MP4. You can pause/seek with the video controls, preview PDF/TXT, and download documents. File copies are not made.

If the port is already in use, stop the other process. Stop the portal with Ctrl+C.

To switch to another folder, stop the server and rerun with another path. The folder is scanned on request with safety caps of 1,500 files, 12,000 entries, and seven levels of subfolders; these caps are intentional for a small pilot. The source folder remains read-only from the application's perspective.

## 3. Verify video streaming

Open Safari or Chrome, click Play and seek to a different timestamp. The file endpoint supports HTTP `Range` and sends `206 Partial Content` for valid requests. Use browser DevTools / Network to inspect responses. Common browser-friendly video types include MP4 with H.264 video and AAC audio, and many WebM files. MOV can work on Safari, depending on codecs. MKV/AVI can be catalogued and downloaded but are not promised in-browser playback.

If video plays in VLC but not the browser, check codecs with `ffprobe` (optional; included with FFmpeg):
```bash
ffprobe -v error -show_entries stream=codec_name,codec_type -of compact "/Volumes/CollegeDrive/NPTEL/OneCourse/Lecture01.mp4"
```

For unsupported codecs, transcode **only a separate small test copy** using FFmpeg; do not alter original college/NPTEL recordings.

## Boundaries and security

- This test runs on the Mac, not on Vercel. The public Vercel URL still displays synthetic demo files.
- The Mac must be powered on and its disk mounted while the site is used.
- The server listens only on loopback (`127.0.0.1`); do not expose it to the public internet, configure router port-forwarding, or disable the password. This pilot is not production SSO or RBAC.
- The disk's data is not uploaded to GitHub, Vercel, ChatGPT, or a cloud server.
- Reading files via the application is non-mutating; for hard guarantees use OS-level read-only mounts or permissions.
- In the production on-campus deployment use PostgreSQL indexing, institutional authentication, hardened streaming and a proper permission model.

## If you already cloned the project

```bash
cd mremdigital
git pull origin main
bash scripts/mac-video-test.sh "/Volumes/CollegeDrive/NPTEL/OneCourse"
```
