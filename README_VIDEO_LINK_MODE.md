# CIBI Video Link Mode

CIBI is now configured to save storage money by not uploading recorded course videos to cloud storage.

## How videos work now

1. Lecturer/Admin uploads the video to YouTube as **Unlisted**.
2. Lecturer/Admin opens the course inside CIBI.
3. Click **Add Video**.
4. Paste the YouTube video/live/shorts/embed link.
5. CIBI saves only the title, description, chapter number, provider and YouTube video ID in PostgreSQL.
6. Students play the video inside a customized CIBI player.

## What this saves

- No Bunny video storage cost.
- No Bunny video bandwidth cost.
- No video files stored on Render disk.
- No 500MB upload pressure on the backend.

## Protection level

The CIBI player hides normal YouTube controls, right-click context menu, download button and visible redirect buttons. Students stay inside the CIBI course page.

Important: any video hosted on YouTube cannot be made 100% piracy-proof. A technical user may still inspect browser network/source code and identify the YouTube video ID. For maximum protection, use Bunny signed URLs or another DRM/protected streaming provider later.

## Backend endpoint kept

The old endpoint path is kept for frontend compatibility:

```txt
POST /api/courses/:courseId/videos/upload
```

But it now accepts JSON instead of a video file:

```json
{
  "title": "Introduction to Biblical Studies",
  "description": "Welcome lesson",
  "chapter": 1,
  "videoUrl": "https://youtu.be/VIDEO_ID"
}
```

## Database migration added

```txt
server/prisma/migrations/20260701214500_external_course_video_links/migration.sql
```

This makes old Bunny video fields optional and adds:

- videoUrl
- provider
- externalVideoId
- embedUrl
