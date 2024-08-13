# Real-Time Database and Google Sheets Synchronization

This project aims to achieve real-time synchronization between a MySQL database and Google Sheets, ensuring that changes in either are instantly reflected in the other.

## Approach and Methods

### 1. Initial Polling Method
- **Polling Frequency**: Every 5 seconds.
- **Process**:
  - Both the MySQL database and Google Sheets were checked for changes every 5 seconds.
  - If a change was detected, synchronization between the two was performed.
- **Drawback**:
  - This method was not real-time, leading to a potential delay of up to 5 seconds before changes were reflected.

### 2. Google Sheets Triggers with Database Polling
- **Google Sheets Synchronization**:
  - Implemented Google Sheets triggers using Google Apps Script.
  - The script detects changes in the spreadsheet and sends the updated data, along with its location, to a webhook.
  - The webhook handles the update and syncs the database accordingly.
- **Database Synchronization**:
  - Continued using polling for the database since users are less likely to update the database directly.
- **Improvement**:
  - Provided better real-time synchronization from Google Sheets to the database but still relied on polling for database updates.

### 3. SQL Triggers and WebSockets (Work in Progress)
- **SQL Trigger Limitations**:
  - Explored using SQL triggers to call a webhook directly when changes occur in the database.
  - Found that MySQL does not support executing webhooks or using `sys_exec` commands within triggers.
- **WebSocket Solution**:
  - Began working on a WebSocket-based approach to replace polling.
  - The server listens for changes in the database and immediately syncs them with Google Sheets in real-time.
  - This approach is still under development and aims to provide a more efficient and real-time synchronization method.

## Conflict Resolution

- **Strategy**: Last Write Wins (LWW).
  - In the event of a conflict (where both Google Sheets and the database have conflicting changes), the system adopts a "last write wins" approach.
  - **Process**:
    - The most recent change, whether from the database or Google Sheets, is kept.
  - **Future Extension**:
    - The conflict resolution strategy can be extended to support user-defined rules, allowing more granular control over how conflicts are handled.
    - For now, the default behavior prioritizes the last modification made.

 ## Project Demonstration

Click the image below to watch a video demonstration of the project:

[![Watch the video](https://blog.coupler.io/wp-content/uploads/2021/07/coupler.io_.png)](https://youtu.be/XHp7zejJcAs)

Or you can watch it [here](https://youtu.be/XHp7zejJcAs).