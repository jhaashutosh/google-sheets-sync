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

## Dynamic Table and Trigger Creation

This application supports dynamic creation of tables and triggers based on the data from Google Sheets. If the database does not have the required tables, triggers, or columns, the application will automatically create them during the initial sync. 

### How It Works

1. **Initial Sync and Table Creation:**
   - When the application is initialized, it first checks whether the necessary tables and triggers exist in the database.
   - If the tables are missing, the application will create them based on the structure of the Google Sheets data. This includes generating column names dynamically and inserting initial data into the newly created tables.

2. **Dynamic Trigger Creation:**
   - After creating the tables, the application will also create database triggers that help maintain synchronization between Google Sheets and the database.
   - These triggers are automatically set up to log any changes (insert, update, delete) in the database to a `sync_log` table, which is then used to update Google Sheets accordingly.

3. **Automatic Column Addition:**
   - The application also checks if any new columns have been added to Google Sheets. If such columns are not present in the existing database tables, they are automatically added to the corresponding tables in the database.

### Advantages

- **Automated Setup:** This feature simplifies the setup process by automatically creating necessary database schemas and triggers without requiring manual intervention.
- **Real-Time Synchronization:** Ensures that both Google Sheets and the database remain in sync with minimal latency.
- **Scalability:** As the data structure in Google Sheets changes over time, the database schema evolves dynamically, allowing for seamless integration of new data fields.

### Example Workflow

- Upon receiving the first webhook from Google Sheets, the application:
  1. Checks if the corresponding table exists in the database.
  2. If the table does not exist, it creates the table and the required triggers.
  3. If the table exists but is missing columns, those columns are added dynamically.
  4. The triggers ensure that any changes in the database are logged and propagated back to Google Sheets.

This setup allows for a robust, scalable synchronization mechanism that adapts to changes in Google Sheets structure over time.


## Scalability - (Future Scope)

To improve the scalability of the synchronization system, the following enhancements can be implemented:

- **Message Queues (Kafka or RabbitMQ)**:
  - Introducing a message broker like Kafka or RabbitMQ can help manage high-throughput data and ensure reliable messaging between the Google Sheets and the database.
  - This can decouple the services, making the system more resilient and scalable, especially under heavy load.

- **Node.js Clusters or Child Processes**:
  - Utilizing Node.js clusters or child processes can improve the scalability of the server by taking advantage of multi-core processors.
  - This allows multiple instances of the synchronization service to run concurrently, distributing the load and improving performance.

## Project Demonstration

Click the image below to watch a video demonstration of the project:

[![Watch the video](https://blog.coupler.io/wp-content/uploads/2021/07/coupler.io_.png)](https://youtu.be/XHp7zejJcAs)

Or you can watch it [here](https://youtu.be/XHp7zejJcAs).