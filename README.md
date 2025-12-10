# 🍃 Tea Disease Detection Web App

A modern React web application for detecting tea plant diseases using AI, integrated with Firebase for authentication and data storage.

## ✨ Features

- 🔐 **Authentication**: Email/Password and Google Sign-In
- 📸 **Disease Detection**: Upload images for AI-powered disease detection
- 📊 **Analytics**: View disease distribution and health trends
- 🗺️ **Map View**: Visualize scans with location data
- 📜 **History**: Track all previous scans with search and filters
- 👤 **Profile**: Manage account settings and profile photo
- 🎨 **Modern UI**: Clean, responsive design with Tailwind CSS

## 🚀 Quick Start

### Prerequisites

- Node.js 16+ and npm
- Firebase project (already configured in `src/firebase/config.js`)

### Installation

```bash
cd tea-disease-webapp

# Install dependencies
npm install

# Start development server
npm start
```

The app will open at `http://localhost:3000`

### Build for Production

```bash
npm run build
```

This creates an optimized build in the `build/` folder.

## 📁 Project Structure

```
tea-disease-webapp/
├── public/
│   └── index.html
├── src/
│   ├── firebase/
│   │   ├── config.js          # Firebase configuration
│   │   ├── auth.js             # Authentication functions
│   │   └── firestore.js        # Firestore operations
│   ├── components/
│   │   ├── Auth/
│   │   │   ├── Login.jsx       # Login page
│   │   │   ├── Register.jsx    # Registration page
│   │   │   └── PrivateRoute.jsx # Protected route wrapper
│   │   ├── Dashboard/
│   │   │   ├── Dashboard.jsx   # Main dashboard
│   │   │   ├── Upload.jsx      # Disease detection upload
│   │   │   ├── History.jsx     # Scan history
│   │   │   ├── Map.jsx         # Map view
│   │   │   ├── Analytics.jsx   # Analytics & insights
│   │   │   └── Profile.jsx     # User profile
│   │   └── Layout/
│   │       ├── Navbar.jsx      # Top navigation bar
│   │       └── Sidebar.jsx     # Side navigation menu
│   ├── context/
│   │   └── AuthContext.js      # Authentication context
│   ├── utils/
│   │   └── imageUtils.js       # Image compression utilities
│   ├── App.js                  # Main app component
│   ├── index.js                # App entry point
│   └── index.css               # Global styles
├── tailwind.config.js          # Tailwind CSS configuration
├── package.json                # Dependencies
└── README.md                   # This file
```

## 🔥 Firebase Configuration

The app is already configured with your Firebase project:

- **Project ID**: `teahealth-6d55b`
- **Authentication**: Email/Password, Google
- **Firestore**: User profiles and scan data
- **Storage**: Base64 images stored in Firestore

### Firestore Structure

```
users/
  {userId}/
    - displayName: string
    - email: string
    - photoB64: string (base64 image)
    - photoURL: string
    - createdAt: timestamp
    - updatedAt: timestamp

    scans/
      {scanId}/
        - imageB64: string (base64 image)
        - label: string (disease name)
        - confidence: number (0-1)
        - geo: GeoPoint (latitude, longitude)
        - locName: string (location name)
        - source: string ("image" or "video")
        - createdAt: timestamp
        - createdAtMs: number
```

## 🎯 Usage

### 1. Authentication

- **Sign Up**: Create an account with email/password or Google
- **Sign In**: Login with your credentials
- **Password Reset**: Request password reset via email

### 2. Upload & Detect

1. Navigate to **New Scan**
2. Upload a tea leaf image
3. Click **Detect Disease**
4. View results with confidence score and recommendations
5. Scan is automatically saved to your history

### 3. View History

- Browse all your previous scans
- Search by disease or location
- Filter by disease type
- Click any scan to view details
- Delete unwanted scans

### 4. Map View

- View scans with location data on an interactive map
- Click location markers to see scan details
- Filter by disease type with the legend

### 5. Analytics

- View total scans and health statistics
- See disease distribution breakdown
- Track recent activity (last 7 days)
- Get insights and recommendations

### 6. Profile Management

- Update display name and email
- Upload profile photo (compressed automatically)
- Change password
- Sign out

## 🛠️ Key Technologies

- **React 18**: Modern React with hooks
- **Firebase 10**: Authentication, Firestore, Analytics
- **React Router 6**: Client-side routing
- **Tailwind CSS 3**: Utility-first styling
- **Lucide React**: Beautiful icon library
- **React Toastify**: Toast notifications

## 📝 Environment Variables

No `.env` file needed! Firebase config is already set in `src/firebase/config.js`.

To use your own Firebase project:

1. Create a Firebase project at https://console.firebase.google.com
2. Enable Authentication (Email/Password, Google)
3. Create a Firestore database
4. Replace the config in `src/firebase/config.js`

## 🔒 Security Rules

Ensure your Firestore security rules allow authenticated users to read/write their own data:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;

      match /scans/{scanId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

## 🚨 Disease Detection API

The Upload component has a placeholder for your AI detection API:

```javascript
// In src/components/Dashboard/Upload.jsx
const response = await fetch("YOUR_API_ENDPOINT_HERE", {
  method: "POST",
  body: formData,
});
```

Replace `'YOUR_API_ENDPOINT_HERE'` with your actual API endpoint.

## 🎨 Customization

### Colors

Edit `tailwind.config.js` to change the primary color scheme:

```javascript
colors: {
  primary: {
    500: '#22c55e', // Change this
    600: '#16a34a', // And this
  },
}
```

### Disease Types

Disease colors and info are defined in each component. Search for `getDiseaseColor()` and `getDiseaseInfo()` functions to customize.

## 📱 Responsive Design

The app is fully responsive and works on:

- 📱 Mobile phones (320px+)
- 📱 Tablets (768px+)
- 💻 Desktops (1024px+)
- 🖥️ Large screens (1536px+)

## 🐛 Troubleshooting

### Build Errors

```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Firebase Errors

- Check that Firebase config is correct
- Ensure Authentication methods are enabled
- Verify Firestore security rules
- Check browser console for detailed errors

### Image Upload Issues

- Images are compressed to ~800KB automatically
- Maximum supported size: ~10MB original
- Supported formats: JPG, PNG, WEBP

## 📄 License

MIT License - feel free to use this project for personal or commercial purposes.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📧 Support

For issues or questions, please open an issue on GitHub.

---

**Made with 🍃 for Tea Health Monitoring**
