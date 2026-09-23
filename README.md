# Instagram Backend

Backend API for an **Instagram-style social media application** built with NestJS, TypeScript, PostgreSQL, and Prisma.

The backend provides authentication, posts, likes, profiles, pagination, image uploads, duplicate detection, rate limiting, and secure token management for the Flutter mobile application.

---

## 🚀 Features

* 🔐 JWT authentication
* 🔄 Access and refresh token authentication
* 📱 Mobile-specific API endpoints
* 👤 User registration and login
* 🖼️ Image post uploads
* ☁️ Cloudinary image storage
* ❤️ Post likes
* 👤 User profiles
* 📄 Paginated feeds
* ♾️ Infinite scrolling support
* 🔍 SHA-256 duplicate image detection
* 🛡️ Rate limiting / throttling
* ⚠️ Structured HTTP error handling
* 🗄️ PostgreSQL database with Prisma ORM
* 🚀 Deployed backend on Render

---

## 🏗️ Architecture


Flutter Mobile App
        │
        ▼
 NestJS REST API
        │
 ┌──────┼───────────────┐
 │      │               │
Auth  Controllers     Services
 │      │               │
 └──────┼───────────────┘
        │
      Prisma
        │
        ▼
   PostgreSQL

External Services
├── Cloudinary
└── Render


The backend follows a modular structure where authentication, users, posts, likes, and other responsibilities are separated into their respective areas.

---

## 📱 Mobile API

The backend provides dedicated mobile API routes using the `/mobile` prefix.

Authentication routes include:


/auth/register
/auth/login
/auth/refresh


Mobile-specific operations are exposed through routes under:


/mobile/...


This keeps the API structure organized around the requirements of the Flutter application.

---

## 🔐 Authentication

The application uses **JWT access and refresh tokens**.

### Token flow

Login / Register
       ↓
Backend validates user
       ↓
Access Token + Refresh Token
       ↓
Client securely stores tokens
       ↓
Access Token used for requests
       ↓
Access Token expires
       ↓
Refresh Token sent to /auth/refresh
       ↓
Backend validates refresh token
       ↓
New Access Token


The Flutter application stores authentication tokens securely and uses the refresh-token flow when the access token expires.

### Token lifetime

* Access token: **5 minutes**
* Refresh token: **7 days**

---

## 🖼️ Post System

Authenticated users can create image posts.

The backend handles:

* Image upload
* Post creation
* Post retrieval
* User-specific posts
* Paginated feeds
* Like information
* Cloudinary image storage

Example post data contains information such as:


{
  "id": 1,
  "userId": 6,
  "name": "User",
  "postUrl": "...",
  "likes": 10,
  "isLiked": true
}


---

## 🔍 Duplicate Image Detection

The backend uses **SHA-256 hashing** to prevent duplicate image uploads.


Image Upload
     ↓
Generate SHA-256 hash
     ↓
Check imageHash in database
     ↓
Already exists?
   ↙        ↘
 YES        NO
  ↓          ↓
409       Continue
Conflict    Upload


The image hash is stored with the post.

If another upload contains the same image, the backend returns a `409 Conflict` instead of creating another post.

---

## ☁️ Cloudinary

Uploaded post images are stored using **Cloudinary**.


Flutter App
    ↓
NestJS API
    ↓
Validate Image
    ↓
Generate SHA-256 Hash
    ↓
Check Duplicate
    ↓
Cloudinary
    ↓
Store Image URL
    ↓
PostgreSQL

The backend uses Cloudinary for media storage rather than storing image files directly in PostgreSQL.

---

## ❤️ Like System

Users can like posts.

Each like is associated with:


userId
postId


The database uses a composite unique constraint to prevent duplicate likes:


@@unique([userId, postId])


The backend also checks whether the user has already liked a post before creating a new like.

If a duplicate like is attempted, the API returns:


409 Conflict


This provides protection both at the application level and database level.

---

## 📄 Pagination & Infinite Scrolling

The feed supports paginated requests so the application does not load every post at once.

Example:


/mobile/posts?page=1&limit=5


The Flutter application uses these paginated responses to implement **infinite scrolling**.


Load first page
      ↓
User scrolls
      ↓
Request next page
      ↓
Append posts
      ↓
Continue until all posts are loaded


---

## 🛡️ Rate Limiting

The API uses request throttling to help prevent excessive requests.

The throttling configuration uses a time-based request limit to protect the backend from abusive or unexpectedly high request rates.

---

## ⚠️ Error Handling

The backend uses standard HTTP status codes for API errors.

| Status | Meaning               |
| ------ | --------------------- |
| `400`  | Bad Request           |
| `401`  | Unauthorized          |
| `404`  | Resource Not Found    |
| `409`  | Conflict / Duplicate  |
| `429`  | Too Many Requests     |
| `500`  | Internal Server Error |

The Flutter application maps these responses into structured application exceptions so the UI can display appropriate error states.

---

## 🗄️ Database

The project uses:

* **PostgreSQL**
* **Prisma ORM**

The database manages relationships between users, posts, and likes.

The like relationship uses a composite uniqueness constraint:

```prisma
@@unique([userId, postId])
```

This ensures that a user cannot have multiple like records for the same post.

---

## 🛠️ Tech Stack

| Technology | Purpose                     |
| ---------- | --------------------------- |
| NestJS     | Backend framework           |
| TypeScript | Programming language        |
| Prisma     | ORM                         |
| PostgreSQL | Database                    |
| JWT        | Authentication              |
| Cloudinary | Image storage               |
| Render     | Backend deployment          |
| REST API   | Client-server communication |

---

## 📁 Project Structure


src/
├── auth/
├── users/
├── posts/
├── likes/
└── ...


The backend is organized around application features such as authentication, users, posts, and likes.

---

## ⚙️ Getting Started

### 1. Clone the repository


git clone https://github.com/Prakash777-code/InstagramBackend-.git
cd InstagramBackend-


### 2. Install dependencies


npm install


### 3. Configure environment variables

Create a `.env` file containing the required database, JWT, and Cloudinary configuration.

Example:


DATABASE_URL=your_database_url

JWT_ACCESS_SECRET=your_access_secret
JWT_REFRESH_SECRET=your_refresh_secret

CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret


### 4. Generate Prisma Client


npx prisma generate


### 5. Run the development server


npm run start:dev


---

## 🌐 Live Backend

The backend is deployed on Render.

https://instagrambackend-aeed.onrender.com

---

## 🔗 Related Repository

### Flutter Mobile App

https://github.com/Prakash777-code/InstagramApp

---

## 📖 What I Learned

Building this backend gave me practical experience with:

* Designing REST APIs using NestJS
* JWT authentication and refresh-token flows
* Secure token handling
* Prisma and PostgreSQL relationships
* Database-level uniqueness constraints
* Image uploads with Cloudinary
* SHA-256 duplicate detection
* Pagination and infinite scrolling APIs
* Rate limiting
* Structured API error handling
* Connecting a Flutter application to a deployed backend
* Deploying a NestJS API using Render

---

## 📄 License

This project was built for learning and portfolio purposes.
