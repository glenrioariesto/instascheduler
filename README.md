# Instascheduler

A personal Instagram scheduler that automates posting using Google Sheets as a database and Google Drive for media storage.

## Features

- **Database**: Uses Google Sheets to manage scheduled posts (dates, captions, media URLs).
- **Storage**: Uses Google Drive to host images and videos.
- **Automation**: Automatically uploads content to Instagram using the Instagram Graph API.
- **Media Support**: Supports single images, videos, and carousel posts.

## Architecture

1.  **Google Sheets**: Acts as the command center. You add rows with:
    - `ID`: Unique identifier for the post.
    - `Date`: Scheduled time (ISO format).
    - `Caption`: Post caption.
    - `URLs`: Comma-separated Google Drive links (view or download links).
    - `Types`: Comma-separated types (`IMAGE` or `VIDEO`).
2.  **Google Drive**: Stores the actual media files. The application automatically converts view links to direct download links for the API.
3.  **Instagram Graph API**: Handles the actual publishing to your Instagram Business account.

## Setup

### Prerequisites
- Node.js installed.
- A Google Cloud Project with **Google Sheets API** enabled.
- A Meta (Facebook) Developer App with **Instagram Graph API** permission.
- An Instagram Business Account linked to a Facebook Page.

### Configuration
1.  Clone the repository.
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Configure your keys in the application settings (or `.env` if implemented):
    - `Google Sheet ID`
    - `Google Access Token` (or API Key)
    - `Instagram Account ID`
    - `Instagram Access Token`

## Usage

1.  Start the application:
    ```bash
    npm run dev
    ```
2.  Open the scheduler interface.
3.  Ensure your Google Sheet is populated.
4.  The app will fetch pending posts and schedule/publish them based on the time.

## Tech Stack
- React (Vite)
- TypeScript
- TailwindCSS (if applicable) / CSS
- Google Sheets API
- Instagram Graph API
