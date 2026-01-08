# Spreadsheet Model Documentation

This document describes the structure of the Google Sheet used by Instascheduler.

## Tab: Schedules (and other profile tabs)

The "Schedules" tab (and any other tab assigned to a profile) stores the content calendar.

| Column Index | Column Letter | Header Name | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| 0 | A | Day | Day of the week (Auto-generated) | Senin |
| 1 | B | Date | Date of the post (YYYY-MM-DD) | 2023-10-27 |
| 2 | C | Time | **[NEW]** Time of the post (HH:mm) | 14:30 |
| 3 | D | Theme | Content theme or category | Educational |
| 4 | E | Title | Hook or headline | 5 Tips for React |
| 5 | F | Caption | Post caption | Here are 5 tips... |
| 6 | G | Script | Short video script or notes | Intro: Wave hand... |
| 7 | H | CTA | Call to Action | Link in bio! |
| 8 | I | Status | Post status (pending, published, failed) | pending |
| 9 | J | Media URLs | Comma-separated ImageKit URLs | https://ik.imagekit.io/..., ... |

> [!IMPORTANT]
> **Column Shift**: The "Time" column was added at Index 2 (Column C). All subsequent columns (Theme, Title, etc.) have been shifted to the right by 1.
